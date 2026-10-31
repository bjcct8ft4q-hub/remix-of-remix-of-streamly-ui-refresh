import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { historyQuery, watchlistQuery } from "@/lib/library";
import { AccountAvatar } from "@/components/AccountAvatar";
import { ProfileBadges } from "@/components/ProfileBadges";
import { Button } from "@/components/ui/button";
import { Trophy, Film, Bookmark, PlayCircle, Star, ShieldCheck, Code2 } from "lucide-react";
export const Route = createFileRoute("/profile")({ component: Profile });
function Profile() {
  const { user, username, openAuth, isAdmin } = useAuth();
  const { halloween, christmas } = useTheme();
  const history = useQuery(historyQuery(user?.id));
  const isDeveloper = isAdmin && username?.toLowerCase() === "iamvraith";
  const watchlist = useQuery(watchlistQuery(user?.id));
  const episodes = history.data?.length ?? 0;
  const shows = new Set((history.data ?? []).map((row) => row.anilist_id)).size;
  const saved = watchlist.data?.length ?? 0;
  const banner = typeof user?.user_metadata?.["profile_banner_url"] === "string" && /^https:\/\//.test(user.user_metadata["profile_banner_url"]) ? user.user_metadata["profile_banner_url"] : "";
  const defaultBanner = christmas ? "/banners/default-red.png.png" : halloween ? "/banners/default-orange.png.png" : "/banners/default-blue.png.png";
  const badges = [
    { title: "First Episode", detail: "Watch your first episode", unlocked: episodes >= 1, icon: PlayCircle },
    { title: "Anime Explorer", detail: "Watch 5 different anime", unlocked: shows >= 5, icon: Film },
    { title: "Episode Marathon", detail: "Watch 25 episodes", unlocked: episodes >= 25, icon: Trophy },
    { title: "Collector", detail: "Add 10 anime to your watchlist", unlocked: saved >= 10, icon: Bookmark },
    { title: "Anime Veteran", detail: "Watch 100 episodes", unlocked: episodes >= 100, icon: Star },
  ];
  return <main className="mx-auto max-w-5xl px-4 pb-24 pt-32 sm:px-6">{!user ? <><h1 className="text-3xl font-bold">Profile</h1><Button className="mt-5" onClick={() => openAuth("signin")}>Sign in</Button></> : <>
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-2xl shadow-black/20"><div className="relative h-48 bg-gradient-to-br from-primary/40 to-background sm:h-64"><img src={banner || defaultBanner} alt="Your profile banner" className="h-full w-full object-cover" onError={e => { e.currentTarget.style.display = "none"; }} /><div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" /></div><div className="p-6 sm:p-8"><div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5"><AccountAvatar size="lg" /><div className="min-w-0 w-full"><h1 className="break-words text-2xl font-extrabold">{username}</h1><div className="mt-1 flex flex-wrap items-center gap-2"><span className="text-sm text-muted-foreground">Streamly member</span><ProfileBadges badges={isDeveloper ? ["owner","admin","moderator","developer"] : isAdmin ? ["admin","moderator"] : []} /></div><p className="mt-1 text-xs text-primary">Joined {new Date(user.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p></div></div><div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3"><Button asChild><Link to="/settings">Edit avatar & settings</Link></Button><Button asChild variant="outline"><Link to="/public-profile" search={{ username: username || "" }}>Public profile</Link></Button><Button asChild variant="outline"><Link to="/friends">Friends</Link></Button><Button asChild variant="outline"><Link to="/my-list">My List</Link></Button><Button asChild variant="outline"><Link to="/watch-goals">Watch Goals</Link></Button></div></div></div>
    <section className="mt-10"><h2 className="mb-2 flex items-center gap-2 text-xl font-extrabold sm:text-2xl"><Trophy className="text-primary" /> Your Achievements</h2><p className="text-sm text-muted-foreground">Badges unlock automatically as you watch and build your list.</p>
    <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl border border-border bg-card p-5 text-center shadow-lg shadow-black/10"><div><strong className="block text-2xl text-primary">{episodes}</strong><span className="text-xs text-muted-foreground">Episodes</span></div><div><strong className="block text-2xl text-primary">{shows}</strong><span className="text-xs text-muted-foreground">Series</span></div><div><strong className="block text-2xl text-primary">{saved}</strong><span className="text-xs text-muted-foreground">Saved</span></div></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{badges.map((badge) => <div key={badge.title} className={`flex items-center gap-4 rounded-2xl border p-5 transition hover:-translate-y-0.5 ${badge.unlocked ? "border-primary/50 bg-primary/10" : "border-border bg-card opacity-50"}`}><div className="rounded-full bg-background p-3"><badge.icon className={badge.unlocked ? "text-primary" : "text-muted-foreground"} size={24} /></div><div><p className="font-bold">{badge.title} {badge.unlocked ? "✓" : "🔒"}</p><p className="text-xs text-muted-foreground">{badge.detail}</p></div></div>)}</div>
    </section>
  </>}</main>;
}
