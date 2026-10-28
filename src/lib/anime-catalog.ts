import { queryOptions } from "@tanstack/react-query";
import type { AnimeSummary } from "@/lib/kitsune";

export type CatalogAnime = AnimeSummary & { description: string | null };
export type AnimeCatalog = { trending: CatalogAnime[]; popular: CatalogAnime[]; airing: CatalogAnime[] };

const fields = `id idMal isAdult title { english romaji } coverImage { large extraLarge } bannerImage format seasonYear episodes averageScore description(asHtml: false)`;

async function fetchCatalog(): Promise<AnimeCatalog> {
  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: `query {
      trending: Page(perPage: 12) { media(type: ANIME, isAdult: false, status_not: NOT_YET_RELEASED, sort: TRENDING_DESC) { ${fields} } }
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
  return { trending: result.data.trending.media, popular: result.data.popular.media, airing: result.data.airing.media };
}

export const animeCatalogQuery = () => queryOptions({
  queryKey: ["anime-home-catalog"],
  queryFn: fetchCatalog,
  staleTime: 10 * 60 * 1000,
  retry: 1,
});