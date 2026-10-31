/** Shared alias and typo-tolerant matching for Streamly search. */
export const animeAliases: Record<string, string> = {
  "umamusume": "Uma Musume",
  "uma musume": "Uma Musume",
  "umamusumes": "Uma Musume",
  "umamusume pretty derby": "Uma Musume",
  "umayon": "Umayon",
  "umayuru": "Umayuru",
  "beginning of a new era": "Uma Musume Pretty Derby Beginning of a New Era",
  "cinderella gray": "Uma Musume Cinderella Gray",
  "mha": "My Hero Academia",
  "bnha": "Boku no Hero Academia",
  "aot": "Attack on Titan",
  "snk": "Shingeki no Kyojin",
  "jjk": "Jujutsu Kaisen",
  "kny": "Kimetsu no Yaiba",
  "demon slayer": "Kimetsu no Yaiba",
  "csm": "Chainsaw Man",
  "op": "One Piece",
  "hxh": "Hunter x Hunter",
  "fmab": "Fullmetal Alchemist Brotherhood",
  "fma": "Fullmetal Alchemist",
  "sao": "Sword Art Online",
  "dbz": "Dragon Ball Z",
  "dbs": "Dragon Ball Super",
  "re zero": "Re:Zero",
  "rezero": "Re:Zero",
  "tensura": "That Time I Got Reincarnated as a Slime",
  "slime isekai": "That Time I Got Reincarnated as a Slime",
  "mushoku": "Mushoku Tensei",
  "konosuba": "KonoSuba",
  "cote": "Classroom of the Elite",
  "oregairu": "My Teen Romantic Comedy SNAFU",
  "bunny girl senpai": "Rascal Does Not Dream of Bunny Girl Senpai",
  "frieren": "Frieren",
  "sxf": "Spy x Family",
  "spy family": "Spy x Family",
  "bsd": "Bungo Stray Dogs",
  "opm": "One Punch Man",
  "tbhk": "Toilet-Bound Hanako-kun",
  "tpn": "The Promised Neverland",
  "deathnote": "Death Note",
  "bleach tybw": "Bleach Thousand-Year Blood War",
  "edgerunners": "Cyberpunk Edgerunners",
  "yugioh": "Yu-Gi-Oh!",
  "haikyuu": "Haikyu!!",
  "dr stone": "Dr. Stone",
  "ngnl": "No Game No Life"
};
export function normaliseAnimeText(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
export function resolveAnimeSearch(value: string): string {
  return animeAliases[normaliseAnimeText(value)] || value.trim();
}
function editDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = old;
    }
  }
  return previous[b.length];
}
export function matchesAnimeTitle(title: string, query: string): boolean {
  const name = normaliseAnimeText(title);
  const term = normaliseAnimeText(resolveAnimeSearch(query));
  if (!term) return true;
  if (name.includes(term) || name.replace(/ /g, "").includes(term.replace(/ /g, ""))) return true;
  const words = name.split(" ");
  const maxErrors = term.length >= 7 ? 2 : term.length >= 4 ? 1 : 0;
  if (!maxErrors) return false;
  const terms = term.split(" ");
  return terms.every((part) => words.some((word) => word.includes(part) || (Math.abs(word.length - part.length) <= maxErrors && editDistance(word, part) <= maxErrors)))
    || (Math.abs(name.length - term.length) <= maxErrors && editDistance(name, term) <= maxErrors);
}
