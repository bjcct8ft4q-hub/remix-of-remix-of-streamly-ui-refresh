import { useEffect, useRef, useState } from "react";

// MyAnimeList content ratings are fetched through Jikan using AniList's idMal.
const cache = new Map<number, string | null>();
const REQUEST_TIMEOUT_MS = 18000;
const pending = new Map<number, Promise<string | null>>();
const workers: Promise<unknown>[] = [Promise.resolve(), Promise.resolve()];
let nextWorker = 0;

async function lookupRating(malId: number): Promise<string | null> {
  if (cache.has(malId)) return cache.get(malId) ?? null;
  if (pending.has(malId)) return pending.get(malId)!;
  const worker = nextWorker++ % workers.length;
  const job = workers[worker].then(async () => {
    // Public Jikan endpoints are limited to roughly three requests per second.
    // Queue calls rather than starting dozens of simultaneous poster requests.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(`/api/public/age-rating/${malId}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
        if (response.status === 429 || response.status >= 500) {
          await new Promise((resolve) => setTimeout(resolve, 1800 * (attempt + 1)));
          continue;
        }
        if (!response.ok) { cache.set(malId, null); return null; }
        const payload = await response.json() as { rating?: string | null };
        const value = payload.rating?.trim() || null;
        cache.set(malId, value);
        return value;
      } catch {
        if (attempt === 2) return null;
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }
    cache.set(malId, null);
    return null;
  });
  // Three independent, rate-limited lanes avoid a single queue blocking all cards.
  workers[worker] = job.then(() => new Promise((resolve) => setTimeout(resolve, 600)), () => undefined);
  pending.set(malId, job);
  void job.then(() => { pending.delete(malId); }, () => { pending.delete(malId); });
  return job;
}

export function useAnimeAgeRating(malId: number | null | undefined, isAdult?: boolean) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [rating, setRating] = useState<string | null>(malId ? cache.get(malId) ?? null : null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "350px" });
    observer.observe(element);
    return () => observer.disconnect();
  });

  useEffect(() => {
    setRating(malId ? cache.get(malId) ?? null : null);
    if (!visible || !malId) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    void lookupRating(malId).then((value) => {
      if (active) { setRating(value); setLoading(false); }
    }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [malId, visible]);

  return {
    ref,
    label: rating || (isAdult ? "18+" : loading ? "Age …" : "Age N/A"),
    verified: !!rating,
  };
}
