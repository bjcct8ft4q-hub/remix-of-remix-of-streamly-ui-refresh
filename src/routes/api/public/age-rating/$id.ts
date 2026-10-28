import { createFileRoute } from "@tanstack/react-router";

type CachedRating = { rating: string | null; expires: number };
const ratings = new Map<number, CachedRating>();
const pending = new Map<number, Promise<string | null>>();
let nextRequestAt = 0;

async function getRating(id: number): Promise<string | null> {
  const cached = ratings.get(id);
  if (cached && cached.expires > Date.now()) return cached.rating;
  const existing = pending.get(id);
  if (existing) return existing;
  const task = (async () => {
    // Keep requests to the public Jikan API below its rate limit.
    const wait = Math.max(0, nextRequestAt - Date.now());
    nextRequestAt = Math.max(nextRequestAt, Date.now()) + 550;
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    try {
      const response = await fetch(`https://api.jikan.moe/v4/anime/${id}/full`, {
        signal: AbortSignal.timeout(7000),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return null;
      const json = await response.json() as { data?: { rating?: string | null } };
      const rating = json.data?.rating?.split(" - ")[0]?.trim() || null;
      ratings.set(id, { rating, expires: Date.now() + (rating ? 86400000 : 3600000) });
      return rating;
    } catch {
      return null;
    }
  })();
  pending.set(id, task);
  try { return await task; } finally { pending.delete(id); }
}

export const Route = createFileRoute("/api/public/age-rating/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = Number(params.id);
        if (!Number.isSafeInteger(id) || id < 1) {
          return Response.json({ error: "Invalid MyAnimeList ID" }, { status: 400 });
        }
        const rating = await getRating(id);
        return Response.json({ rating }, {
          headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
        });
      },
    },
  },
});
