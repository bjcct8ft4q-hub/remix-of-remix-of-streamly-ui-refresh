import { useEffect, useRef, useState } from "react";

// Jikan exposes MyAnimeList's content classifications. AniList itself does not.
const cache = new Map<number, string | null>();
const pending = new Map<number, Promise<string | null>>();
let nextRequestAt = 0;

async function lookupRating(malId: number): Promise<string | null> {
  if (cache.has(malId)) return cache.get(malId) ?? null;
  const active = pending.get(malId);
  if (active) return active;
  const job = (async () => {
    // Jikan's public API is rate-limited; stagger requests from visible cards.
    const wait = Math.max(0, nextRequestAt - Date.now());
    nextRequestAt = Math.max(Date.now(), nextRequestAt) + 550;
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    try {
      const response = await fetch(`https://api.jikan.moe/v4/anime/${malId}/full`);
      if (!response.ok) return null;
      const payload = await response.json() as { data?: { rating?: string | null } };
      const rating = payload.data?.rating?.split(" - ")[0]?.trim() || null;
      cache.set(malId, rating);
      return rating;
    } catch { return null; }
    finally { pending.delete(malId); }
  })();
  pending.set(malId, job);
  return job;
}

export function useAnimeAgeRating(malId: number | null | undefined, isAdult?: boolean) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [rating, setRating] = useState<string | null>(malId ? cache.get(malId) ?? null : null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "200px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setRating(malId ? cache.get(malId) ?? null : null);
    if (!visible || !malId) return;
    let active = true;
    void lookupRating(malId).then((value) => { if (active) setRating(value); });
    return () => { active = false; };
  }, [malId, visible]);
  return { ref, label: rating || (isAdult ? "18+" : "Age N/A"), verified: !!rating };
}
