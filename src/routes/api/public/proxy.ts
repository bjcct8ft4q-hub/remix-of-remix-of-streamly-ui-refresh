import { createFileRoute } from "@tanstack/react-router";

// Video stream relay: rewrites HLS playlists so segments, keys and subtitles load through this app.
export const Route = createFileRoute("/api/public/proxy")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const target = new URL(request.url).searchParams.get("url") ?? "";
        if (!/^https?:\/\//i.test(target)) return new Response("Missing or invalid url", { status: 400 });
        const host = new URL(target).hostname;
        if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) || host.endsWith(".internal")) return new Response("Blocked", { status: 403 });
        const { handleHlsProxyRequest } = await import("@/server/kitsune/hls-proxy");
        return handleHlsProxyRequest(request.url, "/api/public/proxy");
      },
    },
  },
});
