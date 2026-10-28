import { Link } from "@tanstack/react-router";
import { useAnimeAgeRating } from "@/lib/age-ratings";
import { Film, Star } from "lucide-react";
import { animeTitle, type AnimeSummary } from "@/lib/kitsune";

export function AnimeCard({ a }: { a: AnimeSummary }) {
  const title = animeTitle(a);
  const ageRating = useAnimeAgeRating(a.idMal, a.isAdult);
  const cover = a.coverImage.extraLarge || a.coverImage.large;
  return (
    <Link to="/anime/$id" params={{ id: String(a.id) }} className="group block min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <div ref={ageRating.ref as React.Ref<HTMLDivElement>} className="relative aspect-[2/3] overflow-hidden rounded-md bg-background">
        {cover ? <img src={cover} alt={title} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" />
          : <div className="flex h-full items-center justify-center text-muted-foreground"><Film className="h-10 w-10" /></div>}
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-overlay/80 px-1.5 py-0.5 text-xs font-bold">
          <Star className="h-3 w-3 fill-star text-star" /> {a.averageScore ? (a.averageScore / 10).toFixed(1) : "N/A"}
        </span>
        <span className="absolute right-2 top-2 rounded bg-overlay/85 px-1.5 py-0.5 text-[10px] font-bold" title={ageRating.verified ? "MyAnimeList content classification" : "Classification unavailable"}>{ageRating.label}</span>
        {a.episodes ? <span className="absolute bottom-2 left-2 rounded bg-overlay/80 px-1.5 py-0.5 text-xs font-bold">EP {a.episodes}</span> : null}
      </div>
      <p className="mt-3 flex items-start gap-1.5 text-sm font-semibold leading-relaxed">
        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
        <span className="min-w-0 break-words">{title}</span>
      </p>
      <p className="mt-1 pl-3 text-xs text-muted-foreground">{[a.format?.replaceAll("_", " "), a.seasonYear].filter(Boolean).join(" · ") || "TV"}</p>
    </Link>
  );
}
