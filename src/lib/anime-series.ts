import type { AnimeSummary } from "@/lib/kitsune";

export type SeasonEntry = AnimeSummary & { relations?: { edges: { relationType: string; node: AnimeSummary }[] } };
const tv = (a: AnimeSummary) => a.format === "TV" || a.format === "TV_SHORT";
const title = (a: AnimeSummary) => a.title.english || a.title.romaji;

/** Group only explicitly linked TV sequels; films, specials and spin-offs remain separate. */
export function groupAnimeSeasons<T extends SeasonEntry>(items: T[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const parent = new Map<number, number>();
  for (const item of items) {
    if (!tv(item)) continue;
    for (const edge of item.relations?.edges ?? []) {
      if (!tv(edge.node) || !byId.has(edge.node.id)) continue;
      if (edge.relationType === "PREQUEL") parent.set(item.id, edge.node.id);
      if (edge.relationType === "SEQUEL") parent.set(edge.node.id, item.id);
    }
  }
  const root = (id: number) => {
    const visited = new Set<number>();
    while (parent.has(id) && !visited.has(id)) { visited.add(id); id = parent.get(id)!; }
    return id;
  };
  const seen = new Set<number>();
  return items.filter((item) => {
    const id = tv(item) ? root(item.id) : item.id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  }).map((item) => byId.get(tv(item) ? root(item.id) : item.id) ?? item);
}

export function orderedSeasons(items: AnimeSummary[]): AnimeSummary[] {
  return [...items].sort((a, b) => (a.seasonYear ?? 9999) - (b.seasonYear ?? 9999) || a.id - b.id);
}

export async function fetchSeasonChain(id: number): Promise<AnimeSummary[]> {
  const query = `query ($id: Int) { Media(id: $id, type: ANIME) { id title { english romaji } format seasonYear coverImage { large extraLarge } bannerImage episodes averageScore relations { edges { relationType node { id title { english romaji } format seasonYear coverImage { large extraLarge } bannerImage episodes averageScore } } } } }`;
  const found = new Map<number, AnimeSummary>();
  const visited = new Set<number>();
  let queue = [id];
  for (let depth = 0; depth < 8 && queue.length && visited.size < 24; depth++) {
    const current = queue.splice(0, 8).filter((n) => !visited.has(n));
    const results = await Promise.all(current.map(async (next) => {
      visited.add(next);
      try {
        const response = await fetch("https://graphql.anilist.co", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, variables: { id: next } }) });
        if (!response.ok) return null;
        return (await response.json()).data?.Media as SeasonEntry | null;
      } catch { return null; }
    }));
    for (const media of results) {
      if (!media || !tv(media)) continue;
      found.set(media.id, media);
      for (const edge of media.relations?.edges ?? []) {
        if (["PREQUEL", "SEQUEL"].includes(edge.relationType) && tv(edge.node) && !visited.has(edge.node.id)) queue.push(edge.node.id);
      }
    }
  }
  return orderedSeasons([...found.values()]);
}
