import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Newspaper, ExternalLink } from "lucide-react";
export const Route = createFileRoute("/news")({ component: News });
type Anime={id:number;title:{english?:string;romaji?:string};coverImage:{extraLarge?:string;large:string};description?:string;seasonYear?:number;format?:string;startDate?:{year?:number;month?:number;day?:number}};
async function getUpdates():Promise<Anime[]>{
 const response=await fetch("https://graphql.anilist.co",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:"query{Page(page:1,perPage:20){media(type:ANIME,sort:UPDATED_AT_DESC,isAdult:false){id title{english romaji} coverImage{extraLarge large} description(asHtml:false) seasonYear format startDate{year month day}}}}"} )});
 if(!response.ok)throw Error("Updates unavailable");
 const json=await response.json();if(json.errors)throw Error("Updates unavailable");
 return json.data?.Page?.media??[];
}
function News(){
 const {data=[],isPending,isError,refetch}=useQuery({queryKey:["anilist-recently-updated"],queryFn:getUpdates,staleTime:30*60*1000});
 return <main className="mx-auto max-w-6xl px-5 pb-24 pt-16"><div className="text-center"><Newspaper className="mx-auto h-9 w-9 text-primary"/><h1 className="mt-3 text-4xl font-black">News & Updates</h1><p className="mt-2 text-sm text-muted-foreground">Recently updated anime listings and links to independent anime news coverage.</p></div>
 <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3"><h2 className="text-lg font-bold">Recently updated anime</h2><a className="flex items-center gap-2 text-sm text-primary hover:underline" href="https://www.animenewsnetwork.com/news/" target="_blank" rel="noopener noreferrer">Anime News Network <ExternalLink className="h-4 w-4"/></a></div>
 {isPending?<p className="py-20 text-center text-muted-foreground">Loading updates…</p>:isError?<p className="py-20 text-center text-muted-foreground">Updates unavailable. <button onClick={()=>void refetch()} className="text-primary underline">Retry</button></p>:<div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{data.map(a=><a key={a.id} href={`/anime/${a.id}`} className="group"><div className="aspect-video overflow-hidden rounded-lg bg-muted"><img src={a.coverImage.extraLarge||a.coverImage.large} alt="" className="h-full w-full object-cover transition group-hover:scale-105"/></div><span className="mt-2 inline-block rounded bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase text-primary">{a.format||"Anime"} · Updated listing</span><h3 className="mt-2 line-clamp-2 font-extrabold group-hover:text-primary">{a.title.english||a.title.romaji}</h3><p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{a.description?.replace(/<[^>]*>/g,"")||"View anime details and updates."}</p></a>)}</div>}
 <p className="mt-8 text-xs text-muted-foreground">These are recently updated AniList entries, not independently reported news articles. For reported news, visit the linked publisher.</p></main>;
}