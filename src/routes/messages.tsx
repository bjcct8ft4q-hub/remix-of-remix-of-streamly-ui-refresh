import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/messages")({
  validateSearch: (s: Record<string, unknown>): { username?: string } => typeof s.username === "string" ? { username: s.username } : {},
  component: MessagesPage,
  head: () => ({ meta: [{ title: "Messages | Streamly" }] }),
});
const db = supabase as any;
function MessagesPage() {
  const { username } = Route.useSearch();
  const { user, openAuth } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const peer = useQuery({
    queryKey: ["message-peer", username],
    enabled: !!user && !!username,
    queryFn: async () => {
      const { data, error } = await db.from("profiles").select("id,username,public_display_name,public_avatar_url").ilike("username", username!).maybeSingle();
      if (error) throw error;
      return data as { id: string; username: string; public_display_name: string | null; public_avatar_url: string | null } | null;
    },
  });
  const friendship = useQuery({
    queryKey: ["profile-friendship", user?.id, peer.data?.id],
    enabled: !!user && !!peer.data?.id,
    queryFn: async () => {
      const { data, error } = await db.from("friend_requests").select("id,status,sender_id,receiver_id").or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`);
      if (error) throw error;
      return (data ?? []).find((r: any) => (r.sender_id === peer.data!.id || r.receiver_id === peer.data!.id) && r.status === "accepted") ?? null;
    },
  });
  const messages = useQuery({
    queryKey: ["direct-messages", user?.id, peer.data?.id],
    enabled: !!user && !!peer.data?.id && !!friendship.data,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await db.from("direct_messages").select("id,sender_id,receiver_id,body,created_at").or(`and(sender_id.eq.${user!.id},receiver_id.eq.${peer.data!.id}),and(sender_id.eq.${peer.data!.id},receiver_id.eq.${user!.id})`).order("created_at", { ascending: true }).limit(200);
      if (error) throw error;
      return data as { id: string; sender_id: string; receiver_id: string; body: string; created_at: string }[];
    },
  });
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !peer.data || !friendship.data || !body.trim() || sending) return;
    setSending(true);
    const { error } = await db.from("direct_messages").insert({ sender_id: user.id, receiver_id: peer.data.id, body: body.trim() });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setBody("");
    void qc.invalidateQueries({ queryKey: ["direct-messages", user.id, peer.data.id] });
  };
  return <main className="mx-auto max-w-3xl px-4 pb-24 pt-28 sm:px-6">
    <Link to="/friends" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16}/> Friends</Link>
    <h1 className="mb-5 text-3xl font-extrabold">Messages{peer.data ? ` · ${peer.data.public_display_name || peer.data.username}` : ""}</h1>
    {!user ? <div className="rounded-xl border border-border bg-card p-6">Sign in to message your friends. <button className="ml-2 font-bold text-primary" onClick={() => openAuth("signin")}>Sign in</button></div>
      : !username ? <div className="rounded-xl border border-border bg-card p-6">Open a friend's public profile and select Message to start chatting.</div>
      : peer.isLoading || friendship.isLoading ? <p className="text-muted-foreground">Loading conversation…</p>
      : !peer.data ? <p>Member not found.</p>
      : !friendship.data ? <p className="rounded-xl border border-border bg-card p-6">You must be friends before you can exchange messages.</p>
      : <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex h-[min(60vh,560px)] flex-col gap-3 overflow-y-auto p-4 sm:p-6" aria-label="Conversation">
          {messages.isLoading ? <p className="text-sm text-muted-foreground">Loading messages…</p> : messages.isError ? <p className="text-sm text-destructive">Unable to load messages.</p> : messages.data?.length === 0 ? <p className="m-auto text-center text-sm text-muted-foreground">No messages yet. Say hello!</p> : messages.data?.map(m => <div key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${m.sender_id === user.id ? "self-end bg-primary text-primary-foreground" : "self-start bg-muted"}`}><p className="whitespace-pre-wrap break-words">{m.body}</p><time className="mt-1 block text-right text-[10px] opacity-70">{new Date(m.created_at).toLocaleString()}</time></div>)}
        </div>
        <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-3">
          <input aria-label="Message" maxLength={2000} value={body} onChange={e=>setBody(e.target.value)} placeholder="Write a message…" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary"/>
          <button disabled={!body.trim() || sending} className="rounded-lg bg-primary p-3 text-primary-foreground disabled:opacity-50" aria-label="Send message"><Send size={20}/></button>
        </form>
      </section>}
  </main>;
}
