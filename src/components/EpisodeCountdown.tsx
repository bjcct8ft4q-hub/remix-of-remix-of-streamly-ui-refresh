import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
export function EpisodeCountdown({ airingAt, episode }: { airingAt: number; episode: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const interval = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(interval); }, []);
  const remaining = Math.max(0, airingAt * 1000 - now);
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor(remaining / 3600000) % 24;
  const minutes = Math.floor(remaining / 60000) % 60;
  const seconds = Math.floor(remaining / 1000) % 60;
  return <span className="inline-flex flex-wrap items-center gap-1.5 text-xs font-semibold text-primary"><Clock3 size={13} /> Ep {episode} {remaining ? `in ${days ? days + "d " : ""}${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}` : "scheduled now"}</span>;
}
