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

export const Route = createFileRoute("/browse")({
  validateSearch: z.object({ q: z.string().optional() }),
  head: () => ({ meta: [{ title: "Search anime — Streamly" }, { name: "description", content: "Find anime by title, genre, year, status and format." }] }),
  component: Browse,
});

type Filters = { q: string; genre: string; tag: string; year: string; status: string; format: string; demographic: string };
const empty: Filters = { q: "", genre: "", tag: "", year: "", status: "", format: "", demographic: "" };
// AniList has a smaller genre taxonomy; other requested categories are AniList tags.
const genreOptions: [string, string][] = [
  ["Action", "Action"], ["Adventure", "Adventure"], ["Boys Love", "Boys Love / Yaoi"],
  ["Cars", "Cars"], ["Comedy", "Comedy"], ["Demons", "Demons"], ["Drama", "Drama"],
  ["Ecchi", "Ecchi"], ["Erotica", "Erotica"], ["Fantasy", "Fantasy"], ["Video Games", "Game"],
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
const demographics: [string, string][] = [["Josei", "Josei"], ["Shoujo", "Shoujo"], ["Shounen", "Shounen"]];
const tagOptions: [string, string][] = ["School", "Female Protagonist", "Male Protagonist", "Vampire", "Time Travel", "Revenge", "Super Power", "Military", "Space"].map((x) => [x, x]);
const formats = [["TV", "TV"], ["TV_SHORT", "TV Short"], ["MOVIE", "Movie"], ["OVA", "OVA"], ["ONA", "ONA"], ["SPECIAL", "Special"], ["MUSIC", "Music"]];
const statuses = [["FINISHED", "Finished"], ["RELEASING", "Releasing"], ["NOT_YET_RELEASED", "Not yet released"], ["CANCELLED", "Cancelled"], ["HIATUS", "Hiatus"]];
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
    year: f.year ? Number(f.year) : undefined, status: f.status || undefined, format: f.format || undefined,
  };
  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: `query ($search: String, $genre: String, $tag: String, $year: Int, $status: MediaStatus, $format: MediaFormat) {
        Page(page: 1, perPage: 48) {
          pageInfo { total }
          media(type: ANIME, search: $search, genre: $genre, tag: $tag, seasonYear: $year, status: $status, format: $format, isAdult: false, sort: POPULARITY_DESC) {
            id title { english romaji } coverImage { large extraLarge } bannerImage format seasonYear episodes averageScore
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
    return { media: found, total: json.data?.Page?.pageInfo?.total ?? 0 };
  }
  // Retry a word stem when AniList's exact search finds no titles.
  const words = resolveAnimeSearch(f.q).split(/\s+/);
  const longest = [...words].sort((a, b) => b.length - a.length)[0];
  const stem = longest.slice(0, Math.max(3, longest.length - 2));
  if (stem.length < 3) return { media: [], total: 0 };
  const fallbackResponse = await fetch("https://graphql.anilist.co", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: `query ($search: String) { Page(page: 1, perPage: 48) { media(type: ANIME, search: $search, isAdult: false, sort: SEARCH_MATCH) { id title { english romaji } coverImage { large extraLarge } bannerImage format seasonYear episodes averageScore } } }`, variables: { search: stem } }),
  });
  if (!fallbackResponse.ok) return { media: [], total: 0 };
  const fallbackJson = await fallbackResponse.json();
  const candidates: AnimeSummary[] = fallbackJson.data?.Page?.media ?? [];
  const media = candidates.filter((anime) => matchesAnimeTitle(anime.title.english || "", f.q) || matchesAnimeTitle(anime.title.romaji, f.q));
  return { media, total: media.length };
}

function Browse() {
  const { q = "" } = Route.useSearch();
  const [draft, setDraft] = useState<Filters>({ ...empty, q });
  const [applied, setApplied] = useState<Filters>({ ...empty, q });
  const [expanded, setExpanded] = useState(false);
  const { data: series = [] } = useQuery(seriesListQuery());
  const results = useQuery({ queryKey: ["filtered-anime", applied], queryFn: () => fetchFilteredAnime(applied), staleTime: 5 * 60 * 1000, retry: 1 });
  const imported = series.filter((s) => {
    const term = applied.q.trim().toLowerCase();
    return (!term || matchesAnimeTitle(s.title, term) || s.genres.some((g) => g.toLowerCase().includes(term)))
      && (!applied.genre || s.genres.some((g) => g.toLowerCase() === applied.genre.toLowerCase()))
      && (!applied.year || s.premiered?.includes(applied.year))
      && (!applied.format || s.type?.toUpperCase().replaceAll(" ", "_") === applied.format)
      && !applied.tag && !applied.status && !applied.demographic;
  });
  const set = (key: keyof Filters, value: string) => setDraft((prev) => ({ ...prev, [key]: value }));
  const field = (label: string, key: keyof Filters, options: [string, string][]) =>
    <FilterPicker label={label} value={draft[key]} options={options} onChange={(v) => set(key, v)} />;
  return (
    <main className="mx-auto max-w-[1600px] px-4 pb-24 pt-36 sm:px-6 md:px-8 md:pt-28">
      <h1 className="mb-5 border-l-4 border-primary pl-3 text-2xl font-extrabold sm:text-3xl">Search Anime</h1>
      <form onSubmit={(e) => { e.preventDefault(); setApplied({ ...draft }); }} className="space-y-5">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input aria-label="Search anime" placeholder="Type to search..." value={draft.q} onChange={(e) => set("q", e.target.value)} className="w-full rounded-md border border-border bg-card py-3.5 pl-12 pr-4 text-base outline-none focus:border-primary" />
        </label>
        <div className="grid grid-cols-2 gap-4">
          {field("Genres", "genre", genreOptions)}
          {field("Tags", "tag", tagOptions)}
          {field("Year", "year", years.map((y) => [y, y]))}
          {field("Status", "status", statuses as [string, string][])}
          {field("Format", "format", formats as [string, string][])}
          {field("Demographics", "demographic", demographics)}
          <div className="flex min-w-0 items-end gap-1 sm:gap-2">
            <button type="submit" title="Apply filters" aria-label="Apply filters" className="flex h-[46px] min-w-0 flex-1 items-center justify-center gap-1 rounded-l-md border border-primary bg-primary/10 text-primary hover:bg-primary/20"><Filter size={18} /><span className="hidden sm:inline">Apply</span></button>
            <button type="button" title="Reset filters" aria-label="Reset filters" onClick={() => { setDraft({ ...empty }); setApplied({ ...empty }); }} className="flex h-[46px] min-w-0 flex-1 items-center justify-center gap-1 border border-border bg-card hover:text-primary"><RotateCcw size={18} /><span className="hidden sm:inline">Reset</span></button>
            <button type="button" title="More filters" aria-label="More filters" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="flex h-[46px] min-w-0 flex-1 items-center justify-center rounded-r-md border border-border bg-card hover:text-primary"><ChevronDown size={18} className={expanded ? "rotate-180" : ""} /></button>
          </div>
        </div>
        {expanded && <p className="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">Choose a filter using the searchable dropdowns, then press Apply. Demographics and some genre categories are AniList tags; when multiple tag-based options are chosen, demographics take priority. Adult-only titles are excluded from public results.</p>}
      </form>
      <div className="mt-9 border-t border-border pt-6">
        <p className="mb-5 text-sm text-muted-foreground">{results.isLoading ? "Searching anime…" : results.isError ? "Search unavailable" : `${(results.data?.total ?? 0).toLocaleString()} anime results found`}</p>
        {results.isError && <div role="alert" className="mb-5 text-sm text-destructive">{results.error.message} <button className="ml-2 underline" onClick={() => void results.refetch()}>Retry</button></div>}
        {!!imported.length && <section className="mb-9"><h2 className="mb-4 text-lg font-bold">Streamly series</h2><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">{imported.map((s) => <SeriesCard key={s.id} s={s} />)}</div></section>}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">{results.data?.media.map((a) => <AnimeCard key={a.id} a={a} />)}</div>
        {!results.isLoading && !results.isError && !results.data?.media.length && !imported.length && <p className="py-12 text-center text-muted-foreground">No anime matched your filters. Try resetting them.</p>}
      </div>
    </main>
  );
}
