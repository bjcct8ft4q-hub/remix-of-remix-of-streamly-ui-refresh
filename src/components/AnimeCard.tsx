import { Link } from "@tanstack/react-router";
import { Film, Star } from "lucide-react";
import { animeTitle, type AnimeSummary } from "@/lib/kitsune";

export function AnimeCard({ a }: { a: AnimeSummary }) {
  const title = animeTitle(a);
  const cover = a.coverImage.extraLarge || a.coverImage.large;
  return (
    <Link to="/anime/$id" params={{ id: String(a.id) }} className="group block min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-background sm:aspect-[2/3]">
        {cover ? <img src={cover} alt={title} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" />
          : <div className="flex h-full items-center justify-center text-muted-foreground"><Film className="h-10 w-10" /></div>}
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-overlay/80 px-1.5 py-0.5 text-xs font-bold">
          <Star className="h-3 w-3 fill-star text-star" /> {a.averageScore ? (a.averageScore / 10).toFixed(1) : "N/A"}
        </span>
        {a.episodes ? <span className="absolute bottom-2 left-2 rounded bg-overlay/80 px-1.5 py-0.5 text-xs font-bold">EP {a.episodes}</span> : null}
      </div>
      <p className="mt-2 flex items-start gap-1 text-xs font-semibold leading-snug sm:mt-3 sm:gap-1.5 sm:text-sm sm:leading-relaxed">
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary sm:mt-2" />
        <span className="min-w-0 break-words">{title}</span>
      </p>
      <p className="mt-1 pl-2.5 text-[11px] text-muted-foreground sm:pl-3 sm:text-xs">{[a.format?.replaceAll("_", " "), a.seasonYear].filter(Boolean).join(" · ") || "TV"}</p>
    </Link>
  );
}
