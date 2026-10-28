import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/watch-goals")({ component: WatchGoals, head: () => ({ meta: [{ title: "Watch Goals | Streamly" }] }) });
const db = supabase as any;

function WatchGoals() {
  const { user, openAuth } = useAuth();
  const qc = useQueryClient();
  const [target, setTarget] = useState(20);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const goal = useQuery({ queryKey: ["watch-goal", user?.id], enabled: !!user, queryFn: async () => {
    const { data, error } = await db.from("watch_goals").select("monthly_episodes").eq("user_id", user!.id).maybeSingle();
    if (error) throw error;
    return (data?.monthly_episodes as number | undefined) ?? 20;
  } });
  const progress = useQuery({ queryKey: ["watch-goal-progress", user?.id], enabled: !!user, queryFn: async () => {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const { data, error } = await supabase.from("watch_history").select("anilist_id,episode,audio").eq("user_id", user!.id).gte("updated_at", start);
    if (error) throw error;
    return new Set((data ?? []).map(x => `${x.anilist_id}:${x.episode}:${x.audio}`)).size;
  } });
  const amount = goal.data ?? 20;
  const watched = progress.data ?? 0;
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || busy) return;
    if (!Number.isInteger(target) || target < 1 || target > 1000) return setMessage("Choose a goal between 1 and 1000 episodes.");
    setBusy(true); setMessage("");
    const { error } = await db.from("watch_goals").upsert({ user_id: user.id, monthly_episodes: target, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    setBusy(false);
    if (error) setMessage(error.message);
    else { setMessage("Monthly goal saved."); void qc.invalidateQueries({ queryKey: ["watch-goal", user.id] }); }
  };
  return <main className="mx-auto max-w-3xl px-5 pb-24 pt-32">
    <Link to="/profile" className="text-sm text-primary">← Back to profile</Link>
    <h1 className="mt-5 text-3xl font-black">Monthly watch goals</h1>
    <p className="mt-2 text-muted-foreground">Set a target for episodes you watch this month. Progress is based on episodes in your saved watch history that were updated this month.</p>
    {!user ? <button className="mt-6 rounded-lg bg-primary px-5 py-3 text-primary-foreground" onClick={() => openAuth("signin")}>Sign in to set a goal</button> :
    <section className="mt-7 rounded-2xl border border-border bg-card p-6">
      {goal.isError || progress.isError ? <p role="alert">Could not load your goal. Please try again.</p> : <>
        <p className="text-xl font-bold">{watched} of {amount} episodes</p>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={amount} aria-valuenow={Math.min(watched,amount)} className="mt-4 h-3 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{width:`${Math.min(100,watched / amount * 100)}%`}} /></div>
        <p className="mt-2 text-sm text-muted-foreground">{watched >= amount ? "Goal reached! Well done." : `${amount - watched} more to reach your goal.`}</p>
      </>}
      <form onSubmit={save} className="mt-7 flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">New monthly target<input type="number" min={1} max={1000} value={target} onChange={e=>setTarget(Number(e.target.value))} className="mt-2 block w-32 rounded-lg border border-border bg-background p-3" /></label>
        <button disabled={busy} className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">Save goal</button>
      </form>
      {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    </section>}
  </main>;
}
