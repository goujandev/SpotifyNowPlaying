import { handleConnect, handleCallback } from "./oauth.js";
import { handleOverlayPage, handleOverlayApi } from "./overlay.js";

const OVERLAY_PAGE_RE = /^\/o\/([A-Za-z0-9_-]+)$/;
const OVERLAY_API_RE = /^\/api\/o\/([A-Za-z0-9_-]+)$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    try {
      if (request.method === "GET" && pathname === "/connect") {
        return handleConnect(request, env);
      }

      if (request.method === "GET" && pathname === "/callback") {
        return handleCallback(request, env);
      }

      const pageMatch = pathname.match(OVERLAY_PAGE_RE);
      if (request.method === "GET" && pageMatch) {
        return handleOverlayPage(request, env, pageMatch[1]);
      }

      const apiMatch = pathname.match(OVERLAY_API_RE);
      if (request.method === "GET" && apiMatch) {
        return handleOverlayApi(request, env, apiMatch[1]);
      }

      return env.ASSETS.fetch(request);
    } catch (err) {
      return new Response(JSON.stringify({ error: "internal_error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
