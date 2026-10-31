import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Info, Link2, Check, UserRound, HeartPulse } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { historyQuery, watchlistQuery } from "@/lib/library";
import { AccountAvatar } from "@/components/AccountAvatar";
import { ProfileBadges } from "@/components/ProfileBadges";
import { Trophy, Film, Bookmark, CalendarDays, Settings, Users, Sparkles, Activity, ShieldCheck, Crown, Code2, Shield } from "lucide-react";
export const Route = createFileRoute("/public-profile")({ component: PublicProfile, head: () => ({ meta: [{ title: "Public Profile | Streamly" }] }) });
function PublicProfile() {
  const { user, username, isAdmin } = useAuth();
  const [guestSearch, setGuestSearch] = useState("");
  const requestedUsername = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("username")?.trim() ?? "";
  const activityPage = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("activity") === "1";
  const publicLookup = useQuery({
    queryKey: ["public-profile-lookup", requestedUsername],
    enabled: !!requestedUsername,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, username, public_avatar_url, public_display_name, public_banner_url, created_at").ilike("username", requestedUsername).maybeSingle();
      if (error) throw error;
      return data;
    },
    retry: false,
  });
  const publicAdmin = useQuery({ queryKey: ["public-admin-badge", publicLookup.data?.id], enabled: !!publicLookup.data?.id, queryFn: async () => { const { data, error } = await (supabase as any).rpc("is_public_admin", { profile_user_id: publicLookup.data!.id }); if (error) throw error; return data === true; } });
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
  // Staff display badges require a verified administrator role.
  const isOwnerAccount = isAdmin && username?.toLowerCase() === "iamvraith";
  const roleBadges = [
    { role: "owner", label: "Owner", Icon: Crown, style: "text-amber-400 border-amber-400/40 bg-amber-400/10" },
    { role: "moderator", label: "Moderator", Icon: Shield, style: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10" },
    { role: "developer", label: "Developer", Icon: Code2, style: "text-violet-400 border-violet-400/40 bg-violet-400/10" },
  ].filter(badge => isOwnerAccount || roleValues.includes(badge.role));
  const badges = <ProfileBadges episodes={watched} shows={series} saved={watchlist.data?.length ?? 0} isAdmin={isAdmin} isDeveloper={isOwnerAccount || (isAdmin && roleValues.includes("developer"))} />;
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
  const [publicActivityOpen, setPublicActivityOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyProfile = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + "/" + encodeURIComponent(username || ""));
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
    {(!user || viewingOtherUser) ? <div>
      {!requestedUsername ? <div className="mx-auto max-w-[920px] px-4 pt-24 sm:px-5"><h1 className="text-3xl font-extrabold">Public profiles</h1><p className="mt-2 text-sm text-gray-400">Search Streamly members by username.</p><form className="mt-6 flex max-w-xl gap-2" onSubmit={event=>{event.preventDefault();const name=guestSearch.trim().replace(/^@/,"");if(name)window.location.assign("/"+encodeURIComponent(name));}}><input aria-label="Search username" value={guestSearch} onChange={event=>setGuestSearch(event.target.value)} placeholder="Search by username" className="min-w-0 flex-1 rounded-lg border border-white/20 bg-[#111] px-4 py-3 text-white"/><button type="submit" className="rounded-lg bg-primary px-5 py-3 font-semibold text-black">Search</button></form></div> : publicLookup.isLoading ? <p className="mx-auto max-w-[920px] px-5 pt-24 text-gray-400">Loading public profile…</p> : publicLookup.isError ? <p className="mx-auto max-w-[920px] px-5 pt-24 text-gray-400">Public profile could not be loaded.</p> : !publicLookup.data ? <p className="mx-auto max-w-[920px] px-5 pt-24 text-gray-400">No public profile found for @{requestedUsername}.</p> : <>
        {!activityPage && <div className="relative h-[240px] w-full overflow-hidden bg-gradient-to-r from-[#11263a] via-[#121b2a] to-[#050505] sm:h-[420px] lg:h-[480px]">
          {publicLookup.data.public_banner_url && <img src={publicLookup.data.public_banner_url} alt="Profile banner" className="h-full w-full object-cover"/>}
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/25 to-black/10"/>
        </div>}
        <div className={`relative mx-auto w-full max-w-[920px] px-4 sm:px-5 ${activityPage ? "pt-12" : "-mt-10 sm:-mt-20"}`}>
          {!activityPage && <div className="grid min-w-0 grid-cols-1 gap-5 border-b border-white/10 pb-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end sm:gap-6">
            <div className="relative z-10 w-fit shrink-0 rounded-full border-4 border-[#050505] bg-[#111] shadow-xl">
              <span className="inline-grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-primary bg-primary/15 text-3xl font-extrabold text-primary">
                {publicLookup.data.public_avatar_url ? <img src={publicLookup.data.public_avatar_url} alt={publicLookup.data.username+" avatar"} className="h-full w-full object-cover" referrerPolicy="no-referrer"/> : publicLookup.data.username?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 w-full max-w-full pb-1 pt-3 sm:pt-0">
              <div className="flex min-w-0 flex-col items-start gap-3">
                <h1 className="min-w-0 max-w-full break-words text-2xl font-extrabold sm:text-3xl">{publicLookup.data.public_display_name || publicLookup.data.username}</h1>
                <p className="text-xs text-gray-400">@{publicLookup.data.username}</p>
                <div className="flex w-full flex-wrap items-center gap-2">
                  <ProfileBadges isAdmin={!!publicAdmin.data} isDeveloper={!!publicAdmin.data && publicLookup.data.username.toLowerCase() === "iamvraith"}/>
                  <div className="relative">
                    <button type="button" aria-label="Profile information" aria-expanded={identityOpen} onClick={()=>setIdentityOpen(v=>!v)} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/80 hover:border-primary hover:text-primary"><Info size={15}/></button>
                    {identityOpen && <div className="absolute left-0 top-9 z-50 w-56 rounded-lg border border-white/15 bg-[#121317] p-1.5 shadow-2xl">
                      <div className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-gray-200"><UserRound size={14}/>Also known as #{publicLookup.data.username}</div>
                      <button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(window.location.origin+"/"+encodeURIComponent(publicLookup.data!.username));setCopied(true);}catch{setCopied(false);}}} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-gray-200 hover:bg-white/10">{copied?<Check size={14}/>:<Link2 size={14}/>} {copied?"Copied Profile URL":"Copy Profile URL"}</button>
                    </div>}
                  </div>
                  <button type="button" onClick={()=>{window.location.assign("/public-profile?username="+encodeURIComponent(publicLookup.data!.username)+"&activity=1");}} title="View profile activity" aria-label="View profile activity" className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/80 hover:border-primary hover:text-primary"><HeartPulse size={15}/></button>
                </div>
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-400"><span className="flex items-center gap-1.5"><CalendarDays size={12}/> Joined {publicLookup.data.created_at ? new Date(publicLookup.data.created_at).toLocaleDateString("en-GB",{month:"long",year:"numeric"}) : "date unavailable"}</span><span className="flex items-center gap-1.5"><Film size={12}/> Viewing history private</span><span className="flex items-center gap-1.5"><Bookmark size={12}/> Watchlist private</span></p>
            </div>
            <div className="col-span-full grid min-w-0 w-full grid-cols-3 gap-1 rounded-xl border border-white/10 bg-white/5 px-1 py-4 text-center sm:gap-7 sm:px-2">{["COMPLETED","EPISODES","PLANNING"].map(label=><div key={label}><strong className="block text-xl font-black">—</strong><span className="text-[9px] font-bold tracking-wide text-gray-400">{label}</span></div>)}</div>
          </div>}
          {activityPage ? <section className="py-8">
            <button type="button" onClick={()=>window.location.assign("/public-profile?username="+encodeURIComponent(publicLookup.data!.username))} className="mb-6 text-xs text-gray-400 hover:text-white">← Profile</button>
            <div className="mb-7 flex items-center gap-4"><div className="h-16 w-16 overflow-hidden rounded-full border-2 border-primary bg-primary/15">{publicLookup.data.public_avatar_url ? <img src={publicLookup.data.public_avatar_url} alt="Profile avatar" className="h-full w-full object-cover"/> : <span className="grid h-full place-items-center text-2xl">{publicLookup.data.username.charAt(0).toUpperCase()}</span>}</div><div><h1 className="text-2xl font-extrabold">{publicLookup.data.public_display_name || publicLookup.data.username}</h1><p className="text-xs text-gray-400">@{publicLookup.data.username} · Activity</p><div className="mt-2 flex flex-wrap items-center gap-2"><ProfileBadges isAdmin={!!publicAdmin.data} isDeveloper={!!publicAdmin.data && publicLookup.data.username.toLowerCase() === "iamvraith"}/><div className="relative"><button type="button" aria-label="Profile information" onClick={()=>setIdentityOpen(v=>!v)} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/80"><Info size={15}/></button>{identityOpen && <div className="absolute left-0 top-9 z-50 w-56 rounded-lg border border-white/15 bg-[#121317] p-2 shadow-2xl"><p className="px-2 py-2 text-xs text-gray-200">Also known as #{publicLookup.data.username}</p><button type="button" onClick={async()=>{await navigator.clipboard.writeText(window.location.origin+"/"+encodeURIComponent(publicLookup.data!.username));setCopied(true)}} className="block w-full rounded px-2 py-2 text-left text-xs text-gray-200 hover:bg-white/10">{copied?"Copied Profile URL":"Copy Profile URL"}</button></div>}</div><HeartPulse size={15} className="text-gray-400"/></div></div></div>
            <p className="mb-7 text-xs text-gray-400">Member since {publicLookup.data.created_at ? new Date(publicLookup.data.created_at).toLocaleDateString("en-GB",{month:"long",year:"numeric"}) : "date unavailable"}</p>
            <div className="rounded-lg border border-white/10 bg-[#0d0e11] p-5"><h2 className="text-sm font-bold">Past year</h2><p className="mt-1 text-xs text-gray-400">Activity private</p><div className="mt-5 grid grid-flow-col grid-rows-7 justify-start gap-[3px] overflow-x-auto pb-2">{Array.from({length:364},(_,i)=><span key={i} className="h-[10px] w-[10px] rounded-[2px] bg-[#1c1e23]"/>)}</div><p className="mt-3 text-right text-[10px] text-gray-400">Less · · · More</p></div>
            <div className="mt-7 border-b border-white/10 pb-3 text-xs text-gray-400">30 days　　 90 days　　 1 year</div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{["Episodes","Anime","Watchlist","Active days"].map(label=><div key={label} className="rounded-lg border border-white/10 bg-[#0d0e11] p-4"><p className="text-xs text-gray-400">{label}</p><p className="mt-3 text-sm">Private</p></div>)}</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="min-h-36 rounded-lg border border-white/10 bg-[#0d0e11] p-5"><h2 className="text-sm font-bold">Watch time</h2><p className="mt-8 text-center text-xs text-gray-400">Private</p></div><div className="min-h-36 rounded-lg border border-white/10 bg-[#0d0e11] p-5"><h2 className="text-sm font-bold">Recent activity</h2><p className="mt-8 text-center text-xs text-gray-400">This member's activity is private.</p></div></div>
          </section> : <><div className="flex items-center justify-between border-b border-white/10 py-4"><h2 className="flex items-center gap-2 text-sm font-bold"><Bookmark size={16} className="text-primary"/> Watchlist</h2></div>
          <div className="py-28 text-center"><Bookmark size={35} className="mx-auto mb-4 text-primary"/><h3 className="font-bold">Watchlist is private</h3><p className="mt-2 text-xs text-gray-400">This member has not shared their watchlist publicly.</p></div></>}
        </div>
      </>}
    </div> : <>
    {tab === "watchlist" ? <>
      <div className="relative h-[240px] w-full overflow-hidden bg-gradient-to-r from-[#11263a] via-[#121b2a] to-[#050505] sm:h-[420px] lg:h-[480px]">
        {banner && <img src={banner} alt="Profile banner" className="h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/25 to-black/10" />
      </div>
      <div className="relative mx-auto -mt-10 w-full max-w-[920px] px-4 sm:-mt-20 sm:px-5">
        <div className="grid min-w-0 grid-cols-1 gap-5 border-b border-white/10 pb-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end sm:gap-6">
          <div className="relative z-10 w-fit shrink-0 rounded-full border-4 border-[#050505] bg-[#111] shadow-xl"><AccountAvatar size="lg" /></div>
          <div className="min-w-0 w-full max-w-full pb-1 pt-3 sm:pt-0">
            <div className="flex min-w-0 flex-col items-start gap-3"><h1 className="min-w-0 max-w-full break-words text-2xl font-extrabold sm:text-3xl">{displayName || username}</h1><p className="text-xs text-gray-400">@{username}</p><div className="flex w-full flex-wrap items-center gap-2">{badges}{profileActions}</div></div>
            {profileBio && <p className="mt-2 text-xs text-gray-200">{profileBio}</p>}
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-400"><span className="flex items-center gap-1.5"><CalendarDays size={12}/> Joined {memberSince.toLocaleDateString("en-GB", {month:"long",year:"numeric"})}</span><span className="flex items-center gap-1.5"><Film size={12}/> {watched} episodes watched</span><span className="flex items-center gap-1.5"><Bookmark size={12}/> {watchlist.data?.length ?? 0} saved anime</span></p>
          </div>
          <div className="col-span-full grid min-w-0 w-full grid-cols-3 gap-1 rounded-xl border border-white/10 bg-white/5 px-1 py-4 text-center sm:gap-7 sm:px-2">{[{label:"COMPLETED",value:series},{label:"EPISODES",value:watched},{label:"PLANNING",value:watchlist.data?.length ?? 0}].map(item=><div key={item.label}><strong className="block text-xl font-black">{item.value}</strong><span className="text-[9px] font-bold tracking-wide text-gray-400">{item.label}</span></div>)}</div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 py-4"><h2 className="flex items-center gap-2 text-sm font-bold"><Bookmark size={16} className="text-primary"/> Watchlist</h2><div className="flex gap-3"><button onClick={()=>setTab("activity")} className="flex items-center gap-1 text-xs text-gray-300 hover:text-primary"><Activity size={14}/> Activity</button><Link to="/settings" className="flex items-center gap-1 text-xs text-gray-300 hover:text-primary"><Settings size={14}/> Edit</Link></div></div>
        {(watchlist.data?.length ?? 0) === 0 ? <div className="py-28 text-center"><Bookmark size={35} className="mx-auto mb-4 text-primary"/><h3 className="font-bold">No anime in the watchlist yet</h3><p className="mt-2 text-xs text-gray-400">Saved anime will appear here.</p></div> : <div className="grid gap-3 py-6 sm:grid-cols-2"><p className="text-sm text-gray-400">{watchlist.data?.length} anime saved to this account.</p><Link to="/my-list" className="text-sm text-primary hover:underline">Open full watchlist</Link></div>}
      </div>
    </> : <div className="mx-auto w-full max-w-[920px] px-4 pt-12 sm:px-5">
      <button onClick={()=>setTab("watchlist")} className="mb-5 text-xs text-gray-400 hover:text-white">← Profile</button>
      <div className="mb-8 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center"><div className="w-fit"><AccountAvatar size="lg"/></div><div className="min-w-0 w-full"><div className="flex min-w-0 flex-wrap items-center gap-2"><h1 className="max-w-full break-words text-xl font-extrabold sm:text-2xl">{displayName || username}</h1><div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{badges}{profileActions}</div></div><p className="text-xs text-gray-400">@{username} · Activity</p></div><div className="col-span-full text-xs text-gray-400">Member since {memberSince.toLocaleDateString("en-GB",{month:"long",year:"numeric"})}</div></div>
      <section className="rounded-lg border border-white/10 bg-[#0d0e11] p-4"><h2 className="text-sm font-bold">Past year</h2><p className="mt-1 text-xs text-gray-400">{activeDays} active days</p><div className="mt-5 grid max-w-full grid-flow-col grid-rows-7 justify-start gap-[3px] overflow-x-auto pb-2">{activityDays.map((day,i)=><div key={i} title={day.date.toDateString()+": "+day.count+" episodes"} className="h-[10px] w-[10px] rounded-[2px]" style={{background:day.count===0?"#1c1e23":day.count===1?"#123e66":day.count<4?"#0879c5":"#1e9bff"}}/>)}</div><p className="mt-3 text-right text-[10px] text-gray-400">Less ▪ ▪ ▪ More</p></section>
      <div className="mt-8 flex gap-6 border-b border-white/10">{([30,90,365] as const).map(n=><button key={n} onClick={()=>setRange(n)} className={`border-b-2 pb-3 text-xs ${range===n?"border-primary text-white":"border-transparent text-gray-400"}`}>{n===365?"1 year":n+" days"}</button>)}</div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[{name:"Episodes",value:recent.reduce((sum,d)=>sum+d.count,0)},{name:"Anime",value:series},{name:"Watchlist",value:watchlist.data?.length??0},{name:"Active days",value:recent.filter(d=>d.count>0).length}].map(stat=><div key={stat.name} className="rounded-lg border border-white/10 bg-[#0d0e11] p-4"><p className="text-xs text-gray-400">{stat.name}</p><p className="mt-3 text-2xl font-black">{stat.value}</p></div>)}</div>
      <div className="mt-3 grid gap-3 md:grid-cols-2"><section className="min-h-40 rounded-lg border border-white/10 bg-[#0d0e11] p-5"><h2 className="text-sm font-bold">Watch time</h2><p className="mt-9 text-center text-xs text-gray-400">Detailed viewing durations are not available yet.</p></section><section className="min-h-40 rounded-lg border border-white/10 bg-[#0d0e11] p-5"><h2 className="text-sm font-bold">Recent activity</h2><p className="mt-9 text-center text-xs text-gray-400">{activeDays?activeDays+" days with episode activity":"No recorded activity yet"}</p></section></div>
    </div>}
    </>}
  </main>;
}
