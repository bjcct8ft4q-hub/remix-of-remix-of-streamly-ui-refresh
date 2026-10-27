import { createFileRoute } from "@tanstack/react-router";

// Public, read-only anime source lookups (episode maps, episode lists, stream links).
// Returns only public third-party data; no user data is touched here.
export const Route = createFileRoute("/api/public/kitsune/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const splat = (params as { _splat?: string })._splat ?? "";
        if (!/^(map|episodes|watch|stream)\/[\w/-]+$/.test(splat)) return Response.json({ error: "Not found" }, { status: 404 });
        const { default: providerWorker } = await import("@/server/kitsune/providers/index.js");
        const url = new URL(request.url);
        const target = new URL(`/${splat}${url.search}`, url.origin);
        try {
          const res: Response = await providerWorker.fetch(new Request(target.toString(), { headers: request.headers }), {});
          if (!res.ok && splat.startsWith("watch/")) {
            const body = await res.json().catch(() => ({}));
            return Response.json({ streams: [], subtitles: [], error: (body as { error?: string }).error || `Source returned ${res.status}` });
          }
          return res;
        } catch (e) {
          return Response.json({ streams: [], subtitles: [], error: e instanceof Error ? e.message : String(e) }, { status: 502 });
        }
      },
    },
  },
});
