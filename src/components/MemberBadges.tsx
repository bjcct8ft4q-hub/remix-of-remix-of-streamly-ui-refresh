import { useQuery } from "@tanstack/react-query";
import { Crown, Code2, ShieldCheck, Shield, Star, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const BADGE_TYPES = [
  { id:"og", label:"OG Member", icon:Crown, color:"#eab308" },
  { id:"developer", label:"Developer", icon:Code2, color:"#38a8ff" },
  { id:"admin", label:"Admin", icon:ShieldCheck, color:"#ef6868" },
  { id:"moderator", label:"Moderator", icon:Shield, color:"#a78bfa" },
  { id:"supporter", label:"Supporter", icon:Star, color:"#4ade80" },
  { id:"veteran", label:"Veteran", icon:CalendarDays, color:"#c58b52" },
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
 return <span className="inline-flex flex-wrap items-center gap-1.5">{BADGE_TYPES.filter(b=>data.includes(b.id)).map(b=><span key={b.id} title={b.label} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold" style={{color:b.color,borderColor:b.color+"66",backgroundColor:b.color+"14"}}><b.icon size={12}/>{!compact&&b.label}</span>)}</span>;
}
