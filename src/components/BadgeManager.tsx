import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BADGE_TYPES, type BadgeId } from "@/components/MemberBadges";

export function BadgeManager() {
 const [search,setSearch]=useState("");
 const [selected,setSelected]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const qc=useQueryClient();
 const users=useQuery({queryKey:["badge-users",search],enabled:search.trim().length>=2,queryFn:async()=>{
   const {data,error}=await supabase.from("profiles").select("id,username").ilike("username",`%${search.trim().replace(/[%_]/g,"")}%`).limit(15);
   if(error)throw error;return data;
 }});
 const badges=useQuery({queryKey:["member-badges",selected],enabled:!!selected,queryFn:async()=>{
   const {data,error}=await supabase.from("member_badges").select("badge").eq("user_id",selected!);
   if(error)throw error;return data.map(x=>x.badge);
 }});
 const toggle=async(id:BadgeId)=>{
   if(!selected)return;
   setBusy(true);
   const exists=badges.data?.includes(id);
   const result=exists?await supabase.from("member_badges").delete().eq("user_id",selected).eq("badge",id):await supabase.from("member_badges").insert({user_id:selected,badge:id});
   if(result.error)toast.error(result.error.message);else {toast.success(exists?"Badge removed":"Badge assigned");await qc.invalidateQueries({queryKey:["member-badges",selected]});}
   setBusy(false);
 };
 return <section className="mt-8 rounded-xl border border-border bg-card p-5"><h2 className="text-xl font-bold">Member badges</h2><p className="mt-1 text-sm text-muted-foreground">Find a member and assign or remove their profile badges. Badges do not grant account permissions.</p>
 <input className="mt-4 w-full rounded-md border border-border bg-background p-3" placeholder="Search username…" value={search} onChange={e=>{setSearch(e.target.value);setSelected(null)}} />
 <div className="mt-3 flex flex-wrap gap-2">{users.data?.map(u=><button key={u.id} onClick={()=>setSelected(u.id)} className={`rounded-md border px-3 py-2 text-sm ${selected===u.id?"border-primary text-primary":"border-border"}`}>{u.username||"Unnamed member"}</button>)}</div>
 {selected&&<div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{BADGE_TYPES.map(b=><button disabled={busy||badges.isLoading} key={b.id} onClick={()=>toggle(b.id)} className="flex items-center gap-2 rounded-lg border border-border p-3 text-left text-sm hover:bg-muted"><b.icon size={18} style={{color:b.color}}/><span>{b.label}</span><span className="ml-auto text-xs">{badges.data?.includes(b.id)?"✓ Assigned":"Assign"}</span></button>)}</div>}
 </section>;
}
