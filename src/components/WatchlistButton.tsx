import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { setInWatchlist, watchlistQuery } from "@/lib/library";

export function WatchlistButton({ anime }: { anime: { id: number; title: string; cover: string | null } }) {
  const { user, openAuth } = useAuth();
  const qc = useQueryClient();
  const { data = [] } = useQuery(watchlistQuery(user?.id));
  const saved = data.some((r) => r.anilist_id === anime.id);
  const m = useMutation({
    mutationFn: () => setInWatchlist(user!.id, anime, !saved),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["watchlist"] }); toast.success(saved ? "Removed from My list" : "Added to My list"); },
    onError: () => toast.error("Your list couldn’t be updated. Try again."),
  });
  if (!user) return <Button variant="outline" onClick={() => openAuth("signin")}><Bookmark /> Sign in to save</Button>;
  return (
    <Button variant={saved ? "secondary" : "outline"} disabled={m.isPending} onClick={() => m.mutate()} aria-pressed={saved}>
      {saved ? <BookmarkCheck /> : <Bookmark />} {saved ? "In My list" : "Add to My list"}
    </Button>
  );
}
