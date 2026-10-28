import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bookmark, Search, ArrowUpDown, Compass, LoaderCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { watchlistQuery } from "@/lib/library";

export const Route = createFileRoute("/watchlist")({ component: Watchlist });

function Watchlist() {
  const { user, openAuth } = useAuth();
  const q = useQuery({ ...watchlistQuery(user?.id), enabled: !!user });
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState<"az" | "za">("az");
  const saved = q.data ?? [];
  const visible = saved.filter((a) => a.title.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => order === "az" ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title));
  return <main className="mx-auto min-h-[75vh] max-w-7xl px-4 pb-24 pt-12 sm:px-6">
    <div className="relative mb-8 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-card to-background p-6 sm:p-9">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-primary"><Bookmark size={15}/> Your collection</div>
      <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">My Watchlist</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Keep your favourite series in one place and jump back into them whenever you like.</p>
      {user && <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">{saved.length} saved {saved.length === 1 ? "title" : "titles"}</div>}
    </div>
    {!user ? <div className="rounded-xl border border-border bg-card/60 px-6 py-16 text-center">
      <Bookmark className="mx-auto mb-4 h-9 w-9 text-primary"/><h2 className="text-xl font-extrabold">Your watchlist is waiting</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Sign in to see the anime you've saved.</p>
      <button type="button" onClick={() => openAuth("signin")} className="mt-5 rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground">Sign in</button>
    </div> : <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-border bg-card px-3 focus-within:border-primary sm:max-w-sm"><Search className="h-4 w-4 text-muted-foreground"/><input type="search" aria-label="Search your watchlist" placeholder="Search saved anime..." value={search} onChange={e=>setSearch(e.target.value)} className="w-full bg-transparent text-sm outline-none"/></label>
        <button type="button" onClick={()=>setOrder(v=>v==="az"?"za":"az")} className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold transition-colors hover:border-primary"><ArrowUpDown size={15}/>Title: {order==="az"?"A–Z":"Z–A"}</button>
      </div>
      {q.isPending ? <div role="status" className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin"/>Loading your watchlist…</div>
      : q.isError ? <div role="alert" className="rounded-xl border border-destructive/40 p-6 text-center text-sm text-destructive">Could not load your watchlist. <button type="button" onClick={()=>void q.refetch()} className="font-bold underline">Try again</button></div>
      : visible.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">{visible.map(a=><Link key={a.id} to="/anime/$id" params={{id:String(a.anilist_id)}} className="group min-w-0 overflow-hidden rounded-xl border border-border bg-card/50 transition-all hover:-translate-y-1 hover:border-primary hover:shadow-lg hover:shadow-primary/10">
        <div className="relative aspect-[2/3] overflow-hidden bg-muted">{a.cover_url ? <img src={a.cover_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"/> : <div className="flex h-full items-center justify-center"><Bookmark className="h-9 w-9 text-muted-foreground"/></div>}<span className="absolute bottom-2 right-2 rounded-md bg-background/90 p-1.5 text-primary"><Bookmark size={14} fill="currentColor"/></span></div>
        <div className="p-3"><h2 className="line-clamp-2 text-sm font-extrabold leading-5 group-hover:text-primary">{a.title}</h2><p className="mt-2 text-[11px] font-semibold text-muted-foreground">View anime details →</p></div>
      </Link>)}</div>
      : <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-16 text-center"><Compass className="mx-auto mb-3 h-9 w-9 text-primary"/><h2 className="text-lg font-extrabold">{search ? "No matching anime" : "Your watchlist is empty"}</h2><p className="mt-2 text-sm text-muted-foreground">{search ? "Try another title or clear your search." : "Find a series you love and save it for later."}</p>{search ? <button onClick={()=>setSearch("")} className="mt-4 text-sm font-bold text-primary underline">Clear search</button> : <Link to="/browse" className="mt-5 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">Explore anime</Link>}</div>}
    </>}
  </main>;
}
