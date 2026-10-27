import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/VideoPlayer";
import { WatchlistButton } from "@/components/WatchlistButton";
import { animeTitle, getStreams, PROVIDER_ORDER, providerLabel } from "@/lib/kitsune";
import { useAuth } from "@/lib/auth";
import { historyQuery, saveProgress } from "@/lib/library";
import { animeQuery, episodesQuery } from "./anime.$id";

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
  const idx = list.findIndex((e) => e.number === ep);
  const prev = list[idx - 1], next = list[idx + 1];
  const hasDub = !!episode?.sources.some((s) => s.audio === "dub");
  const go = (search: { ep?: number; audio?: "sub" | "dub"; provider?: string | undefined }) => void navigate({ search: (s) => ({ ...s, provider: undefined, ...search }) });

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-20 pt-40 sm:px-6 md:px-8 md:pt-24">
      <Link to="/anime/$id" params={{ id: String(id) }} className="text-sm text-muted-foreground hover:text-primary">← {title || "Back to series"}</Link>
      <h1 className="mt-1 text-2xl font-extrabold">Episode {ep}{episode?.title ? ` — ${episode.title}` : ""}</h1>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="aspect-video overflow-hidden rounded-md bg-overlay">
            {eps.isPending || (current && streams.isPending) ? <div role="status" className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin" />{eps.isPending ? "Finding episode…" : `Loading ${providerLabel(current!.provider)}…`}</div>
              : !current ? <div role="alert" className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground"><p>{sources.length ? "None of the sources had a working video for this episode." : `No ${audio} version found for this episode.`}</p>{sources.length > 0 && <Button variant="outline" onClick={() => setFailed([])}>Try again</Button>}</div>
              : streams.isError ? <div role="alert" className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">{providerLabel(current.provider)} has no video for this episode right now. Pick another source.</div>
              : stream ? <VideoPlayer key={stream.src} ref={playerRef} kind={stream.kind} src={stream.src} subtitles={stream.subtitles} intro={stream.intro} poster={episode?.image ?? undefined} fileName={`${title} - ${ep}`} autoPlay
                  onLoaded={(v) => { if (resumeAt > 5 && resumeAt < v.duration - 30) v.currentTime = resumeAt; }}
                  onEnded={() => { if (playerRef.current) save(playerRef.current, true); if (next) go({ ep: next.number }); }}
                  onError={() => { if (streams.data && server < streams.data.length - 1) setServer(server + 1); }} /> : null}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
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
        <aside className="max-h-[70vh] overflow-y-auto rounded-md border border-border p-2">
          <p className="px-2 py-1 text-xs font-bold uppercase text-muted-foreground">Episodes</p>
          {list.map((e) => <button key={e.number} type="button" onClick={() => go({ ep: e.number })} className={`block w-full truncate rounded-sm px-2 py-2 text-left text-sm hover:bg-muted ${e.number === ep ? "bg-primary/10 text-primary" : ""}`}>{e.number}. {e.title ?? `Episode ${e.number}`}</button>)}
        </aside>
      </div>
    </main>
  );
}
