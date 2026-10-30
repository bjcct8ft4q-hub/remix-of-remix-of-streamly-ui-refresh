import { Bookmark, Code2, Film, PlayCircle, ShieldCheck, Star, Trophy } from "lucide-react";
import type { ReactNode } from "react";

type Badge = { name: string; description: string; icon: ReactNode; style: string };
export function ProfileBadges({ episodes = 0, shows = 0, saved = 0, isAdmin = false, isDeveloper = false }: { episodes?: number; shows?: number; saved?: number; isAdmin?: boolean; isDeveloper?: boolean }) {
  const badges: Badge[] = [
    ...(isAdmin ? [{ name: "Administrator", description: "Manages Streamly", icon: <ShieldCheck size={15}/>, style: "border-rose-400/50 bg-rose-400/15 text-rose-400" }] : []),
    ...(isDeveloper ? [{ name: "Developer", description: "Helps build Streamly", icon: <Code2 size={15}/>, style: "border-sky-400/50 bg-sky-400/15 text-sky-400" }] : []),
    ...(episodes >= 1 ? [{ name: "First Episode", description: "Watched the first episode", icon: <PlayCircle size={15}/>, style: "border-violet-400/50 bg-violet-400/15 text-violet-400" }] : []),
    ...(shows >= 5 ? [{ name: "Anime Explorer", description: "Watched five different anime", icon: <Film size={15}/>, style: "border-teal-400/50 bg-teal-400/15 text-teal-400" }] : []),
    ...(episodes >= 25 ? [{ name: "Episode Marathon", description: "Watched 25 episodes", icon: <Trophy size={15}/>, style: "border-amber-400/50 bg-amber-400/15 text-amber-400" }] : []),
    ...(saved >= 10 ? [{ name: "Collector", description: "Saved ten anime", icon: <Bookmark size={15}/>, style: "border-emerald-400/50 bg-emerald-400/15 text-emerald-400" }] : []),
    ...(episodes >= 100 ? [{ name: "Anime Veteran", description: "Watched 100 episodes", icon: <Star size={15}/>, style: "border-yellow-400/50 bg-yellow-400/15 text-yellow-400" }] : []),
  ];
  return <div className="flex flex-wrap items-center gap-1.5" aria-label="Public profile badges">{badges.map(b => <span key={b.name} tabIndex={0} title={b.name + " — " + b.description} aria-label={b.name + ": " + b.description} className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${b.style}`}>{b.icon}</span>)}</div>;
}
