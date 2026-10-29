import { z } from "zod";

export const STATUS_REFRESH_MS = 5 * 60 * 1000;
export const SERVICE_NAMES = ["Streamly website", "AniList", "Cloudflare", "Anikoto", "KickAssAnime", "AniZone", "ReAnime", "AniWaves", "AnimeGG", "AnimeNoSub", "AnimeOnsen", "AnimeDunya", "MKissa", "Senshi", "AniPM"] as const;
export type ServiceState = "operational" | "degraded" | "outage" | "unknown";
export type ServiceCheck = { name: string; state: ServiceState; detail: string; duration: number | null; checkedAt: string };
export const incidentSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(160),
  service: z.enum(SERVICE_NAMES),
  body: z.string().trim().min(1).max(5000),
  status: z.enum(["investigating", "identified", "monitoring", "resolved"]),
  severity: z.enum(["degraded", "outage", "maintenance"]),
  started_at: z.string().datetime(),
});
export function httpState(status: number): ServiceState {
  if (status >= 200 && status < 400) return "operational";
  if (status === 401 || status === 403 || status === 429 || status === 404 || status === 405) return "unknown";
  return status >= 500 ? "outage" : "unknown";
}
export function incidentStats(incidents: { status: string; started_at: string; resolved_at: string | null }[]) {
  return {
    total: incidents.length,
    active: incidents.filter(i => i.status !== "resolved").length,
    resolved: incidents.filter(i => i.status === "resolved").length,
    minutes: Math.round(incidents.reduce((sum, i) => sum + (i.resolved_at ? Math.max(0, Date.parse(i.resolved_at) - Date.parse(i.started_at)) / 60000 : 0), 0)),
  };
}