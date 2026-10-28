import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Play, Info, Star, ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { animeCatalogQuery, type CatalogAnime } from "@/lib/anime-catalog";
import { animeTitle } from "@/lib/kitsune";
import { AnimeCard } from "@/components/AnimeCard";
import { Button } from "@/components/ui/button";
import { ContinueWatchingShelf } from "@/components/ContinueWatchingShelf";
import { PersonalizedRecommendations } from "@/components/PersonalizedRecommendations";
import { EpisodeCountdown } from "@/components/EpisodeCountdown";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Streamly | Discover Anime" },
      { name: "description", content: "Watch the newest episodes, trending series and fresh uploads on Streamly." },
      { property: "og:title", content: "Streamly — Watch the latest series episodes" },
      { property: "og:description", content: "Watch the newest episodes, trending series and fresh uploads on Streamly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type S = CatalogAnime;

function Hero({ s }: { s: S }) {
  const img = s.bannerImage || s.coverImage.extraLarge || s.coverImage.large;
  return (
    <div className="relative flex min-h-[430px] items-end overflow-hidden bg-muted md:min-h-[490px]">
      {img && <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-overlay/60 to-transparent" />
      <div className="relative z-10 min-w-0 px-6 pb-10 pt-24 sm:px-9 md:px-12">
        <div className="flex flex-wrap gap-3 text-xs font-semibold text-foreground">
          <span>{s.format?.replaceAll("_", " ") ?? "Anime"}</span>
          {s.seasonYear && <span>{s.seasonYear}</span>}
          {s.averageScore != null && <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-star text-star" />{(s.averageScore / 10).toFixed(1)}</span>}
        </div>
        <h1 className="mt-4 max-w-3xl break-words text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">{animeTitle(s)}</h1>
        {s.description && <p className="mt-4 line-clamp-3 max-w-2xl text-sm leading-7 text-foreground">{s.description.replace(/<[^>]+>/g, "")}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild className="h-11 px-6 font-bold"><Link to="/anime/$id" params={{ id: String(s.id) }}><Play className="h-4 w-4 fill-current" /> Watch now</Link></Button>
          <Button asChild variant="outline" className="h-11 bg-background/70 px-6 font-bold"><Link to="/anime/$id" params={{ id: String(s.id) }}><Info className="h-4 w-4" /> View details</Link></Button>
        </div>
      </div>
    </div>
  );
}

function Grid({ title, items, loading, filters }: { title: string; items: S[]; loading?: boolean; filters?: boolean }) {
  const [f, setF] = useState<"all" | "series" | "movies">("all");
  const shown = items.filter((s) => f === "all" || (f === "movies" ? s.format === "MOVIE" : s.format !== "MOVIE"));
  return (
    <section>
      <SectionTitle title={title}>
        {filters && (
          <div className="flex gap-4 text-sm font-semibold">
            {(["all", "series", "movies"] as const).map((k) => (
              <Button variant="ghost" size="sm" key={k} onClick={() => setF(k)} aria-pressed={f === k} className={`capitalize ${f === k ? "text-primary" : "text-muted-foreground"}`}>{k}</Button>
            ))}
          </div>
        )}
      </SectionTitle>
      {loading ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" />Loading anime…</p> : shown.length ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {shown.map((s) => <AnimeCard key={s.id} a={s} />)}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No anime found for this filter.</p>
      )}
    </section>
  );
}

type AiringItem = { airingAt: number; episode: number; media: { id: number; title: { english: string | null; romaji: string }; coverImage: { large: string | null } } };
async function fetchUpcoming(): Promise<AiringItem[]> {
  const now = Math.floor(Date.now() / 1000);
  const response = await fetch("https://graphql.anilist.co", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: `query ($start: Int, $end: Int) { Page(page: 1, perPage: 50) { airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) { airingAt episode media { id title { english romaji } coverImage { large } isAdult } } } }`, variables: { start: now - 1, end: now + 8 * 86400 } }),
  });
  if (!response.ok) throw new Error("Release schedule unavailable");
  const json = await response.json();
  if (json.errors?.length) throw new Error("Release schedule unavailable");
  return (json.data?.Page?.airingSchedules ?? []).filter((item: AiringItem & { media: { isAdult?: boolean } }) => item.media && !item.media.isAdult);
}
function Schedule() {
  const [sel, setSel] = useState(0);
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["anilist-airing-schedule"], queryFn: fetchUpcoming, staleTime: 15 * 60 * 1000, refetchInterval: 30 * 60 * 1000 });
  const days = Array.from({ length: 7 }, (_, k) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + k); return d; });
  const key = (d: Date) => d.toLocaleDateString("en-CA");
  const selectedDate = days[sel] ?? days[0];
  const items = (data ?? []).filter((item) => key(new Date(item.airingAt * 1000)) === key(selectedDate));
  return <aside className="rounded-lg border border-border bg-card p-4">
    <div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-xl font-extrabold">Upcoming Anime</h2><span className="text-xs text-muted-foreground">Next 7 days</span></div>
    <div className="grid grid-cols-7 gap-1.5 border-b border-border pb-4">{days.map((d, k) => <button key={key(d)} onClick={() => setSel(k)} aria-pressed={sel === k} className="flex flex-col items-center gap-1"><span className={`text-[10px] font-bold uppercase ${sel === k ? "text-primary" : "text-muted-foreground"}`}>{d.toLocaleDateString("en-GB", { weekday: "short" })}</span><span className={`grid h-9 w-full place-items-center rounded text-sm font-extrabold ${sel === k ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{d.getDate()}</span></button>)}</div>
    <p className="mt-3 text-xs font-semibold text-muted-foreground">{selectedDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
    <div className="mt-2 max-h-80 space-y-2 overflow-y-auto">
      {isPending ? <p className="py-3 text-sm text-muted-foreground">Loading upcoming episodes…</p>
        : isError ? <div className="py-3 text-sm text-muted-foreground">Schedule could not be loaded. <button className="text-primary underline" onClick={() => void refetch()}>Retry</button></div>
        : items.length ? items.map((item) => <Link key={item.media.id + "-" + item.airingAt} to="/anime/$id" params={{ id: String(item.media.id) }} className="flex items-center gap-3 rounded-md border border-border/70 bg-background/60 p-3 hover:border-primary">
          {item.media.coverImage.large && <img src={item.media.coverImage.large} alt="" className="h-14 w-10 shrink-0 rounded object-cover" />}
          <div className="min-w-0"><p className="line-clamp-2 text-sm font-semibold">{animeTitle(item.media)}</p><p className="mt-1 text-xs text-muted-foreground"><EpisodeCountdown airingAt={item.airingAt} episode={item.episode} /> · {new Date(item.airingAt * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} local time</p></div>
        </Link>) : <p className="py-3 text-sm text-muted-foreground">No scheduled episodes found for this date.</p>}
    </div>
    <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">Planned AniList airing times, shown in your local time zone. Dates may change and do not guarantee streaming availability.</p>
  </aside>;
}

function TopTrending({ daily, weekly, monthly, loading }: { daily: S[]; weekly: S[]; monthly: S[]; loading: boolean }) {
  // AniList exposes a current TRENDING_DESC ranking, not historical daily/weekly/monthly leaderboards.
  const ranked = daily.slice(0, 10);
  return (
    <aside className="relative overflow-hidden rounded-xl border border-border bg-card/70 p-3.5 shadow-lg sm:p-4">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
        <h2 className="shrink-0 text-lg font-black tracking-tight sm:text-xl">Top Trending</h2>
        <span className="text-[11px] font-bold text-muted-foreground">AniList · Current</span>
      </div>
      <div className="mt-4 space-y-3">
        {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading trending anime…</p> : ranked.length ? ranked.map((anime, index) => {
          const artwork = anime.bannerImage || anime.coverImage.extraLarge || anime.coverImage.large;
          return <Link key={anime.id} to="/anime/$id" params={{ id: String(anime.id) }} className="group relative flex min-h-[92px] items-center gap-3 overflow-hidden rounded-lg border border-border/40 bg-background transition-colors hover:border-primary/70">
            {artwork && <img src={artwork} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-center opacity-20 grayscale-[35%] transition-all group-hover:opacity-35" />}
            <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/85 to-background/55" />
            <span aria-hidden="true" className="absolute left-2 top-1/2 -translate-y-1/2 text-[76px] font-black italic leading-none text-primary/10">{index + 1}</span>
            <span className="relative z-10 w-16 shrink-0 text-center text-4xl font-black italic text-foreground drop-shadow-md">{index + 1}</span>
            <div className="relative z-10 min-w-0 flex-1 pr-2">
              <p className="truncate text-sm font-extrabold text-foreground group-hover:text-primary" title={animeTitle(anime)}>{animeTitle(anime)}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold text-muted-foreground">
                {anime.averageScore != null && <span className="flex items-center gap-1 text-yellow-400"><Star size={12} fill="currentColor" />{(anime.averageScore / 10).toFixed(1)}</span>}
                <span>{anime.format?.replaceAll("_", " ") || "ANIME"}</span>
                {anime.episodes != null && <span className="rounded bg-muted/70 px-1.5 py-0.5">▤ {anime.episodes}</span>}
              </div>
            </div>
          </Link>;
        }) : <p className="py-8 text-center text-sm text-muted-foreground">Trending anime is unavailable right now.</p>}
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">Current AniList trending order, not Streamly viewing figures or historical day/week/month statistics.</p>
    </aside>
  );
}

function SectionTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="border-l-[3px] border-primary pl-3 text-xl font-extrabold md:text-2xl">{title}</h2>
      {children}
    </div>
  );
}

function Index() {
  const catalog = useQuery(animeCatalogQuery());
  const isLoading = catalog.isPending;
  const [i, setI] = useState(0);
  const featured = (catalog.data?.trending ?? []).slice(0, 8);
  const popularAnime = catalog.data?.popular ?? [];
  const latestEpisodes = catalog.data?.airing ?? [];
  const activeIndex = featured.length ? i % featured.length : 0;
  const current = featured[activeIndex];

  useEffect(() => {
    if (featured.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % featured.length), 7000);
    return () => clearInterval(t);
  }, [featured.length]);

  return (
    <main>
      <section className="relative mx-auto max-w-[1900px] px-4 pb-8 pt-6 sm:px-6 md:pt-8">
        {current ? (
          <>
            <Hero key={current.id} s={current} />
            <div className="absolute right-8 top-10 z-20 flex gap-2 md:right-10 md:top-12">
              {[ChevronLeft, ChevronRight].map((Ic, k) => (
                <Button variant="outline" size="icon" key={k} aria-label={k ? "Next" : "Previous"} onClick={() => setI((x) => (x + (k ? 1 : -1) + featured.length) % featured.length)} className="bg-overlay/60">
                  <Ic className="h-4 w-4" />
                </Button>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-end gap-1">
              {featured.map((f, k) => (
                <Button variant="ghost" key={f.id} aria-label={`Slide ${k + 1}`} aria-pressed={k === activeIndex} onClick={() => setI(k)} className="h-6 w-7 rounded-none p-0"><span className={`h-1 rounded-full ${k === activeIndex ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/50"}`} /></Button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex min-h-[390px] flex-col justify-center gap-4 rounded-2xl border border-border bg-card px-6 py-12 sm:px-8 md:px-12">
            <p className="text-sm font-bold uppercase text-primary">Streamly</p>
            <h1 className="max-w-lg text-4xl font-black">{isLoading ? "Loading anime…" : "Anime couldn’t be loaded"}</h1>
            {catalog.isError && <div role="alert"><p className="text-muted-foreground">{catalog.error.message}</p><Button variant="outline" className="mt-4" onClick={() => void catalog.refetch()}>Try again</Button></div>}

          </div>
        )}
      </section>

      <div className="mx-auto grid max-w-[1900px] items-start gap-6 px-4 pb-20 pt-3 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-12">
          <ContinueWatchingShelf compact />
          <PersonalizedRecommendations />
          <Grid title="Currently Airing" items={latestEpisodes} loading={isLoading} filters />
          <Grid title="Trending Anime" items={catalog.data?.trending ?? []} loading={isLoading} />
          <Grid title="Popular Anime" items={popularAnime} loading={isLoading} filters />
        </div>
        <div className="space-y-6">
          <TopTrending daily={catalog.data?.trending ?? []} weekly={catalog.data?.popular ?? []} monthly={catalog.data?.trending ?? []} loading={isLoading} />
          <Schedule />
        </div>
      </div>
    </main>
  );
}
