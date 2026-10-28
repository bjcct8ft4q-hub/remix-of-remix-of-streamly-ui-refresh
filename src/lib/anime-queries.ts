import { getAnime, getSourceEpisodes, searchAnime } from "@/lib/kitsune";

export const animeQuery = (id: number) => ({ queryKey: ["anime", id], queryFn: () => getAnime(id), staleTime: 60 * 60 * 1000 });
export const episodesQuery = (id: number) => ({ queryKey: ["anime-episodes", id], queryFn: () => getSourceEpisodes(id), staleTime: 60 * 60 * 1000, gcTime: 2 * 60 * 60 * 1000, retry: 0 });
export const animeSearchQuery = (q: string) => ({ queryKey: ["anime-search", q], queryFn: () => searchAnime(q), enabled: q.length >= 2, staleTime: 5 * 60 * 1000, retry: 1 });
