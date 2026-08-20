import { getUser } from "./storage.js";
import { ensureFreshAccessToken, fetchCurrentlyPlaying } from "./spotify.js";

const CACHE_TTL_SECONDS = 5;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleOverlayPage(request, env, slug) {
  const user = await getUser(env, slug);
  if (!user) {
    return new Response("Overlay not found.", { status: 404 });
  }
  return env.ASSETS.fetch(new URL("/overlay.html", request.url));
}

export async function handleOverlayApi(request, env, slug) {
  const user = await getUser(env, slug);
  if (!user) {
    return jsonResponse({ error: "not_found" }, 404);
  }

  const cacheKey = new Request(new URL(`/__cache/o/${slug}`, request.url), request);
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached;
  }

  let fresh;
  try {
    fresh = await ensureFreshAccessToken(env, slug, user);
  } catch (err) {
    return jsonResponse({ error: "reauth_required" }, 401);
  }

  let nowPlaying;
  try {
    nowPlaying = await fetchCurrentlyPlaying(fresh.access_token);
  } catch (err) {
    if (err.code === "REAUTH_REQUIRED") {
      return jsonResponse({ error: "reauth_required" }, 401);
    }
    return jsonResponse({ error: "upstream_error" }, 502);
  }

  const response = jsonResponse(nowPlaying);
  response.headers.set("Cache-Control", `public, max-age=${CACHE_TTL_SECONDS}`);
  await cache.put(cacheKey, response.clone());
  return response;
}
