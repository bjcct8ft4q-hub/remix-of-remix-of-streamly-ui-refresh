import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Activity, AlertCircle, CheckCircle2, Clock3, RefreshCw, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { incidentsQuery, serviceStatusQuery } from "@/lib/status-queries";
import { SERVICE_NAMES, STATUS_REFRESH_MS, incidentStats, type ServiceCheck, type ServiceState } from "@/lib/status-model";

export const Route = createFileRoute("/status")({
  component: StatusPage,
  head: () => ({ meta: [
    { title: "Service Status & Incidents — Streamly" },
    { name: "description", content: "Live Streamly, AniList, Cloudflare and video-source checks, with incident responses and service history." },
    { property: "og:title", content: "Service Status & Incidents — Streamly" },
    { property: "og:description", content: "See current service checks and published Streamly incident updates." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
});
const stateClass: Record<ServiceState, string> = { operational: "text-status-good", degraded: "text-status-warning", outage: "text-destructive", unknown: "text-muted-foreground" };
const barClass: Record<ServiceState, string> = { operational: "bg-status-good", degraded: "bg-status-warning", outage: "bg-destructive", unknown: "bg-muted" };
const labels: Record<ServiceState, string> = { operational: "Operational", degraded: "Degraded", outage: "Outage", unknown: "Unverified" };
const storageKey = "streamly-service-history-v2";
function StatusPage() {
  const checks = useQuery(serviceStatusQuery());
  const incidents = useQuery(incidentsQuery());
  const [history, setHistory] = useState<Record<string, ServiceCheck[]>>({});
  const [secondsRemaining, setSecondsRemaining] = useState(Math.ceil(STATUS_REFRESH_MS / 1000));
  useEffect(() => {
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - (checks.dataUpdatedAt || Date.now());
      const remaining = Math.ceil((STATUS_REFRESH_MS - (elapsed % STATUS_REFRESH_MS)) / 1000);
      setSecondsRemaining(Math.max(0, remaining));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [checks.dataUpdatedAt]);
  useEffect(() => {
    try { const value = JSON.parse(sessionStorage.getItem(storageKey) ?? "{}"); if (value && typeof value === "object" && !Array.isArray(value)) setHistory(value); } catch { /* History is optional. */ }
  }, []);
  useEffect(() => {
    if (!checks.data) return;
    setHistory(previous => {
      const next = { ...previous };
      for (const check of checks.data) {
        const stored = Array.isArray(next[check.name]) ? next[check.name] : [];
        next[check.name] = stored.at(-1)?.checkedAt === check.checkedAt ? stored : [...stored, check].slice(-48);
      }
      try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Storage is optional. */ }
      return next;
    });
  }, [checks.data]);
  const rows = checks.data ?? SERVICE_NAMES.map(name => ({ name, state: "unknown" as const, detail: checks.isError ? "Checks unavailable" : "Checking…", duration: null, checkedAt: "" }));
  const active = incidents.data?.filter(i => i.status !== "resolved") ?? [];
  const stats = incidentStats(incidents.data ?? []);
  const issues = rows.filter(row => row.state === "outage" || row.state === "degraded").length;
  const unknown = rows.filter(row => row.state === "unknown").length;
  const headline = checks.isPending ? "Checking services" : issues || active.length ? "Some services need attention" : unknown ? "Available services are responding" : "All services operational";
  const checkedAt = checks.data?.[0]?.checkedAt;
  return <main className="min-h-screen bg-background px-4 pb-24 pt-24 text-foreground sm:px-8">
    <div className="mx-auto max-w-4xl">
      <header className="mb-10 text-center">
        <div className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-border ${issues || active.length ? "text-status-warning" : "text-status-good"}`}>
          {checks.isFetching ? <RefreshCw size={28} className="animate-spin motion-reduce:animate-none" /> : issues || active.length ? <AlertCircle size={30} /> : <CheckCircle2 size={30} />}
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">Streamly service status</p>
        <h1 className="text-3xl font-extrabold sm:text-4xl">{headline}</h1>
        <p className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Clock3 size={14} />Last checked: {checkedAt ? new Date(checkedAt).toLocaleString() : "Waiting for checks"}</p>
      </header>
      {checks.isError && <p role="alert" className="mb-5 text-destructive">Service checks could not be loaded. Try Refresh below.</p>}
      {active.length > 0 && <section className="mb-6 border-l-2 border-status-warning pl-4"><h2 className="mb-2 font-bold">Active incidents</h2>{active.map(i => <div key={i.id} className="py-2"><h3 className="font-semibold">{i.title}</h3><p className="text-xs text-status-warning">{i.service} · {i.status}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{i.body}</p></div>)}</section>}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-bold"><Server size={18} className="text-primary" />Services</h2>
        <div className="divide-y divide-border border-y border-border">
          {rows.map(row => {
            const samples = history[row.name] ?? [];
            const confirmed = samples.filter(s => s.state !== "unknown");
            const percent = confirmed.length ? Math.round(confirmed.filter(s => s.state === "operational").length / confirmed.length * 100) : null;
            return <details key={row.name} className="group py-4">
              <summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><Activity size={18} className={`shrink-0 ${stateClass[row.state]}`} /><div><h3 className="font-semibold">{row.name}</h3><p className="mt-1 text-xs text-muted-foreground">{row.duration === null ? "No response time" : `${row.duration} ms`}</p></div></div><span className={`shrink-0 text-sm font-semibold ${stateClass[row.state]}`}>{checks.isPending ? "Checking" : labels[row.state]}</span></div>
              <div className="mt-4 flex h-6 gap-0.5" aria-label={`${row.name} sampled checks`}>
                {Array.from({ length: 48 }, (_, index) => { const sample = samples[index - (48 - samples.length)]; return <span key={index} title={sample ? `${new Date(sample.checkedAt).toLocaleString()}: ${labels[sample.state]}` : "No check recorded"} className={`min-w-0 flex-1 rounded-sm ${sample ? barClass[sample.state] : "bg-muted"}`} />; })}
              </div><div className="mt-2 flex justify-between gap-3 text-xs text-muted-foreground"><span>Earlier checks</span><span>{percent === null ? "No confirmed samples" : `${percent}% of ${confirmed.length} confirmed checks successful`}</span><span>Latest</span></div></summary>
              <p className="mt-3 text-sm text-muted-foreground">{row.detail}</p>
            </details>;
          })}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Cloudflare uses its official status report. Video-source checks measure reachability, not video playback. Blocked or timed-out checks are unverified. Bars reflect this browser session, not continuous uptime.</p>
      </section>
      <section className="mt-8 grid grid-cols-2 gap-5 border-y border-border py-5 sm:grid-cols-4" aria-label="Incident statistics">
        {[["Published incidents", stats.total], ["Active", stats.active], ["Resolved", stats.resolved], ["Resolved incident minutes", stats.minutes]].map(([label, value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{incidents.isError ? "—" : value}</p></div>)}
      </section>
      <section className="mt-10"><h2 className="text-2xl font-bold">Past incidents</h2>
        {incidents.isPending && <p className="mt-4 text-muted-foreground">Loading incidents…</p>}
        {incidents.isError && <p role="alert" className="mt-4 text-destructive">Incident history could not be loaded.</p>}
        <article className="mt-4 border-b border-border py-5" aria-label="Cloudflare partial service disruption advisory">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="break-words font-bold">Cloudflare partial service disruption</h3>
            <span className="shrink-0 rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-yellow-500" aria-label="Risk severity: Medium">Medium</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Cloudflare · Streamly advisory reported <time dateTime="2026-10-29T00:37:00Z">{new Date("2026-10-29T00:37:00Z").toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/London" })} (UK time)</time></p>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm">Some parts of Cloudflare have experienced partial system outages affecting certain services and regions. This does not mean Cloudflare is completely down, and many of its services may still be available to use.</p>
          <p className="mt-2 text-xs text-muted-foreground">This is a historical advisory, not a live outage confirmation. Check the current Cloudflare service status above for updates.</p>
        </article>
        {incidents.data?.map(i => <article key={i.id} className="border-b border-border py-5"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="break-words font-bold">{i.title}</h3><span className={i.status === "resolved" ? "text-status-good" : "text-status-warning"}>{i.status}</span></div><p className="mt-2 text-xs text-muted-foreground">{i.service} · {new Date(i.started_at).toLocaleString()}{i.resolved_at ? ` · Resolved ${new Date(i.resolved_at).toLocaleString()}` : ""}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm">{i.body}</p></article>)}
      </section>
      <div className="mt-10 flex flex-col items-center gap-3 border-t border-border pt-6"><Button variant="outline" disabled={checks.isFetching || incidents.isFetching} onClick={() => { void checks.refetch(); void incidents.refetch(); }}><RefreshCw size={16} className={checks.isFetching ? "animate-spin motion-reduce:animate-none" : ""} />{checks.isFetching ? "Refreshing…" : "Refresh"}</Button><p className="text-xs text-muted-foreground">Refreshes every five minutes while this page is open.</p><p className="text-sm font-medium text-muted-foreground" role="timer">Refreshing in <span className="tabular-nums text-foreground">{String(Math.floor(secondsRemaining / 60)).padStart(2, "0")}:{String(secondsRemaining % 60).padStart(2, "0")}</span></p></div>
    </div>
  </main>;
}
