import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { ChevronLeft, ChevronRight, LoaderCircle, Search, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/VideoPlayer";
import { WatchlistButton } from "@/components/WatchlistButton";
import { animeTitle, getStreams, PROVIDER_ORDER, providerLabel } from "@/lib/kitsune";
import { useAuth } from "@/lib/auth";
import { historyQuery, saveProgress } from "@/lib/library";
import { animeQuery, episodesQuery } from "@/lib/anime-queries";

export const Route = createFileRoute("/anime/$id_/watch")({
  validateSearch: z.object({ ep: z.coerce.number().default(1), audio: z.enum(["sub", "dub"]).default("sub"), provider: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Now watching — Streamly" },
      { name: "description", content: "Stream this anime episode in sub or dub on Streamly." },
      { property: "og:title", content: "Now watching — Streamly" },
      { property: "og:description", content: "Stream this anime episode in sub or dub on Streamly." },
      { property: "og:type", content: "video.episode" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WatchAnime,
});

function WatchAnime() {
  const id = Number(Route.useParams().id);
  const { ep, audio, provider } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { user } = useAuth();
  const info = useQuery(animeQuery(id));
  const eps = useQuery(episodesQuery(id));
  const hist = useQuery(historyQuery(user?.id, id));
  const episode = eps.data?.find((e) => e.number === ep);
  const sources = useMemo(() => (episode?.sources ?? []).filter((s) => s.audio === audio).sort((a, b) => PROVIDER_ORDER.indexOf(a.provider) - PROVIDER_ORDER.indexOf(b.provider)), [episode, audio]);
  const [failed, setFailed] = useState<string[]>([]);
  const [server, setServer] = useState(0);
  const [episodeSearch, setEpisodeSearch] = useState("");
  useEffect(() => { setFailed([]); setServer(0); }, [ep, audio]);
  const current = sources.find((s) => s.provider === provider) ?? sources.find((s) => !failed.includes(s.provider));
  const streams = useQuery({ queryKey: ["streams", current?.watchId], queryFn: () => getStreams(current!.watchId), enabled: !!current, retry: 0, staleTime: 5 * 60 * 1000 });
  useEffect(() => { setServer(0); }, [current?.watchId]);
  // Without an explicit pick, move on to the next source automatically when one has no video.
  useEffect(() => { if (streams.isError && current && !provider) setFailed((f) => [...f, current.provider]); }, [streams.isError, current, provider]);
  const stream = streams.data?.[server];

  const title = info.data ? animeTitle(info.data) : "";
  const cover = info.data?.coverImage.large ?? null;
  const resumeAt = hist.data?.find((h) => h.episode === ep)?.progress_seconds ?? 0;
  const lastSave = useRef(0);
  const save = (v: HTMLVideoElement, force = false) => {
    if (!user || !v.duration || (!force && Date.now() - lastSave.current < 15000)) return;
    lastSave.current = Date.now();
    void saveProgress({ userId: user.id, anilistId: id, episode: ep, audio, title, cover, progress: v.currentTime, duration: v.duration });
  };
  const playerRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = playerRef.current; if (!v) return;
    const t = () => save(v);
    v.addEventListener("timeupdate", t);
    return () => { v.removeEventListener("timeupdate", t); save(v, true); };
  });

  const list = (eps.data ?? []).filter((e) => e.sources.some((s) => s.audio === audio));
  const filteredEpisodes = list.filter((e) => `${e.number} ${e.title ?? ""}`.toLowerCase().includes(episodeSearch.toLowerCase()));
  const recommended = (info.data?.recommendations?.nodes ?? []).map((n) => n.mediaRecommendation).filter((item) => !!item && item.id !== id).slice(0, 6);
  const idx = list.findIndex((e) => e.number === ep);
  const prev = list[idx - 1], next = list[idx + 1];
  const hasDub = !!episode?.sources.some((s) => s.audio === "dub");
  const go = (search: { ep?: number; audio?: "sub" | "dub"; provider?: string | undefined }) => void navigate({ search: (s) => ({ ...s, provider: undefined, ...search }) });

  return (
    <main className="mx-auto max-w-[1800px] px-4 pb-20 pt-4 sm:px-6 md:pt-6">
      <Link to="/anime/$id" params={{ id: String(id) }} className="text-sm text-muted-foreground hover:text-primary">← {title || "Back to series"}</Link>
      <h1 className="mt-2 mb-4 text-xl font-extrabold">Episode {ep}{episode?.title ? ` — ${episode.title}` : ""}</h1>
      <div className="grid items-start gap-4 xl:grid-cols-[210px_minmax(0,1fr)_320px]">
        <aside className="hidden rounded-xl border border-border bg-card/40 p-3 xl:block">{cover && <img src={cover} alt="" className="mx-auto aspect-[2/3] w-full max-w-40 rounded-lg object-cover" />}<Link to="/anime/$id" params={{ id: String(id) }} className="mt-3 block text-base font-extrabold hover:text-primary">{title}</Link>{info.data?.averageScore != null && <p className="mt-2 text-sm font-semibold text-primary">★ {(info.data.averageScore / 10).toFixed(1)} / 10</p>}{info.data?.genres?.length ? <p className="mt-3 text-xs leading-5 text-muted-foreground">{info.data.genres.join(" · ")}</p> : null}{info.data?.description && <p className="mt-3 line-clamp-6 text-xs leading-5 text-muted-foreground">{info.data.description.replace(/<[^>]+>/g, "")}</p>}</aside>
        <div className="min-w-0">
          <div className="aspect-video overflow-hidden rounded-lg border border-border bg-overlay shadow-lg">
            {eps.isPending || (current && streams.isPending) ? <div role="status" className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin" />{eps.isPending ? "Finding episode…" : `Loading ${providerLabel(current!.provider)}…`}</div>
              : !current ? <div role="alert" className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground"><p>{sources.length ? "None of the sources had a working video for this episode." : `No ${audio} version found for this episode.`}</p>{sources.length > 0 && <Button variant="outline" onClick={() => setFailed([])}>Try again</Button>}</div>
              : streams.isError ? <div role="alert" className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">{providerLabel(current.provider)} has no video for this episode right now. Pick another source.</div>
              : stream ? <VideoPlayer key={stream.src} ref={playerRef} kind={stream.kind} src={stream.src} subtitles={stream.subtitles} intro={stream.intro} poster={episode?.image ?? undefined} fileName={`${title} - ${ep}`} autoPlay
                  onLoaded={(v) => { if (resumeAt > 5 && resumeAt < v.duration - 30) v.currentTime = resumeAt; }}
                  onEnded={() => { if (playerRef.current) save(playerRef.current, true); if (next) go({ ep: next.number }); }}
                  onError={() => { if (streams.data && server < streams.data.length - 1) setServer(server + 1); }} /> : null}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/40 p-3">
            <Button variant="outline" size="sm" disabled={!prev} onClick={() => prev && go({ ep: prev.number })}><ChevronLeft /> Previous</Button>
            <Button variant="outline" size="sm" disabled={!next} onClick={() => next && go({ ep: next.number })}>Next <ChevronRight /></Button>
            <div className="ml-auto flex gap-1" role="group" aria-label="Audio">
              <Button size="sm" variant={audio === "sub" ? "default" : "outline"} onClick={() => go({ audio: "sub" })}>Sub</Button>
              <Button size="sm" variant={audio === "dub" ? "default" : "outline"} disabled={!hasDub} onClick={() => go({ audio: "dub" })}>Dub</Button>
            </div>
            {info.data && <WatchlistButton anime={{ id, title, cover }} />}
          </div>
          {sources.length > 0 && <div className="mt-4">
            <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Source</p>
            <div className="flex flex-wrap gap-2">
              {sources.map((s) => <Button key={s.provider} size="sm" variant={s.provider === current?.provider ? "default" : "outline"} className={failed.includes(s.provider) && s.provider !== current?.provider ? "opacity-50" : ""} onClick={() => go({ provider: s.provider })}>{providerLabel(s.provider)}</Button>)}
            </div>
            {(streams.data?.length ?? 0) > 1 && <>
              <p className="mb-2 mt-3 text-xs font-bold uppercase text-muted-foreground">Server</p>
              <div className="flex flex-wrap gap-2">{streams.data!.map((s, i) => <Button key={i} size="sm" variant={i === server ? "secondary" : "ghost"} onClick={() => setServer(i)}>{s.label}</Button>)}</div>
            </>}
          </div>}
          {!user && <p className="mt-4 text-sm text-muted-foreground">Sign in to save your progress.</p>}
        </div>
        <aside className="min-w-0 rounded-xl border border-border bg-card/40 p-3 xl:sticky xl:top-20">
          <h2 className="mb-3 text-lg font-extrabold">Episodes <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{list.length}</span></h2>
          <label className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={episodeSearch} onChange={(e) => setEpisodeSearch(e.target.value)} placeholder="Search episodes..." aria-label="Search episodes" className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary" /></label>
          <div className="mt-3 max-h-[65vh] space-y-2 overflow-y-auto pr-1">
            {filteredEpisodes.map((e) => <button key={e.number} type="button" onClick={() => go({ ep: e.number })} className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition hover:border-primary/70 hover:bg-muted/50 ${e.number === ep ? "border-primary bg-primary/10" : "border-border/70"}`}>
              <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded bg-muted">{(e.image || cover) && <img src={e.image || cover || ""} alt="" loading="lazy" className="h-full w-full object-cover" />}{e.number === ep && <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-primary"><Play className="h-5 w-5 fill-current" /></span>}</div>
              <div className="min-w-0"><p className={`text-[10px] font-bold uppercase ${e.number === ep ? "text-primary" : "text-muted-foreground"}`}>EP {String(e.number).padStart(2, "0")}</p><p className="mt-1 line-clamp-2 text-xs font-semibold">{e.title || `Episode ${e.number}`}</p></div>
            </button>)}
            {!filteredEpisodes.length && <p className="p-4 text-center text-sm text-muted-foreground">No episodes match your search.</p>}
          </div>
        </aside>
      </div>
      {recommended.length > 0 && <section className="mt-8 border-t border-border pt-5"><h2 className="mb-4 border-l-2 border-primary pl-3 text-lg font-extrabold">Recommended for this series</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{recommended.map((item) => item && <Link key={item.id} to="/anime/$id" params={{ id: String(item.id) }} className="group flex gap-3 rounded-lg border border-border bg-card/40 p-2 hover:border-primary"><img src={item.coverImage.large || ""} alt="" loading="lazy" className="h-24 w-16 shrink-0 rounded object-cover" /><div className="min-w-0"><p className="line-clamp-3 text-xs font-bold group-hover:text-primary">{animeTitle(item)}</p><p className="mt-2 text-xs text-primary">★ {item.averageScore != null ? (item.averageScore / 10).toFixed(1) : "N/A"}</p></div></Link>)}</div></section>}
    </main>
  );
}
