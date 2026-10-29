import { createFileRoute } from "@tanstack/react-router";
import { httpState, type ServiceCheck } from "@/lib/status-model";

const providers = [
  ["Anikoto", "https://anikototv.to"], ["ReAnime", "https://reanime.to"],
  ["AniWaves", "https://aniwaves.ru"], ["MKissa", "https://mkissa.to"],
] as const;

async function probe(name: string, url: string): Promise<ServiceCheck> {
  const start = Date.now();
  const base = { name, checkedAt: new Date().toISOString() };
  try {
    if (name === "Cloudflare") {
      // The public status JSON endpoint has sometimes returned months-old snapshots.
      // Prefer the official live overview, and never turn an undated API snapshot into a live outage.
      try {
        const overview = await fetch("https://www.cloudflarestatus.com/?streamly_check=" + Date.now(), {
          cache: "no-store",
          headers: { "Accept": "text/html", "User-Agent": "StreamlyStatusMonitor/1.0 (+https://streamlyio.vercel.app/status)" },
          signal: AbortSignal.timeout(8000),
        });
        if (overview.ok) {
          const html = await overview.text();
          if (/No known service issues/i.test(html)) {
            return { ...base, state: "operational", detail: "Cloudflare official overview: No known service issues", duration: Date.now() - start };
          }
          if (/Partial System Outage|Major Service Outage|Minor Service Outage/i.test(html)) {
            return { ...base, state: "degraded", detail: "Cloudflare official overview reports a service issue", duration: Date.now() - start };
          }
        }
      } catch { /* The official page may block automated requests; use the API with freshness validation. */ }
    }
    const requestUrl = name === "Cloudflare" ? `${url}?_=${Date.now()}` : url;
    const response = await fetch(requestUrl, {
      method: name === "AniList" ? "POST" : name === "Cloudflare" ? "GET" : "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      ...(name === "AniList" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "{ Page(page:1,perPage:1) { media(type:ANIME) { id } } }" }) } : {}),
    });
    let state = name === "Cloudflare" ? "unknown" as const : httpState(response.status);
    let detail = state === "operational" ? "Site reachable; playback not tested" : state === "outage" ? `Service returned HTTP ${response.status}` : `Check blocked or unsupported (HTTP ${response.status}); outage unconfirmed`;
    if (name === "Cloudflare" && !response.ok) {
      detail = `Official Cloudflare status unavailable (HTTP ${response.status}); outage not confirmed`;
    } else if (name === "Cloudflare" && response.ok) {
      const data = await response.json() as { status?: { indicator?: string; description?: string } };
      const sourceUpdatedAt = Date.parse((data as { page?: { updated_at?: string } }).page?.updated_at ?? "");
      if (!Number.isFinite(sourceUpdatedAt) || Date.now() - sourceUpdatedAt > 60 * 60 * 1000) {
        return { ...base, state: "unknown", detail: "Cloudflare API response is stale; current status could not be verified. See cloudflarestatus.com.", duration: Date.now() - start };
      }
      const indicator = data.status?.indicator;
      state = indicator === "none" ? "operational" : indicator === "critical" ? "outage" : indicator === "major" || indicator === "minor" ? "degraded" : "unknown";
      detail = indicator === "major" ? "Cloudflare reports a partial system outage affecting some services or regions; This does not mean all of Cloudflare is down." : indicator === "critical" ? "Cloudflare reports a critical system-wide disruption." : data.status?.description ?? "Official status unavailable";
    } else if (name === "AniList" && response.ok) {
      const data = await response.json() as { data?: { Page?: { media?: unknown[] } }; errors?: unknown[] };
      state = data.data?.Page?.media?.length ? "operational" : "unknown";
      detail = state === "operational" ? "Anime catalog API responding" : "API did not return catalog data";
    } else { await response.body?.cancel(); }
    return { ...base, state, detail, duration: Date.now() - start };
  } catch {
    return { ...base, state: "unknown", detail: "Unable to verify: timeout, network failure or blocked check", duration: null };
  }
}

export const Route = createFileRoute("/api/public/service-status")({
  server: { handlers: { GET: async () => {
    const services = await Promise.all([
      probe("AniList", "https://graphql.anilist.co"),
      probe("Cloudflare", "https://www.cloudflarestatus.com/api/v2/status.json"),
      ...providers.map(([name, url]) => probe(name, url)),
    ]);
    return Response.json({ services }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } } },
});