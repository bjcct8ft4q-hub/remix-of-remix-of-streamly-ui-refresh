import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Activity, BarChart3, Bookmark, CalendarDays, Check, Clock, LayoutGrid, Link2, List, MessageCircle, MoreHorizontal, Search, Settings, Star, UserPlus, Users, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { historyQuery, watchlistQuery } from "@/lib/library";
import { ProfileBadges } from "@/components/ProfileBadges";

export const Route = createFileRoute("/public-profile")({
  validateSearch: (s: Record<string, unknown>): { username?: string } => (typeof s["username"] === "string" && s["username"] ? { username: s["username"] } : {}),
  component: PublicProfile,
  head: () => ({
    meta: [
      { title: "Public Profile | Streamly" },
      { name: "description", content: "View a Streamly member's profile, badges and anime stats." },
      { property: "og:title", content: "Public Profile | Streamly" },
      { property: "og:description", content: "View a Streamly member's profile, badges and anime stats." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const TABS = [
  { name: "Watchlist", icon: Bookmark },
  { name: "History", icon: Clock },
  { name: "Stats", icon: BarChart3 },
  { name: "Reviews", icon: Star },
  { name: "Activity", icon: Activity },
  { name: "Friends", icon: Users },
] as const;
const FILTERS = ["All", "Watching", "Completed", "On Hold", "Dropped", "Planning"];

function PublicProfile() {
  const { username: requested } = Route.useSearch();
  const { user, username: myName, isAdmin } = useAuth();
  const { halloween, christmas } = useTheme();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<string>("Watchlist");
  const [filter, setFilter] = useState("All");
  const [grid, setGrid] = useState(true);
  const [listSearchOpen, setListSearchOpen] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const target = requested?.trim().replace(/^@/, "") || (user ? myName ?? "" : "");
  const profile = useQuery({
    queryKey: ["public-profile", target, user?.id],
    enabled: !!target || !!user,
    queryFn: async () => {
      const q = supabase.from("profiles").select("id, username, public_avatar_url, public_display_name, public_banner_url, created_at");
      const { data, error } = target ? await q.ilike("username", target).maybeSingle() : await q.eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const pid = profile.data?.id;
  const badges = useQuery({
    queryKey: ["profile-badges", pid],
    enabled: !!pid,
    queryFn: async () => {
      // Role badges must come from trusted server-side role checks, never
      // from editable profile metadata or a matching username alone.
      const { data: admin, error } = await supabase.rpc("is_public_admin", { profile_user_id: pid! });
      if (error) throw error;
      const list = ["verified"];
      if (admin === true) {
        list.push("moderator");
        if (profile.data?.username?.toLowerCase() === "iamvraith") {
          list.push("owner", "developer");
        }
      }
      return list;
    },
  });
  const isSelf = !!user && pid === user.id;
  const history = useQuery(historyQuery(isSelf ? user?.id : undefined));
  const watchlist = useQuery(watchlistQuery(isSelf ? user?.id : undefined));

  if (!target && !user) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-4 pt-24 pb-24">
        <h1 className="text-3xl font-extrabold">Public profiles</h1>
        <p className="mt-2 text-sm text-muted-foreground">Search Streamly members by username.</p>
        <form className="mt-6 flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = search.trim().replace(/^@/, ""); if (n) window.location.assign("/public-profile?username=" + encodeURIComponent(n)); }}>
          <input aria-label="Search username" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by username" className="min-w-0 flex-1 rounded-lg border border-border bg-card px-4 py-3" />
          <button type="submit" className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground">Search</button>
        </form>
      </main>
    );
  }
  if (profile.isLoading) return <main className="mx-auto max-w-5xl px-5 pt-24 text-muted-foreground">Loading profile…</main>;
  if (!profile.data) return <main className="mx-auto max-w-5xl px-5 pt-24 text-muted-foreground">No public profile found for @{target}.</main>;

  const p = profile.data;
  const name = p.public_display_name || p.username || "Member";
  const handle = p.username || "member";
  const episodes = history.data?.length ?? 0;
  const completed = new Set((history.data ?? []).map((r) => r.anilist_id)).size;
  const planning = watchlist.data?.length ?? 0;
  const joined = new Date(p.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const items = (watchlist.data ?? []).filter((w) => !listSearch || (w.title ?? "").toLowerCase().includes(listSearch.toLowerCase()));
  const soon = (what: string) => toast(`${what} is coming soon.`);
  const copyUrl = async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/${encodeURIComponent(handle)}`); setCopied(true); } catch { setCopied(false); } };

  return (
    <main className="min-h-screen pb-24 pt-20">
      <div className="mx-auto max-w-[1480px] px-3 sm:px-6 lg:px-10">
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          {/* Banner */}
          <div className="relative h-44 sm:h-60 lg:h-72">
            {p.public_banner_url ? <img src={p.public_banner_url} alt="Profile banner" className="h-full w-full object-cover" /> : <div className={`relative h-full w-full overflow-hidden ${christmas ? "bg-gradient-to-r from-[#a5000d] via-[#48060d] to-[#050407]" : halloween ? "bg-gradient-to-r from-[#fa6900] via-[#4d1c07] to-[#050407]" : "bg-gradient-to-r from-[#00a7ff] via-[#06275a] to-[#030611]"}`}>
              <img key={christmas ? "red" : halloween ? "orange" : "blue"} src={christmas ? "/banners/default-red.webp" : halloween ? "/banners/default-orange.webp" : "/banners/default-blue.webp"} alt="" loading="eager" decoding="async" className="absolute inset-0 h-full w-full object-cover object-center opacity-75" onError={(event) => { if (!event.currentTarget.src.endsWith("/16498")) event.currentTarget.src = "https://img.anili.st/16498"; else event.currentTarget.style.display = "none"; }} />
              <div className={`pointer-events-none absolute inset-0 ${christmas ? "bg-gradient-to-r from-[#a5000d]/40 via-transparent to-black/10" : halloween ? "bg-gradient-to-r from-[#fa6900]/40 via-transparent to-black/10" : "bg-gradient-to-r from-[#00a7ff]/40 via-transparent to-black/10"}`} />
            </div>}
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
          </div>

          <div className="relative -mt-20 px-4 sm:-mt-24 sm:px-8 lg:px-10">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="h-28 w-28 shrink-0 overflow-hidden rounded-full border-4 border-primary bg-muted shadow-xl sm:h-36 sm:w-36">
                {p.public_avatar_url ? <img src={p.public_avatar_url} alt={`${handle} avatar`} className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : <span className="grid h-full place-items-center text-5xl font-extrabold text-primary">{handle.charAt(0).toUpperCase()}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="break-words text-4xl font-extrabold tracking-tight sm:text-5xl">{name}</h1>
                <p className="mt-1 text-lg text-muted-foreground">@{handle}</p>
                <div className="mt-3"><ProfileBadges badges={badges.data ?? []} /></div>
              </div>
              <div className="relative flex shrink-0 flex-wrap items-center gap-2 md:mb-4">
                <button type="button" aria-label="More options" onClick={() => setMenuOpen((v) => !v)} className="grid h-11 w-11 place-items-center rounded-lg border border-border bg-background/60 hover:bg-muted"><MoreHorizontal size={20} /></button>
                {menuOpen && (
                  <div className="absolute right-0 top-12 z-20 w-52 rounded-lg border border-border bg-popover p-1.5 shadow-2xl">
                    <button type="button" onClick={copyUrl} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted">{copied ? <Check size={15} /> : <Link2 size={15} />}{copied ? "Copied profile URL" : "Copy profile URL"}</button>
                  </div>
                )}
                {isSelf ? (
                  <Link to="/settings" className="flex h-11 items-center gap-2 rounded-lg bg-primary px-5 font-bold text-primary-foreground hover:opacity-90"><Settings size={18} /> Edit Profile</Link>
                ) : (
                  <>
                    <button type="button" onClick={() => soon("Messaging")} className="flex h-11 items-center gap-2 rounded-lg border border-border bg-background/60 px-4 font-semibold hover:bg-muted"><MessageCircle size={18} /> Message</button>
                    <button type="button" onClick={() => soon("Friend requests")} className="flex h-11 items-center gap-2 rounded-lg bg-primary px-5 font-bold text-primary-foreground hover:opacity-90"><UserPlus size={18} /> Add Friend</button>
                  </>
                )}
              </div>
            </div>

            {/* Meta */}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground md:pl-[164px]">
              <span className="flex items-center gap-2"><CalendarDays size={16} /> Joined {joined}</span>
              <span className="hidden text-border sm:inline">|</span>
              <span className="flex items-center gap-2"><Eye size={16} /> Viewing history {isSelf ? "visible to you" : "private"}</span>
              <span className="hidden text-border sm:inline">|</span>
              <span className="flex items-center gap-2"><Bookmark size={16} /> Watchlist {isSelf ? "visible to you" : "private"}</span>
            </div>

            {/* Stats */}
            <div className="mt-5 grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-background/40 py-4 text-center">
              {[{ l: "Completed", v: completed }, { l: "Episodes", v: episodes }, { l: "Planning", v: planning }].map((s) => (
                <div key={s.l}><strong className="block text-xl font-bold">{isSelf ? s.v : "—"}</strong><span className="text-sm text-muted-foreground">{s.l}</span></div>
              ))}
            </div>

            {/* Tabs */}
            <nav aria-label="Profile sections" className="mt-6 flex gap-2 overflow-x-auto border-b border-border">
              {TABS.map(({ name: t, icon: Icon }) => (
                <button key={t} type="button" onClick={() => setTab(t)} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 pb-3 text-sm transition-colors ${tab === t ? "border-primary font-bold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}><Icon size={17} />{t}</button>
              ))}
            </nav>

            {/* Section */}
            <div className="py-6">
              <h2 className="flex items-center gap-2 text-xl font-bold"><Bookmark size={20} className="text-primary" /> {tab}</h2>
              {tab === "Watchlist" && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {FILTERS.map((f) => <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-lg px-4 py-2 text-sm ${filter === f ? "bg-primary font-semibold text-primary-foreground" : "bg-muted/60 text-foreground hover:bg-muted"}`}>{f}</button>)}
                  </div>
                  <div className="flex items-center gap-2">
                    {listSearchOpen && <input aria-label="Filter watchlist" value={listSearch} onChange={(e) => setListSearch(e.target.value)} placeholder="Search…" className="w-36 rounded-lg border border-border bg-background px-3 py-2 text-sm" />}
                    <button type="button" aria-label="Search watchlist" onClick={() => setListSearchOpen((v) => !v)} className="grid h-10 w-10 place-items-center rounded-lg border border-border hover:bg-muted"><Search size={18} /></button>
                    <div className="flex rounded-lg border border-border">
                      <button type="button" aria-label="Grid view" onClick={() => setGrid(true)} className={`grid h-10 w-10 place-items-center rounded-l-lg ${grid ? "bg-muted" : ""}`}><LayoutGrid size={18} /></button>
                      <button type="button" aria-label="List view" onClick={() => setGrid(false)} className={`grid h-10 w-10 place-items-center rounded-r-lg ${!grid ? "bg-muted" : ""}`}><List size={18} /></button>
                    </div>
                  </div>
                </div>
              )}

              {tab === "Watchlist" && isSelf && items.length > 0 && filter !== "Dropped" && filter !== "On Hold" ? (
                <div className={grid ? "mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6" : "mt-5 space-y-2"}>
                  {items.map((w) => (
                    <Link key={w.anilist_id} to="/anime/$id" params={{ id: String(w.anilist_id) }} className={grid ? "group" : "flex items-center gap-3 rounded-lg border border-border p-2 hover:bg-muted"}>
                      {w.cover_url && <img src={w.cover_url} alt={w.title ?? "Anime cover"} className={grid ? "aspect-[2/3] w-full rounded-lg object-cover transition group-hover:opacity-80" : "h-16 w-11 rounded object-cover"} />}
                      <p className="mt-1 line-clamp-2 text-sm font-medium">{w.title}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-border bg-background/40 py-14 text-center">
                  <Bookmark size={44} className="mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-bold">{!isSelf ? `${tab} is private` : tab === "Watchlist" ? "No anime in watchlist yet" : `No ${tab.toLowerCase()} yet`}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{!isSelf ? "This member has not shared this publicly." : "Start adding anime to see them here!"}</p>
                  {isSelf && <Link to="/browse" className="mt-5 inline-flex rounded-lg bg-primary px-7 py-3 text-sm font-bold text-primary-foreground hover:opacity-90">Browse Anime</Link>}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
