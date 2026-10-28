import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, AlertCircle, CheckCircle2, ChevronDown, Clock3, RefreshCw, Server, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/status")({ component: StatusPage });

type Probe = { ok: boolean; duration: number; at: number };
type Health = "checking" | "online" | "offline";
const STORAGE_KEY = "streamly-status-probes-v1";
const MAX_SAMPLES = 48;

function StatusPage() {
  const [samples, setSamples] = useState<Probe[]>([]);
  const [state, setState] = useState<Health>("checking");
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(stored)) setSamples(stored.filter((s) => typeof s?.ok === "boolean" && typeof s?.at === "number").slice(-MAX_SAMPLES));
    } catch { /* Ignore malformed local history. */ }
  }, []);

  useEffect(() => {
    let active = true;
    let controller: AbortController | undefined;
    async function check() {
      controller?.abort();
      controller = new AbortController();
      const started = performance.now();
      try {
        const response = await fetch("/", { method: "HEAD", cache: "no-store", signal: controller.signal });
        if (!active) return;
        const sample = { ok: response.ok, duration: Math.round(performance.now() - started), at: Date.now() };
        setState(sample.ok ? "online" : "offline");
        setLastChecked(sample.at);
        setSamples((previous) => {
          const next = [...previous, sample].slice(-MAX_SAMPLES);
          try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Storage is optional. */ }
          return next;
        });
      } catch {
        if (!active || controller?.signal.aborted) return;
        const sample = { ok: false, duration: Math.round(performance.now() - started), at: Date.now() };
        setState("offline");
        setLastChecked(sample.at);
        setSamples((previous) => {
          const next = [...previous, sample].slice(-MAX_SAMPLES);
          try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Storage is optional. */ }
          return next;
        });
      }
    }
    void check();
    const interval = window.setInterval(() => void check(), 60_000);
    return () => { active = false; controller?.abort(); window.clearInterval(interval); };
  }, []);

  const latest = samples.at(-1);
  const successCount = samples.filter((sample) => sample.ok).length;
  const percent = samples.length ? Math.round((successCount / samples.length) * 100) : null;
  const dateLabel = lastChecked ? new Date(lastChecked).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Waiting for first check";

  return (
    <main className="min-h-screen bg-background px-4 pb-24 pt-24 text-foreground sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 text-center">
          <div className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border ${state === "online" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : state === "offline" ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-border bg-card text-muted-foreground"}`}>
            {state === "online" ? <CheckCircle2 size={30} /> : state === "offline" ? <AlertCircle size={30} /> : <RefreshCw size={28} className="animate-spin" />}
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-primary">Streamly service status</p>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{state === "online" ? "Website is responding" : state === "offline" ? "Website check failed" : "Checking website status"}</h1>
          <p className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Clock3 size={14} /> Last checked: {dateLabel}</p>
        </div>

        <section className="overflow-hidden rounded-xl border border-border bg-card/60">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="flex items-center gap-2 font-bold"><Server size={18} className="text-primary" /> Streamly services</h2>
            <span className="text-xs text-muted-foreground">Live browser check</span>
          </div>
          <button type="button" onClick={() => setExpanded((value) => !value)} className="w-full px-5 py-5 text-left transition-colors hover:bg-accent/30" aria-expanded={expanded}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={state === "online" ? "text-emerald-400" : state === "offline" ? "text-red-400" : "text-muted-foreground"}><Activity size={19} /></span>
                <div><div className="font-semibold">Streamly website</div><div className="mt-1 text-xs text-muted-foreground">{latest ? `Last response: ${latest.duration} ms` : "Checking…"}</div></div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold ${state === "online" ? "text-emerald-400" : state === "offline" ? "text-red-400" : "text-muted-foreground"}`}>{state === "online" ? "Operational" : state === "offline" ? "Unreachable" : "Checking"}</span>
                <ChevronDown size={16} className={`text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
              </div>
            </div>
            <div className="mt-5 flex h-8 items-end gap-[3px]" aria-label="Recent browser checks, oldest to newest">
              {Array.from({ length: MAX_SAMPLES }, (_, i) => {
                const sample = samples[i - (MAX_SAMPLES - samples.length)];
                return <div key={i} title={sample ? `${new Date(sample.at).toLocaleTimeString()}: ${sample.ok ? "Successful" : "Failed"}` : "No sample"} className={`h-full min-w-0 flex-1 rounded-[2px] ${!sample ? "bg-muted" : sample.ok ? "bg-emerald-500" : "bg-red-500"}`} />;
              })}
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>Earlier checks</span><span>{percent === null ? "No data" : `${percent}% of ${samples.length} sampled checks successful`}</span><span>Latest</span></div>
          </button>
          {expanded && <div className="border-t border-border bg-background/30 px-5 py-4 text-sm text-muted-foreground">This checks whether the homepage responds to a HEAD request from your browser every 60 seconds while this page is open. History is stored only in this browser session; it is not a 24-hour uptime measurement.</div>}
        </section>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card/60 p-5"><div className="mb-2 flex items-center gap-2 font-semibold"><ShieldCheck size={17} className="text-primary" /> Other services</div><p className="text-sm leading-relaxed text-muted-foreground">Video streaming, login, database and external anime providers are not monitored independently yet. Their status cannot be confirmed by the website check above.</p></div>
          <div className="rounded-xl border border-border bg-card/60 p-5"><div className="mb-2 flex items-center gap-2 font-semibold"><Activity size={17} className="text-primary" /> Availability history</div><p className="text-sm leading-relaxed text-muted-foreground">The green and red bars show actual checks made during this browser session. A separate monitoring service is needed for reliable 24/7 uptime and response-time reporting.</p></div>
        </div>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Past incidents</h2>
          <div className="mt-4 rounded-xl border border-border bg-card/60 p-6">
            <p className="font-semibold">No published incident reports</p>
            <p className="mt-2 text-sm text-muted-foreground">When verified incidents and maintenance updates are available, they can be listed here with their dates, impact and resolution. No incident history has been invented.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
