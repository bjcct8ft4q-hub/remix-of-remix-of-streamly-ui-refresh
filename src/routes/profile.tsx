import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { historyQuery, watchlistQuery } from "@/lib/library";
import { AccountAvatar } from "@/components/AccountAvatar";
import { Button } from "@/components/ui/button";
import { Trophy, Film, Bookmark, PlayCircle, Star } from "lucide-react";
export const Route = createFileRoute("/profile")({ component: Profile });
function Profile() {
  const { user, username, openAuth } = useAuth();
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
  return <main className="mx-auto max-w-4xl px-5 pb-20 pt-32">{!user ? <><h1 className="text-3xl font-bold">Profile</h1><Button className="mt-5" onClick={() => openAuth("signin")}>Sign in</Button></> : <>
    <div className="overflow-hidden rounded-xl border border-border bg-card">{banner ? <img src={banner} alt="Your profile banner" className="h-44 w-full object-cover sm:h-56" /> : <div className="h-32 bg-gradient-to-r from-primary/30 via-primary/10 to-background sm:h-40" />}<div className="p-6"><div className="flex items-center gap-5"><AccountAvatar size="lg" /><div className="min-w-0"><h1 className="truncate text-2xl font-extrabold">{username}</h1><p className="truncate text-sm text-muted-foreground">{user.email}</p><p className="mt-1 text-xs text-primary">Joined {new Date(user.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p></div></div><div className="mt-6 flex flex-wrap gap-3"><Button asChild><Link to="/settings">Edit avatar & settings</Link></Button><Button asChild variant="outline"><Link to="/public-profile">Public profile</Link></Button></div></div></div>
    <section className="mt-8"><h2 className="mb-2 flex items-center gap-2 text-2xl font-extrabold"><Trophy className="text-primary" /> Your Achievements</h2><p className="text-sm text-muted-foreground">Badges unlock automatically as you watch and build your list.</p>
    <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl border border-border bg-card p-4 text-center"><div><strong className="block text-2xl text-primary">{episodes}</strong><span className="text-xs text-muted-foreground">Episodes</span></div><div><strong className="block text-2xl text-primary">{shows}</strong><span className="text-xs text-muted-foreground">Series</span></div><div><strong className="block text-2xl text-primary">{saved}</strong><span className="text-xs text-muted-foreground">Saved</span></div></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{badges.map((badge) => <div key={badge.title} className={`flex items-center gap-4 rounded-xl border p-4 ${badge.unlocked ? "border-primary/50 bg-primary/10" : "border-border bg-card opacity-50"}`}><div className="rounded-full bg-background p-3"><badge.icon className={badge.unlocked ? "text-primary" : "text-muted-foreground"} size={24} /></div><div><p className="font-bold">{badge.title} {badge.unlocked ? "✓" : "🔒"}</p><p className="text-xs text-muted-foreground">{badge.detail}</p></div></div>)}</div>
    </section>
  </>}</main>;
}
