import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bell, CheckCheck, CalendarClock, UserPlus, Users, Activity, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { incidentsQuery } from "@/lib/status-queries";
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
  const friends = useQuery({
    queryKey: ["notifications-friends", user?.id], enabled: !!user,
    queryFn: async () => {
      const {data,error} = await (supabase as any).from("friend_requests")
        .select("id,sender_id,receiver_id,status,created_at,updated_at")
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
        .order("updated_at",{ascending:false}).limit(100);
      if(error)throw error;
      return (data??[]) as Array<{id:string;sender_id:string;receiver_id:string;status:string;created_at:string;updated_at:string}>;
    },refetchInterval:30000,
  });
  const incidents = useQuery(incidentsQuery());
  const friendEvents = (friends.data??[]).filter(r =>
    (r.receiver_id===user?.id && r.status==="pending") ||
    (r.sender_id===user?.id && r.status==="accepted")
  );
  const friendIds = [...new Set(friendEvents.map(r=>r.sender_id===user?.id?r.receiver_id:r.sender_id))];
  const profiles = useQuery({
    queryKey:["notification-friend-profiles",friendIds.join(",")],enabled:!!user&&friendIds.length>0,
    queryFn:async()=>{
      const {data,error}=await supabase.from("profiles").select("id,username").in("id",friendIds);
      if(error)throw error;return data??[];
    },staleTime:60000,
  });
  const friendName = (id:string) => profiles.data?.find(p=>p.id===id)?.username || "A Streamly member";
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
  const incidentEvents = (incidents.data??[]).slice(0,30);
  const friendKey = (r: typeof friendEvents[number]) => `friend:${r.id}:${r.status}`;
  const incidentKey = (i: typeof incidentEvents[number]) => `incident:${i.id}:${i.status}:${i.updated_at}`;
  const unread = relevant.filter(a=>!read.includes(key(a))).length +
    friendEvents.filter(r=>!read.includes(friendKey(r))).length +
    incidentEvents.filter(i=>!read.includes(incidentKey(i))).length;
  const allKeys = [...relevant.map(key),...friendEvents.map(friendKey),...incidentEvents.map(incidentKey)];
  return <main className="mx-auto max-w-3xl px-5 pb-20 pt-32">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h1 className="flex items-center gap-3 border-l-4 border-primary pl-3 text-3xl font-bold"><Bell className="text-primary" /> Notifications</h1>{unread > 0 && <button onClick={() => markRead(allKeys)} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary"><CheckCheck size={16} /> Mark all read</button>}</div>
    {!user ? <div className="rounded-xl border border-border bg-card p-6"><p>Sign in to receive friend requests, friendship updates, service alerts and watchlist episode notifications.</p><button onClick={() => openAuth("signin")} className="mt-3 text-primary underline">Sign in</button></div> : <>
      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">{[[friendEvents.length,"Friends"],[incidentEvents.length,"Status"],[relevant.length,"Episodes"]].map(([count,label])=><div key={label} className="rounded-xl border border-border bg-card p-3 text-center"><strong className="block text-xl font-black text-primary">{count}</strong><span className="text-xs text-muted-foreground">{label}</span></div>)}</div>
      <section className="mb-7 space-y-3"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-bold"><UserPlus size={19} className="text-primary"/> Friends</h2><Link to="/friends" className="text-xs font-semibold text-primary hover:underline">Manage friends</Link></div>
        {friends.isError&&<p role="alert" className="text-sm text-destructive">Friend notifications could not be loaded.</p>}
        {friendEvents.map(r=>{const incoming=r.receiver_id===user.id;const k=friendKey(r);const isRead=read.includes(k);return <Link key={k} to="/friends" onClick={()=>markRead([k])} className={`flex items-center gap-3 rounded-xl border p-4 transition hover:border-primary ${isRead?"border-border bg-card/50":"border-primary/50 bg-primary/5"}`}><Users size={20} className="shrink-0 text-primary"/><div className="min-w-0 flex-1"><p className="font-semibold">{incoming?`${friendName(r.sender_id)} sent you a friend request`:`${friendName(r.receiver_id)} accepted your friend request`}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(r.updated_at??r.created_at).toLocaleString()} · {incoming?"Accept or decline in Friends":"You are now friends"}</p></div>{!isRead&&<span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread"/>}</Link>})}
        {!friends.isPending&&!friendEvents.length&&!friends.isError&&<p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">No new friend activity.</p>}
      </section>
      <section className="mb-7 space-y-3"><h2 className="flex items-center gap-2 text-lg font-bold"><Activity size={19} className="text-primary"/> Service status</h2>
        {incidents.isError&&<p className="text-sm text-destructive">Status notifications are unavailable.</p>}
        {incidentEvents.map(i=>{const k=incidentKey(i);const isRead=read.includes(k);return <Link key={k} to="/status" onClick={()=>markRead([k])} className={`flex items-center gap-3 rounded-xl border p-4 hover:border-primary ${isRead?"border-border bg-card/50":"border-primary/50 bg-primary/5"}`}><Activity size={20} className="shrink-0 text-primary"/><div className="min-w-0 flex-1"><p className="font-semibold">{i.title}</p><p className="mt-1 text-xs text-muted-foreground">{i.service} · <span className="capitalize">{i.status}</span> · {new Date(i.updated_at).toLocaleString()}</p></div>{!isRead&&<span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread"/>}</Link>})}
        {!incidents.isPending&&!incidentEvents.length&&!incidents.isError&&<p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">No published status updates.</p>}
      </section>
      <section className="space-y-3"><h2 className="flex items-center gap-2 text-lg font-bold"><CalendarClock size={19} className="text-primary"/> Watchlist episodes</h2>
        {(list.isError||schedule.isError)&&<p role="alert" className="text-sm text-muted-foreground">Episode schedule unavailable. Friend and status alerts are still available.</p>}
        {relevant.map(a=>{const isRead=read.includes(key(a));const released=a.airingAt*1000<=Date.now();return <Link key={a.id} to="/anime/$id" params={{id:String(a.media.id)}} onClick={()=>markRead([key(a)])} className={`flex gap-3 rounded-xl border p-4 transition hover:border-primary ${isRead?"border-border bg-card/50":"border-primary/50 bg-primary/5"}`}><CalendarClock className="mt-1 shrink-0 text-primary" size={22}/><div className="min-w-0 flex-1"><p className="font-bold">{a.media.title.english||a.media.title.romaji}</p><p className="mt-1 text-sm">Episode {a.episode} {released?"was scheduled to air":"is scheduled to air"}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(a.airingAt*1000).toLocaleString()} · AniList schedule</p></div>{!isRead&&<span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread"/>}</Link>})}
        {!relevant.length&&!list.isPending&&!schedule.isPending&&!list.isError&&!schedule.isError&&<p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">No upcoming episodes found for your watchlist.</p>}
      </section>
    </>}
    <p className="mt-6 text-xs text-muted-foreground">Notifications refresh while the page is open. Friend activity and incident updates are based on your account; episode schedules use AniList and do not guarantee playback. Read status is saved on this device.</p>
  </main>;
}
