import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Users, Inbox, Send, Check, X, Search, UserMinus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
export const Route = createFileRoute("/friends")({ component: Friends, head: () => ({ meta: [{ title: "Friends | Streamly" }] }) });
type Person = { id: string; username: string | null };
type Request = { id: string; sender_id: string; receiver_id: string; status: string; created_at: string };
const db = supabase as any; // friend_requests is introduced by the accompanying SQL migration.
function Friends() {
  const { user, openAuth } = useAuth();
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const requests = useQuery({
    queryKey: ["friends-requests", user?.id], enabled: !!user,
    queryFn: async (): Promise<Request[]> => {
      const { data, error } = await db.from("friend_requests").select("id,sender_id,receiver_id,status,created_at").or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const search = useQuery({
    queryKey: ["friends-search", term.trim()], enabled: !!user && term.trim().length >= 2,
    queryFn: async (): Promise<Person[]> => {
      const { data, error } = await db.rpc("search_streamly_users", { search_text: term.trim() });
      if (error) throw error;
      return data ?? [];
    },
  });
  const ids = [...new Set((requests.data ?? []).flatMap((r) => [r.sender_id, r.receiver_id]))].filter((id) => id !== user?.id);
  const names = useQuery({
    queryKey: ["friend-names", ids.join(",")], enabled: ids.length > 0,
    queryFn: async (): Promise<Person[]> => {
      const { data, error } = await supabase.from("profiles").select("id,username").in("id", ids);
      if (error) throw error;
      return data ?? [];
    },
  });
  const nameOf = (id: string) => names.data?.find((p) => p.id === id)?.username || "Streamly user";
  const act = async (operation: () => Promise<{ error: { message: string } | null }>, success: string) => {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const result = await operation();
      if (result.error) throw new Error(result.error.message);
      setMessage(success);
      await qc.invalidateQueries({ queryKey: ["friends-requests"] });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Something went wrong."); }
    finally { setBusy(false); }
  };
  const send = (person: Person) => {
    if (!user || person.id === user.id) return;
    const existing = (requests.data ?? []).find((r) => [r.sender_id, r.receiver_id].includes(person.id));
    if (existing) { setMessage("You already have a request or friendship with this user."); return; }
    void act(() => db.from("friend_requests").insert({ sender_id: user.id, receiver_id: person.id, status: "pending" }), `Friend request sent to ${person.username || "user"}.`);
  };
  const incoming = (requests.data ?? []).filter((r) => r.receiver_id === user?.id && r.status === "pending");
  const outgoing = (requests.data ?? []).filter((r) => r.sender_id === user?.id && r.status === "pending");
  const accepted = (requests.data ?? []).filter((r) => r.status === "accepted");
  const section = "rounded-2xl border border-border bg-card/80 p-5 sm:p-6";
  return <main className="mx-auto max-w-5xl px-4 pb-24 pt-32 sm:px-6">
    <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Your community</p><h1 className="mt-2 flex items-center gap-3 text-3xl font-black sm:text-4xl"><Users className="text-primary" /> Friends</h1><p className="mt-2 text-sm text-muted-foreground">Find other fans, send requests, and build your Streamly circle.</p></div>
    {!user ? <div className={section}><p>Sign in to add friends and manage requests.</p><button onClick={() => openAuth("signin")} className="mt-4 rounded-xl bg-primary px-5 py-2 font-semibold text-primary-foreground">Sign in</button></div> : <>
      <div className="mb-6 grid grid-cols-3 gap-3">{[[accepted.length,"Friends"],[incoming.length,"Requests"],[outgoing.length,"Sent"]].map(([value,label]) => <div key={label} className="rounded-2xl border border-border bg-card p-4 text-center"><strong className="block text-2xl font-black text-primary">{value}</strong><span className="text-xs text-muted-foreground">{label}</span></div>)}</div>
      {message && <p role="status" className="mb-5 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm">{message}</p>}
      {requests.isError && <p className="mb-5 rounded-xl border border-border p-4 text-sm text-muted-foreground">Could not load friend requests. Please sign in again or try refreshing the page.</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className={section}><h2 className="flex items-center gap-2 text-xl font-bold"><UserPlus className="text-primary" /> Find friends</h2><p className="mt-1 text-xs text-muted-foreground">Search by username. Email addresses are never shown.</p>
          <div className="relative mt-4"><Search size={18} className="absolute left-3 top-3 text-muted-foreground" /><input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search username…" className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 outline-none focus:border-primary" /></div>
          <div className="mt-4 space-y-2">{search.isFetching && <p className="text-sm text-muted-foreground">Searching…</p>}{search.isError && <p className="text-sm text-muted-foreground">Could not search usernames. Please check your connection or sign in again.</p>}{search.data?.map((p) => <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/60 p-3"><div className="min-w-0"><p className="truncate font-semibold">{p.username || "Streamly user"}</p><p className="text-xs text-muted-foreground">Member</p></div><button disabled={busy || (requests.data ?? []).some((r) => r.sender_id === p.id || r.receiver_id === p.id)} onClick={() => send(p)} className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-40">Add friend</button></div>)}{term.trim().length >= 2 && !search.isFetching && !search.data?.length && !search.isError && <p className="text-sm text-muted-foreground">No matching usernames.</p>}</div>
        </section>
        <section className={section}><h2 className="flex items-center gap-2 text-xl font-bold"><Inbox className="text-primary" /> Friend requests</h2><div className="mt-4 space-y-3">{incoming.map((r) => <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-border p-3"><p className="truncate text-sm font-semibold">{nameOf(r.sender_id)}</p><div className="flex gap-2"><button disabled={busy} aria-label="Accept request" onClick={() => void act(() => db.from("friend_requests").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id",r.id).eq("receiver_id",user.id), "Friend added!")} className="rounded-lg bg-primary p-2 text-primary-foreground"><Check size={17}/></button><button disabled={busy} aria-label="Decline request" onClick={() => void act(() => db.from("friend_requests").update({ status: "declined" }).eq("id",r.id).eq("receiver_id",user.id), "Request declined.")} className="rounded-lg border border-border p-2"><X size={17}/></button></div></div>)}{!incoming.length && <p className="text-sm text-muted-foreground">No incoming requests right now.</p>}</div>
          <h3 className="mt-6 flex items-center gap-2 border-t border-border pt-5 font-semibold"><Send size={17} /> Sent requests</h3><div className="mt-3 space-y-2">{outgoing.map((r) => <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-background/60 p-3"><span className="truncate text-sm">{nameOf(r.receiver_id)}</span><button disabled={busy} onClick={() => void act(() => db.from("friend_requests").delete().eq("id",r.id), "Request cancelled.")} className="text-xs text-primary">Cancel</button></div>)}{!outgoing.length && <p className="text-sm text-muted-foreground">No pending requests sent.</p>}</div>
        </section>
      </div>
      <section className={section+" mt-6"}><h2 className="mb-4 flex items-center gap-2 text-xl font-bold"><Users className="text-primary" /> Your friends</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{accepted.map((r) => {const friendId=r.sender_id===user.id?r.receiver_id:r.sender_id;return <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/60 p-4"><div className="min-w-0"><p className="truncate font-semibold">{nameOf(friendId)}</p><p className="text-xs text-muted-foreground">Friend</p></div><button disabled={busy} title="Remove friend" aria-label={`Remove ${nameOf(friendId)}`} onClick={() => void act(() => db.from("friend_requests").delete().eq("id",r.id), "Friend removed.")} className="rounded-lg border border-border p-2 text-muted-foreground hover:text-destructive"><UserMinus size={17}/></button></div>;})}{!accepted.length && <p className="text-sm text-muted-foreground">No friends yet. Search for someone above to get started.</p>}</div></section>
    </>}
  </main>;
}
