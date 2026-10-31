import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Trash2, Upload, LoaderCircle, Pencil, ChevronDown, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { seriesListQuery, seriesQuery } from "@/lib/queries";
import { mediaError, uploadMedia, withDeadline } from "@/lib/media";
import { uploadEpisodeVideos, validateEpisodeVideos, type AudioVersion } from "@/lib/episode-video";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusIncidentManager } from "@/components/StatusIncidentManager";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin — Streamly" },
      { name: "description", content: "Manage series and upload episodes on Streamly." },
      { property: "og:title", content: "Admin — Streamly" },
      { property: "og:description", content: "Manage series and upload episodes on Streamly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

const inputCls = "min-h-11 w-full min-w-0 rounded-md border border-border bg-muted/60 px-3 py-2.5 text-sm outline-none focus:border-primary file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-primary";
const L = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <label className="block space-y-1.5">
    <span className="text-xs font-semibold text-muted-foreground">{t}</span>
    {children}
  </label>
);

const seriesSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(3000),
  type: z.string().trim().max(20),
  start_date: z.string().optional(),
  premiered: z.string().trim().max(60),
  country: z.string().trim().max(60),
  status: z.string().trim().max(40),
  score: z.string().refine((v) => v === "" || (Number(v) >= 0 && Number(v) <= 10), "Score must be 0–10"),
  genres: z.string().max(500),
  studios: z.string().max(500),
});

const empty = { title: "", description: "", type: "TV", start_date: "", premiered: "", country: "", status: "Airing", score: "", genres: "", studios: "" };

function SeriesForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState(empty);
  const [cover, setCover] = useState<File | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = seriesSchema.safeParse(f);
    if (!p.success) return void toast.error(p.error.issues[0]?.message ?? "Invalid input");
    setBusy(true);
    try {
      const cover_url = cover ? await uploadMedia(cover, "covers") : null;
      const banner_url = banner ? await uploadMedia(banner, "banners") : null;
      const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
      const { error } = await withDeadline(supabase.from("series").insert({
        title: p.data.title,
        description: p.data.description || null,
        type: p.data.type,
        start_date: p.data.start_date || null,
        premiered: p.data.premiered || null,
        country: p.data.country || null,
        status: p.data.status,
        score: p.data.score === "" ? null : Number(p.data.score),
        genres: split(p.data.genres),
        studios: split(p.data.studios),
        cover_url,
        banner_url,
      }).abortSignal(AbortSignal.timeout(30_000)));
      if (error) throw error;
      toast.success("Series added");
      setF(empty);
      setCover(null);
      setBanner(null);
      onDone();
    } catch (err) {
      toast.error(mediaError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-x-6 gap-y-5 border-y border-border py-7 md:grid-cols-2">
      <h2 className="text-xl font-extrabold md:col-span-2">Add a series</h2>
      <L t="Title"><input className={inputCls} value={f.title} onChange={set("title")} /></L>
      <L t="Type">
        <select className={inputCls} value={f.type} onChange={set("type")}>
          {["TV", "Movie", "ONA", "OVA", "Special"].map((t) => <option key={t}>{t}</option>)}
        </select>
      </L>
      <div className="md:col-span-2"><L t="Description"><textarea rows={3} className={inputCls} value={f.description} onChange={set("description")} /></L></div>
      <L t="Start date"><input type="date" className={inputCls} value={f.start_date} onChange={set("start_date")} /></L>
      <L t="Premiered"><input className={inputCls} placeholder="Fall 2026" value={f.premiered} onChange={set("premiered")} /></L>
      <L t="Country"><input className={inputCls} placeholder="Japan" value={f.country} onChange={set("country")} /></L>
      <L t="Score (0–10)"><input type="number" step="0.1" min="0" max="10" className={inputCls} value={f.score} onChange={set("score")} /></L>
      <L t="Genres (comma separated)"><input className={inputCls} placeholder="Action, Fantasy" value={f.genres} onChange={set("genres")} /></L>
      <L t="Studios (comma separated)"><input className={inputCls} placeholder="Studio Pierrot" value={f.studios} onChange={set("studios")} /></L>
      <L t="Status">
        <select className={inputCls} value={f.status} onChange={set("status")}>
          {["Airing", "Finished", "Upcoming"].map((t) => <option key={t}>{t}</option>)}
        </select>
      </L>
      <div />
      <L t="Cover art (portrait)"><input type="file" accept="image/*" className={inputCls} onChange={(e) => setCover(e.target.files?.[0] ?? null)} /></L>
      <L t="Banner (wide, optional)"><input type="file" accept="image/*" className={inputCls} onChange={(e) => setBanner(e.target.files?.[0] ?? null)} /></L>
      <Button type="submit" disabled={busy} className="h-11 font-bold md:col-span-2 md:justify-self-start">
        {busy ? "Saving..." : "Add series"}
      </Button>
    </form>
  );
}

type EpisodeRow = Database["public"]["Tables"]["episodes"]["Row"];
function EpisodeEditor({ episode, seriesId, taken, onDone }: { episode: EpisodeRow; seriesId: string; taken: number[]; onDone: () => void }) {
  const [num, setNum] = useState(String(episode.number));
  const [title, setTitle] = useState(episode.title ?? "");
  const [airDate, setAirDate] = useState(episode.air_date ?? "");
  const [sub, setSub] = useState<File | null>(null);
  const [dub, setDub] = useState<File | null>(null);
  const [thumb, setThumb] = useState<File | null>(null);
  const [removeDub, setRemoveDub] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(num);
    if (!Number.isInteger(n) || n < 1) return void toast.error("Episode number must be a positive whole number");
    if (taken.includes(n)) return void toast.error(`Episode ${n} already exists.`);
    setBusy(true);
    const added: string[] = [];
    try {
      const patch: Partial<EpisodeRow> = { number: n, title: title.trim().slice(0, 200) || null, air_date: airDate || null };
      if (sub) { setProgress("Uploading sub video… 0%"); patch.video_path = await uploadMedia(sub, `videos/${seriesId}/sub`, { onProgress: (p) => setProgress(`Uploading sub video… ${p}%`) }); added.push(patch.video_path); }
      if (dub) { setProgress("Uploading dub video… 0%"); patch.dub_video_path = await uploadMedia(dub, `videos/${seriesId}/dub`, { onProgress: (p) => setProgress(`Uploading dub video… ${p}%`) }); added.push(patch.dub_video_path); }
      else if (removeDub) patch.dub_video_path = null;
      if (thumb) { setProgress("Uploading image…"); patch.thumbnail_path = await uploadMedia(thumb, `thumbs/${seriesId}`); added.push(patch.thumbnail_path); }
      setProgress("Saving…");
      const { error } = await withDeadline(supabase.from("episodes").update(patch).eq("id", episode.id).abortSignal(AbortSignal.timeout(30_000)));
      if (error) throw error;
      const old = [sub && episode.video_path, (dub || removeDub) && episode.dub_video_path, thumb && episode.thumbnail_path].filter((p): p is string => !!p);
      if (old.length) await supabase.storage.from("media").remove(old);
      toast.success(`Episode ${n} updated`);
      onDone();
    } catch (err) {
      if (added.length) await supabase.storage.from("media").remove(added).catch(() => {});
      toast.error(mediaError(err));
    } finally { setBusy(false); setProgress(null); }
  };

  return (
    <form onSubmit={save} className="mt-3 rounded-md border border-border bg-card/40 p-4">
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-[100px_minmax(0,1fr)_180px]">
        <L t="Number"><input type="number" min="1" className={inputCls} value={num} onChange={(e) => setNum(e.target.value)} /></L>
        <L t="Title"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} /></L>
        <L t="Air date"><input type="date" className={inputCls} value={airDate} onChange={(e) => setAirDate(e.target.value)} /></L>
        <L t="Replace sub video"><input type="file" accept="video/*" className={inputCls} onChange={(e) => setSub(e.target.files?.[0] ?? null)} /></L>
        <L t={episode.dub_video_path ? "Replace dub video" : "Add dub video"}><input type="file" accept="video/*" className={inputCls} onChange={(e) => setDub(e.target.files?.[0] ?? null)} /></L>
        <L t={episode.thumbnail_path ? "Replace episode image" : "Add episode image"}><input type="file" accept="image/*" className={inputCls} onChange={(e) => setThumb(e.target.files?.[0] ?? null)} /></L>
      </fieldset>
      {episode.dub_video_path && !dub && <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={removeDub} onChange={(e) => setRemoveDub(e.target.checked)} className="accent-primary" />Remove dub version</label>}
      {progress && <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">{progress}</p>}
      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={busy} size="sm">{busy ? <LoaderCircle className="animate-spin" /> : null}Save changes</Button>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

function EpisodeManager({ seriesId }: { seriesId: string }) {
  const qc = useQueryClient();
  const { data: s } = useQuery(seriesQuery(seriesId));
  const [num, setNum] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dub, setDub] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [airDate, setAirDate] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [uploadVersion, setUploadVersion] = useState<AudioVersion>("sub");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const next = (s?.episodes.at(-1)?.number ?? 0) + 1;

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (controller.current) return;
    const form = e.currentTarget as HTMLFormElement;
    try { validateEpisodeVideos(file, dub); } catch (err) { return void toast.error(mediaError(err)); }
    if (!file) return;
    const n = Number(num || next);
    if (!Number.isInteger(n) || n < 1) return void toast.error("Episode number must be a positive whole number");
    if (s?.episodes.some((episode) => episode.number === n)) return void toast.error(`Episode ${n} already exists. Choose a different number.`);
    controller.current = new AbortController();
    setProgress(0);
    setStatus(null);
    setBusy(true);
    const uploadedPaths: string[] = [];
    try {
      const { video_path, dub_video_path } = await uploadEpisodeVideos(file, dub, seriesId, { onProgress: setProgress, signal: controller.current.signal, onVersion: setUploadVersion, onUploaded: (path) => uploadedPaths.push(path) });
      const thumbnail_path = thumbFile ? await uploadMedia(thumbFile, `thumbs/${seriesId}`, { signal: controller.current.signal }) : null;
      if (thumbnail_path) uploadedPaths.push(thumbnail_path);
      setSaving(true);
      const { error } = await withDeadline(supabase.from("episodes").insert({ series_id: seriesId, number: n, title: title.trim().slice(0, 200) || null, video_path, dub_video_path, thumbnail_path, air_date: airDate || null }).abortSignal(AbortSignal.timeout(30_000)));
      if (error) throw error;
      toast.success(`Episode ${n} uploaded`);
      setStatus({ kind: "success", message: `Episode ${n} uploaded successfully.` });
      setNum("");
      setTitle("");
      setFile(null);
      setDub(null);
      form.reset();
      qc.invalidateQueries({ queryKey: ["series"] });
    } catch (err) {
      let message = mediaError(err);
      const uploadedPath = uploadedPaths[0];
      if (uploadedPath) {
        // A response timeout may hide a successful insert. Never delete a referenced video.
        try {
          const check = await withDeadline(supabase.from("episodes").select("id").eq("video_path", uploadedPath).abortSignal(AbortSignal.timeout(30_000)));
          if (check.error) throw check.error;
          if (check.data?.length) {
            message = "The video was saved, but confirmation was interrupted. Refresh the episode list before retrying.";
            qc.invalidateQueries({ queryKey: ["series"] });
          } else {
            const cleanup = await withDeadline(supabase.storage.from("media").remove(uploadedPaths));
            if (cleanup.error) throw cleanup.error;
          }
        } catch {
          message += " The video may still be stored; refresh the episode list before retrying.";
        }
      }
      setStatus({ kind: "error", message });
      toast.error(message);
    } finally {
      setBusy(false);
      setSaving(false);
      controller.current = null;
    }
  };

  const delEp = async (id: string, path: string, dubPath: string | null) => {
    if (!confirm("Delete this episode?")) return;
    try {
      const { error } = await withDeadline(supabase.from("episodes").delete().eq("id", id).abortSignal(AbortSignal.timeout(30_000)));
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["series"] });
      const cleanup = await withDeadline(supabase.storage.from("media").remove(dubPath ? [path, dubPath] : [path]));
      if (cleanup.error) toast.error("Episode deleted, but its video files could not be removed.");
    } catch (err) { toast.error(mediaError(err)); }
  };

  return (
    <section className="min-w-0 space-y-5 border-t border-border pt-7">
      <h2 className="break-words text-xl font-extrabold">Episodes — {s?.title}</h2>
      <form onSubmit={upload} className="space-y-4">
      <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-[100px_minmax(0,1fr)]">
        <L t="Number"><input type="number" min="1" className={inputCls} placeholder={String(next)} value={num} onChange={(e) => setNum(e.target.value)} /></L>
        <L t="Title (optional)"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} /></L>
        <div className="sm:col-span-2"><L t="Sub video (required)"><input type="file" required accept="video/*" className={inputCls} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></L></div>
        <div className="sm:col-span-2"><L t="Dub video (optional)"><input type="file" accept="video/*" className={inputCls} onChange={(e) => setDub(e.target.files?.[0] ?? null)} /></L></div>
        <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
          <L t="Episode image (optional)"><input type="file" accept="image/*" className={inputCls} onChange={(e) => setThumbFile(e.target.files?.[0] ?? null)} /></L>
          <L t="Air date (optional)"><input type="date" className={inputCls} value={airDate} onChange={(e) => setAirDate(e.target.value)} /></L>
        </div>
      </fieldset>
      {busy && <div className="space-y-2" aria-live="polite"><Progress value={progress} aria-label="Video upload progress" /><p className="text-sm text-muted-foreground">{saving ? "Saving episode…" : `Uploading ${uploadVersion} video… ${progress}%`}</p></div>}
      <div className="flex gap-3">
        <Button type="submit" disabled={busy} className="h-11 font-bold">
          {busy ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <Upload />} {busy ? "Uploading…" : "Upload"}
        </Button>
        {busy && !saving && <Button type="button" variant="outline" className="h-11" onClick={() => controller.current?.abort()}>Cancel</Button>}
      </div>
      {status && <p role={status.kind === "error" ? "alert" : "status"} className={`break-words text-sm ${status.kind === "error" ? "text-destructive" : "text-primary"}`}>{status.message}</p>}
      </form>
      <form className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3" onSubmit={async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget); const f = ev.currentTarget;
        const n = Number(fd.get("n")); const url = String(fd.get("url") ?? "").trim();
        if (!Number.isInteger(n) || n < 1) return void toast.error("Enter an episode number");
        if (!/^https:\/\/.+/i.test(url)) return void toast.error("Enter a full https:// streaming link");
        if (s?.episodes.some((x) => x.number === n)) return void toast.error(`Episode ${n} already has a video`);
        const { error } = await supabase.from("episodes").insert({ series_id: seriesId, number: n, video_path: url });
        if (error) return void toast.error(error.message);
        toast.success(`Streaming link added to episode ${n}`); f.reset(); qc.invalidateQueries({ queryKey: ["series"] });
      }}>
        <L t="Episode #"><input name="n" type="number" min="1" className={`${inputCls} w-24`} placeholder={String(next)} /></L>
        <div className="min-w-0 flex-1"><L t="Authorised video or embed URL"><input name="url" type="url" className={inputCls} placeholder="https://…/video.m3u8 or provider embed URL" /></L></div>
        <Button type="submit" variant="outline" className="h-11">Add link</Button>
      </form>
      <ul className="divide-y divide-border">
        {s?.episodes.map((e) => (
          <li key={e.id} className="py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <Link to="/watch/$episodeId" params={{ episodeId: e.id }} className="min-w-0 break-words hover:text-primary">EP {e.number} {e.title && `· ${e.title}`} <span className="ml-2 text-xs text-primary">SUB{e.dub_video_path ? " · DUB" : ""}{e.thumbnail_path ? " · IMG" : ""}</span></Link>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" aria-label="Edit episode" title="Edit episode" aria-expanded={editing === e.id} onClick={() => setEditing(editing === e.id ? null : e.id)} className="text-muted-foreground hover:text-primary"><Pencil /></Button>
                <Button variant="ghost" size="icon" aria-label="Delete episode" title="Delete episode" onClick={() => delEp(e.id, e.video_path, e.dub_video_path)} className="text-muted-foreground hover:text-destructive"><Trash2 /></Button>
              </div>
            </div>
            {editing === e.id && <EpisodeEditor episode={e} seriesId={seriesId} taken={s.episodes.filter((x) => x.id !== e.id).map((x) => x.number)} onDone={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["series"] }); qc.invalidateQueries({ queryKey: ["episode", e.id] }); }} />}
          </li>
        ))}
      </ul>
      {!s?.episodes.length && <p className="text-sm text-muted-foreground">No episodes uploaded yet.</p>}
    </section>
  );
}

type EpisodeReport = { id: string; anime_id: number; anime_title: string; episode: number; audio: string; provider: string | null; category: string; details: string; device_info: string | null; status: string; created_at: string };
function ReportManager() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("open");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!filterMenuRef.current?.contains(event.target as Node)) setFilterOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const [updating, setUpdating] = useState<string | null>(null);
  const { data = [], isPending, error } = useQuery({
    queryKey: ["admin-episode-reports", filter],
    queryFn: async () => {
      let q = (supabase as any).from("episode_reports").select("id,anime_id,anime_title,episode,audio,provider,category,details,device_info,status,created_at").order("created_at", { ascending: false }).limit(100);
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as EpisodeReport[];
    }, retry: 0,
  });
  const changeStatus = async (id: string, status: string) => {
    setUpdating(id);
    const { error } = await (supabase as any).from("episode_reports").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    setUpdating(null);
    if (error) toast.error(error.message);
    else { toast.success("Report updated"); qc.invalidateQueries({ queryKey: ["admin-episode-reports"] }); }
  };
  return <section className="space-y-4 border-t border-border pt-7">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-extrabold">Episode reports</h2><p className="text-xs text-muted-foreground">Review viewer playback issues and update their status.</p></div>
      <div ref={filterMenuRef} className="relative w-48">
        <button type="button" aria-label="Filter reports by status" aria-haspopup="listbox" aria-expanded={filterOpen} onClick={() => setFilterOpen(!filterOpen)} className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-sm font-semibold transition-colors ${filterOpen ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/60"}`}>
          <span>{filter[0].toUpperCase() + filter.slice(1)}</span><ChevronDown size={16} className={`transition-transform ${filterOpen ? "rotate-180 text-primary" : "text-muted-foreground"}`} />
        </button>
        {filterOpen && <div role="listbox" aria-label="Report statuses" className="absolute right-0 top-full z-50 mt-2 w-full overflow-hidden rounded-xl border border-primary/40 bg-card p-1.5 shadow-2xl shadow-black/50">
          {(["open","reviewing","resolved","dismissed","all"] as const).map((v) => <button key={v} type="button" role="option" aria-selected={filter === v} onClick={() => { setFilter(v); setFilterOpen(false); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${filter === v ? "bg-primary text-primary-foreground font-bold" : "text-foreground hover:bg-primary/10 hover:text-primary"}`}><span>{v[0].toUpperCase() + v.slice(1)}</span>{filter === v && <Check size={15} />}</button>)}
        </div>}
      </div></div>
    {isPending && <p className="text-sm text-muted-foreground">Loading reports…</p>}
    {error && <p role="alert" className="text-sm text-destructive">Unable to load reports. Apply the episode reports SQL migration in Supabase first.</p>}
    {!isPending && !error && !data.length && <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">No {filter === "all" ? "" : filter} reports yet.</p>}
    <div className="grid gap-3">{data.map((report) => <article key={report.id} className="rounded-lg border border-border bg-card/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold">{report.anime_title}</p><p className="mt-1 text-xs text-muted-foreground">Episode {report.episode} · {report.audio.toUpperCase()} · {report.provider || "Unknown source"} · {new Date(report.created_at).toLocaleString()}</p></div><span className="rounded border border-primary/30 px-2 py-1 text-xs font-bold text-primary">{report.status}</span></div>
      <p className="mt-3 text-sm font-semibold">{report.category.replaceAll("_"," ")}</p>
      {report.details && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{report.details}</p>}
      {report.device_info && <p className="mt-2 text-xs text-muted-foreground">Device: {report.device_info}</p>}
      <div className="mt-4 flex flex-wrap gap-2">{(["open","reviewing","resolved","dismissed"] as const).filter((status) => status !== report.status).map((status) => <Button key={status} type="button" size="sm" variant="outline" disabled={updating === report.id} onClick={() => void changeStatus(report.id,status)}>{status === "reviewing" ? "Mark reviewing" : status === "resolved" ? "Resolve" : status === "dismissed" ? "Dismiss" : "Reopen"}</Button>)}</div>
    </article>)}</div>
  </section>;
}

type TrafficRow = { day: string; path: string; views: number };
function AnalyticsPanel() {
  const [period, setPeriod] = useState<7 | 30>(30);
  const { data = [], isPending, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-traffic", period],
    queryFn: async () => {
      const since = new Date(Date.now() - (period - 1) * 86400000).toISOString().slice(0, 10);
      const { data, error } = await (supabase as any).from("page_view_counts").select("day,path,views").gte("day", since).order("day", { ascending: false }).limit(3000);
      if (error) throw error;
      return (data ?? []) as TrafficRow[];
    }, retry: 0, refetchInterval: 60000,
  });
  const total = data.reduce((sum, row) => sum + Number(row.views), 0);
  const today = new Date().toISOString().slice(0, 10);
  const todayViews = data.filter(row => row.day === today).reduce((sum, row) => sum + Number(row.views), 0);
  const paths = Object.entries(data.reduce((acc, row) => {
    acc[row.path] = (acc[row.path] || 0) + Number(row.views);
    return acc;
  }, {} as Record<string, number>)).sort((a,b) => b[1] - a[1]).slice(0, 10);
  const daily = Array.from({length: period}, (_, i) => {
    const d = new Date(); d.setUTCHours(12, 0, 0, 0); d.setUTCDate(d.getUTCDate() - (period - i - 1));
    const day = d.toISOString().slice(0, 10);
    return { day, views: data.filter(row => row.day === day).reduce((sum,row) => sum + Number(row.views), 0) };
  });
  const peak = Math.max(1, ...daily.map(d => d.views));
  const previous = daily.slice(0, Math.floor(period / 2)).reduce((n,d) => n + d.views, 0);
  const recent = daily.slice(Math.floor(period / 2)).reduce((n,d) => n + d.views, 0);
  const trend = previous ? Math.round((recent - previous) / previous * 100) : null;
  const cards = [
    {label: "Page views", value: total, note: "All recorded views in period"},
    {label: "Today", value: todayViews, note: "Views recorded today"},
    {label: "Average per day", value: Math.round(total / period), note: "Across the selected period"},
    {label: "Pages visited", value: paths.length, note: "Top tracked paths (max 10)"},
  ];
  return <section className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Audience insights</p><h2 className="mt-1 text-2xl font-extrabold">Visitor analytics</h2><p className="mt-1 text-sm text-muted-foreground">Privacy-friendly aggregated page views. No IP addresses or visitor identities are stored in these counts.</p></div>
      <div className="flex flex-wrap gap-2">
        {([7,30] as const).map(n => <Button key={n} size="sm" variant={period === n ? "default" : "outline"} onClick={() => setPeriod(n)}>{n} days</Button>)}
        <Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isFetching}>{isFetching ? "Refreshing…" : "Refresh"}</Button>
      </div>
    </div>
    {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">Unable to load analytics. Verify the page_view_counts table and its read permissions in Supabase.</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(card => <div key={card.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{card.label}</p>
        <p className="mt-3 text-3xl font-black tabular-nums text-foreground">{isPending ? "…" : card.value.toLocaleString()}</p>
        <p className="mt-2 text-xs text-muted-foreground">{card.note}</p>
      </div>)}
    </div>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">Traffic over time</h3><p className="mt-1 text-xs text-muted-foreground">Daily page views · last {period} days</p></div>
          {trend !== null && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${trend >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"}`}>{trend > 0 ? "+" : ""}{trend}% vs earlier half</span>}
        </div>
        <div className="mt-8 flex h-48 items-end gap-1 border-b border-border pb-1" role="img" aria-label="Daily page views bar chart">
          {daily.map(({day,views}) => <div key={day} className="group relative flex h-full min-w-0 flex-1 items-end" title={`${day}: ${views.toLocaleString()} page views`}>
            <div className="w-full rounded-t-sm bg-primary/70 transition-colors group-hover:bg-primary" style={{height: `${views ? Math.max(3, views / peak * 100) : 1}%`}} />
          </div>)}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{daily[0]?.day}</span><span>{daily[daily.length - 1]?.day}</span></div>
        {!total && !isPending && <p className="mt-4 text-sm text-muted-foreground">No page views recorded in this period.</p>}
      </div>
      <div className="min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h3 className="font-bold">Most visited pages</h3><p className="mt-1 text-xs text-muted-foreground">Ranked by total page views</p>
        <div className="mt-5 space-y-4">{paths.length ? paths.map(([path,count],i) => <div key={path} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate" title={path}><span className="mr-2 text-xs text-muted-foreground">{i+1}.</span>{path}</span><span className="shrink-0 font-bold tabular-nums">{count.toLocaleString()}</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width: `${Math.max(2,count / Math.max(1,paths[0][1]) * 100)}%`}} /></div>
        </div>) : <p className="text-sm text-muted-foreground">No page data yet.</p>}</div>
      </div>
    </div>
    <p className="text-xs text-muted-foreground">Page views are not unique visitors or live online users. Country, device and referral breakdowns require additional privacy-aware event collection and are not inferred from these counts.</p>
  </section>;
}
function AdminAlerts({ openReports }: { openReports: () => void }) {
  const { data: reports = [], isError } = useQuery({
    queryKey: ["admin-alerts-open-reports"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("episode_reports")
        .select("id,anime_title,episode,category,created_at")
        .eq("status", "open").order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return (data ?? []) as Pick<EpisodeReport,"id"|"anime_title"|"episode"|"category"|"created_at">[];
    },
    refetchInterval: 60000, retry: 0,
  });
  return <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-extrabold">Admin notifications</h2><p className="mt-1 text-xs text-muted-foreground">Recent open playback reports · refreshes every minute while this page is open</p></div>
      <Button variant="outline" size="sm" onClick={openReports}>View reports</Button>
    </div>
    {isError ? <p role="alert" className="mt-4 text-sm text-destructive">Report alerts are unavailable. Check the episode reports database permissions.</p>
      : reports.length ? <div className="mt-4 divide-y divide-border">{reports.map(report => <button key={report.id} onClick={openReports} className="flex w-full items-center justify-between gap-4 py-3 text-left hover:text-primary">
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{report.anime_title} · Episode {report.episode}</p><p className="mt-1 text-xs text-muted-foreground">{report.category.replaceAll("_", " ")} · {new Date(report.created_at).toLocaleString()}</p></div>
        <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive">Open</span>
      </button>)}</div>
      : <p className="mt-4 rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">No open playback reports found.</p>}
  </section>;
}
function Admin() {
  const { user, isAdmin, loading, openAuth } = useAuth();
  const qc = useQueryClient();
  const { data = [] } = useQuery({ ...seriesListQuery(), enabled: isAdmin });
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "analytics" | "reports" | "content" | "status">("overview");

  if (loading) return <main className="pt-32 text-center text-muted-foreground">Loading...</main>;
  if (!user)
    return (
      <main className="pt-32 text-center">
        <p className="mb-4">Sign in with an admin account to continue.</p>
        <Button onClick={() => openAuth("signin")}>Sign in</Button>
      </main>
    );
  if (!isAdmin) return <main className="pt-32 text-center text-muted-foreground">This account isn't an admin.</main>;

  const delSeries = async (id: string) => {
    if (!confirm("Delete this series and all its episodes?")) return;
    const { error } = await supabase.from("series").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    if (selected === id) setSelected(null);
    qc.invalidateQueries({ queryKey: ["series"] });
  };

  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-32 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">Streamly control centre</p><h1 className="text-3xl font-black tracking-tight sm:text-4xl">Admin dashboard</h1><p className="mt-2 text-sm text-muted-foreground">Manage your site, understand traffic and resolve playback reports.</p></div>
        <Link to="/" className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:border-primary">View website</Link>
      </div>
      <nav aria-label="Admin sections" className="mb-8 flex flex-wrap gap-2 border-b border-border pb-4">
        {(["overview","analytics","reports","content","status"] as const).map((section)=><Button key={section} type="button" variant={tab === section ? "default" : "outline"} aria-current={tab === section ? "page" : undefined} onClick={()=>setTab(section)} className="capitalize">{section === "content" ? "Content manager" : section === "status" ? "Status & incidents" : section}</Button>)}
      </nav>
      {tab === "overview" && <div className="space-y-6">
        <AdminAlerts openReports={() => setTab("reports")} />\n        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-6"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Managed series</p><p className="mt-3 text-4xl font-black text-primary">{data.length}</p></div>
          <div className="rounded-xl border border-border bg-card p-6"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Uploaded episodes</p><p className="mt-3 text-4xl font-black text-primary">{data.reduce((n,s)=>n+(s.episodes?.[0]?.count ?? 0),0)}</p></div>
          <div className="rounded-xl border border-border bg-card p-6"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Moderation</p><button onClick={()=>setTab("reports")} className="mt-3 text-lg font-extrabold text-primary hover:underline">Review episode reports →</button></div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <button onClick={()=>setTab("analytics")} className="rounded-xl border border-border bg-card p-6 text-left transition hover:border-primary"><h2 className="text-xl font-extrabold">Traffic analytics</h2><p className="mt-2 text-sm text-muted-foreground">View actual page visits, daily trends and popular pages.</p></button>
          <button onClick={()=>setTab("content")} className="rounded-xl border border-border bg-card p-6 text-left transition hover:border-primary"><h2 className="text-xl font-extrabold">Content management</h2><p className="mt-2 text-sm text-muted-foreground">Import anime, add series, upload episodes and manage your library.</p></button>
        </div>
      </div>}
      {tab === "analytics" && <AnalyticsPanel />}
      {tab === "reports" && <ReportManager />}
      {tab === "status" && <StatusIncidentManager />}
      {tab === "content" && <div className="space-y-8">
        <h2 className="text-2xl font-extrabold">Content manager</h2>
        <SeriesForm onDone={() => qc.invalidateQueries({ queryKey: ["series"] })} />
        <section className="min-w-0 rounded-xl border border-border bg-card/40 p-4 sm:p-6">
          <h3 className="mb-3 text-xl font-extrabold">Your series</h3>
          <ul className="divide-y divide-border">
            {data.map((s)=><li key={s.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><span className="min-w-0 break-words font-semibold">{s.title} <span className="text-xs text-muted-foreground">· {s.episodes?.[0]?.count ?? 0} eps</span></span><div className="flex shrink-0 gap-2"><Button size="sm" onClick={()=>setSelected(s.id)} variant={selected === s.id ? "default" : "outline"}>Manage episodes</Button><Button variant="ghost" size="icon" aria-label="Delete series" onClick={()=>delSeries(s.id)}><Trash2 /></Button></div></li>)}
            {!data.length && <p className="py-4 text-sm text-muted-foreground">No uploaded series yet.</p>}
          </ul>
        </section>
        {selected && <EpisodeManager key={selected} seriesId={selected} />}
      </div>}
    </main>
  );
}
