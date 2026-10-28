import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { ChevronLeft, ChevronRight, LoaderCircle, Search, Play, MonitorPlay, ListVideo, SkipForward, RefreshCw, Star, Keyboard, Users, Flag, BookmarkPlus, MessageSquare, ThumbsUp, ThumbsDown, Send, Reply, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/VideoPlayer";
import { WatchlistButton } from "@/components/WatchlistButton";
import { animeTitle, getStreams, PROVIDER_ORDER, providerLabel } from "@/lib/kitsune";
import { useAuth } from "@/lib/auth";
import { historyQuery, saveProgress } from "@/lib/library";
import { animeQuery, episodesQuery } from "@/lib/anime-queries";
import { useAnimeAgeRating } from "@/lib/age-ratings";
import { supabase } from "@/integrations/supabase/client";

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
  const { user, username, openAuth } = useAuth();
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [roomError, setRoomError] = useState("");
  const info = useQuery(animeQuery(id));
  const eps = useQuery(episodesQuery(id));
  const ageRating = useAnimeAgeRating(info.data?.idMal, info.data?.isAdult);
  const hist = useQuery(historyQuery(user?.id, id));
  const episode = eps.data?.find((e) => e.number === ep);
  const sources = useMemo(() => (episode?.sources ?? []).filter((s) => s.audio === audio).sort((a, b) => PROVIDER_ORDER.indexOf(a.provider) - PROVIDER_ORDER.indexOf(b.provider)), [episode, audio]);
  const [failed, setFailed] = useState<string[]>([]);
  const [server, setServer] = useState(0);
  const [episodeSearch, setEpisodeSearch] = useState("");
  const [episodeView, setEpisodeView] = useState<"list" | "grid">("list");
  const [episodeAudioFilter, setEpisodeAudioFilter] = useState<"all" | "sub" | "dub">("all");
  const [showEpisodeImages, setShowEpisodeImages] = useState(true);
  const [autoNext, setAutoNext] = useState(true);
  const [theaterMode, setTheaterMode] = useState(false);
  const [autoSkip, setAutoSkip] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [rating, setRating] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [commentSort, setCommentSort] = useState<"newest" | "oldest">("newest");
  const [comments, setComments] = useState<Array<{ id: string; author: string; body: string; created: number; parent?: string; likes: number; dislikes: number }>>([]);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportSent, setReportSent] = useState(false);
  useEffect(() => {
    try { setComments(JSON.parse(localStorage.getItem(`streamly-comments-${id}-${ep}`) || "[]")); }
    catch { setComments([]); }
    setReplyTo(null); setCommentText("");
  }, [id, ep]);
  const updateComments = (nextComments: typeof comments) => {
    setComments(nextComments);
    try { localStorage.setItem(`streamly-comments-${id}-${ep}`, JSON.stringify(nextComments)); } catch {}
  };
  const postComment = () => {
    const body = commentText.trim();
    if (!body) return;
    if (!user) { openAuth("signin"); return; }
    updateComments([...comments, { id: crypto.randomUUID(), author: username || "Viewer", body, created: Date.now(), parent: replyTo || undefined, likes: 0, dislikes: 0 }]);
    setCommentText(""); setReplyTo(null);
  };
  const voteComment = (commentId: string, direction: "likes" | "dislikes") => {
    updateComments(comments.map((c) => c.id === commentId ? { ...c, [direction]: c[direction] + 1 } : c));
  };
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

  const list = (eps.data ?? []).filter((e) => e.sources.length > 0);
  const visibleList = list.filter((e) => episodeAudioFilter === "all" || e.sources.some((s) => s.audio === episodeAudioFilter));
  const filteredEpisodes = visibleList.filter((e) => `${e.number} ${e.title ?? ""}`.toLowerCase().includes(episodeSearch.toLowerCase()));
  const recommended = (info.data?.recommendations?.nodes ?? []).map((n) => n.mediaRecommendation).filter((item) => !!item && item.id !== id).slice(0, 6);
  const idx = list.findIndex((e) => e.number === ep);
  const prev = list[idx - 1], next = list[idx + 1];
  const hasDub = !!episode?.sources.some((s) => s.audio === "dub");
  const createRoom = async () => {
    if (!user) { openAuth("signin"); return; }
    if (!info.data) return;
    setCreatingRoom(true); setRoomError("");
    const { data, error } = await (supabase as any).from("watch_rooms").insert({
      host_id: user.id, host_name: username || "Host", anime_id: id, anime_title: title,
      anime_cover: cover, episode: ep, audio, status: "waiting", is_public: true
    }).select("id").single();
    setCreatingRoom(false);
    if (error || !data) { setRoomError("Could not create room. Watch Together may need database setup."); return; }
    void navigate({ to: "/watch-together/$roomId" as any, params: { roomId: data.id } as any });
  };
  const go = (search: { ep?: number; audio?: "sub" | "dub"; provider?: string | undefined }) => void navigate({ search: (s) => ({ ...s, provider: undefined, ...search }) });

  return (
    <main className="mx-auto max-w-[1900px] px-3 pb-20 pt-3 sm:px-5 md:pt-4">
      <nav className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><Link to="/" className="hover:text-primary">Home</Link><span>›</span><Link to="/anime/$id" params={{ id: String(id) }} className="max-w-56 truncate hover:text-primary">{title || "Series"}</Link><span>›</span><span className="font-semibold text-primary">Episode {ep}</span></nav>
      <div className={`grid items-start gap-3 ${theaterMode ? "grid-cols-1" : "xl:grid-cols-[270px_minmax(0,1fr)_355px]"}`}>
        <aside ref={ageRating.ref as React.Ref<HTMLElement>} className={`${theaterMode ? "hidden" : "hidden xl:block"} min-w-0 rounded-lg border border-border/60 bg-card/40 p-4`}>
          {cover && <img src={cover} alt={title} className="mx-auto aspect-[2/3] w-full rounded-md object-cover" />}
          <Link to="/anime/$id" params={{ id: String(id) }} className="mt-4 block text-lg font-extrabold leading-tight hover:text-primary">{title}</Link>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase">
            {info.data?.averageScore != null && <span className="rounded border border-primary/30 bg-primary/10 px-2 py-1 text-primary">★ {(info.data.averageScore / 10).toFixed(1)}</span>}
            {info.data?.status && <span className="rounded border border-border px-2 py-1 text-muted-foreground">{info.data.status.replaceAll("_", " ")}</span>}
            <span className="rounded border border-border px-2 py-1 text-muted-foreground" title={ageRating.verified ? "MyAnimeList age classification" : "Age classification not confirmed"}>{ageRating.label}</span>
          </div>
          {info.data?.description && <p className="mt-4 line-clamp-6 border-t border-border/60 pt-4 text-xs leading-5 text-muted-foreground">{info.data.description.replace(/<[^>]+>/g, "")}</p>}
          <dl className="mt-4 space-y-2 border-t border-border/60 pt-4 text-xs">
            {info.data?.seasonYear && <div className="flex items-center justify-between gap-2"><dt className="text-muted-foreground">Year</dt><dd className="font-semibold">{info.data.seasonYear}</dd></div>}
            {info.data?.format && <div className="flex items-center justify-between gap-2"><dt className="text-muted-foreground">Format</dt><dd className="font-semibold">{info.data.format}</dd></div>}
            {info.data?.duration && <div className="flex items-center justify-between gap-2"><dt className="text-muted-foreground">Duration</dt><dd className="font-semibold">{info.data.duration} min</dd></div>}
            {info.data?.genres?.length ? <div><dt className="mb-1 text-muted-foreground">Genres</dt><dd className="leading-5">{info.data.genres.join(", ")}</dd></div> : null}
          </dl>
          <div className="mt-5 rounded-lg border border-border/60 bg-background/50 p-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Rate this anime</p>
            <div className="mt-2 flex justify-center gap-1" role="group" aria-label="Rate this anime locally">
              {[1,2,3,4,5].map((n) => <button key={n} type="button" onClick={() => setRating(n)} aria-label={`Rate ${n} out of 5`} aria-pressed={rating === n} className="text-muted-foreground transition hover:scale-110 hover:text-primary"><Star className={`h-5 w-5 ${n <= rating ? "fill-primary text-primary" : ""}`} /></button>)}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">{rating ? `Your selection: ${rating}/5 (not submitted)` : "Select your rating"}</p>
          </div>
        </aside>
        <div className="min-w-0">
          <div className="aspect-video overflow-hidden rounded-md bg-black">
            {eps.isPending || (current && streams.isPending) ? <div role="status" className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin" />{eps.isPending ? "Finding episode…" : `Loading ${providerLabel(current!.provider)}…`}</div>
              : !current ? <div role="alert" className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground"><p>{sources.length ? "None of the sources had a working video for this episode." : `No ${audio} version found for this episode.`}</p>{sources.length > 0 && <Button variant="outline" onClick={() => setFailed([])}>Try again</Button>}</div>
              : streams.isError ? <div role="alert" className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">{providerLabel(current.provider)} has no video for this episode right now. Pick another source.</div>
              : stream ? <VideoPlayer key={stream.src} ref={playerRef} kind={stream.kind} src={stream.src} subtitles={stream.subtitles} intro={stream.intro} poster={episode?.image ?? undefined} autoSkip={autoSkip} fileName={`${title} - ${ep}`} autoPlay={autoPlay}
                  onLoaded={(v) => { if (resumeAt > 5 && resumeAt < v.duration - 30) v.currentTime = resumeAt; }}
                  onEnded={() => { if (playerRef.current) save(playerRef.current, true); if (autoNext && next) go({ ep: next.number }); }}
                  onError={() => { if (streams.data && server < streams.data.length - 1) setServer(server + 1); }} /> : null}
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/15 px-3 py-2 text-xs font-medium text-foreground">
            <Flag className="h-4 w-4 shrink-0" /> If an episode is not working, please report it and we will look into it.
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border/60 py-3 text-[11px] font-bold uppercase">
            <span className="text-primary">● <span className="font-extrabold">WATCHING</span> · Episode {ep}</span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <button type="button" onClick={() => setTheaterMode(!theaterMode)} className="flex items-center gap-1 hover:text-primary"><MonitorPlay className="h-4 w-4" /> {theaterMode ? "Exit theater" : "Theater"}</button>
              <button type="button" onClick={() => setShowShortcuts(!showShortcuts)} className="flex items-center gap-1 hover:text-primary"><Keyboard className="h-4 w-4" /> Keys</button>
              <button type="button" disabled={creatingRoom} onClick={() => void createRoom()} className="flex items-center gap-1 hover:text-primary"><Users className="h-4 w-4" /> W2G</button>
              <button type="button" aria-pressed={autoPlay} onClick={() => setAutoPlay(!autoPlay)} className={`flex items-center gap-1 ${autoPlay ? "text-primary" : ""}`}><Play className="h-4 w-4" /> Auto play {autoPlay ? "on" : "off"}</button>
              <button type="button" aria-pressed={autoNext} onClick={() => setAutoNext(!autoNext)} className={`flex items-center gap-1 ${autoNext ? "text-primary" : ""}`}><SkipForward className="h-4 w-4" /> Auto next {autoNext ? "on" : "off"}</button>
              <button type="button" aria-pressed={autoSkip} onClick={() => setAutoSkip(!autoSkip)} className={`flex items-center gap-1 ${autoSkip ? "text-primary" : ""}`}><SkipForward className="h-4 w-4" /> Auto skip {autoSkip ? "on" : "off"}</button>
              {info.data && <WatchlistButton anime={{ id, title, cover }} />}
              <button type="button" onClick={() => { setReportOpen(!reportOpen); setReportSent(false); }} className="flex items-center gap-1 hover:text-primary"><Flag className="h-4 w-4" /> Report</button>
            </div>
          </div>
          {roomError && <p role="alert" className="my-2 text-xs text-destructive">{roomError}</p>}
          {showShortcuts && <div className="my-2 rounded border border-border bg-card p-3 text-xs text-muted-foreground">Player shortcuts: Space/K = play or pause · ←/→ = seek 10 seconds · F = fullscreen · M = mute</div>}
          {reportOpen && <div className="my-3 rounded-md border border-border bg-card p-3">
            <div className="flex items-center justify-between"><h3 className="text-sm font-bold">Report playback problem</h3><button aria-label="Close report" onClick={() => setReportOpen(false)}><X className="h-4 w-4" /></button></div>
            <p className="mt-2 text-xs text-muted-foreground">Reports are not submitted to staff until a reporting service is configured.</p>
            <textarea value={reportText} onChange={(e) => setReportText(e.target.value)} placeholder="Describe the playback issue..." className="mt-2 w-full rounded border border-border bg-background p-2 text-sm" rows={2} />
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(`Streamly playback report: ${title}, episode ${ep}, ${audio}. ${reportText}`); setReportSent(true); }} disabled={!reportText.trim()}>Copy report</Button>
            {reportSent && <span className="ml-2 text-xs text-muted-foreground">Report copied. Send it to the site administrator.</span>}
          </div>}
          <div className="grid gap-4 border-b border-border/60 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">You are Watching</p>
              <p className="mt-1 text-sm font-bold">Episode {ep}{episode?.title ? ` — ${episode.title}` : ""}</p>
              <p className="mt-2 text-xs text-muted-foreground">If the current source doesn't work, try another available server.</p>
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 pb-1 text-xs"><span className="text-muted-foreground">Audio:</span><button type="button" onClick={() => go({audio:"sub"})} className={`rounded border px-3 py-1.5 font-semibold ${audio === "sub" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>SUB</button><button type="button" onClick={() => go({audio:"dub"})} className={`rounded border px-3 py-1.5 font-semibold ${audio === "dub" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>DUB</button>{!hasDub && <span className="text-muted-foreground">Dub not available for this episode</span>}</div>
              {(["sub", "dub"] as const).map((lang) => {
                const available = (episode?.sources ?? []).filter((s) => s.audio === lang);
                return <div key={lang} className="flex items-start gap-3"><span className="w-12 pt-2 text-xs font-bold uppercase text-muted-foreground">{lang}:</span>
                  <div className="flex flex-wrap gap-2">{available.length ? available.map((source, i) => <button key={source.provider} type="button" onClick={() => go({ audio: lang, provider: source.provider })} className={`min-w-20 rounded-md border px-3 py-2 text-xs font-semibold ${audio === lang && current?.provider === source.provider ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary"}`}>{providerLabel(source.provider) || `Server ${i + 1}`}</button>) : <span className="py-2 text-xs text-muted-foreground">No {lang.toUpperCase()} source available</span>}</div>
                </div>;
              })}
              {(streams.data?.length ?? 0) > 1 && <div className="flex flex-wrap items-center gap-2 pt-1"><span className="text-xs text-muted-foreground">Stream:</span>{streams.data!.map((item, i) => <Button key={i} size="sm" variant={i === server ? "default" : "outline"} onClick={() => setServer(i)}>{item.label || `Stream ${i + 1}`}</Button>)}</div>}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={!prev} onClick={() => prev && go({ ep: prev.number })}><ChevronLeft className="h-4 w-4" /> Previous</Button>
            <Button variant="outline" size="sm" disabled={!next} onClick={() => next && go({ ep: next.number })}>Next <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
        <aside className={`${theaterMode ? "hidden" : ""} min-w-0 rounded-xl border border-border bg-card/40 p-3 `}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-extrabold">Episodes <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{list.length}</span></h2><div className="flex items-center gap-1 text-[10px] font-bold">{(["all","sub","dub"] as const).map((filter) => <button key={filter} type="button" onClick={() => setEpisodeAudioFilter(filter)} aria-pressed={episodeAudioFilter === filter} className={`rounded px-2 py-1 uppercase ${episodeAudioFilter === filter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{filter}</button>)}<button type="button" onClick={() => setEpisodeView(episodeView === "list" ? "grid" : "list")} aria-label="Toggle episode grid/list" className="rounded border border-border px-2 py-1">{episodeView === "list" ? "▦" : "☰"}</button><button type="button" onClick={() => setShowEpisodeImages(!showEpisodeImages)} aria-label="Toggle episode thumbnails" className="rounded border border-border px-2 py-1">{showEpisodeImages ? "◉" : "◎"}</button></div></div>
          <label className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={episodeSearch} onChange={(e) => setEpisodeSearch(e.target.value)} placeholder="Search episodes..." aria-label="Search episodes" className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary" /></label>
          <div className={`mt-3 max-h-[72vh] overflow-y-auto pr-1 ${episodeView === "grid" ? "grid grid-cols-5 content-start gap-2" : "space-y-2"}`}>
            {filteredEpisodes.map((e) => <button key={e.number} type="button" onClick={() => go({ ep: e.number })} className={`${episodeView === "grid" ? "flex aspect-square items-center justify-center text-center" : "flex w-full items-center gap-3 text-left"} rounded-lg border p-2 transition hover:border-primary/70 hover:bg-muted/50 ${e.number === ep ? "border-primary bg-primary/10" : "border-border/40"}`}>
              {episodeView === "list" && showEpisodeImages && <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded bg-muted">{(e.image || cover) && <img src={e.image || cover || ""} alt="" loading="lazy" className="h-full w-full object-cover" />}{e.number === ep && <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-primary"><Play className="h-5 w-5 fill-current" /></span>}</div>}
              <div className="min-w-0"><p className={`text-[10px] font-bold uppercase ${e.number === ep ? "text-primary" : "text-muted-foreground"}`}>{episodeView === "grid" ? e.number : `EP ${String(e.number).padStart(2, "0")}`}</p>{episodeView === "list" && <p className="mt-1 line-clamp-2 text-xs font-semibold">{e.title || `Episode ${e.number}`}</p>}{episodeView === "list" && <p className="mt-1 flex gap-1 text-[9px] font-bold">{e.sources.some((s) => s.audio === "sub") && <span className="rounded bg-muted px-1">SUB</span>}{e.sources.some((s) => s.audio === "dub") && <span className="rounded bg-primary/20 px-1 text-primary">DUB</span>}</p>}</div>
            </button>)}
            {!filteredEpisodes.length && <div className="p-4 text-center text-sm text-muted-foreground">{eps.isPending ? <span><RefreshCw className="mr-2 inline h-4 w-4 animate-spin" />Finding episodes…</span> : eps.isError ? <span>Episodes could not be loaded. <button className="font-bold text-primary underline" onClick={() => void eps.refetch()}>Retry</button></span> : list.length === 0 ? "No episodes available yet." : "No episodes match your search."}</div>}
          </div>
        </aside>
      </div>
      <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_355px]">
        <section className="min-w-0">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="flex items-center gap-2 text-lg font-extrabold uppercase"><MessageSquare className="h-5 w-5 text-primary" /> Comments <span className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground">{comments.length}</span></h2>
            <div className="flex items-center gap-3 text-xs font-semibold">{(["newest", "oldest"] as const).map((sort) => <button key={sort} type="button" onClick={() => setCommentSort(sort)} className={`rounded px-2 py-1 capitalize ${commentSort === sort ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{sort}</button>)}</div>
          </div>
          <p className="my-3 rounded bg-card/60 p-3 text-xs text-muted-foreground">Share your thoughts about this episode. Be respectful and avoid spoilers. Comments are currently saved only in this browser, not shared publicly.</p>
          <div className="rounded-lg border border-border bg-card/30 p-3">
            {replyTo && <div className="mb-2 flex items-center justify-between text-xs text-primary"><span>Replying to {comments.find((c) => c.id === replyTo)?.author}</span><button onClick={() => setReplyTo(null)} aria-label="Cancel reply"><X className="h-4 w-4" /></button></div>}
            <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} rows={3} placeholder={user ? "Write your comment..." : "Sign in to comment..."} className="w-full resize-y rounded border border-border bg-background p-3 text-sm outline-none focus:border-primary" />
            <div className="mt-2 flex justify-end"><Button size="sm" onClick={postComment} disabled={!commentText.trim()}><Send className="mr-2 h-4 w-4" />{user ? "Post comment" : "Sign in to post"}</Button></div>
          </div>
          <div className="mt-5 space-y-5">
            {comments.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No comments yet. Be the first to share your thoughts.</p>}
            {[...comments].sort((a,b) => commentSort === "newest" ? b.created - a.created : a.created - b.created).map((comment) => <article key={comment.id} className={`border-b border-border/50 pb-4 ${comment.parent ? "ml-7 border-l-2 border-l-primary/40 pl-3" : ""}`}>
              <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">{comment.author.slice(0,1).toUpperCase()}</span><strong className="text-xs">{comment.author}</strong><span className="text-[11px] text-muted-foreground">{new Date(comment.created).toLocaleDateString()}</span></div>
              {comment.parent && <p className="mt-1 text-xs text-primary">Reply to {comments.find((c) => c.id === comment.parent)?.author || "comment"}</p>}
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">{comment.body}</p>
              <div className="mt-2 flex gap-4 text-xs text-muted-foreground"><button onClick={() => voteComment(comment.id, "likes")} className="flex items-center gap-1 hover:text-primary"><ThumbsUp className="h-3.5 w-3.5" /> {comment.likes}</button><button onClick={() => voteComment(comment.id, "dislikes")} className="flex items-center gap-1 hover:text-primary"><ThumbsDown className="h-3.5 w-3.5" /> {comment.dislikes}</button><button onClick={() => { setReplyTo(comment.id); document.querySelector("textarea")?.focus(); }} className="flex items-center gap-1 hover:text-primary"><Reply className="h-3.5 w-3.5" /> Reply</button></div>
            </article>)}
          </div>
        </section>
        <aside className="min-w-0">
          <h2 className="mb-4 border-l-2 border-primary pl-3 text-lg font-extrabold">Related Anime</h2>
          {recommended.length ? <div className="space-y-3">{recommended.map((item) => item && <Link key={item.id} to="/anime/$id" params={{ id: String(item.id) }} className="group flex gap-3 rounded border border-border/40 bg-card/30 p-2 hover:border-primary">
            <img src={item.coverImage.large || ""} alt="" loading="lazy" className="h-24 w-16 shrink-0 rounded object-cover" />
            <div className="min-w-0"><p className="line-clamp-2 text-sm font-bold group-hover:text-primary">{animeTitle(item)}</p><p className="mt-2 text-xs uppercase text-muted-foreground">{item.format?.replaceAll("_", " ") || "Anime"} · {item.seasonYear || "—"}</p><p className="mt-2 text-xs text-primary">★ {item.averageScore != null ? (item.averageScore / 10).toFixed(1) : "N/A"}</p></div>
          </Link>)}</div> : <p className="text-sm text-muted-foreground">No related anime available for this series.</p>}
        </aside>
      </div>
    </main>
  );
}
