import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bell, CheckCheck, CalendarClock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { watchlistQuery } from "@/lib/library";

export const Route = createFileRoute("/notifications")({ component: Notifications });
type Airing = { id: number; airingAt: number; episode: number; media: { id: number; title: { english: string | null; romaji: string } } };
async function getAiring(): Promise<Airing[]> {
  const now = Math.floor(Date.now() / 1000);
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "query ($from:Int,$to:Int) { Page(page:1,perPage:50) { airingSchedules(airingAt_greater:$from,airingAt_lesser:$to,sort:TIME) { id airingAt episode media { id title { english romaji } } } } }", variables: { from: now - 7 * 86400, to: now + 7 * 86400 } }),
  });
  if (!res.ok) throw Error("Episode schedule unavailable");
  const json = await res.json();
  if (json.errors?.length) throw Error("Episode schedule unavailable");
  return json.data?.Page?.airingSchedules ?? [];
}
function Notifications() {
  const { user, openAuth } = useAuth();
  const list = useQuery(watchlistQuery(user?.id));
  const schedule = useQuery({ queryKey: ["notification-airings"], queryFn: getAiring, staleTime: 15 * 60 * 1000 });
  const [read, setRead] = useState<string[]>([]);
  useEffect(() => {
    if (!user) { setRead([]); return; }
    try { setRead(JSON.parse(localStorage.getItem(`streamly-notifications-read-${user.id}`) || "[]")); } catch { setRead([]); }
  }, [user?.id]);
  const markRead = (ids: string[]) => {
    if (!user) return;
    const next = [...new Set([...read, ...ids])].slice(-500);
    setRead(next);
    try { localStorage.setItem(`streamly-notifications-read-${user.id}`, JSON.stringify(next)); } catch {}
  };
  const ids = new Set((list.data ?? []).map((a) => a.anilist_id));
  const relevant = (schedule.data ?? []).filter((a) => ids.has(a.media.id));
  const key = (a: Airing) => String(a.id);
  const unread = relevant.filter((a) => !read.includes(key(a))).length;
  return <main className="mx-auto max-w-3xl px-5 pb-20 pt-32">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h1 className="flex items-center gap-3 border-l-4 border-primary pl-3 text-3xl font-bold"><Bell className="text-primary" /> Notifications</h1>{unread > 0 && <button onClick={() => markRead(relevant.map(key))} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary"><CheckCheck size={16} /> Mark all read</button>}</div>
    {!user ? <div className="rounded-xl border border-border bg-card p-6"><p>Sign in to see episode alerts for anime in your watchlist.</p><button onClick={() => openAuth("signin")} className="mt-3 text-primary underline">Sign in</button></div>
      : list.isPending || schedule.isPending ? <p className="text-muted-foreground">Checking upcoming episodes…</p>
      : list.isError || schedule.isError ? <p role="alert" className="text-muted-foreground">Episode schedule unavailable. Please try again later.</p>
      : relevant.length ? <div className="space-y-3">{relevant.map((a) => {
        const isRead = read.includes(key(a));
        const released = a.airingAt * 1000 <= Date.now();
        return <Link key={a.id} to="/anime/$id" params={{ id: String(a.media.id) }} onClick={() => markRead([key(a)])} className={`flex gap-3 rounded-xl border p-4 transition hover:border-primary ${isRead ? "border-border bg-card/50" : "border-primary/50 bg-primary/5"}`}>
          <CalendarClock className="mt-1 shrink-0 text-primary" size={22} /><div className="min-w-0 flex-1"><p className="font-bold">{a.media.title.english || a.media.title.romaji}</p><p className="mt-1 text-sm">Episode {a.episode} {released ? "was scheduled to air" : "is scheduled to air"}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(a.airingAt * 1000).toLocaleString()} · AniList schedule</p></div>{!isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}</Link>;
      })}</div> : <div className="rounded-xl border border-border bg-card p-6"><h2 className="text-xl font-bold">All caught up!</h2><p className="mt-2 text-sm text-muted-foreground">No scheduled episodes found for your watchlist in the current results.</p></div>}
    <p className="mt-6 text-xs text-muted-foreground">Alerts use the first 50 AniList airing records for the last and next seven days. Airing does not guarantee a playable episode. Read status is saved on this device.</p>
  </main>;
}
