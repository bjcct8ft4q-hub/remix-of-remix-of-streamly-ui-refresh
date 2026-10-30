import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, LoaderCircle, Play, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WatchlistButton } from "@/components/WatchlistButton";
import { animeTitle, type AnimeSummary, type Audio } from "@/lib/kitsune";
import { animeQuery, episodesQuery } from "@/lib/anime-queries";
import { useAuth } from "@/lib/auth";
import { historyQuery } from "@/lib/library";
import { useAudioPreference } from "@/lib/audio-preference";
import { fetchSeasonChain } from "@/lib/anime-series";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";


export const Route = createFileRoute("/anime/$id")({
  head: () => ({
    meta: [
      { title: "Watch anime — Streamly" },
      { name: "description", content: "Episodes, sub and dub, for this anime on Streamly." },
      { property: "og:title", content: "Watch anime — Streamly" },
      { property: "og:description", content: "Episodes, sub and dub, for this anime on Streamly." },
      { property: "og:type", content: "video.tv_show" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnimePage,
});

function AnimePage() {
  const id = Number(Route.useParams().id);
  const { user } = useAuth();
  const [tab, setTab] = useState<"overview" | "cast" | "related" | "recommendations">("overview");
  const [showAllCast, setShowAllCast] = useState(false);
  const [showFullSynopsis, setShowFullSynopsis] = useState(false);
  const [relatedType, setRelatedType] = useState("ALL");
  const [manualAudio, setManualAudio] = useState<Audio | null>(null);
  const { preference } = useAudioPreference();
  const info = useQuery(animeQuery(id));
  const seasons = useQuery({ queryKey: ["anime-season-chain", id], queryFn: () => fetchSeasonChain(id), staleTime: 60 * 60 * 1000 });
  const eps = useQuery(episodesQuery(id));
  const hist = useQuery(historyQuery(user?.id, id));
  const a = info.data;
  if (info.isPending) return <main className="flex min-h-[60vh] items-center justify-center pt-28"><LoaderCircle className="animate-spin text-primary" /></main>;
  if (!a) return <main className="mx-auto max-w-3xl px-4 pt-40 text-center"><h1 className="text-2xl font-bold">Anime not found</h1></main>;
  const title = animeTitle(a);
  const hasDub = (eps.data ?? []).some((e) => e.sources.some((s) => s.audio === "dub"));
  const audio: Audio = manualAudio ?? (preference !== "sub" && hasDub ? "dub" : "sub");
  const list = (eps.data ?? []).filter((e) => e.sources.some((s) => s.audio === audio));
  const related = (a.relations?.edges ?? []).filter((edge) => edge.node?.id && edge.node.format);
  const filteredRelated = related.filter((edge) => relatedType === "ALL" || (relatedType === "MOVIE" ? edge.node.format === "MOVIE" : relatedType === "OVA" ? ["OVA", "SPECIAL", "ONA"].includes(edge.node.format || "") : edge.node.format === "TV" || edge.node.format === "TV_SHORT"));
  // AniList recommendations belong to this exact media ID and are ordered by community votes.
  // Deduplicate results, exclude the current title, and never substitute unrelated trending titles.
  const recommendations = Array.from(new Map(
    (a.recommendations?.nodes ?? [])
      .map((node) => node.mediaRecommendation)
      .filter((item): item is AnimeSummary => !!item?.id && item.id !== a.id)
      .map((item) => [item.id, item] as const),
  ).values());
  const watched = new Map((hist.data ?? []).map((h) => [h.episode, h]));
  const resume = hist.data?.[0];
  const first = resume?.episode ?? list[0]?.number;
  return (
    <main className="pb-20">
      <div className="relative h-52 overflow-hidden sm:h-64 md:h-80">
        {a.bannerImage && <img src={a.bannerImage} alt="" className="h-full w-full object-cover object-center opacity-40" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
      </div>
      <div className="relative mx-auto -mt-20 max-w-[1400px] px-4 sm:px-6 md:-mt-28 md:px-8">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:gap-7">
          <div className="w-36 shrink-0 overflow-hidden rounded-lg border border-border bg-card shadow-xl sm:w-44 md:w-48"><img src={a.coverImage.extraLarge || a.coverImage.large || ""} alt={title} className="aspect-[2/3] h-auto w-full object-cover object-center" /></div>
          <div className="min-w-0 flex-1 pt-2 sm:pt-6 md:pt-10">
            <h1 className="text-3xl font-extrabold md:text-4xl">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{[a.format?.replaceAll("_", " "), a.seasonYear, a.episodes && `${a.episodes} episodes`, a.averageScore && `★ ${(a.averageScore / 10).toFixed(1)}`, ...a.genres].filter(Boolean).join(" · ")}</p>
            <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-md border border-border bg-card px-3 py-1 text-xs font-bold">★ AniList {a.averageScore != null ? `${(a.averageScore / 10).toFixed(1)}/10` : "Not rated"}</span></div>
            <div className="mt-4 flex flex-wrap gap-2">
              {first != null && <Button asChild><Link to="/anime/$id/watch" params={{ id: String(id) }} search={{ ep: first, audio: resume?.audio === "dub" ? "dub" : audio }}><Play /> {resume ? `Continue episode ${resume.episode}` : "Watch now"}</Link></Button>}
              <WatchlistButton anime={{ id, title, cover: a.coverImage.large }} />
              <Button variant="outline" onClick={() => { if (typeof navigator !== "undefined" && navigator.share) void navigator.share({ title, url: window.location.href }); else if (typeof navigator !== "undefined" && navigator.clipboard) void navigator.clipboard.writeText(window.location.href); }}><Share2 className="h-4 w-4" /> Share</Button>
              {(seasons.isPending || (seasons.data?.length ?? 0) > 1) && <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" disabled={seasons.isPending}>Seasons {seasons.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-80 w-72 overflow-y-auto border-primary/40 bg-card">
                  {(seasons.data ?? []).map((season, index) => <DropdownMenuItem key={season.id} asChild>
                    <Link to="/anime/$id" params={{ id: String(season.id) }} className={season.id === id ? "bg-primary/15 text-primary" : ""}>
                      <img src={season.coverImage.large || ""} alt="" className="mr-2 h-12 w-9 rounded object-cover" />
                      <span className="min-w-0"><span className="block text-sm font-bold">Season {index + 1}</span><span className="block truncate text-xs text-muted-foreground">{animeTitle(season)}</span></span>
                    </Link>
                  </DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>}
            </div>
            {a.description && <div className="mt-4 max-w-3xl"><p className={`whitespace-pre-line text-sm leading-6 text-muted-foreground ${showFullSynopsis ? "" : "line-clamp-4"}`}>{a.description.replace(/<[^>]+>/g, "")}</p>{a.description.replace(/<[^>]+>/g, "").length > 240 && <button type="button" className="mt-2 text-xs font-semibold text-primary hover:underline" onClick={() => setShowFullSynopsis(v => !v)}>{showFullSynopsis ? "Show less" : "Read full synopsis"}</button>}</div>}
          </div>
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="h-fit rounded-lg border border-border bg-card p-4 text-sm">
            <h2 className="mb-4 border-l-2 border-primary pl-2 font-bold">Anime information</h2>
            {[
              ["Type", a.format?.replaceAll("_", " ")],
              ["Episodes", a.episodes],
              ["Duration", a.duration ? `${a.duration} min` : null],
              ["Status", a.status?.replaceAll("_", " ")],
              ["Start date", [a.startDate?.year, a.startDate?.month && String(a.startDate.month).padStart(2, "0"), a.startDate?.day && String(a.startDate.day).padStart(2, "0")].filter(Boolean).join("-")],
              ["Season", [a.season, a.seasonYear].filter(Boolean).join(" ")],
              ["Origin", a.countryOfOrigin],
            ].map(([label, value]) => <div key={String(label)} className="mb-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold capitalize">{value || "Unknown"}</p></div>)}
          </aside>
          <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-card/70">
            <div className="grid grid-cols-4 border-b border-border" role="tablist" aria-label="Anime details">
              {(["overview", "cast", "related", "recommendations"] as const).map((item) => <button key={item} role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`border-b-2 px-1 py-3 text-xs font-bold capitalize transition sm:px-4 sm:text-sm ${tab === item ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{item}</button>)}
            </div>
            <div className="min-h-60 p-4 sm:p-5" role="tabpanel">
              {tab === "overview" && <div className="space-y-6">
                <div><h3 className="mb-2 font-bold">Alternative titles</h3><div className="flex flex-wrap gap-2">{[a.title.romaji, ...a.synonyms].filter(Boolean).map((name, i) => <span key={i} className="rounded bg-muted px-2 py-1 text-xs">{name}</span>)}</div></div>
                <div><h3 className="mb-2 font-bold">Studios</h3><div className="flex flex-wrap gap-2">{a.studios.nodes.length ? a.studios.nodes.map((studio) => <span key={studio.name} className="rounded bg-muted px-2 py-1 text-xs">{studio.name}</span>) : <p className="text-sm text-muted-foreground">No studio information available.</p>}</div></div>
                <div><h3 className="mb-2 font-bold">Tags</h3><div className="flex flex-wrap gap-2">{a.tags.filter((tag) => !tag.isMediaSpoiler).slice(0, 30).map((tag) => <span key={tag.name} className="rounded bg-muted px-2 py-1 text-xs">{tag.name} <span className="text-muted-foreground">{tag.rank}%</span></span>)}</div></div>
                <div><h3 className="mb-3 font-bold">Stats</h3><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[["Episodes", a.episodes ?? "—"], ["Duration", a.duration ? `${a.duration}m` : "—"], ["AniList score", a.averageScore ? `${(a.averageScore / 10).toFixed(1)}/10` : "—"], ["Status", a.status?.replaceAll("_", " ") ?? "—"]].map(([label, value]) => <div key={String(label)} className="rounded bg-muted p-3 text-center"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-bold">{value}</p></div>)}</div></div>
                <div><h3 className="font-bold">Discussions</h3><p className="mt-2 rounded bg-muted/60 p-3 text-sm text-muted-foreground">Anime discussions are not available on Streamly yet.</p></div>
              </div>}
              {tab === "cast" && <div><h3 className="mb-4 font-bold uppercase">Characters & Japanese voice actors</h3>{a.characters?.edges?.length ? <><div className="grid gap-2 xl:grid-cols-2">{a.characters.edges.slice(0, showAllCast ? undefined : 12).map((edge) => <div key={edge.node.id} className="flex min-w-0 items-center gap-2 rounded border border-border bg-muted/30 p-2"><img src={edge.node.image.medium || ""} alt="" className="h-16 w-11 shrink-0 rounded object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{edge.node.name.full}</p><p className="text-[10px] font-semibold text-primary">{edge.role}</p></div>{edge.voiceActors[0] && <><div className="min-w-0 text-right"><p className="truncate text-xs font-semibold">{edge.voiceActors[0].name.full}</p><p className="text-[10px] text-muted-foreground">Japanese</p></div>{edge.voiceActors[0].image.medium && <img src={edge.voiceActors[0].image.medium} alt="" className="h-16 w-11 shrink-0 rounded object-cover" />}</>}</div>)}</div>{a.characters.edges.length > 12 && <button className="mt-4 w-full rounded border border-border py-2 text-sm hover:border-primary" onClick={() => setShowAllCast(!showAllCast)}>{showAllCast ? "Show fewer" : `View more (${a.characters.edges.length - 12} remaining)`}</button>}</> : <p className="text-sm text-muted-foreground">Cast details are not available.</p>}</div>}
              {tab === "related" && <div><h3 className="mb-4 font-bold uppercase">Related seasons & series</h3><div className="mb-4 flex flex-wrap gap-2">{[["ALL", "All"], ["TV", "TV"], ["MOVIE", "Movies"], ["OVA", "OVA & specials"]].map(([value, label]) => <button key={value} onClick={() => setRelatedType(value)} className={`rounded border px-3 py-1.5 text-xs font-bold ${relatedType === value ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{label}</button>)}</div>{filteredRelated.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{filteredRelated.map((edge) => <Link key={edge.node.id} to="/anime/$id" params={{ id: String(edge.node.id) }} className="group relative overflow-hidden rounded border border-border hover:border-primary"><img src={edge.node.bannerImage || edge.node.coverImage.large || ""} alt="" className="aspect-[16/9] w-full object-cover opacity-70 transition group-hover:opacity-100" /><div className="absolute inset-0 bg-gradient-to-t from-background/95 to-transparent" /><div className="absolute inset-x-2 bottom-2"><p className="text-[10px] font-bold uppercase text-primary">{edge.relationType.replaceAll("_", " ")} · {edge.node.format}</p><p className="line-clamp-2 text-xs font-bold">{animeTitle(edge.node)}</p><p className="mt-1 text-[10px] text-foreground">★ {edge.node.averageScore != null ? `${(edge.node.averageScore / 10).toFixed(1)}/10` : "Not rated"}</p></div></Link>)}</div> : <p className="text-sm text-muted-foreground">No related anime found in this category.</p>}</div>}
              {tab === "recommendations" && <div>
                <h3 className="font-bold uppercase">Recommended for {title}</h3>
                <p className="mb-4 mt-1 text-xs text-muted-foreground">Community recommendations for this specific series, ranked by AniList votes. Ratings are AniList community scores out of 10.</p>
                {recommendations.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">{recommendations.map((item) => <Link key={item.id} to="/anime/$id" params={{ id: String(item.id) }} className="group min-w-0"><div className="relative overflow-hidden rounded border border-border group-hover:border-primary">{item.coverImage.large ? <img src={item.coverImage.large} alt="" loading="lazy" className="aspect-[2/3] w-full object-cover" /> : <div className="aspect-[2/3] bg-muted" />}<span className="absolute left-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-bold text-primary">★ {item.averageScore != null ? (item.averageScore / 10).toFixed(1) : "Not rated"}</span></div><p className="mt-1 line-clamp-2 text-xs font-semibold group-hover:text-primary">{animeTitle(item)}</p><p className="mt-1 text-[10px] text-muted-foreground">{[item.format?.replaceAll("_", " "), item.seasonYear].filter(Boolean).join(" · ")}</p></Link>)}</div> : <p className="rounded-lg border border-border bg-muted/30 p-5 text-sm text-muted-foreground">AniList has no community recommendations for this anime yet.</p>}
              </div>}
            </div>
          </section>
        </div>
        <section className="mt-10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="border-l-4 border-primary pl-3 text-xl font-bold">Episodes</h2>
            <div className="flex gap-1" role="group" aria-label="Audio">
              <Button size="sm" variant={audio === "sub" ? "default" : "outline"} onClick={() => setManualAudio("sub")}>Sub</Button>
              <Button size="sm" variant={audio === "dub" ? "default" : "outline"} disabled={!hasDub} onClick={() => setManualAudio("dub")}>Dub</Button>
            </div>
          </div>
          {eps.isPending ? <div aria-busy="true">
            <p role="status" className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />Loading playback sources. You can browse episodes while we check…</p>
            {a.episodes != null && a.episodes > 0 ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7 xl:grid-cols-10">{Array.from({ length: Math.min(a.episodes, 500) }, (_, i) => <Link key={i} to="/anime/$id/watch" params={{ id: String(id) }} search={{ ep: i + 1, audio }} className="rounded-md border border-border bg-muted/30 p-3 text-sm transition hover:border-primary hover:text-primary" title="Episode availability is still being checked"><span className="font-bold">EP {i + 1}</span><span className="mt-1 block text-[10px] text-muted-foreground">Checking source…</span></Link>)}</div> : <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7 xl:grid-cols-10">{Array.from({ length: 12 }, (_, i) => <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />)}</div>}
          </div>
            : eps.isError ? <div role="alert" className="text-sm text-muted-foreground">Episodes couldn’t be loaded. <Button variant="link" onClick={() => void eps.refetch()}>Try again</Button></div>
            : !list.length ? <p className="text-sm text-muted-foreground">No {audio} episodes found yet.</p>
            : <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
              {list.map((e) => {
                const h = watched.get(e.number);
                const pct = h && h.duration_seconds ? Math.min(100, (h.progress_seconds / h.duration_seconds) * 100) : 0;
                return (
                  <Link key={e.number} to="/anime/$id/watch" params={{ id: String(id) }} search={{ ep: e.number, audio }} className="relative overflow-hidden rounded-md border border-border bg-muted/30 p-3 text-sm transition hover:border-primary hover:text-primary">
                    <span className="font-bold">EP {e.number}</span>
                    {e.title && <span className="mt-1 block truncate text-xs text-muted-foreground">{e.title}</span>}
                    {pct > 0 && <span className="absolute inset-x-0 bottom-0 h-1 bg-primary" style={{ width: `${pct}%` }} />}
                  </Link>
                );
              })}
            </div>}
        </section>
      </div>
    </main>
  );
}
