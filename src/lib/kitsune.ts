// Client helpers for the anime sources ported from Kitsune (AniList metadata + provider scrapers).
import type { PlayerSubtitle } from "@/components/VideoPlayer";
import { resolveAnimeSearch, matchesAnimeTitle } from "@/lib/anime-search";

export type Audio = "sub" | "dub";

/** Preferred order when picking a default source. Sources that relied on browser impersonation come last. */
export const PROVIDER_ORDER = ["anikoto", "kaa", "anizone", "reanime", "aniwaves", "animegg", "animenosub", "animeonsen", "animedunya", "mkissa", "senshi", "anipm"];

export type AnimeSummary = {
  id: number;
  idMal?: number | null;
  title: { english: string | null; romaji: string };
  coverImage: { large: string | null; extraLarge?: string | null };
  bannerImage?: string | null;
  format: string | null;
  seasonYear: number | null;
  episodes: number | null;
  averageScore: number | null;
  isAdult?: boolean;
};

export type AnimeDetails = AnimeSummary & {
  description: string | null;
  status: string | null;
  season: string | null;
  genres: string[];
  studios: { nodes: { name: string }[] };
  countryOfOrigin: string | null;
  startDate: { year: number | null; month: number | null; day: number | null };
  duration: number | null;
  synonyms: string[];
  tags: { name: string; rank: number; isMediaSpoiler: boolean }[];
  characters: { edges: { node: { id: number; name: { full: string }; image: { medium: string | null } }; role: string; voiceActors: { id: number; name: { full: string }; image: { medium: string | null } }[] }[] };
  relations: { edges: { relationType: string; node: AnimeSummary }[] };
  recommendations: { nodes: { rating: number | null; mediaRecommendation: AnimeSummary | null }[] };
};

const SUMMARY = "id idMal title { english romaji } coverImage { large extraLarge } bannerImage format seasonYear episodes averageScore isAdult";

async function anilist<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(res.status === 429 ? "Too many searches — wait a moment and try again." : "Anime info couldn’t be loaded.");
  const json = await res.json();
  if (json.errors?.length) throw new Error("Anime info couldn’t be loaded.");
  return json.data as T;
}

export const animeTitle = (a: { title: { english: string | null; romaji: string } }) => a.title.english || a.title.romaji;

export async function searchAnime(search: string): Promise<AnimeSummary[]> {
  const resolved = resolveAnimeSearch(search);
  const query = `query ($search: String) { Page(page: 1, perPage: 24) { media(type: ANIME, search: $search, isAdult: false, sort: SEARCH_MATCH) { ${SUMMARY} } } }`;
  const primary = await anilist<{ Page: { media: AnimeSummary[] } }>(query, { search: resolved });
  const results = primary.Page.media ?? [];
  // AniList search is not fuzzy. For misspellings, retry a shortened word stem
  // and rank matches locally instead of requiring an exact spelling.
  if (results.length || resolved.length < 5) return results;
  const words = resolved.trim().split(/\s+/).filter((word) => word.length >= 4);
  const attempts = [...words].sort((a, b) => a.length - b.length).map((word) => word.slice(0, Math.max(3, word.length - 2)));
  const found = new Map<number, AnimeSummary>();
  for (const stem of [...new Set(attempts)].slice(0, 3)) {
    const fallback = await anilist<{ Page: { media: AnimeSummary[] } }>(query, { search: stem });
    for (const anime of fallback.Page.media ?? []) {
      if (matchesAnimeTitle(anime.title.english || "", search) || matchesAnimeTitle(anime.title.romaji, search)) found.set(anime.id, anime);
    }
    if (found.size) break;
  }
  return [...found.values()].slice(0, 24);
}

export async function getAnime(id: number): Promise<AnimeDetails | null> {
  const data = await anilist<{ Media: AnimeDetails | null }>(
    `query ($id: Int) { Media(id: $id, type: ANIME) { ${SUMMARY} description(asHtml: false) status season genres countryOfOrigin duration synonyms tags { name rank isMediaSpoiler } startDate { year month day } studios(isMain: true) { nodes { name } } characters(sort: [ROLE, RELEVANCE], perPage: 24) { edges { role node { id name { full } image { medium } } voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) { id name { full } image { medium } } } } relations { edges { relationType node { ${SUMMARY} } } } recommendations(sort: RATING_DESC, perPage: 25) { nodes { rating mediaRecommendation { ${SUMMARY} } } } } }`,
    { id },
  );
  return data.Media;
}

export type SourceRef = { provider: string; audio: Audio; watchId: string };
export type SourceEpisode = { number: number; title: string | null; image: string | null; description: string | null; sources: SourceRef[] };

type RawEpisode = { id: string; number: number; title?: string | null; image?: string | null; description?: string | null };

export async function getSourceEpisodes(anilistId: number): Promise<SourceEpisode[]> {
  // First try a small set of preferred providers. The full twelve-provider
  // aggregation can block on the slowest provider for a minute or longer.
  const fastProviders = ["anikoto", "kaa", "anizone"];
  const fetchEpisodes = async (path: string, timeoutMs: number) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(path, { signal: controller.signal });
      if (!res.ok) throw new Error("Episode provider unavailable");
      return await res.json() as Record<string, { episodes?: Partial<Record<string, RawEpisode[]>> } | unknown>;
    } finally { clearTimeout(timeout); }
  };
  const hasEpisodes = (result: Record<string, unknown>) =>
    PROVIDER_ORDER.some((name) => {
      const entry = result[name] as { episodes?: Partial<Record<string, RawEpisode[]>> } | undefined;
      return Boolean(entry?.episodes?.sub?.length || entry?.episodes?.dub?.length);
    });
  let data: Record<string, { episodes?: Partial<Record<string, RawEpisode[]>> } | unknown>;
  try {
    data = await fetchEpisodes(`/api/public/kitsune/episodes/${fastProviders.join("/")}/${anilistId}?map=false`, 12000);
    if (!hasEpisodes(data)) throw new Error("No episodes found in preferred sources");
  } catch {
    // Preserve coverage when the fast providers do not have this series.
    data = await fetchEpisodes(`/api/public/kitsune/episodes/${anilistId}`, 35000);
  }
  const byNumber = new Map<number, SourceEpisode>();
  for (const provider of PROVIDER_ORDER) {
    const entry = data[provider] as { episodes?: Partial<Record<string, RawEpisode[]>> } | undefined;
    for (const audio of ["sub", "dub"] as const) {
      for (const ep of entry?.episodes?.[audio] ?? []) {
        const n = Number(ep.number);
        if (!Number.isFinite(n) || !ep.id) continue;
        const row = byNumber.get(n) ?? { number: n, title: null, image: null, description: null, sources: [] };
        row.title ||= ep.title ?? null;
        row.image ||= ep.image && !/thumbnail\.jpg$/.test(ep.image) ? ep.image : null;
        row.description ||= ep.description ?? null;
        row.sources.push({ provider, audio, watchId: ep.id });
        byNumber.set(n, row);
      }
    }
  }
  return [...byNumber.values()].sort((a, b) => a.number - b.number);
}

type RawStream = {
  url: string; type?: string; server?: string; quality?: string; referer?: string;
  headers?: Record<string, string>; playlist_key?: string;
  subtitles?: { url?: string; file?: string; label?: string; lang?: string; srclang?: string; default?: boolean }[];
  intro?: { start: number; end: number };
};

export type PlayableStream = { label: string; kind: "hls" | "mp4" | "embed"; src: string; subtitles: PlayerSubtitle[]; intro?: { start: number; end: number } | undefined };

export function proxyUrl(url: string, opts: { referer?: string | undefined; headers?: Record<string, string> | undefined; playlistKey?: string | undefined } = {}) {
  const p = new URLSearchParams({ url });
  if (opts.referer) p.set("referer", opts.referer);
  if (opts.headers && Object.keys(opts.headers).length) p.set("headers", JSON.stringify(opts.headers));
  if (opts.playlistKey) p.set("playlist_key", opts.playlistKey);
  return `/api/public/proxy?${p.toString()}`;
}

export async function getStreams(watchId: string): Promise<PlayableStream[]> {
  if (!/^watch\/[\w-]+\/\d+\/(sub|dub)\/[\w-]+$/.test(watchId)) throw new Error("Unknown episode source.");
  const res = await fetch(`/api/public/kitsune/${watchId}`);
  const data = (await res.json().catch(() => ({}))) as { streams?: RawStream[]; subtitles?: RawStream["subtitles"]; intro?: { start: number; end: number }; error?: string };
  const streams = data.streams ?? [];
  if (!streams.length) throw new Error(data.error ? "This source has no video for this episode right now." : "No video found on this source.");
  return streams.filter((s) => s.url).map((s, i) => {
    const kind: PlayableStream["kind"] = s.type === "hls" || /\.m3u8/i.test(s.url) ? "hls" : s.type === "mp4" || /\.mp4/i.test(s.url) ? "mp4" : "embed";
    const proxyOpts = { referer: s.referer, headers: s.headers, playlistKey: s.playlist_key };
    const subs = (s.subtitles?.length ? s.subtitles : data.subtitles ?? [])
      .map((t) => ({ url: t.url || t.file || "", label: t.label || t.lang || "Subtitles", lang: t.srclang, default: t.default }))
      .filter((t) => /\.vtt(\?|$)/i.test(t.url))
      .map((t) => ({ ...t, url: proxyUrl(t.url, { referer: s.referer, headers: s.headers }) }));
    return {
      label: [s.server || `Server ${i + 1}`, s.quality].filter(Boolean).join(" · "),
      kind,
      src: kind === "embed" ? s.url : proxyUrl(s.url, proxyOpts),
      subtitles: subs,
      intro: s.intro ?? data.intro,
    };
  }).sort((a, b) => Number(a.kind === "embed") - Number(b.kind === "embed"));
}

export const providerLabel = (p: string) => ({ kaa: "KickAssAnime", anikoto: "Anikoto", anizone: "AniZone", reanime: "ReAnime", aniwaves: "AniWaves", animegg: "AnimeGG", animenosub: "AnimeNoSub", animeonsen: "AnimeOnsen", animedunya: "AnimeDunya", mkissa: "MKissa", senshi: "Senshi", anipm: "AniPM" } as Record<string, string>)[p] ?? p;
