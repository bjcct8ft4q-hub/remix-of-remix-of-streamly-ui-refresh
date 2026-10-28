import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { historyQuery, watchlistQuery } from "@/lib/library";
import { AccountAvatar } from "@/components/AccountAvatar";
import { Trophy, Film, Bookmark, CalendarDays, Settings, Users, Sparkles } from "lucide-react";
export const Route = createFileRoute("/public-profile")({ component: PublicProfile, head: () => ({ meta: [{ title: "Public Profile | Streamly" }] }) });
function PublicProfile() {
  const { user, username, openAuth } = useAuth();
  const history = useQuery(historyQuery(user?.id));
  const watchlist = useQuery(watchlistQuery(user?.id));
  const watched = history.data?.length ?? 0;
  const series = new Set((history.data ?? []).map((r) => r.anilist_id)).size;
  const banner = typeof user?.user_metadata?.profile_banner_url === "string" && user.user_metadata.profile_banner_url.startsWith("https://") ? user.user_metadata.profile_banner_url : "";
  const stats = [{ label: "Episodes watched", value: watched, icon: Film }, { label: "Anime explored", value: series, icon: Sparkles }, { label: "In my list", value: watchlist.data?.length ?? 0, icon: Bookmark }];
  return <main className="mx-auto max-w-5xl px-4 pb-24 pt-32 sm:px-6">
    <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Streamly community</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Public Profile</h1><p className="mt-2 text-sm text-muted-foreground">A preview of your community profile. Your email and private account details are never displayed here.</p></div>
    {!user ? <div className="rounded-2xl border border-border bg-card p-8 text-center"><Users className="mx-auto mb-3 text-primary" size={36}/><h2 className="text-xl font-bold">Join the community</h2><button onClick={() => openAuth("signin")} className="mt-4 rounded-xl bg-primary px-5 py-2 font-semibold text-primary-foreground">Sign in</button></div> : <>
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-2xl shadow-black/20">
        <div className="relative h-44 overflow-hidden bg-gradient-to-br from-primary/50 via-primary/15 to-background sm:h-60">{banner && <img src={banner} alt="" className="h-full w-full object-cover" />}<div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" /></div>
        <div className="relative px-5 pb-7 sm:px-8"><div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="flex items-end gap-4"><div className="rounded-full border-4 border-card bg-card p-1 shadow-xl"><AccountAvatar size="lg" /></div><div className="min-w-0 pb-2"><h2 className="truncate text-2xl font-black sm:text-3xl">{username || "Streamly member"}</h2><p className="text-sm text-primary">Streamly member</p></div></div><Link to="/settings" className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold hover:border-primary"><Settings size={16}/> Edit profile</Link></div>
          <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays size={15} /> Joined {new Date(user.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</div>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground">Discovering new stories, collecting favorites, and watching anime on Streamly.</p>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3">{stats.map((stat) => <div key={stat.label} className="rounded-2xl border border-border bg-card p-4 text-center sm:p-6"><stat.icon className="mx-auto mb-2 text-primary" size={20}/><strong className="block text-2xl font-black sm:text-3xl">{stat.value}</strong><span className="text-xs text-muted-foreground">{stat.label}</span></div>)}</div>
      <section className="mt-7 rounded-2xl border border-border bg-card p-5 sm:p-7"><h3 className="flex items-center gap-2 text-xl font-bold"><Trophy className="text-primary"/> Community highlights</h3><div className="mt-4 grid gap-3 sm:grid-cols-3">{[{ name: "First Steps", earned: watched >= 1, detail: "Watch an episode" },{ name: "Explorer", earned: series >= 5, detail: "Try five series" },{ name: "Collector", earned: (watchlist.data?.length ?? 0) >= 10, detail: "Save ten anime" }].map((badge) => <div key={badge.name} className={`rounded-xl border p-4 ${badge.earned ? "border-primary/40 bg-primary/10" : "border-border bg-background/50 opacity-60"}`}><p className="font-bold">{badge.earned ? "✦" : "◇"} {badge.name}</p><p className="mt-1 text-xs text-muted-foreground">{badge.detail}</p></div>)}</div></section>
      <p className="mt-5 text-xs text-muted-foreground">This is your own public-profile preview. Viewing other members' profiles requires a separate public-profile endpoint and privacy controls.</p>
    </>}
  </main>;
}
