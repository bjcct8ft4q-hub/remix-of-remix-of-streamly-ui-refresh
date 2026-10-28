import { queryOptions } from "@tanstack/react-query";
import type { AnimeSummary } from "@/lib/kitsune";
import { groupAnimeSeasons } from "@/lib/anime-series";

export type CatalogAnime = AnimeSummary & { description: string | null; genres: string[] };
export type AnimeCatalog = { trending: CatalogAnime[]; popular: CatalogAnime[]; airing: CatalogAnime[] };

const fields = `id idMal isAdult title { english romaji } coverImage { large extraLarge } bannerImage format seasonYear episodes averageScore genres description(asHtml: false) relations { edges { relationType node { id format } } }`;

async function fetchCatalog(): Promise<AnimeCatalog> {
  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: `query {
      trending: Page(perPage: 35) { media(type: ANIME, isAdult: false, status_not: NOT_YET_RELEASED, sort: TRENDING_DESC) { ${fields} } }
      popular: Page(perPage: 12) { media(type: ANIME, isAdult: false, status_not: NOT_YET_RELEASED, sort: POPULARITY_DESC) { ${fields} } }
      airing: Page(perPage: 12) { media(type: ANIME, isAdult: false, status: RELEASING, sort: TRENDING_DESC) { ${fields} } }
    }` }),
  });
  if (!response.ok) throw new Error("Anime couldn’t be loaded. Please try again.");
  const result = await response.json() as {
    errors?: unknown[];
    data?: { trending: { media: CatalogAnime[] }; popular: { media: CatalogAnime[] }; airing: { media: CatalogAnime[] } };
  };
  if (result.errors?.length || !result.data) throw new Error("Anime couldn’t be loaded. Please try again.");
  return { trending: groupAnimeSeasons(result.data.trending.media).slice(0, 12), popular: groupAnimeSeasons(result.data.popular.media).slice(0, 12), airing: groupAnimeSeasons(result.data.airing.media).slice(0, 12) };
}

export const animeCatalogQuery = () => queryOptions({
  queryKey: ["anime-home-catalog"],
  queryFn: fetchCatalog,
  staleTime: 10 * 60 * 1000,
  retry: 1,
});