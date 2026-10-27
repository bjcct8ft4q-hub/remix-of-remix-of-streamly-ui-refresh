import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { seriesListQuery } from "@/lib/queries";
import { SeriesCard } from "@/components/SeriesCard";
import { AnimeCard } from "@/components/AnimeCard";
import { animeSearchQuery } from "@/lib/anime-queries";

export const Route = createFileRoute("/browse")({
  validateSearch: z.object({ q: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Browse series — Streamly" },
      { name: "description", content: "Search and browse every series on Streamly." },
      { property: "og:title", content: "Browse series — Streamly" },
      { property: "og:description", content: "Search and browse every series on Streamly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Browse,
});

function Browse() {
  const { q = "" } = Route.useSearch();
  const { data = [] } = useQuery(seriesListQuery());
  const term = q.toLowerCase();
  const anime = useQuery(animeSearchQuery(q.trim()));
  const list = data.filter((s) => !term || s.title.toLowerCase().includes(term) || s.genres.some((g) => g.toLowerCase().includes(term)));
  return (
    <main className="mx-auto max-w-[1600px] px-4 pb-20 pt-40 sm:px-6 md:px-8 md:pt-28">
      <h1 className="mb-6 border-l-4 border-primary pl-3 text-3xl font-extrabold">{q ? `Results for "${q}"` : "All series"}</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {list.map((s) => <SeriesCard key={s.id} s={s} />)}
      </div>
      {!list.length && !q && <p className="text-muted-foreground">No series found.</p>}
      {q.trim().length >= 2 && <section className="mt-10">
        <h2 className="mb-4 border-l-4 border-primary pl-3 text-2xl font-extrabold">Anime</h2>
        {anime.isPending ? <p role="status" className="text-sm text-muted-foreground">Searching anime…</p>
          : anime.isError ? <p role="alert" className="text-sm text-muted-foreground">{anime.error.message}</p>
          : !anime.data?.length ? <p className="text-sm text-muted-foreground">No anime found.</p>
          : <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">{anime.data.map((a) => <AnimeCard key={a.id} a={a} />)}</div>}
      </section>}
    </main>
  );
}
