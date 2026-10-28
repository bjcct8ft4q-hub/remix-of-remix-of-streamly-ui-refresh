import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Search, Filter, RotateCcw, ChevronDown } from "lucide-react";
import { z } from "zod";
import { seriesListQuery } from "@/lib/queries";
import { SeriesCard } from "@/components/SeriesCard";
import { AnimeCard } from "@/components/AnimeCard";
import type { AnimeSummary } from "@/lib/kitsune";
import { matchesAnimeTitle, resolveAnimeSearch } from "@/lib/anime-search";
import { groupAnimeSeasons } from "@/lib/anime-series";

export const Route = createFileRoute("/browse")({
  validateSearch: z.object({ q: z.string().optional() }),
  head: () => ({ meta: [{ title: "Search anime — Streamly" }, { name: "description", content: "Find anime by title, genre, year, status and format." }] }),
  component: Browse,
});

type Filters = { q: string; genre: string; tag: string; year: string; status: string; format: string; demographic: string; ageRating: string; season: string; origin: string };
const empty: Filters = { q: "", genre: "", tag: "", year: "", status: "", format: "", demographic: "", ageRating: "", season: "", origin: "" };
// AniList has a smaller genre taxonomy; other requested categories are AniList tags.
const genreOptions: [string, string][] = [
  ["Action", "Action"], ["Adventure", "Adventure"], ["Boys Love", "Boys Love / Yaoi"],
  ["Cars", "Cars"], ["Comedy", "Comedy"], ["Demons", "Demons"], ["Drama", "Drama"],
  ["Fantasy", "Fantasy"], ["Video Games", "Game"],
  ["Girls Love", "Girls Love / Yuri"], ["Harem", "Harem"], ["Historical", "Historical"],
  ["Horror", "Horror"], ["Isekai", "Isekai / Reincarnation / Transmigration"],
  ["Magic", "Magic"], ["Martial Arts", "Martial Arts"], ["Mecha", "Mecha"],
  ["Military", "Military"], ["Music", "Music"], ["Mystery", "Mystery"],
  ["Parody", "Parody"], ["Police", "Police"], ["Sci-Fi", "Sci-Fi"],
  ["Slice of Life", "Slice of Life"], ["Space", "Space"], ["Sports", "Sports"],
  ["Super Power", "Super Power"], ["Supernatural", "Supernatural"],
  ["Psychological", "Suspense"], ["Thriller", "Thriller"],
];
const anilistGenres = new Set(["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mecha", "Music", "Mystery", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller", "Boys Love", "Girls Love", "Ecchi"]);
const ageRatings: [string, string][] = [["general", "Non-adult titles"]];
const demographics: [string, string][] = [["Josei", "Josei"], ["Shoujo", "Shoujo"], ["Shounen", "Shounen"]];
const tagOptions: [string, string][] = ["School", "Female Protagonist", "Male Protagonist", "Vampire", "Time Travel", "Revenge", "Super Power", "Military", "Space"].map((x) => [x, x]);
const formats = [["TV", "TV"], ["TV_SHORT", "TV Short"], ["MOVIE", "Movie"], ["OVA", "OVA"], ["ONA", "ONA"], ["SPECIAL", "Special"], ["MUSIC", "Music"]];
const statuses = [["FINISHED", "Finished"], ["RELEASING", "Releasing"], ["NOT_YET_RELEASED", "Not yet released"], ["CANCELLED", "Cancelled"], ["HIATUS", "Hiatus"]];
const seasons: [string, string][] = [["WINTER", "Winter"], ["SPRING", "Spring"], ["SUMMER", "Summer"], ["FALL", "Fall"]];
const origins: [string, string][] = [["JP", "Japan"], ["KR", "South Korea"], ["CN", "China"]];
const years = Array.from({ length: new Date().getFullYear() - 1969 }, (_, i) => String(new Date().getFullYear() - i));
const selectClass = "w-full min-w-0 rounded-md border border-border bg-card px-3 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary";

function FilterPicker({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open]);
  const shown = options.filter(([, text]) => text.toLowerCase().includes(search.toLowerCase()));
  return <div className="relative min-w-0" ref={root}>
    <span className="mb-2 block text-sm font-semibold">{label}</span>
    <button type="button" aria-label={label} aria-expanded={open} aria-haspopup="listbox" onClick={() => { setOpen(!open); setSearch(""); }} className={selectClass + " flex items-center justify-between gap-2 text-left"}>
      <span className="truncate">{options.find(([key]) => key === value)?.[1] || "Any " + label.toLowerCase()}</span>
      <ChevronDown className={"h-4 w-4 shrink-0 text-muted-foreground transition-transform " + (open ? "rotate-180" : "")} />
    </button>
    {open && <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-lg border border-primary/60 bg-card shadow-2xl">
      <div className="border-b border-border p-2"><input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder={"Search " + label.toLowerCase() + "..."} aria-label={"Search " + label} className="w-full rounded-md bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary" /></div>
      <div role="listbox" aria-label={label} className="max-h-64 overflow-y-auto p-1">
        {[["", "Any " + label.toLowerCase()] as [string, string], ...shown].map(([key, text]) =>
          <button type="button" role="option" aria-selected={value === key} key={key} onClick={() => { onChange(key); setOpen(false); }} className={"block w-full rounded px-3 py-2 text-left text-sm hover:bg-primary/15 " + (value === key ? "bg-primary/15 font-semibold text-primary" : "")}>{text}</button>
        )}
        {!shown.length && <p className="px-3 py-4 text-sm text-muted-foreground">No matches</p>}
      </div>
    </div>}
  </div>;
}


async function fetchFilteredAnime(f: Filters): Promise<{ media: AnimeSummary[]; total: number }> {
  const variables = {
    search: resolveAnimeSearch(f.q) || undefined,
    genre: anilistGenres.has(f.genre) ? f.genre : undefined,
    // For tag-based categories, use the AniList tag filter. A demographic takes precedence.
    tag: f.demographic || (!anilistGenres.has(f.genre) ? f.genre : "") || f.tag || undefined,
    adult: false,
    season: f.season || undefined,
    origin: f.origin || undefined,
    year: f.year ? Number(f.year) : undefined, status: f.status || undefined, format: f.format || undefined,
  };
  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: `query ($search: String, $genre: String, $tag: String, $year: Int, $status: MediaStatus, $format: MediaFormat, $adult: Boolean, $season: MediaSeason, $origin: CountryCode) {
        Page(page: 1, perPage: 48) {
          pageInfo { total }
          media(type: ANIME, search: $search, genre: $genre, tag: $tag, seasonYear: $year, status: $status, format: $format, isAdult: $adult, season: $season, countryOfOrigin: $origin, sort: POPULARITY_DESC) {
            id idMal title { english romaji } coverImage { large extraLarge } bannerImage format seasonYear episodes averageScore isAdult relations { edges { relationType node { id format } } }
          }
        }
      }`,
      variables,
    }),
  });
  if (!response.ok) throw new Error(response.status === 429 ? "Too many searches. Please try again shortly." : "Anime search is temporarily unavailable.");
  const json = await response.json();
  if (json.errors?.length) throw new Error("Unable to apply those filters.");
  const found: AnimeSummary[] = json.data?.Page?.media ?? [];
  if (found.length || !f.q.trim() || f.q.trim().length < 5) {
    return { media: groupAnimeSeasons(found), total: groupAnimeSeasons(found).length };
  }
  // Retry a word stem when AniList's exact search finds no titles.
  const words = resolveAnimeSearch(f.q).split(/\s+/).filter((word) => word.length >= 4);
  const attempts = [...words].sort((a, b) => a.length - b.length).map((word) => word.slice(0, Math.max(3, word.length - 2)));
  for (const stem of [...new Set(attempts)].slice(0, 3)) {
    const fallbackResponse = await fetch("https://graphql.anilist.co", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: `query ($search: String) { Page(page: 1, perPage: 48) { media(type: ANIME, search: $search, isAdult: false, sort: SEARCH_MATCH) { id idMal title { english romaji } coverImage { large extraLarge } bannerImage format seasonYear episodes averageScore isAdult } } }`, variables: { search: stem } }),
    });
    if (!fallbackResponse.ok) continue;
    const fallbackJson = await fallbackResponse.json();
    const candidates: AnimeSummary[] = fallbackJson.data?.Page?.media ?? [];
    const media = candidates.filter((anime) => matchesAnimeTitle(anime.title.english || "", f.q) || matchesAnimeTitle(anime.title.romaji, f.q));
    if (media.length) return { media: groupAnimeSeasons(media), total: groupAnimeSeasons(media).length };
  }
  return { media: [], total: 0 };
}

function Browse() {
  const { q = "" } = Route.useSearch();
  const [draft, setDraft] = useState<Filters>({ ...empty, q });
  const [applied, setApplied] = useState<Filters>({ ...empty, q });
  const [expanded, setExpanded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { data: series = [] } = useQuery(seriesListQuery());
  const results = useQuery({ queryKey: ["filtered-anime", applied], queryFn: () => fetchFilteredAnime(applied), staleTime: 5 * 60 * 1000, retry: 1 });
  const imported = series.filter((s) => {
    const term = applied.q.trim().toLowerCase();
    return (!term || matchesAnimeTitle(s.title, term) || s.genres.some((g) => g.toLowerCase().includes(term)))
      && (!applied.genre || s.genres.some((g) => g.toLowerCase() === applied.genre.toLowerCase()))
      && (!applied.year || s.premiered?.includes(applied.year))
      && (!applied.format || s.type?.toUpperCase().replaceAll(" ", "_") === applied.format)
      && !applied.tag && !applied.status && !applied.demographic && !applied.ageRating && !applied.season && !applied.origin;
  });
  const set = (key: keyof Filters, value: string) => setDraft((prev) => ({ ...prev, [key]: value }));
  const field = (label: string, key: keyof Filters, options: [string, string][]) =>
    <FilterPicker label={label} value={draft[key]} options={options} onChange={(v) => set(key, v)} />;
  return (
    <main className="mx-auto w-full max-w-none px-4 pb-24 pt-3 sm:px-5 md:px-6 md:pt-3">
      <div className="mb-4 flex items-center justify-between gap-3"><h1 className="border-l-4 border-primary pl-3 text-xl font-extrabold sm:text-2xl">Search Anime</h1><span className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:inline">Explore the anime catalogue</span></div>
      <form onSubmit={(e) => { e.preventDefault(); setApplied({ ...draft }); }} className="space-y-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-7 lg:items-end">
          <label className="relative col-span-2 block min-w-0 lg:col-span-1"><span className="mb-2 block text-sm font-semibold">Search</span><Search className="pointer-events-none absolute bottom-3.5 left-4 h-5 w-5 text-muted-foreground" /><input aria-label="Search anime" placeholder="Search by anime title or abbreviation…" value={draft.q} onChange={(e) => set("q", e.target.value)} className="w-full rounded-md border border-border bg-card py-3 pl-12 pr-4 text-sm outline-none focus:border-primary" /></label>
          <div className="col-span-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-6 lg:grid-cols-6">
            {field("Genres", "genre", genreOptions)}
            {field("Year", "year", years.map((y) => [y, y]))}
            {field("Tags", "tag", tagOptions)}
            {field("Status", "status", statuses as [string, string][])}
            {field("Format", "format", formats as [string, string][])}
            {field("Age rating", "ageRating", ageRatings)}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="submit" className="flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"><Filter size={16} />Apply filters</button>
          <button type="button" onClick={() => { setDraft({ ...empty }); setApplied({ ...empty }); }} className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm hover:text-primary"><RotateCcw size={16} />Reset</button>
          <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm hover:text-primary">More filters <ChevronDown size={16} className={expanded ? "rotate-180" : ""} /></button>
        </div>
        {expanded && <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card/60 p-4 sm:grid-cols-4">{field("Demographics", "demographic", demographics)}{field("Season", "season", seasons)}{field("Origin", "origin", origins)}<p className="col-span-2 self-end text-xs text-muted-foreground sm:col-span-1">AniList age flags are not official age classifications.</p></div>}
      </form>
      <div className="mt-4 flex flex-col gap-4 lg:flex-row">
        {sidebarOpen && <aside className="w-full shrink-0 space-y-3 lg:w-44 xl:w-48">
          {([
            ["Season", "season", seasons],
            ["Format", "format", formats as [string, string][]],
            ["Status", "status", statuses as [string, string][]],
            ["Origin", "origin", origins],
          ] as [string, keyof Filters, [string, string][]][]).map(([label, key, options]) => <fieldset key={key} className="overflow-hidden rounded-lg border border-border bg-card/70 p-3"><legend className="sr-only">{label}</legend><h2 className="mb-3 border-l-2 border-primary pl-2 text-sm font-bold">{label}</h2><div className="space-y-2">{options.map(([value, name]) => <label key={value} className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><input type="radio" name={key} checked={draft[key] === value} onChange={() => set(key, draft[key] === value ? "" : value)} className="accent-primary" />{name}</label>)}<button type="button" onClick={() => set(key, "")} className="text-xs text-primary underline">Any {label.toLowerCase()}</button></div></fieldset>)}
          <button type="button" onClick={() => setApplied({ ...draft })} className="w-full rounded bg-primary py-2 text-sm font-bold text-primary-foreground">Apply sidebar filters</button>
        </aside>}
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{results.isLoading ? "Searching anime…" : results.isError ? "Search unavailable" : `${(results.data?.total ?? 0).toLocaleString()} anime results found`}</p><button type="button" onClick={() => setSidebarOpen(!sidebarOpen)} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-primary">{sidebarOpen ? "Hide sidebar" : "Show sidebar"}</button></div>
          {results.isError && <div role="alert" className="mb-5 text-sm text-destructive">{results.error.message} <button className="ml-2 underline" onClick={() => void results.refetch()}>Retry</button></div>}
          {!!imported.length && <section className="mb-8"><h2 className="mb-4 text-lg font-bold">Available on Streamly</h2><div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-9">{imported.map((series) => <SeriesCard key={series.id} s={series} />)}</div></section>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7">{results.data?.media.map((anime) => <AnimeCard key={anime.id} a={anime} />)}</div>
          {!results.isLoading && !results.isError && !results.data?.media.length && !imported.length && <p className="py-12 text-center text-muted-foreground">No anime matched your filters. Try resetting them.</p>}
        </div>
      </div>
    </main>
  );
}
