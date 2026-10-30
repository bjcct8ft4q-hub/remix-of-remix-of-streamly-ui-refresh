import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Play, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { historyQuery } from "@/lib/library";

export function ContinueWatchingShelf({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const history = useQuery(historyQuery(user?.id));
  if (!user) return null;
  if (history.isPending) return compact ? null : <p className="py-8 text-sm text-muted-foreground">Loading your watch history…</p>;
  if (history.isError) return compact ? null : <div className="py-8 text-sm text-muted-foreground">Could not load your watch history. <button type="button" className="font-semibold text-primary underline" onClick={() => void history.refetch()}>Try again</button></div>;
  const seen = new Set<number>();
  const items = (history.data ?? []).filter((item) => {
    if (seen.has(item.anilist_id)) return false;
    seen.add(item.anilist_id);
    return true;
  }).slice(0, compact ? 6 : 30);
  if (!items.length) return compact ? null : <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">No saved episodes yet. Start watching an anime while signed in, and your progress will appear here.</div>;
  return <section className="space-y-4">
    <div className="flex items-center justify-between gap-3"><h2 className="border-l-[3px] border-primary pl-3 text-xl font-extrabold">Pick up where you left off</h2>{compact && <Link to="/continue-watching" className="flex items-center gap-1 text-sm font-semibold text-primary">View all <ArrowRight size={15} /></Link>}</div>
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">{items.map((item) => {
      const progress = item.duration_seconds > 0 ? Math.min(100, Math.max(0, item.progress_seconds / item.duration_seconds * 100)) : 0;
      const completed = progress >= 95;
      return <Link key={item.id} to="/anime/$id/watch" params={{ id: String(item.anilist_id) }} search={{ ep: item.episode, audio: item.audio === "dub" ? "dub" : "sub" }} className="group min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-lg shadow-black/10 transition duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-primary/10">
        <div className="relative aspect-[2/3] overflow-hidden bg-muted">{item.cover_url && <img src={item.cover_url} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />}<span className="absolute bottom-3 right-3 rounded-full border border-primary/30 bg-background/95 p-3 text-primary shadow-lg transition group-hover:scale-110"><Play size={16} fill="currentColor" /></span><div className="absolute bottom-0 left-0 right-0 h-2 bg-black/60"><div className="h-full bg-primary" style={{ width: `${progress}%` }} /></div></div>
        <div className="p-3.5"><p className="line-clamp-2 text-sm font-bold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">Episode {item.episode} · {item.audio.toUpperCase()}</p><div className="mt-3 flex items-center justify-between gap-2"><p className="text-xs font-semibold text-primary">{completed ? "Nearly finished" : progress > 0 ? `${Math.round(progress)}% watched` : "Start episode"}</p><span className="text-[11px] font-bold text-muted-foreground group-hover:text-primary">Resume →</span></div></div>
      </Link>;
    })}</div>
  </section>;
}
