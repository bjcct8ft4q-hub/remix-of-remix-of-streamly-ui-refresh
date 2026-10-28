import type { AnimeSummary } from "@/lib/kitsune";

export type SeasonEntry = AnimeSummary & { relations?: { edges: { relationType: string; node: AnimeSummary }[] } };
const tv = (a: AnimeSummary) => a.format === "TV" || a.format === "TV_SHORT" || a.format === "ONA";
const name = (a: AnimeSummary) => (a.title.english || a.title.romaji).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const baseName = (a: AnimeSummary) => name(a)
  .replace(/(?:\s+|^)(?:season|series|part|cour)\s*(?:[0-9]+|ii|iii|iv|v|vi|vii|viii|ix|x)\b.*$/i, "")
  .replace(/\s+(?:2nd|3rd|4th|5th|6th|7th|8th|9th)\s+season\b.*$/i, "")
  .replace(/\s+(?:ii|iii|iv|v|vi|vii|viii|ix|x|[2-9])$/i, "")
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

/** Follow AniList links and supplement missing sequel links with a narrowly scoped title search. */
export async function fetchSeasonChain(id: number): Promise<AnimeSummary[]> {
  const fields = `id title { english romaji } format seasonYear coverImage { large extraLarge } bannerImage episodes averageScore relations { edges { relationType node { id title { english romaji } format seasonYear coverImage { large extraLarge } bannerImage episodes averageScore } } }`;
  const request = async (query: string, variables: Record<string, unknown>) => {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw new Error(`AniList returned ${response.status}`);
    return (await response.json()).data;
  };
  const found = new Map<number, AnimeSummary>();
  const visited = new Set<number>();
  let queue = [id];
  for (let depth = 0; depth < 6 && queue.length && visited.size < 24; depth++) {
    const current = queue.splice(0, 8).filter((n) => !visited.has(n));
    const results = await Promise.all(current.map(async (next) => {
      visited.add(next);
      try {
        const data = await request(`query ($id: Int) { Media(id: $id, type: ANIME) { ${fields} } }`, { id: next });
        return data?.Media as SeasonEntry | null;
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
  // AniList may treat the second Edgerunners production as a standalone entry.
  // Keep both instalments available from either series page.
  if (id === 120377 || id === 195539) {
    for (const relatedId of [120377, 195539]) {
      if (found.has(relatedId)) continue;
      try {
        const data = await request(`query ($id: Int) { Media(id: $id, type: ANIME) { ${fields} } }`, { id: relatedId });
        if (data?.Media && tv(data.Media)) found.set(relatedId, data.Media as SeasonEntry);
      } catch { /* Show any successfully retrieved seasons. */ }
    }
  }
  const anchor = found.get(id);
  if (!anchor) return [];
  // AniList sometimes lists a numbered sequel without a PREQUEL/SEQUEL edge.
  // Search only for the anchor's base title, then require a matching base title
  // and an explicit season number; avoid mixing movies, specials and spin-offs.
  const anchorBase = baseName(anchor);
  if (anchorBase.length >= 4) {
    try {
      const search = (anchor.title.english || anchor.title.romaji).replace(/(?:\s+|^)(?:season|series|part|cour)\s*(?:[0-9]+|ii|iii|iv|v|vi|vii|viii|ix|x)\b.*$/i, "").trim();
      const data = await request(`query ($search: String) { Page(page: 1, perPage: 30) { media(search: $search, type: ANIME) { ${fields} } } }`, { search });
      const candidates = (data?.Page?.media ?? []) as SeasonEntry[];
      for (const candidate of candidates) {
        if (!tv(candidate) || candidate.id === id || baseName(candidate) !== anchorBase) continue;
        const candidateName = name(candidate);
        const numbered = /(?:season|series|part|cour)\s*(?:[2-9]|ii|iii|iv|v|vi|vii|viii|ix|x)\b|\b(?:2nd|3rd|4th|5th)\s+season\b|\s(?:ii|iii|iv|v|vi|vii|viii|ix|x|[2-9])$/.test(candidateName);
        if (numbered || [...found.values()].some((entry) => (entry as SeasonEntry).relations?.edges?.some((edge) => edge.node.id === candidate.id && ["PREQUEL", "SEQUEL"].includes(edge.relationType)))) {
          found.set(candidate.id, candidate);
        }
      }
    } catch { /* Keep linked seasons when title search is unavailable. */ }
  }
  return orderedSeasons([...found.values()]);
}
