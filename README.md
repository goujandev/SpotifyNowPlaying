# Spotify Now Playing overlay for Twitch

A multi-tenant "now playing" widget. Streamers connect their Spotify account once and get a
unique overlay URL to add as an OBS Browser Source.

Cloudflare Workers, no build step, no npm dependencies.

## Setup

1. Create a Spotify app at https://developer.spotify.com/dashboard and set its redirect URI
   to `https://<your-worker-domain>/callback` (and `http://localhost:8787/callback` for local
   dev, added as an additional redirect URI).
2. Create the three KV namespaces and paste their ids into `wrangler.toml`:
   ```bash
   wrangler kv namespace create USERS
   wrangler kv namespace create USER_INDEX
   wrangler kv namespace create STATE
   ```
3. Set secrets:
   ```bash
   wrangler secret put SPOTIFY_CLIENT_ID
   wrangler secret put SPOTIFY_CLIENT_SECRET
   ```
4. `wrangler dev` for local development, `wrangler deploy` to ship.

## How it works

- `GET /` — landing page with a "Connect Spotify" button.
- `GET /connect` — starts the Spotify OAuth flow.
- `GET /callback` — OAuth redirect target; links the Spotify account to a random slug and
  shows the streamer their overlay URL (`/o/<slug>`).
- `GET /o/:slug` — the overlay page, meant to be added as an OBS Browser Source.
- `GET /api/o/:slug` — JSON polled by the overlay page every 8 seconds.

The slug is the only "credential" for a streamer's overlay — anyone with the URL can see
what they're currently playing. There's no login or revoke flow for v1; treat the URL like
you would any semi-private link.
