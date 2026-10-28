import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, Search, Radio, Clock3, LockKeyhole, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/watch-together")({ component: WatchTogether });
type Room = { id: string; host_id: string; host_name: string; anime_id: number; anime_title: string; anime_cover: string | null; episode: number; audio: string; status: string; created_at: string };
const db = supabase as any;
function WatchTogether() {
  const { user, openAuth } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loadingRooms, setLoadingRooms] = useState(false);
  const refresh = async () => {
    if (!user) return;
    setLoadingRooms(true);
    const { data, error } = await db.from("watch_rooms").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) setError("Rooms are not available yet. The Watch Together database migration may need to be applied.");
    else { setError(""); setRooms(data ?? []); }
    setLoadingRooms(false);
  };
  useEffect(() => {
    if (!user) return;
    void refresh();
    const channel = supabase.channel("watch-rooms-list").on("postgres_changes", { event: "*", schema: "public", table: "watch_rooms" }, () => void refresh()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);
  const visible = rooms.filter(r => (tab === "all" || (tab === "mine" ? r.host_id === user?.id : r.status === tab)) && (r.anime_title + r.host_name).toLowerCase().includes(search.toLowerCase()));
  return <main className="mx-auto min-h-[75vh] max-w-6xl px-5 pb-24 pt-16">
    <div className="text-center"><Users className="mx-auto h-9 w-9 text-primary"/><h1 className="mt-3 text-4xl font-black">Watch Together</h1><p className="mt-2 text-sm text-muted-foreground">Find rooms to watch anime with friends. Choose an episode and press W2G on its watch page to host. Playback syncing is still being developed.</p></div>
    {!user ? <div className="mx-auto mt-12 max-w-md rounded-xl border border-border p-8 text-center"><LockKeyhole className="mx-auto mb-3 h-8 w-8 text-primary"/><h2 className="font-bold">Sign in to join or create a room</h2><button onClick={() => openAuth("signin")} className="mt-4 rounded bg-primary px-5 py-2 font-bold text-primary-foreground">Sign in</button></div> : <>
      <div className="mt-8 grid gap-3 sm:grid-cols-3">{([["Live now", rooms.filter(r => r.status === "live").length], ["Waiting", rooms.filter(r => r.status === "waiting").length], ["Your rooms", rooms.filter(r => r.host_id === user.id).length]] as const).map(([label,count]) => <div key={label} className="rounded-xl border border-border bg-card/60 p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-black text-primary">{loadingRooms && !rooms.length ? "…" : count}</p></div>)}</div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-b border-border/50 pb-3"><div className="flex flex-wrap gap-5">{[["all","All"],["live","Live"],["waiting","Waiting"],["ended","Ended"],["mine","My Rooms"]].map(([value,label])=><button key={value} onClick={()=>setTab(value)} className={`pb-2 text-sm font-semibold ${tab===value?"border-b-2 border-primary text-primary":"text-muted-foreground hover:text-foreground"}`}>{label}</button>)}</div><label className="flex items-center gap-2 rounded border border-border px-3 py-2"><Search className="h-4 w-4"/><input className="bg-transparent text-sm outline-none" placeholder="Search rooms..." value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
      <button type="button" onClick={() => void refresh()} disabled={loadingRooms} className="mt-4 flex items-center gap-2 text-xs font-bold text-primary hover:underline disabled:opacity-50"><RefreshCw size={14} className={loadingRooms ? "animate-spin" : ""} />Refresh rooms</button>
      {error && <p role="alert" className="mt-5 text-sm text-destructive">{error}</p>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map(r=><Link key={r.id} to="/watch-together/$roomId" params={{roomId:r.id}} className="group overflow-hidden rounded-xl border border-border/60 bg-card/50 transition hover:border-primary/60"><div className="flex min-h-32 gap-4 bg-gradient-to-br from-primary/10 to-background p-4">{r.anime_cover&&<img src={r.anime_cover} alt="" className="h-28 w-20 rounded object-cover"/>}<div className="min-w-0"><span className="rounded bg-primary px-2 py-1 text-[10px] font-black uppercase text-primary-foreground">{r.status==="live"?"● Live":r.status}</span><h2 className="mt-3 line-clamp-2 font-bold">{r.anime_title}</h2><p className="mt-2 text-xs text-muted-foreground">EP {r.episode} · {r.audio.toUpperCase()}</p></div></div><div className="flex justify-between border-t border-border/50 px-4 py-3 text-xs"><span>Hosted by <strong>{r.host_name}</strong></span><span className="text-primary">Join →</span></div></Link>)}</div>
      {!visible.length && !error && !loadingRooms && <div className="py-20 text-center text-muted-foreground"><Clock3 className="mx-auto mb-3 h-8 w-8"/><p>No rooms here yet. Open an anime episode and select W2G to start one.</p></div>}
    </>}
  </main>;
}
