import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronRight, Film, LoaderCircle, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { seriesListQuery, type SeriesRow } from "@/lib/queries";
import { animeSearchQuery } from "@/lib/anime-queries";
import { animeTitle } from "@/lib/kitsune";
import { matchesAnimeTitle, resolveAnimeSearch } from "@/lib/anime-search";
import { groupAnimeSeasons } from "@/lib/anime-series";

type TrendingAnime = {
  id: number;
  title: { english: string | null; romaji: string };
  coverImage: { large: string | null };
  format: string | null;
  season: string | null;
  seasonYear: number | null;
  siteUrl: string;
};

async function fetchTrendingAnime(): Promise<TrendingAnime[]> {
  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: `query {
        Page(page: 1, perPage: 20) {
          media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
            id
            title { english romaji }
            coverImage { large }
            format
            season
            seasonYear
            siteUrl
          }
        }
      }`,
    }),
  });
  if (!response.ok) throw new Error("Unable to load AniList trending anime");
  const payload = await response.json();
  if (payload.errors?.length) throw new Error("AniList returned an error");
  return payload.data?.Page?.media ?? [];
}

function normaliseTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findImportedSeries(anime: TrendingAnime, data: SeriesRow[]) {
  return data.find((series) => Number(series.anilist_id) === anime.id)
    ?? data.find((series) => normaliseTitle(series.title) === normaliseTitle(anime.title.english || anime.title.romaji));
}

export function QuickSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("");
  useEffect(() => { const onKey=(e:KeyboardEvent)=>{ if(e.ctrlKey&&e.key.toLowerCase()==="s"){e.preventDefault();onOpenChange(true);} };document.addEventListener("keydown",onKey);return()=>document.removeEventListener("keydown",onKey);},[onOpenChange]);
  const [category,setCategory] = useState<"anime"|"users">("anime");
  const { user } = useAuth();
  const users = useQuery({queryKey:["quick-user-search",query.trim()],queryFn:async()=>{const {data,error}=await supabase.rpc("search_streamly_users",{search_text:query.trim()});if(error)throw error;return (data??[]) as {id:string;username:string}[];},enabled:open&&category==="users"&&!!user&&query.trim().length>=2,staleTime:30000});
  const { data = [], isPending, isError, refetch } = useQuery({ ...seriesListQuery(), enabled: open });
  const { data: trending = [], isPending: trendingPending, isError: trendingError, refetch: refetchTrending } = useQuery({
    queryKey: ["anilist-trending-anime"],
    queryFn: fetchTrendingAnime,
    enabled: open && category==="anime" && !query.trim(),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
    retry: 1,
  });
  const term = query.trim().toLowerCase();
  const anime = useQuery({ ...animeSearchQuery(resolveAnimeSearch(term)), enabled: open && category==="anime" && term.length >= 2 });
  const matches = term
    ? data.filter((series) => matchesAnimeTitle(series.title, term) || series.genres.some((genre) => genre.toLowerCase().includes(term)))
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-overlay/85 backdrop-blur-sm" />
        <DialogPrimitive.Content aria-describedby={undefined} className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 outline-none">
          <div className="mb-2 flex h-8 items-center justify-between px-1">
            <DialogTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quick access</DialogTitle>
            <DialogClose asChild><Button variant="ghost" size="icon" aria-label="Close search"><X /></Button></DialogClose>
          </div>
          <div className="relative overflow-hidden rounded-md border border-border border-t-primary bg-background">
            <div className="halloween-web pointer-events-none absolute right-0 top-0 hidden h-24 w-24 rotate-90 halloween:block" />
            <div className="flex h-10 items-center justify-center gap-2 border-b border-border text-xs font-bold uppercase"><button onClick={()=>{setCategory("anime");setQuery("");}} className={`px-4 py-3 ${category==="anime"?"border-b-2 border-primary text-primary":"text-muted-foreground"}`}>Anime</button><button onClick={()=>{setCategory("users");setQuery("");}} className={`px-4 py-3 ${category==="users"?"border-b-2 border-primary text-primary":"text-muted-foreground"}`}>Users</button></div>
            <form onSubmit={(event) => event.preventDefault()} className="flex h-12 items-center gap-2 px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={category==="users"?"Search usernames...":"Search anime..."} aria-label="Quick search" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              {query && <Button variant="ghost" size="icon" aria-label="Clear search" onClick={() => setQuery("")}><X /></Button>}
            </form>
          </div>
          <div className="relative mt-2 overflow-hidden rounded-md border border-border bg-background">
            <div className="halloween-web pointer-events-none absolute right-0 top-0 hidden h-32 w-32 rotate-90 halloween:block" />
            <h2 className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{term ? "Search results" : "Trending now · Live AniList rankings"}</h2>
            <div className="max-h-[min(50dvh,24rem)] overflow-y-auto p-2">
              {category==="users" ? (!user ? <p className="p-5 text-sm text-muted-foreground">Sign in to search Streamly users.</p> : term.length<2 ? <p className="p-5 text-sm text-muted-foreground">Type at least 2 characters to find users.</p> : users.isPending ? <p className="p-5 text-sm">Searching users…</p> : users.isError ? <p className="p-5 text-sm text-muted-foreground">User search unavailable.</p> : users.data?.length ? users.data.map(u=><Link key={u.id} to="/friends" onClick={()=>onOpenChange(false)} className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm hover:bg-muted"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">{u.username.charAt(0).toUpperCase()}</span><span className="font-semibold">{u.username}</span><span className="ml-auto text-xs text-muted-foreground">Friends</span></Link>) : <p className="p-5 text-sm text-muted-foreground">No matching users found.</p>) : term ? (isPending ? <div role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" />Loading series…</div>
                : isError ? <div role="alert" className="py-6 text-center text-sm text-muted-foreground"><p>Series couldn’t be loaded.</p><Button variant="ghost" onClick={() => void refetch()} className="mt-2">Try again</Button></div>
                : matches.length === 0 && !anime.data?.length ? <p role="status" className="px-3 py-8 text-center text-sm text-muted-foreground">{anime.isFetching ? "Searching anime…" : "No series found."}</p>
                : [...matches.slice(0, 10).map((series, index) => (
                  <Button asChild variant="ghost" key={series.id} className="h-auto min-h-16 w-full justify-start gap-3 whitespace-normal px-1.5 py-2">
                    <Link to="/series/$id" params={{ id: series.id }} onClick={() => onOpenChange(false)}>
                      <span className="w-4 shrink-0 text-[10px] font-bold text-primary">{String(index + 1).padStart(2, "0")}</span>
                      {series.cover_url ? <img src={series.cover_url} alt="" className="h-12 w-9 shrink-0 rounded-sm object-cover" /> : <span className="flex h-12 w-9 shrink-0 items-center justify-center rounded-sm bg-muted"><Film className="text-muted-foreground" /></span>}
                      <span className="min-w-0 flex-1"><span className="line-clamp-2 text-xs font-bold">{series.title}</span><span className="mt-1 block text-[10px] text-muted-foreground">{series.type}{series.premiered ? ` · ${series.premiered}` : ""}</span></span>
                      <ChevronRight className="shrink-0 text-muted-foreground" />
                    </Link>
                  </Button>
                )), ...( /jo\\s*jo|jojo|joestar|stardust crusaders|diamond is unbreakable|golden wind|stone ocean|steel ball run|phantom blood|battle tendency|kishibe rohan/i.test(term) ? (anime.data ?? []) : groupAnimeSeasons(anime.data ?? []) ).filter((a) => !matches.some((m) => Number(m.anilist_id) === a.id)).slice(0, 8).map((a) => (
                  <Button asChild variant="ghost" key={`a${a.id}`} className="h-auto min-h-16 w-full justify-start gap-3 whitespace-normal px-1.5 py-2">
                    <Link to="/anime/$id" params={{ id: String(a.id) }} onClick={() => onOpenChange(false)}>
                      <span className="w-4 shrink-0 text-[10px] font-bold text-primary"><Film className="h-3 w-3" /></span>
                      {a.coverImage.large ? <img src={a.coverImage.large} alt="" className="h-12 w-9 shrink-0 rounded-sm object-cover" /> : <span className="h-12 w-9 shrink-0 rounded-sm bg-muted" />}
                      <span className="min-w-0 flex-1"><span className="line-clamp-2 text-xs font-bold">{animeTitle(a)}</span><span className="mt-1 block text-[10px] text-muted-foreground">{[a.format?.replaceAll("_", " "), a.seasonYear].filter(Boolean).join(" · ")}</span></span>
                      <ChevronRight className="shrink-0 text-muted-foreground" />
                    </Link>
                  </Button>
                ))])
                : trendingPending ? <div role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" />Loading live trends…</div>
                : trendingError ? <div role="alert" className="py-6 text-center text-sm text-muted-foreground"><p>Live trends couldn’t be loaded.</p><Button variant="ghost" onClick={() => void refetchTrending()} className="mt-2">Try again</Button></div>
                : trending.slice(0, 5).map((anime, index) => {
                  const imported = findImportedSeries(anime, data);
                  const title = anime.title.english || anime.title.romaji;
                  const subtitle = [anime.format?.replaceAll("_", " "), anime.season && anime.seasonYear ? `${anime.season.charAt(0)}${anime.season.slice(1).toLowerCase()} ${anime.seasonYear}` : anime.seasonYear].filter(Boolean).join(" · ");
                  return (
                    <Button asChild variant="ghost" key={anime.id} className="h-auto min-h-16 w-full justify-start gap-3 whitespace-normal px-1.5 py-2">
                      {imported ? (
                        <Link to="/series/$id" params={{ id: imported.id }} onClick={() => onOpenChange(false)}>
                          <span className="w-4 shrink-0 text-[10px] font-bold text-primary">{String(index + 1).padStart(2, "0")}</span>
                          {anime.coverImage.large ? <img src={anime.coverImage.large} alt="" className="h-12 w-9 shrink-0 rounded-sm object-cover" /> : <span className="flex h-12 w-9 shrink-0 items-center justify-center rounded-sm bg-muted"><Film className="text-muted-foreground" /></span>}
                          <span className="min-w-0 flex-1"><span className="line-clamp-2 text-xs font-bold">{title}</span><span className="mt-1 block text-[10px] text-muted-foreground">{subtitle || "Trending on AniList"}</span></span>
                          <ChevronRight className="shrink-0 text-muted-foreground" />
                        </Link>
                      ) : (
                        <Link to="/anime/$id" params={{ id: String(anime.id) }} onClick={() => onOpenChange(false)}>
                          <span className="w-4 shrink-0 text-[10px] font-bold text-primary">{String(index + 1).padStart(2, "0")}</span>
                          {anime.coverImage.large ? <img src={anime.coverImage.large} alt="" className="h-12 w-9 shrink-0 rounded-sm object-cover" /> : <span className="flex h-12 w-9 shrink-0 items-center justify-center rounded-sm bg-muted"><Film className="text-muted-foreground" /></span>}
                          <span className="min-w-0 flex-1"><span className="line-clamp-2 text-xs font-bold">{title}</span><span className="mt-1 block text-[10px] text-muted-foreground">{subtitle ? `${subtitle}` : "Trending on AniList"}</span></span>
                          <ChevronRight className="shrink-0 text-muted-foreground" />
                        </Link>
                      )}
                    </Button>
                  );
                })}
            </div>
            {category==="anime" && term && <Button asChild variant="ghost" className="h-10 w-full justify-between rounded-none border-t border-border px-3 text-xs text-primary"><Link to="/browse" search={{ q: query.trim() }} onClick={() => onOpenChange(false)}>View all results<ArrowRight /></Link></Button>}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}