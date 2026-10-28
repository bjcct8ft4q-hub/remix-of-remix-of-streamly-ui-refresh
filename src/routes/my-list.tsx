import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Film, Bookmark, PlayCircle, Search } from "lucide-react";
import { useState } from "react";
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
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<"newest" | "title">("newest");
  const list = useQuery(watchlistQuery(user?.id));
  const hist = useQuery(historyQuery(user?.id));
  if (loading) return <main className="pt-40" />;
  if (!user) return <main className="mx-auto max-w-md px-4 pt-40 text-center"><h1 className="text-2xl font-bold">My list</h1><p className="mt-2 text-muted-foreground">Sign in to save anime and pick up where you left off.</p><Button className="mt-4" onClick={() => openAuth("signin")}>Sign in</Button></main>;
  const latestById = new Map<number, NonNullable<typeof hist.data>[number]>();
  for (const h of hist.data ?? []) if (!latestById.has(h.anilist_id)) latestById.set(h.anilist_id, h);
  const grid = "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6";
  const savedItems = [...(list.data ?? [])].filter((item) => item.title.toLowerCase().includes(filter.toLowerCase())).sort((a,b) => sort === "title" ? a.title.localeCompare(b.title) : 0);
  return (
    <main className="mx-auto max-w-[1600px] px-4 pb-20 pt-40 sm:px-6 md:px-8 md:pt-28">
      <div className="mb-8 rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Your collection</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">My List</h1><p className="mt-2 text-sm text-muted-foreground">Everything you saved, all in one place.</p><div className="mt-5 flex gap-3"><div className="rounded-xl border border-border bg-background/60 px-5 py-3"><Bookmark size={17} className="mb-1 text-primary" /><strong className="block text-xl">{list.data?.length ?? 0}</strong><span className="text-xs text-muted-foreground">Saved anime</span></div><div className="rounded-xl border border-border bg-background/60 px-5 py-3"><PlayCircle size={17} className="mb-1 text-primary" /><strong className="block text-xl">{latestById.size}</strong><span className="text-xs text-muted-foreground">In progress</span></div></div></div>
      {latestById.size > 0 && <section className="mb-10">
        <h2 className="mb-4 border-l-4 border-primary pl-3 text-2xl font-extrabold">Continue watching</h2>
        <div className={grid}>{[...latestById.values()].slice(0, 12).map((h) => <Poster key={h.id} id={h.anilist_id} title={h.title} cover={h.cover_url} ep={h.episode} audio={h.audio} sub={`Episode ${h.episode} · ${h.audio.toUpperCase()}`} />)}</div>
      </section>}
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><h2 className="border-l-4 border-primary pl-3 text-2xl font-extrabold">Saved anime</h2><div className="flex gap-2"><label className="relative min-w-0 flex-1"><Search size={16} className="absolute left-3 top-3 text-muted-foreground" /><input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter your list…" className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary" /></label><select value={sort} onChange={(e) => setSort(e.target.value as "newest" | "title")} aria-label="Sort saved anime" className="rounded-xl border border-border bg-card px-3 text-sm"><option value="newest">Recently added</option><option value="title">A–Z</option></select></div></div>
      {savedItems.length ? <div className={grid}>{savedItems.map((r) => <Poster key={r.id} id={r.anilist_id} title={r.title} cover={r.cover_url} />)}</div>
        : <p className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-muted-foreground">{filter ? "No saved anime match that search." : "Nothing saved yet."} <Link to="/browse" className="text-primary">Find something to watch</Link>.</p>}
    </main>
  );
}
