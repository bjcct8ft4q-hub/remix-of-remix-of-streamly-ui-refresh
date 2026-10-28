import type { AnimeSummary } from "@/lib/kitsune";

export type SeasonEntry = AnimeSummary & { relations?: { edges: { relationType: string; node: AnimeSummary }[] } };
const tv = (a: AnimeSummary) => a.format === "TV" || a.format === "TV_SHORT";
const name = (a: AnimeSummary) => (a.title.english || a.title.romaji).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const baseName = (a: AnimeSummary) => name(a)
  .replace(/(?:\s+|^)(?:season|series|part|cour)\s*(?:[0-9]+|ii|iii|iv|v|vi|vii|viii|ix|x)\b.*$/i, "")
  .replace(/\s+(?:2nd|3rd|4th|5th|6th|7th|8th|9th)\s+season\b.*$/i, "")
  .trim();

/** Prefer explicit sequel links; use conservative numbered-season title matching when AniList omits links. */
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
  const canonical = new Map<string, number>();
  for (const item of items) {
    if (!tv(item)) continue;
    const key = baseName(item);
    if (!key) continue;
    const existing = canonical.get(key);
    if (existing == null || ((byId.get(existing)?.seasonYear ?? 9999) > (item.seasonYear ?? 9999))) canonical.set(key, item.id);
  }
  const seen = new Set<number>();
  const result: T[] = [];
  for (const item of items) {
    const linked = tv(item) ? root(item.id) : item.id;
    const canonicalId = tv(item) ? canonical.get(baseName(byId.get(linked) ?? item)) ?? linked : linked;
    if (seen.has(canonicalId)) continue;
    seen.add(canonicalId);
    result.push(byId.get(canonicalId) ?? item);
  }
  return result;
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
