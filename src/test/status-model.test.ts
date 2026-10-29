import { describe, expect, it } from "vitest";
import { STATUS_REFRESH_MS, httpState, incidentSchema, incidentStats } from "@/lib/status-model";
describe("Service status rules", () => {
  it("refreshes every five minutes", () => { expect(STATUS_REFRESH_MS).toBe(300000); });
  it("does not report blocked provider checks as outages", () => { expect(httpState(403)).toBe("unknown"); expect(httpState(429)).toBe("unknown"); expect(httpState(503)).toBe("outage"); });
  it("counts published responses in incident statistics", () => {
    expect(incidentStats([{ status: "resolved", started_at: "2026-10-29T00:00:00Z", resolved_at: "2026-10-29T00:15:00Z" }, { status: "investigating", started_at: "2026-10-29T00:20:00Z", resolved_at: null }])).toEqual({ total: 2, active: 1, resolved: 1, minutes: 15 });
  });
  it("rejects incident states and services outside the allowed choices", () => {
    const value = { title: "Playback interrupted", service: "Anikoto", body: "Investigating video errors", status: "investigating", severity: "outage", started_at: "2026-10-29T00:00:00Z" };
    expect(incidentSchema.safeParse(value).success).toBe(true);
    expect(incidentSchema.safeParse({ ...value, status: "fake" }).success).toBe(false);
    expect(incidentSchema.safeParse({ ...value, service: "arbitrary URL" }).success).toBe(false);
  });
});