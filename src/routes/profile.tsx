import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { historyQuery, watchlistQuery } from "@/lib/library";
import { AccountAvatar } from "@/components/AccountAvatar";
import { Button } from "@/components/ui/button";
import { Trophy, Film, Bookmark, PlayCircle, Star, ShieldCheck, Code2 } from "lucide-react";
export const Route = createFileRoute("/profile")({ component: Profile });
function Profile() {
  const { user, username, openAuth, isAdmin } = useAuth();
  const history = useQuery(historyQuery(user?.id));
  const watchlist = useQuery(watchlistQuery(user?.id));
  const episodes = history.data?.length ?? 0;
  const shows = new Set((history.data ?? []).map((row) => row.anilist_id)).size;
  const saved = watchlist.data?.length ?? 0;
  const banner = typeof user?.user_metadata?.profile_banner_url === "string" && /^https:\/\//.test(user.user_metadata.profile_banner_url) ? user.user_metadata.profile_banner_url : "";
  const badges = [
    { title: "First Episode", detail: "Watch your first episode", unlocked: episodes >= 1, icon: PlayCircle },
    { title: "Anime Explorer", detail: "Watch 5 different anime", unlocked: shows >= 5, icon: Film },
    { title: "Episode Marathon", detail: "Watch 25 episodes", unlocked: episodes >= 25, icon: Trophy },
    { title: "Collector", detail: "Add 10 anime to your watchlist", unlocked: saved >= 10, icon: Bookmark },
    { title: "Anime Veteran", detail: "Watch 100 episodes", unlocked: episodes >= 100, icon: Star },
  ];
  return <main className="mx-auto max-w-5xl px-4 pb-24 pt-32 sm:px-6">{!user ? <><h1 className="text-3xl font-bold">Profile</h1><Button className="mt-5" onClick={() => openAuth("signin")}>Sign in</Button></> : <>
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-2xl shadow-black/20">{banner ? <img src={banner} alt="Your profile banner" className="h-48 w-full object-cover sm:h-64" /> : <div className="h-48 bg-gradient-to-br from-primary/50 via-primary/15 to-background sm:h-64" />}<div className="p-6 sm:p-8"><div className="flex items-center gap-5"><AccountAvatar size="lg" /><div className="min-w-0"><h1 className="truncate text-2xl font-extrabold">{username}</h1><div className="mt-1 flex flex-wrap items-center gap-2"><span className="text-sm text-muted-foreground">Streamly member</span>{isAdmin && <><span className="group relative inline-flex" tabIndex={0} aria-label="Administrator badge"><ShieldCheck size={19} className="text-rose-500 drop-shadow-[0_0_5px_rgba(244,63,94,.35)]" /><span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-44 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-center text-xs text-popover-foreground shadow-xl group-hover:block group-focus:block"><strong className="block">Administrator</strong>Manages Streamly</span></span><span className="group relative inline-flex" tabIndex={0} aria-label="Developer badge"><Code2 size={19} className="text-sky-400 drop-shadow-[0_0_5px_rgba(56,189,248,.35)]" /><span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-44 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-center text-xs text-popover-foreground shadow-xl group-hover:block group-focus:block"><strong className="block">Developer</strong>Helps build Streamly</span></span></>}</div><p className="mt-1 text-xs text-primary">Joined {new Date(user.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p></div></div><div className="mt-6 flex flex-wrap gap-3"><Button asChild><Link to="/settings">Edit avatar & settings</Link></Button><Button asChild variant="outline"><Link to="/public-profile">Public profile</Link></Button><Button asChild variant="outline"><Link to="/friends">Friends</Link></Button><Button asChild variant="outline"><Link to="/my-list">My List</Link></Button><Button asChild variant="outline"><Link to="/watch-goals">Watch Goals</Link></Button></div></div></div>
    <section className="mt-10"><h2 className="mb-2 flex items-center gap-2 text-2xl font-extrabold"><Trophy className="text-primary" /> Your Achievements</h2><p className="text-sm text-muted-foreground">Badges unlock automatically as you watch and build your list.</p>
    <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl border border-border bg-card p-5 text-center shadow-lg shadow-black/10"><div><strong className="block text-2xl text-primary">{episodes}</strong><span className="text-xs text-muted-foreground">Episodes</span></div><div><strong className="block text-2xl text-primary">{shows}</strong><span className="text-xs text-muted-foreground">Series</span></div><div><strong className="block text-2xl text-primary">{saved}</strong><span className="text-xs text-muted-foreground">Saved</span></div></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{badges.map((badge) => <div key={badge.title} className={`flex items-center gap-4 rounded-2xl border p-5 transition hover:-translate-y-0.5 ${badge.unlocked ? "border-primary/50 bg-primary/10" : "border-border bg-card opacity-50"}`}><div className="rounded-full bg-background p-3"><badge.icon className={badge.unlocked ? "text-primary" : "text-muted-foreground"} size={24} /></div><div><p className="font-bold">{badge.title} {badge.unlocked ? "✓" : "🔒"}</p><p className="text-xs text-muted-foreground">{badge.detail}</p></div></div>)}</div>
    </section>
  </>}</main>;
}
