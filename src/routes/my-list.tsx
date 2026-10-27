import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { historyQuery, watchlistQuery } from "@/lib/library";

export const Route = createFileRoute("/my-list")({
  head: () => ({
    meta: [
      { title: "My list — Streamly" },
      { name: "description", content: "Your saved anime and what you were watching on Streamly." },
      { property: "og:title", content: "My list — Streamly" },
      { property: "og:description", content: "Your saved anime and what you were watching on Streamly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyList,
});

function Poster({ id, title, cover, sub, ep, audio }: { id: number; title: string; cover: string | null; sub?: string; ep?: number; audio?: string }) {
  const inner = <>
    <div className="aspect-[2/3] overflow-hidden rounded-md bg-muted">{cover ? <img src={cover} alt={title} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center"><Film className="text-muted-foreground" /></div>}</div>
    <p className="mt-2 line-clamp-2 text-sm font-semibold">{title}</p>
    {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
  </>;
  return ep != null
    ? <Link to="/anime/$id/watch" params={{ id: String(id) }} search={{ ep, audio: audio === "dub" ? "dub" : "sub" }} className="block hover:text-primary">{inner}</Link>
    : <Link to="/anime/$id" params={{ id: String(id) }} className="block hover:text-primary">{inner}</Link>;
}

function MyList() {
  const { user, loading, openAuth } = useAuth();
  const list = useQuery(watchlistQuery(user?.id));
  const hist = useQuery(historyQuery(user?.id));
  if (loading) return <main className="pt-40" />;
  if (!user) return <main className="mx-auto max-w-md px-4 pt-40 text-center"><h1 className="text-2xl font-bold">My list</h1><p className="mt-2 text-muted-foreground">Sign in to save anime and pick up where you left off.</p><Button className="mt-4" onClick={() => openAuth("signin")}>Sign in</Button></main>;
  const latest = [...new Map((hist.data ?? []).map((h) => [h.anilist_id, h])).values()];
  const latestById = new Map<number, (typeof latest)[number]>();
  for (const h of hist.data ?? []) if (!latestById.has(h.anilist_id)) latestById.set(h.anilist_id, h);
  const grid = "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6";
  return (
    <main className="mx-auto max-w-[1600px] px-4 pb-20 pt-40 sm:px-6 md:px-8 md:pt-28">
      {latestById.size > 0 && <section className="mb-10">
        <h2 className="mb-4 border-l-4 border-primary pl-3 text-2xl font-extrabold">Continue watching</h2>
        <div className={grid}>{[...latestById.values()].slice(0, 12).map((h) => <Poster key={h.id} id={h.anilist_id} title={h.title} cover={h.cover_url} ep={h.episode} audio={h.audio} sub={`Episode ${h.episode} · ${h.audio.toUpperCase()}`} />)}</div>
      </section>}
      <h1 className="mb-4 border-l-4 border-primary pl-3 text-2xl font-extrabold">My list</h1>
      {list.data?.length ? <div className={grid}>{list.data.map((r) => <Poster key={r.id} id={r.anilist_id} title={r.title} cover={r.cover_url} />)}</div>
        : <p className="text-muted-foreground">Nothing saved yet. <Link to="/browse" className="text-primary">Find something to watch</Link>.</p>}
    </main>
  );
}
