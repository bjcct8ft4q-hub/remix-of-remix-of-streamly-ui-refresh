import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Info, Link2, Check, UserRound, HeartPulse } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { historyQuery, watchlistQuery } from "@/lib/library";
import { AccountAvatar } from "@/components/AccountAvatar";
import { Trophy, Film, Bookmark, CalendarDays, Settings, Users, Sparkles, Activity, ShieldCheck, Crown, Code2, Shield } from "lucide-react";
export const Route = createFileRoute("/public-profile")({ component: PublicProfile, head: () => ({ meta: [{ title: "Public Profile | Streamly" }] }) });
function PublicProfile() {
  const { user, username, isAdmin } = useAuth();
  const [guestSearch, setGuestSearch] = useState("");
  const requestedUsername = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("username")?.trim() ?? "";
  const publicLookup = useQuery({
    queryKey: ["public-profile-lookup", requestedUsername],
    enabled: !!requestedUsername,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, username").ilike("username", requestedUsername).maybeSingle();
      if (error) throw error;
      return data;
    },
    retry: false,
  });
  const viewingOtherUser = !!requestedUsername && publicLookup.data?.id !== user?.id;
  const history = useQuery(historyQuery(user?.id));
  const watchlist = useQuery(watchlistQuery(user?.id));
  const watched = history.data?.length ?? 0;
  const series = new Set((history.data ?? []).map((r) => r.anilist_id)).size;
  const banner = typeof user?.user_metadata?.profile_banner_url === "string" && user.user_metadata.profile_banner_url.startsWith("https://") ? user.user_metadata.profile_banner_url : "";
  const stats = [{ label: "Episodes watched", value: watched, icon: Film }, { label: "Anime explored", value: series, icon: Sparkles }, { label: "In my list", value: watchlist.data?.length ?? 0, icon: Bookmark }];
  const memberSince = user ? new Date(user.created_at) : new Date();
  // Staff badges are sourced from trusted auth metadata, never a public username.
  const roleValues = [user?.app_metadata?.role, ...(Array.isArray(user?.app_metadata?.roles) ? user.app_metadata.roles : [])]
    .filter((value): value is string => typeof value === "string")
    .map(value => value.toLowerCase());
  // The site owner account receives its staff display badges only when its admin role is verified by user_roles.\n  const isOwnerAccount = isAdmin && username?.toLowerCase() === "vraith";\n  const roleBadges = [
    { role: "owner", label: "Owner", Icon: Crown, style: "text-amber-400 border-amber-400/40 bg-amber-400/10" },
    { role: "moderator", label: "Moderator", Icon: Shield, style: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10" },
    { role: "developer", label: "Developer", Icon: Code2, style: "text-violet-400 border-violet-400/40 bg-violet-400/10" },
  ].filter(badge => isOwnerAccount || roleValues.includes(badge.role));
  const badges = <div className="flex items-center gap-1.5" aria-label="Profile badges">
    {roleBadges.map(({role:badgeRole,label,Icon,style})=><span key={badgeRole} title={label} aria-label={label} className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${style}`}><Icon size={14}/></span>)}
    <span title="Verified" aria-label="Verified" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-sky-400/40 bg-sky-400/10 text-sky-400"><ShieldCheck size={14}/></span>
  </div>;
  const profileBio = typeof user?.user_metadata?.bio === "string" ? user.user_metadata.bio : "";
  const displayName = typeof user?.user_metadata?.display_name === "string" ? user.user_metadata.display_name : username;
  const activityDays = Array.from({ length: 364 }, (_, index) => {
    const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - (363 - index));
    return { date: day, count: (history.data ?? []).filter((entry) => {
      const dateValue = (entry as Record<string, unknown>).watched_at ?? (entry as Record<string, unknown>).created_at;
      return typeof dateValue === "string" && new Date(dateValue).toDateString() === day.toDateString();
    }).length };
  });
  const activeDays = activityDays.filter((day) => day.count > 0).length;
  const [tab, setTab] = useState<"watchlist" | "activity">("watchlist");
  const [identityOpen, setIdentityOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyProfile = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + "/public-profile");
      setCopied(true);
    } catch { setCopied(false); }
  };
  const profileActions = <div className="relative flex items-center gap-2">
    <div className="relative">
      <button type="button" onClick={() => setIdentityOpen(v => !v)} aria-label="Profile information" aria-expanded={identityOpen} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/80 hover:border-primary hover:text-primary"><Info size={15}/></button>
      {identityOpen && <div className="absolute left-0 top-9 z-50 w-56 rounded-lg border border-white/15 bg-[#121317] p-1.5 shadow-2xl">
        <div className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-gray-200"><UserRound size={14} className="text-gray-400"/>Also known as #{username}</div>
        <button type="button" onClick={copyProfile} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-gray-200 hover:bg-white/10">{copied ? <Check size={14} className="text-emerald-400"/> : <Link2 size={14} className="text-gray-400"/>}{copied ? "Copied Profile URL" : "Copy Profile URL"}</button>
      </div>}
    </div>
    <button type="button" onClick={() => { setTab("activity"); setIdentityOpen(false); }} aria-label="View activity" title="View activity" className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/80 hover:border-primary hover:text-primary"><HeartPulse size={15}/></button>
  </div>;

  const [range, setRange] = useState<30 | 90 | 365>(30);
  const recent = activityDays.slice(-range);
  return <main className="min-h-screen bg-[#050505] pb-24 text-white">
    {(!user || viewingOtherUser) ? <div className="mx-auto max-w-4xl px-6 pt-28">
      <h1 className="text-3xl font-extrabold">Public profiles</h1>
      <p className="mt-2 text-sm text-gray-400">Find Streamly members without signing in. Private watchlists and account details stay hidden.</p>
      <form className="mt-6 flex max-w-xl gap-2" onSubmit={(event) => { event.preventDefault(); const name = guestSearch.trim().replace(/^@/, ""); if (name) window.location.assign("/public-profile?username=" + encodeURIComponent(name)); }}>
        <input aria-label="Search username" value={guestSearch} onChange={event => setGuestSearch(event.target.value)} placeholder="Search by username" className="min-w-0 flex-1 rounded-lg border border-white/20 bg-[#111] px-4 py-3 text-white" />
        <button type="submit" className="rounded-lg bg-primary px-5 py-3 font-semibold text-black">Search</button>
      </form>
      {requestedUsername && <div className="mt-10 rounded-xl border border-white/10 bg-[#0c0e12] p-7">
        {publicLookup.isLoading ? <p className="text-gray-400">Looking up profile…</p> : publicLookup.isError ? <p className="text-gray-400">Public profiles could not be loaded. Check public profile read permissions.</p> : !publicLookup.data ? <p className="text-gray-400">No public profile found for @{requestedUsername}.</p> : <>
          <div className="flex items-center gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-2xl font-bold text-primary">{publicLookup.data.username.slice(0,1).toUpperCase()}</div><div><h2 className="text-2xl font-bold">{publicLookup.data.username}</h2><p className="text-sm text-gray-400">@{publicLookup.data.username}</p></div></div>
          <p className="mt-6 text-sm text-gray-400">Private activity and watchlists are not displayed.</p>
          <button type="button" onClick={() => { void navigator.clipboard.writeText(window.location.href); }} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm"><Link2 size={14}/> Copy profile URL</button>
        </>}
      </div>}
    </div> : <>
    {tab === "watchlist" ? <>
      <div className="relative h-[320px] w-full overflow-hidden bg-gradient-to-r from-[#11263a] via-[#121b2a] to-[#050505] sm:h-[420px] lg:h-[480px]">
        {banner && <img src={banner} alt="Profile banner" className="h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/25 to-black/10" />
      </div>
      <div className="relative mx-auto -mt-16 max-w-[920px] px-5 sm:-mt-20">
        <div className="flex flex-wrap items-end gap-4 border-b border-white/10 pb-7 sm:gap-6">
          <div className="relative z-10 shrink-0 rounded-full border-4 border-[#050505] bg-[#111] shadow-xl"><AccountAvatar size="lg" /></div>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2"><h1 className="break-words text-xl font-extrabold sm:text-2xl">{displayName || username}</h1>{badges}{profileActions}</div>
            <p className="text-xs text-gray-400">@{username}</p>
            {profileBio && <p className="mt-2 text-xs text-gray-200">{profileBio}</p>}
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-400"><span className="flex items-center gap-1.5"><CalendarDays size={12}/> Joined {memberSince.toLocaleDateString("en-GB", {month:"long",year:"numeric"})}</span><span className="flex items-center gap-1.5"><Film size={12}/> {watched} episodes watched</span><span className="flex items-center gap-1.5"><Bookmark size={12}/> {watchlist.data?.length ?? 0} saved anime</span></p>
          </div>
          <div className="flex gap-7 pb-2 text-center">{[{label:"COMPLETED",value:series},{label:"EPISODES",value:watched},{label:"PLANNING",value:watchlist.data?.length ?? 0}].map(item=><div key={item.label}><strong className="block text-xl font-black">{item.value}</strong><span className="text-[9px] font-bold tracking-wide text-gray-400">{item.label}</span></div>)}</div>
        </div>
        <div className="flex items-center justify-between border-b border-white/10 py-4"><h2 className="flex items-center gap-2 text-sm font-bold"><Bookmark size={16} className="text-primary"/> Watchlist</h2><div className="flex gap-3"><button onClick={()=>setTab("activity")} className="flex items-center gap-1 text-xs text-gray-300 hover:text-primary"><Activity size={14}/> Activity</button><Link to="/settings" className="flex items-center gap-1 text-xs text-gray-300 hover:text-primary"><Settings size={14}/> Edit</Link></div></div>
        {(watchlist.data?.length ?? 0) === 0 ? <div className="py-28 text-center"><Bookmark size={35} className="mx-auto mb-4 text-primary"/><h3 className="font-bold">No anime in the watchlist yet</h3><p className="mt-2 text-xs text-gray-400">Saved anime will appear here.</p></div> : <div className="grid gap-3 py-6 sm:grid-cols-2"><p className="text-sm text-gray-400">{watchlist.data?.length} anime saved to this account.</p><Link to="/my-list" className="text-sm text-primary hover:underline">Open full watchlist</Link></div>}
      </div>
    </> : <div className="mx-auto max-w-[920px] px-5 pt-12">
      <button onClick={()=>setTab("watchlist")} className="mb-5 text-xs text-gray-400 hover:text-white">← Profile</button>
      <div className="mb-8 flex flex-wrap items-center gap-4"><AccountAvatar size="lg"/><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h1 className="text-2xl font-extrabold">{displayName || username}</h1>{badges}{profileActions}</div><p className="text-xs text-gray-400">@{username} · Activity</p></div><div className="text-xs text-gray-400">Member since {memberSince.toLocaleDateString("en-GB",{month:"long",year:"numeric"})}</div></div>
      <section className="rounded-lg border border-white/10 bg-[#0d0e11] p-4"><h2 className="text-sm font-bold">Past year</h2><p className="mt-1 text-xs text-gray-400">{activeDays} active days</p><div className="mt-5 grid grid-flow-col grid-rows-7 gap-[3px] overflow-x-auto">{activityDays.map((day,i)=><div key={i} title={day.date.toDateString()+": "+day.count+" episodes"} className="h-[10px] w-[10px] rounded-[2px]" style={{background:day.count===0?"#1c1e23":day.count===1?"#123e66":day.count<4?"#0879c5":"#1e9bff"}}/>)}</div><p className="mt-3 text-right text-[10px] text-gray-400">Less ▪ ▪ ▪ More</p></section>
      <div className="mt-8 flex gap-6 border-b border-white/10">{([30,90,365] as const).map(n=><button key={n} onClick={()=>setRange(n)} className={`border-b-2 pb-3 text-xs ${range===n?"border-primary text-white":"border-transparent text-gray-400"}`}>{n===365?"1 year":n+" days"}</button>)}</div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[{name:"Episodes",value:recent.reduce((sum,d)=>sum+d.count,0)},{name:"Anime",value:series},{name:"Watchlist",value:watchlist.data?.length??0},{name:"Active days",value:recent.filter(d=>d.count>0).length}].map(stat=><div key={stat.name} className="rounded-lg border border-white/10 bg-[#0d0e11] p-4"><p className="text-xs text-gray-400">{stat.name}</p><p className="mt-3 text-2xl font-black">{stat.value}</p></div>)}</div>
      <div className="mt-3 grid gap-3 md:grid-cols-2"><section className="min-h-40 rounded-lg border border-white/10 bg-[#0d0e11] p-5"><h2 className="text-sm font-bold">Watch time</h2><p className="mt-9 text-center text-xs text-gray-400">Detailed viewing durations are not available yet.</p></section><section className="min-h-40 rounded-lg border border-white/10 bg-[#0d0e11] p-5"><h2 className="text-sm font-bold">Recent activity</h2><p className="mt-9 text-center text-xs text-gray-400">{activeDays?activeDays+" days with episode activity":"No recorded activity yet"}</p></section></div>
    </div>}
    </>}
  </main>;
}
