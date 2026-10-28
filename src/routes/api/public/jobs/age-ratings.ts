import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Import one small AniList page per invocation; call repeatedly with page=1,2,...
// A small batch avoids overwhelming Jikan and Vercel's execution limits.
export const Route = createFileRoute("/api/public/jobs/age-ratings")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const url = new URL(request.url);
        const page = Number(url.searchParams.get("page") || "1");
        if (!Number.isSafeInteger(page) || page < 1 || page > 10000) {
          return Response.json({ error: "Invalid page" }, { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const query = `query ($page: Int) { Page(page: $page, perPage: 10) { pageInfo { hasNextPage total } media(type: ANIME, sort: POPULARITY_DESC) { idMal } } }`;
        const response = await fetch("https://graphql.anilist.co", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, variables: { page } }), signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) return Response.json({ error: "AniList unavailable", status: response.status }, { status: 502 });
        const payload = await response.json() as { data?: { Page?: { pageInfo?: { hasNextPage: boolean; total: number }; media?: { idMal?: number | null }[] } } };
        const ids = [...new Set((payload.data?.Page?.media || []).map(a => a.idMal).filter((id): id is number => Number.isSafeInteger(id) && !!id))];
        const { data: existing, error: dbError } = await supabaseAdmin.from("anime_age_ratings").select("mal_id,source,updated_at").in("mal_id", ids.length ? ids : [-1]);
        if (dbError) return Response.json({ error: "Database read failed", detail: dbError.message }, { status: 500 });
        const current = new Map((existing || []).map(row => [row.mal_id, row]));
        let saved = 0, skipped = 0, failed = 0;
        for (const id of ids) {
          const row = current.get(id);
          if (row && (row.source === "admin" || Date.now() - new Date(row.updated_at).getTime() < 7 * 86400000)) { skipped++; continue; }
          try {
            const result = await fetch(`https://api.jikan.moe/v4/anime/${id}`, { signal: AbortSignal.timeout(7000) });
            if (result.status === 429) { failed++; break; }
            if (!result.ok) { failed++; continue; }
            const json = await result.json() as { data?: { rating?: string | null } };
            const rating = json.data?.rating?.split(" - ")[0]?.trim() || null;
            if (!rating) { skipped++; continue; }
            const { error } = await supabaseAdmin.from("anime_age_ratings").upsert({ mal_id: id, rating, source: "jikan", updated_at: new Date().toISOString() }, { onConflict: "mal_id" });
            if (error) failed++; else saved++;
          } catch { failed++; }
          await new Promise(resolve => setTimeout(resolve, 550));
        }
        return Response.json({ page, nextPage: payload.data?.Page?.pageInfo?.hasNextPage ? page + 1 : null, total: payload.data?.Page?.pageInfo?.total ?? null, saved, skipped, failed });
      },
    },
  },
});
