const STATE_TTL_SECONDS = 600;

function randomSlug() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function getUser(env, slug) {
  const raw = await env.USERS.get(slug);
  return raw ? JSON.parse(raw) : null;
}

export async function putUser(env, slug, record) {
  await env.USERS.put(slug, JSON.stringify(record));
}

export async function findSlugBySpotifyUserId(env, spotifyUserId) {
  return env.USER_INDEX.get(spotifyUserId);
}

export async function linkSlugToSpotifyUserId(env, spotifyUserId, slug) {
  await env.USER_INDEX.put(spotifyUserId, slug);
}

export async function createSlug(env) {
  return randomSlug();
}

export async function saveState(env, state) {
  await env.STATE.put(`state:${state}`, "pending", {
    expirationTtl: STATE_TTL_SECONDS,
  });
}

export async function consumeState(env, state) {
  const key = `state:${state}`;
  const value = await env.STATE.get(key);
  if (!value) return false;
  await env.STATE.delete(key);
  return true;
}
