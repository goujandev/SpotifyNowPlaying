import {
  saveState,
  consumeState,
  createSlug,
  findSlugBySpotifyUserId,
  linkSlugToSpotifyUserId,
  putUser,
} from "./storage.js";
import { exchangeCodeForTokens, fetchSpotifyProfile } from "./spotify.js";

const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const SCOPE = "user-read-currently-playing user-read-playback-state";

function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function redirectUriFor(request) {
  const url = new URL(request.url);
  return `${url.origin}/callback`;
}

export async function handleConnect(request, env) {
  const state = randomState();
  await saveState(env, state);

  const params = new URLSearchParams({
    client_id: env.SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUriFor(request),
    scope: SCOPE,
    state,
  });

  return Response.redirect(`${AUTHORIZE_URL}?${params.toString()}`, 302);
}

export async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return new Response(`Spotify authorization was not completed: ${errorParam}`, {
      status: 400,
    });
  }
  if (!code || !state) {
    return new Response("Missing code or state.", { status: 400 });
  }

  const stateValid = await consumeState(env, state);
  if (!stateValid) {
    return new Response("Invalid or expired state.", { status: 400 });
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(env, code, redirectUriFor(request));
  } catch (err) {
    return new Response("Failed to exchange authorization code.", { status: 502 });
  }

  let profile;
  try {
    profile = await fetchSpotifyProfile(tokens.access_token);
  } catch (err) {
    return new Response("Failed to fetch Spotify profile.", { status: 502 });
  }

  const spotifyUserId = profile.id;
  let slug = await findSlugBySpotifyUserId(env, spotifyUserId);
  if (!slug) {
    slug = await createSlug(env);
    await linkSlugToSpotifyUserId(env, spotifyUserId, slug);
  }

  await putUser(env, slug, {
    spotify_user_id: spotifyUserId,
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
    access_token_expiry: Date.now() + tokens.expires_in * 1000,
    display_name: profile.display_name || spotifyUserId,
    created_at: Date.now(),
  });

  const overlayUrl = `${url.origin}/o/${slug}`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Overlay connected</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: system-ui, sans-serif; max-width: 640px; margin: 4rem auto; padding: 0 1.5rem; line-height: 1.5;">
<h1>Spotify connected</h1>
<p>Your overlay URL — add this as an OBS Browser Source:</p>
<p><code style="display:block; padding: 1rem; background: #f2f2f2; border-radius: 6px; word-break: break-all;">${overlayUrl}</code></p>
<p>This URL is unique to your Spotify account. Anyone with it can see what you're currently playing, so keep it out of public chat or screenshots.</p>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
