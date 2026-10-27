import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LoaderCircle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WatchlistButton } from "@/components/WatchlistButton";
import { animeTitle, type Audio } from "@/lib/kitsune";
import { animeQuery, episodesQuery } from "@/lib/anime-queries";
import { useAuth } from "@/lib/auth";
import { historyQuery } from "@/lib/library";


export const Route = createFileRoute("/anime/$id")({
  head: () => ({
    meta: [
      { title: "Watch anime — Streamly" },
      { name: "description", content: "Episodes, sub and dub, for this anime on Streamly." },
      { property: "og:title", content: "Watch anime — Streamly" },
      { property: "og:description", content: "Episodes, sub and dub, for this anime on Streamly." },
      { property: "og:type", content: "video.tv_show" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnimePage,
});

function AnimePage() {
  const id = Number(Route.useParams().id);
  const { user } = useAuth();
  const [audio, setAudio] = useState<Audio>("sub");
  const info = useQuery(animeQuery(id));
  const eps = useQuery(episodesQuery(id));
  const hist = useQuery(historyQuery(user?.id, id));
  const a = info.data;
  if (info.isPending) return <main className="flex min-h-[60vh] items-center justify-center pt-28"><LoaderCircle className="animate-spin text-primary" /></main>;
  if (!a) return <main className="mx-auto max-w-3xl px-4 pt-40 text-center"><h1 className="text-2xl font-bold">Anime not found</h1></main>;
  const title = animeTitle(a);
  const list = (eps.data ?? []).filter((e) => e.sources.some((s) => s.audio === audio));
  const hasDub = (eps.data ?? []).some((e) => e.sources.some((s) => s.audio === "dub"));
  const watched = new Map((hist.data ?? []).map((h) => [h.episode, h]));
  const resume = hist.data?.[0];
  const first = resume?.episode ?? list[0]?.number;
  return (
    <main className="pb-20">
      <div className="relative h-64 overflow-hidden md:h-80">
        {a.bannerImage && <img src={a.bannerImage} alt="" className="h-full w-full object-cover opacity-50" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
      </div>
      <div className="mx-auto -mt-40 max-w-[1400px] px-4 sm:px-6 md:px-8">
        <div className="relative flex flex-col gap-6 md:flex-row">
          <img src={a.coverImage.extraLarge || a.coverImage.large || ""} alt={title} className="w-40 shrink-0 rounded-md shadow-xl md:w-52" />
          <div className="min-w-0 flex-1 md:pt-24">
            <h1 className="text-3xl font-extrabold md:text-4xl">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{[a.format?.replaceAll("_", " "), a.seasonYear, a.episodes && `${a.episodes} episodes`, a.averageScore && `★ ${(a.averageScore / 10).toFixed(1)}`, ...a.genres].filter(Boolean).join(" · ")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {first != null && <Button asChild><Link to="/anime/$id/watch" params={{ id: String(id) }} search={{ ep: first, audio: resume?.audio === "dub" ? "dub" : audio }}><Play /> {resume ? `Continue episode ${resume.episode}` : "Watch now"}</Link></Button>}
              <WatchlistButton anime={{ id, title, cover: a.coverImage.large }} />
            </div>
            {a.description && <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">{a.description.replace(/<[^>]+>/g, "")}</p>}
          </div>
        </div>
        <section className="mt-10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="border-l-4 border-primary pl-3 text-xl font-bold">Episodes</h2>
            <div className="flex gap-1" role="group" aria-label="Audio">
              <Button size="sm" variant={audio === "sub" ? "default" : "outline"} onClick={() => setAudio("sub")}>Sub</Button>
              <Button size="sm" variant={audio === "dub" ? "default" : "outline"} disabled={!hasDub} onClick={() => setAudio("dub")}>Dub</Button>
            </div>
          </div>
          {eps.isPending ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />Finding episodes across sources… this can take up to a minute.</p>
            : eps.isError ? <div role="alert" className="text-sm text-muted-foreground">Episodes couldn’t be loaded. <Button variant="link" onClick={() => void eps.refetch()}>Try again</Button></div>
            : !list.length ? <p className="text-sm text-muted-foreground">No {audio} episodes found yet.</p>
            : <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
              {list.map((e) => {
                const h = watched.get(e.number);
                const pct = h && h.duration_seconds ? Math.min(100, (h.progress_seconds / h.duration_seconds) * 100) : 0;
                return (
                  <Link key={e.number} to="/anime/$id/watch" params={{ id: String(id) }} search={{ ep: e.number, audio }} className="relative overflow-hidden rounded-md border border-border bg-muted/30 p-3 text-sm transition hover:border-primary hover:text-primary">
                    <span className="font-bold">EP {e.number}</span>
                    {e.title && <span className="mt-1 block truncate text-xs text-muted-foreground">{e.title}</span>}
                    {pct > 0 && <span className="absolute inset-x-0 bottom-0 h-1 bg-primary" style={{ width: `${pct}%` }} />}
                  </Link>
                );
              })}
            </div>}
        </section>
      </div>
    </main>
  );
}
