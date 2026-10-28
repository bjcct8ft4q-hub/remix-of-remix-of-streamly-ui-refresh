import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Crown, Code2, ShieldCheck, Shield, Star, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const BADGE_TYPES = [
  { id:"og", label:"OG Member", icon:Crown, color:"#eab308", description:"One of Streamly's earliest members." },
  { id:"developer", label:"Developer", icon:Code2, color:"#38a8ff", description:"Helps build and maintain Streamly." },
  { id:"admin", label:"Admin", icon:ShieldCheck, color:"#ef6868", description:"Streamly administrator." },
  { id:"moderator", label:"Moderator", icon:Shield, color:"#a78bfa", description:"Helps keep the Streamly community safe." },
  { id:"supporter", label:"Supporter", icon:Star, color:"#4ade80", description:"Supports the Streamly community." },
  { id:"veteran", label:"Veteran", icon:CalendarDays, color:"#c58b52", description:"Long-standing Streamly member." },
] as const;
export type BadgeId = typeof BADGE_TYPES[number]["id"];
export function useMemberBadges(userId?:string) {
  return useQuery({queryKey:["member-badges",userId],enabled:!!userId,queryFn:async()=>{
    const {data,error}=await supabase.from("member_badges").select("badge").eq("user_id",userId!);
    if(error)throw error;
    return data.map(x=>x.badge as BadgeId);
  }});
}
export function MemberBadges({userId,compact=false}:{userId?:string;compact?:boolean}) {
 const {data=[]}=useMemberBadges(userId);
 const [active,setActive]=useState<BadgeId|null>(null);
 return <span className="inline-flex flex-wrap items-center gap-2" aria-label="Member badges">{BADGE_TYPES.filter(b=>data.includes(b.id)).map(b=><span key={b.id} className="relative inline-flex">
 <button type="button" aria-label={b.label} title={b.label} onClick={()=>setActive(active===b.id?null:b.id)} onBlur={()=>setActive(null)} className="group flex h-7 w-7 items-center justify-center rounded-full border transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" style={{color:b.color,borderColor:b.color+"88",backgroundColor:b.color+"20"}}>
 <b.icon size={compact?14:16} strokeWidth={2.5}/></button>
 <span role="tooltip" className={`pointer-events-none absolute bottom-full left-1/2 z-50 mb-3 w-52 -translate-x-1/2 rounded-lg border border-border bg-popover p-3 text-center text-popover-foreground shadow-2xl ${active===b.id?"block":"hidden group-hover:block"}`}>
 <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full border-2" style={{color:b.color,borderColor:b.color,backgroundColor:b.color+"22"}}><b.icon size={26}/></span>
 <strong className="block text-sm font-extrabold uppercase tracking-wide">{b.label}</strong>
 <span className="mt-1 block text-xs text-muted-foreground">{b.description}</span>
 </span></span>)}</span>;
}
