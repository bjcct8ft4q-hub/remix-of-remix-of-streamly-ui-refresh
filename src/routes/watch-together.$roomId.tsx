import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Copy, Send, Play, Pause, Users, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { animeQuery } from "@/lib/anime-queries";
import { animeTitle } from "@/lib/kitsune";
export const Route = createFileRoute("/watch-together/$roomId")({ component: WatchRoom });
type Room = { id:string; host_id:string; anime_id:number; anime_title:string; anime_cover:string|null; episode:number; audio:"sub"|"dub"; status:string; playback_seconds:number; is_playing:boolean; updated_at:string };
type Message = { id:number; username:string; body:string; created_at:string };
const db = supabase as any;
function WatchRoom(){
  const {roomId}=Route.useParams();
  const {user,username,openAuth}=useAuth();
  const [room,setRoom]=useState<Room|null>(null);
  const [messages,setMessages]=useState<Message[]>([]);
  const [draft,setDraft]=useState("");
  const [error,setError]=useState("");
  const [joined,setJoined]=useState(false);
  const [position,setPosition]=useState(0);
  const [playing,setPlaying]=useState(false);
  const player=useRef<HTMLVideoElement|null>(null);
  const info=useQuery({...animeQuery(room?.anime_id??0),enabled:!!room});
  const host=user?.id===room?.host_id;
  const load=async()=>{
    const [{data:r,error:e},{data:m}]=await Promise.all([
      db.from("watch_rooms").select("*").eq("id",roomId).maybeSingle(),
      db.from("watch_room_messages").select("id,username,body,created_at").eq("room_id",roomId).order("created_at",{ascending:true}).limit(100)
    ]);
    if(e)setError("Unable to load room. Check that Watch Together is configured.");
    else if(!r)setError("Room not found or access denied.");
    else {setRoom(r);setPosition(r.playback_seconds);setPlaying(r.is_playing);}
    setMessages(m??[]);
  };
  useEffect(()=>{
    if(!user)return;
    void load();
    const channel=supabase.channel("room-"+roomId).on("postgres_changes",{event:"*",schema:"public",table:"watch_rooms",filter:`id=eq.${roomId}`},()=>void load()).on("postgres_changes",{event:"INSERT",schema:"public",table:"watch_room_messages",filter:`room_id=eq.${roomId}`},()=>void load()).subscribe();
    return()=>{void supabase.removeChannel(channel);};
  },[roomId,user?.id]);
  const update=async(patch:Record<string,unknown>)=>{
    if(!host)return;
    const {error:e}=await db.from("watch_rooms").update({...patch,updated_at:new Date().toISOString()}).eq("id",roomId).eq("host_id",user?.id);
    if(e)setError("Could not update the room.");else void load();
  };
  const send=async(e:React.FormEvent)=>{
    e.preventDefault();if(!user||!draft.trim()||room?.status==="ended")return;
    const body=draft.trim().slice(0,500);setDraft("");
    const {error:e}=await db.from("watch_room_messages").insert({room_id:roomId,user_id:user.id,username:username||"Member",body});
    if(e){setError("Message could not be sent.");setDraft(body);}else void load();
  };
  return <main className="mx-auto max-w-[1800px] px-4 pb-16 pt-4">
    <div className="mb-3 flex gap-2 text-xs text-muted-foreground"><Link to="/watch-together" className="hover:text-primary">← Rooms</Link><span>›</span><span>Watch Party</span></div>
    {!user?<div className="py-32 text-center"><h1 className="text-2xl font-bold">Sign in to join Watch Together</h1><button className="mt-5 rounded bg-primary px-6 py-2 font-bold text-primary-foreground" onClick={()=>openAuth("signin")}>Sign in</button></div>:
    error&&!room?<p role="alert" className="py-24 text-center text-destructive">{error}</p>:
    !room?<p className="py-24 text-center text-muted-foreground">Loading room…</p>:
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0"><div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-black">
        {room.anime_cover&&<img src={room.anime_cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20 blur-xl"/>}
        <div className="relative z-10 flex flex-col items-center gap-4 text-center"><span className="rounded border border-primary/50 bg-background/80 px-3 py-1 text-xs font-bold text-primary">{host?"You are the host":"Synced to host"} · {room.status.toUpperCase()}</span>
          <h2 className="max-w-xl px-4 text-xl font-extrabold">{room.anime_title} · Episode {room.episode}</h2>
          {!joined?<button onClick={()=>setJoined(true)} className="flex items-center gap-2 rounded bg-primary px-6 py-3 font-bold text-primary-foreground"><Play className="h-5 w-5"/>Join room</button>:<div className="rounded-lg bg-background/80 p-4"><p className="text-sm">Shared playback position: {Math.floor(position/60)}:{String(Math.floor(position%60)).padStart(2,"0")}</p><p className="mt-1 text-xs text-muted-foreground">Playback state is shared; video sources must be accessed separately by each viewer.</p><Link to="/anime/$id/watch" params={{id:String(room.anime_id)}} search={{ep:room.episode,audio:room.audio}} className="mt-3 inline-block rounded bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Open episode player</Link></div>}
        </div></div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-extrabold">{room.anime_title}</h1><p className="mt-1 text-xs text-muted-foreground">Episode {room.episode} · {room.audio.toUpperCase()} · {room.status}</p></div><button onClick={()=>void navigator.clipboard.writeText(window.location.href)} className="flex items-center gap-2 rounded border border-border px-4 py-2 text-sm"><Copy className="h-4 w-4"/>Copy invite link</button></div>
        {host&&<div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-border p-4"><span className="text-xs font-bold text-muted-foreground">HOST CONTROLS</span><button onClick={()=>void update({status:"live",is_playing:!playing,playback_seconds:position})} className="flex items-center gap-2 rounded bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">{playing?<Pause className="h-4 w-4"/>:<Play className="h-4 w-4"/>}{playing?"Pause":"Start / Play"}</button><label className="flex items-center gap-2 text-xs">Position (seconds)<input type="number" min="0" value={position} onChange={e=>setPosition(Math.max(0,Number(e.target.value)))} className="w-24 rounded border border-border bg-background p-2"/></label><button onClick={()=>void update({playback_seconds:position})} className="rounded border border-border px-3 py-2 text-xs">Sync position</button><button onClick={()=>void update({status:"ended",is_playing:false})} className="rounded border border-destructive px-3 py-2 text-xs text-destructive">End room</button></div>}
        {error&&<p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
      </section>
      <aside className="flex min-h-[65vh] flex-col rounded-lg border border-border bg-card/30"><div className="flex items-center justify-between border-b border-border p-4"><h2 className="font-bold text-primary">Chat</h2><Users className="h-4 w-4 text-muted-foreground"/></div><div className="flex-1 space-y-3 overflow-y-auto p-4">{messages.length?messages.map(m=><div key={m.id} className="text-sm"><span className="mr-2 font-bold text-primary">{m.username}</span><span className="break-words">{m.body}</span></div>):<p className="py-20 text-center text-sm text-muted-foreground">No messages yet. Say hello!</p>}</div><form onSubmit={send} className="flex gap-2 border-t border-border p-3"><input aria-label="Chat message" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={500} disabled={room.status==="ended"} placeholder="Send a message..." className="min-w-0 flex-1 rounded border border-border bg-background px-3 py-2 text-sm"/><button aria-label="Send message" disabled={!draft.trim()||room.status==="ended"} className="rounded bg-primary p-2 text-primary-foreground disabled:opacity-40"><Send className="h-4 w-4"/></button></form></aside>
    </div>}
  </main>;
}