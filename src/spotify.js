import { putUser } from "./storage.js";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const CURRENTLY_PLAYING_URL =
  "https://api.spotify.com/v1/me/player/currently-playing";
const ME_URL = "https://api.spotify.com/v1/me";

const REFRESH_BUFFER_MS = 60 * 1000;

function basicAuthHeader(env) {
  return "Basic " + btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
}

export async function exchangeCodeForTokens(env, code, redirectUri) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(env),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    throw new Error(`Spotify token exchange failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchSpotifyProfile(accessToken) {
  const res = await fetch(ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Spotify profile fetch failed: ${res.status}`);
  }
  return res.json();
}

async function refreshAccessToken(env, refreshToken) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(env),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    throw new Error(`Spotify token refresh failed: ${res.status}`);
  }
  return res.json();
}

export async function ensureFreshAccessToken(env, slug, user) {
  if (user.access_token_expiry > Date.now() + REFRESH_BUFFER_MS) {
    return user;
  }
  const tokens = await refreshAccessToken(env, user.refresh_token);
  const updated = {
    ...user,
    access_token: tokens.access_token,
    access_token_expiry: Date.now() + tokens.expires_in * 1000,
    refresh_token: tokens.refresh_token || user.refresh_token,
  };
  await putUser(env, slug, updated);
  return updated;
}

export async function fetchCurrentlyPlaying(accessToken) {
  const res = await fetch(CURRENTLY_PLAYING_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 204) {
    return { playing: false };
  }
  if (res.status === 401) {
    const err = new Error("Spotify access revoked");
    err.code = "REAUTH_REQUIRED";
    throw err;
  }
  if (!res.ok) {
    throw new Error(`Spotify currently-playing fetch failed: ${res.status}`);
  }

  const data = await res.json();
  if (!data || !data.item) {
    return { playing: false };
  }

  const item = data.item;
  return {
    playing: Boolean(data.is_playing),
    track: item.name,
    artist: (item.artists || []).map((a) => a.name).join(", "),
    album_art_url: item.album?.images?.[0]?.url || null,
    progress_ms: data.progress_ms ?? 0,
    duration_ms: item.duration_ms ?? 0,
  };
}
