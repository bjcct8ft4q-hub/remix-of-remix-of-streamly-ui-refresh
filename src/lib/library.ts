// Per-user watchlist and watch history (RLS keeps each user's rows private).
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Audio } from "@/lib/kitsune";

export const watchlistQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["watchlist", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("watchlist").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const historyQuery = (userId: string | undefined, anilistId?: number) =>
  queryOptions({
    queryKey: ["history", userId, anilistId ?? "all"],
    enabled: !!userId,
    queryFn: async () => {
      let q = supabase.from("watch_history").select("*").order("updated_at", { ascending: false }).limit(200);
      if (anilistId) q = q.eq("anilist_id", anilistId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

export async function setInWatchlist(userId: string, anime: { id: number; title: string; cover: string | null }, add: boolean) {
  if (add) {
    const { error } = await supabase.from("watchlist").upsert(
      { user_id: userId, anilist_id: anime.id, title: anime.title, cover_url: anime.cover },
      { onConflict: "user_id,anilist_id" },
    );
    if (error) throw error;
  } else {
    const { error } = await supabase.from("watchlist").delete().eq("user_id", userId).eq("anilist_id", anime.id);
    if (error) throw error;
  }
}

export async function saveProgress(row: { userId: string; anilistId: number; episode: number; audio: Audio; title: string; cover: string | null; progress: number; duration: number }) {
  await supabase.from("watch_history").upsert(
    {
      user_id: row.userId, anilist_id: row.anilistId, episode: row.episode, audio: row.audio, title: row.title, cover_url: row.cover,
      progress_seconds: Math.floor(row.progress), duration_seconds: Math.floor(row.duration), updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,anilist_id,episode" },
  );
}
