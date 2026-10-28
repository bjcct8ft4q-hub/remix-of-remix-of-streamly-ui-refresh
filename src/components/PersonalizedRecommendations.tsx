import { AnimeCard } from "@/components/AnimeCard";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { historyQuery, watchlistQuery } from "@/lib/library";
import { animeCatalogQuery } from "@/lib/anime-catalog";
import { animeTitle } from "@/lib/kitsune";

export function PersonalizedRecommendations() {
  const { user } = useAuth();
  const history = useQuery(historyQuery(user?.id));
  const watchlist = useQuery(watchlistQuery(user?.id));
  const catalog = useQuery(animeCatalogQuery());
  if (!user || !catalog.data || !history.data || !watchlist.data) return null;
  const watchedIds = new Set([...history.data.map((x) => x.anilist_id), ...watchlist.data.map((x) => x.anilist_id)]);
  if (!watchedIds.size) return null;
  const all = [...catalog.data.trending, ...catalog.data.popular, ...catalog.data.airing];
  const byId = new Map(all.map((item) => [item.id, item]));
  const favoriteGenres = new Map<string, number>();
  for (const id of watchedIds) for (const genre of byId.get(id)?.genres ?? []) favoriteGenres.set(genre, (favoriteGenres.get(genre) ?? 0) + 1);
  const suggestions = [...byId.values()].filter((item) => !watchedIds.has(item.id) && !item.isAdult)
    .map((item) => ({ item, score: (item.genres ?? []).reduce((sum, genre) => sum + (favoriteGenres.get(genre) ?? 0), 0) * 10 + (item.averageScore ?? 0) / 10 }))
    .sort((a, b) => b.score - a.score).slice(0, 6);
  if (!suggestions.length) return null;
  return <section className="space-y-4">
    <div><h2 className="flex items-center gap-2 border-l-[3px] border-primary pl-3 text-xl font-extrabold"><Sparkles size={20} className="text-primary" /> Recommended for You</h2><p className="mt-2 text-xs text-muted-foreground">Based on genres in your watch history and watchlist, using the current anime catalog.</p></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">{suggestions.map(({ item }) => <AnimeCard key={item.id} a={item} />)}</div>
  </section>;
}
