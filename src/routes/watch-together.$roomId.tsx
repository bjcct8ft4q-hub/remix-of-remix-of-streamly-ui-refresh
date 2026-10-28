import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Copy, Send, Play, Pause, Users, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { animeQuery } from "@/lib/anime-queries";
import { getSourceEpisodes, getStreams, PROVIDER_ORDER } from "@/lib/kitsune";
import { VideoPlayer } from "@/components/VideoPlayer";
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
  const [copied,setCopied]=useState(false);
  const [streamError,setStreamError]=useState("");
  const [stream,setStream]=useState<Awaited<ReturnType<typeof getStreams>>[number]|null>(null);
  const syncing=useRef(false);
  const lastSync=useRef(0);
  const roomRef=useRef<Room|null>(null);
  roomRef.current=room;
  const [position,setPosition]=useState(0);
  const [playing,setPlaying]=useState(false);
  const player=useRef<HTMLVideoElement|null>(null);

  const host=user?.id===room?.host_id;
  useEffect(()=>{
    if(!joined || !room || room.status==="ended")return;
    let cancelled=false;
    setStream(null);setStreamError("");
    void (async()=>{
      try{
        const episodes=await getSourceEpisodes(room.anime_id);
        const episode=episodes.find(e=>e.number===room.episode);
        const sources=(episode?.sources??[]).filter(s=>s.audio===room.audio).sort((a,b)=>PROVIDER_ORDER.indexOf(a.provider)-PROVIDER_ORDER.indexOf(b.provider));
        let lastError="No playable source available for this episode.";
        for(const source of sources){
          try{
            const streams=await getStreams(source.watchId);
            const direct=streams.find(s=>s.kind!=="embed");
            if(direct){if(!cancelled)setStream(direct);return;}
          }catch(e){lastError=e instanceof Error?e.message:lastError;}
        }
        if(!cancelled)setStreamError(lastError);
      }catch(e){if(!cancelled)setStreamError(e instanceof Error?e.message:"Unable to load episode.");}
    })();
    return()=>{cancelled=true;};
  },[joined,room?.anime_id,room?.episode,room?.audio,room?.status==="ended"]);
  const syncVideo=(state:Room)=>{
    const v=player.current;
    if(!v||!joined||state.status==="ended")return;
    const elapsed=state.is_playing?Math.max(0,(Date.now()-new Date(state.updated_at).getTime())/1000):0;
    const target=Math.max(0,state.playback_seconds+Math.min(elapsed,30));
    syncing.current=true;
    if(v.readyState>=1 && Math.abs(v.currentTime-target)>1.5){try{v.currentTime=target;}catch{}}
    if(state.is_playing && v.paused)void v.play().catch(()=>setStreamError("Press Play once to allow synchronized playback in your browser."));
    if(!state.is_playing && !v.paused)v.pause();
    window.setTimeout(()=>{syncing.current=false;},300);
  };
  useEffect(()=>{
    if(!joined||!stream||!room||host)return;
    syncVideo(room);
    const interval=window.setInterval(()=>{if(roomRef.current)syncVideo(roomRef.current);},4000);
    return()=>window.clearInterval(interval);
  },[joined,stream?.src,host,room?.id]);
  const publishPlayback=async(force=false)=>{
    const v=player.current;
    if(!host||!v||syncing.current||roomRef.current?.status==="ended")return;
    if(!force&&Date.now()-lastSync.current<3000)return;
    lastSync.current=Date.now();
    await update({status:"live",is_playing:!v.paused,playback_seconds:Math.max(0,v.currentTime)});
  };
  const load=async()=>{
    const [{data:r,error:e},{data:m}]=await Promise.all([
      db.from("watch_rooms").select("*").eq("id",roomId).maybeSingle(),
      db.from("watch_room_messages").select("id,username,body,created_at").eq("room_id",roomId).order("created_at",{ascending:true}).limit(100)
    ]);
    if(e)setError("Unable to load room. Check that Watch Together is configured.");
    else if(!r)setError("Room not found or access denied.");
    else {setError("");setRoom(r);setPosition(r.playback_seconds);setPlaying(r.is_playing);if(!host && joined)syncVideo(r);}
    setMessages(m??[]);
  };
  useEffect(()=>{
    if(!user)return;
    void load();
    const channel=supabase.channel("room-"+roomId).on("postgres_changes",{event:"*",schema:"public",table:"watch_rooms",filter:`id=eq.${roomId}`},()=>void load()).on("postgres_changes",{event:"INSERT",schema:"public",table:"watch_room_messages",filter:`room_id=eq.${roomId}`},()=>void load()).subscribe();
    return()=>{void supabase.removeChannel(channel);};
  },[roomId,user?.id]);
  const update=async(patch:Record<string,unknown>)=>{
    if(!host || room?.status==="ended")return;
    const {error:e}=await db.from("watch_rooms").update({...patch,updated_at:new Date().toISOString()}).eq("id",roomId).eq("host_id",user?.id);
    if(e)setError("Could not update the room.");else void load();
  };
  useEffect(()=>{
    const v=player.current;if(!host||!joined||!stream||!v)return;
    const onPlay=()=>void publishPlayback(true);
    const onPause=()=>void publishPlayback(true);
    const onSeek=()=>void publishPlayback(true);
    const onTime=()=>void publishPlayback(false);
    v.addEventListener("play",onPlay);v.addEventListener("pause",onPause);v.addEventListener("seeked",onSeek);v.addEventListener("timeupdate",onTime);
    return()=>{v.removeEventListener("play",onPlay);v.removeEventListener("pause",onPause);v.removeEventListener("seeked",onSeek);v.removeEventListener("timeupdate",onTime);};
  },[host,joined,stream?.src,room?.status]);
  const send=async(e:React.FormEvent)=>{
    e.preventDefault();if(!user||!draft.trim()||room?.status==="ended")return;
    const body=draft.trim().slice(0,500);setDraft("");
    const {error:sendError}=await db.from("watch_room_messages").insert({room_id:roomId,user_id:user.id,username:username||"Member",body});
    if(sendError){setError("Message could not be sent.");setDraft(body);}else void load();
  };
  return <main className="mx-auto max-w-[1800px] px-4 pb-16 pt-4">
    <div className="mb-3 flex gap-2 text-xs text-muted-foreground"><Link to="/watch-together" className="hover:text-primary">← Rooms</Link><span>›</span><span>Watch Party</span></div>
    {!user?<div className="py-32 text-center"><h1 className="text-2xl font-bold">Sign in to join Watch Together</h1><button className="mt-5 rounded bg-primary px-6 py-2 font-bold text-primary-foreground" onClick={()=>openAuth("signin")}>Sign in</button></div>:
    error&&!room?<p role="alert" className="py-24 text-center text-destructive">{error}</p>:
    !room?<p className="py-24 text-center text-muted-foreground">Loading room…</p>:
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0"><div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-black">
        {room.status==="ended"?<div className="p-6 text-center text-sm">This watch party has ended.</div>:
        !joined?<div className="text-center"><h2 className="mb-4 text-xl font-bold">{room.anime_title} · Episode {room.episode}</h2><button onClick={()=>setJoined(true)} className="rounded bg-primary px-6 py-3 font-bold text-primary-foreground">Join and load episode</button></div>:
        stream?<VideoPlayer key={stream.src} ref={player} kind={stream.kind} src={stream.src} subtitles={stream.subtitles} intro={stream.intro} poster={room.anime_cover??undefined} autoPlay={false} fileName={room.anime_title+" - Episode "+room.episode}
          onLoaded={v=>{if(!host)syncVideo(room);else if(room.playback_seconds>0)v.currentTime=room.playback_seconds;}}
          onEnded={()=>{if(host)void update({is_playing:false,playback_seconds:player.current?.duration||0});}} />:
        <div className="p-6 text-center text-sm">{streamError||"Loading episode video…"}</div>}
      </div>
      {joined&&stream&&room.status!=="ended"&&<p className="mt-2 text-xs text-muted-foreground">{host?"You control playback for everyone.":"Playback follows the host. Browser autoplay may require one click."}</p>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-extrabold">{room.anime_title}</h1><p className="mt-1 text-xs text-muted-foreground">Episode {room.episode} · {room.audio.toUpperCase()} · {room.status}</p></div><button onClick={async()=>{try{await navigator.clipboard.writeText(window.location.href);setCopied(true);}catch{setError("Could not copy the link. Copy it from your browser address bar.");}} className="flex items-center gap-2 rounded border border-border px-4 py-2 text-sm"><Copy className="h-4 w-4"/>{copied?"Link copied":"Copy invite link"}</button></div>
        {host&&room.status!=="ended"&&<div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-border p-4"><span className="text-xs font-bold text-muted-foreground">HOST CONTROLS</span><button onClick={()=>{const v=player.current;if(v){if(v.paused)void v.play().then(()=>void publishPlayback(true));else {v.pause();void publishPlayback(true);}}else void update({status:"live",is_playing:!playing,playback_seconds:position});}} className="flex items-center gap-2 rounded bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">{playing?<Pause className="h-4 w-4"/>:<Play className="h-4 w-4"/>}{playing?"Pause":"Start / Play"}</button><label className="flex items-center gap-2 text-xs">Position (seconds)<input type="number" min="0" value={position} onChange={e=>setPosition(Math.max(0,Number(e.target.value)))} className="w-24 rounded border border-border bg-background p-2"/></label><button onClick={()=>{if(player.current)player.current.currentTime=position;void update({status:"live",playback_seconds:position,is_playing:player.current?!player.current.paused:playing});}} className="rounded border border-border px-3 py-2 text-xs">Sync position</button><button onClick={()=>{if(window.confirm("End this watch party for everyone?"))void update({status:"ended",is_playing:false});}} className="rounded border border-destructive px-3 py-2 text-xs text-destructive">End room</button></div>}
        {error&&<p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
      </section>
      <aside className="flex min-h-[65vh] flex-col rounded-lg border border-border bg-card/30"><div className="flex items-center justify-between border-b border-border p-4"><h2 className="font-bold text-primary">Chat</h2><Users className="h-4 w-4 text-muted-foreground"/></div><div className="flex-1 space-y-3 overflow-y-auto p-4">{messages.length?messages.map(m=><div key={m.id} className="text-sm"><span className="mr-2 font-bold text-primary">{m.username}</span><span className="break-words">{m.body}</span></div>):<p className="py-20 text-center text-sm text-muted-foreground">No messages yet. Say hello!</p>}</div><form onSubmit={send} className="flex gap-2 border-t border-border p-3"><input aria-label="Chat message" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={500} disabled={room.status==="ended"} placeholder="Send a message..." className="min-w-0 flex-1 rounded border border-border bg-background px-3 py-2 text-sm"/><button aria-label="Send message" disabled={!draft.trim()||room.status==="ended"} className="rounded bg-primary p-2 text-primary-foreground disabled:opacity-40"><Send className="h-4 w-4"/></button></form></aside>
    </div>}
  </main>;
}