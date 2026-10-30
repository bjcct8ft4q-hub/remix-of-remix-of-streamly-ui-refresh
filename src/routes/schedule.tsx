import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import { EpisodeCountdown } from "@/components/EpisodeCountdown";
export const Route = createFileRoute("/schedule")({ component: Schedule });
type Airing = { airingAt:number; episode:number; media:{id:number;title:{english?:string;romaji?:string};coverImage:{large:string};format?:string;genres?:string[]} };
async function getSchedule(dayStart: number, dayEnd: number): Promise<Airing[]> {
 const all: Airing[] = [];
 for (let page = 1; page <= 5; page++) {
   const response = await fetch("https://graphql.anilist.co", {
     method: "POST",
     headers: { "Content-Type": "application/json", Accept: "application/json" },
     body: JSON.stringify({
       query: "query($start:Int,$end:Int,$page:Int){Page(page:$page,perPage:50){pageInfo{hasNextPage}airingSchedules(airingAt_greater:$start,airingAt_lesser:$end,sort:TIME){airingAt episode media{id title{english romaji} coverImage{large} format genres}}}}",
       variables: { start: dayStart - 1, end: dayEnd, page },
     }),
   });
   if (!response.ok) throw new Error("Schedule temporarily unavailable");
   const json = await response.json();
   if (json.errors?.length) throw new Error("Schedule temporarily unavailable");
   const pageData = json.data?.Page;
   all.push(...(pageData?.airingSchedules ?? []).filter((a: Airing) => !!a.media?.id));
   if (!pageData?.pageInfo?.hasNextPage) break;
 }
 return all;
}
function Schedule(){
 const [offset,setOffset]=useState(0);
 const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+i);return d;});
 const day=days[offset];
 const dayStart = Math.floor(day.getTime() / 1000);
 const nextDay = new Date(day); nextDay.setDate(nextDay.getDate() + 1);
 const dayEnd = Math.floor(nextDay.getTime() / 1000);
 const {data=[],isPending,isError,refetch}=useQuery({queryKey:["daily-airing-schedule",dayStart],queryFn:()=>getSchedule(dayStart,dayEnd),staleTime:15*60*1000,retry:1});
 const filtered=data.filter(x=>x.airingAt>=dayStart && x.airingAt<dayEnd);
 return <main className="mx-auto max-w-5xl px-5 pb-24 pt-16"><div className="text-center"><CalendarDays className="mx-auto h-9 w-9 text-primary"/><h1 className="mt-3 text-4xl font-black">Weekly Schedule</h1><p className="mt-2 text-sm text-muted-foreground">Upcoming anime airings from AniList, displayed in your local time.</p></div>
 <div className="mx-auto mt-14 flex max-w-2xl justify-center gap-2 overflow-x-auto">{days.map((d,i)=><button key={i} onClick={()=>setOffset(i)} className={`min-w-16 rounded-lg border px-3 py-3 text-center ${i===offset?"border-primary bg-primary/10 text-primary":"border-border bg-card/40 text-muted-foreground"}`}><span className="block text-[10px] font-bold uppercase">{d.toLocaleDateString("en-GB",{weekday:"short"})}</span><span className="mt-1 block text-xl font-extrabold">{d.getDate()}</span></button>)}</div>
 <h2 className="mt-12 border-b border-border pb-3 text-lg font-extrabold">{day.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}</h2>
 {isPending?<p className="py-20 text-center text-muted-foreground">Loading upcoming airings…</p>:isError?<div className="py-20 text-center text-muted-foreground">Schedule unavailable. <button className="text-primary underline" onClick={()=>void refetch()}>Try again</button></div>:filtered.length?<div className="mt-5 space-y-4">{filtered.map((a,i)=><Link key={a.media.id+"-"+a.episode+"-"+i} to="/anime/$id" params={{id:String(a.media.id)}} className="flex gap-4 rounded-xl border border-border/60 bg-card/40 p-4 transition hover:border-primary"><img src={a.media.coverImage.large} alt="" className="h-28 w-20 rounded object-cover"/><div className="min-w-0 flex-1"><h3 className="font-bold">{a.media.title.english||a.media.title.romaji}</h3><p className="mt-2 text-sm text-muted-foreground">{a.media.genres?.slice(0,3).join(" · ")}</p><p className="mt-3 text-xs text-primary">Episode {a.episode} · {a.media.format||"Anime"}</p></div><div className="flex shrink-0 items-center gap-2 text-sm font-bold text-primary"><Clock3 className="h-4 w-4"/><span className="flex flex-col items-end gap-1"><EpisodeCountdown airingAt={a.airingAt} episode={a.episode} /><span>{new Date(a.airingAt*1000).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</span></span></div></Link>)}</div>:<p className="py-20 text-center text-muted-foreground">No scheduled airings found for this day in the current results.</p>}
 <p className="mt-8 text-xs text-muted-foreground">Schedule data is sourced from AniList and may change. Each date is fetched separately to avoid missing later weekdays.</p></main>;
}