import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, ArrowLeft, Search, Users, MessageSquare } from "lucide-react";
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
  const [search, setSearch] = useState("");
  const friends = useQuery({
    queryKey: ["messenger-friends", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: links, error } = await db.from("friend_requests").select("sender_id,receiver_id").eq("status","accepted").or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`);
      if (error) throw error;
      const ids = [...new Set((links ?? []).map((r: any) => r.sender_id === user!.id ? r.receiver_id : r.sender_id))];
      if (!ids.length) return [];
      const { data, error: e } = await db.from("profiles").select("id,username,public_display_name,public_avatar_url").in("id",ids);
      if (e) throw e;
      return data as {id:string;username:string;public_display_name:string|null;public_avatar_url:string|null}[];
    },
  });
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
  return <main className="mx-auto w-full max-w-[1680px] px-3 pb-8 pt-24 sm:px-6">
    <h1 className="mb-5 flex items-center gap-3 text-3xl font-extrabold"><MessageSquare className="text-primary"/> Messages</h1>
    <div className="grid min-h-[70vh] overflow-hidden rounded-2xl border border-border bg-[#080f19] text-white shadow-xl lg:grid-cols-[290px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_260px]">
      <aside className="hidden flex-col border-r border-white/10 lg:flex">
        <div className="border-b border-white/10 p-4"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">Conversations</h2><Link to="/friends" className="rounded-lg bg-primary p-2 text-primary-foreground" title="Find friends"><Users size={18}/></Link></div><label className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search conversations…" className="w-full bg-transparent text-sm outline-none"/></label></div>
        <div className="flex-1 p-2">{friends.isLoading ? <p className="p-4 text-sm text-slate-400">Loading friends…</p> : friends.data?.filter(f=>(f.public_display_name||f.username).toLowerCase().includes(search.toLowerCase())).map(f=><Link key={f.id} to="/messages" search={{username:f.username}} className={`mb-1 flex items-center gap-3 rounded-xl p-3 hover:bg-white/10 ${username===f.username?"bg-primary/15":""}`}><div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-primary/20">{f.public_avatar_url?<img src={f.public_avatar_url} alt="" className="h-full w-full object-cover"/>:<Users className="m-3"/>}</div><div className="min-w-0"><p className="truncate font-bold">{f.public_display_name||f.username}</p><p className="truncate text-xs text-slate-400">@{f.username}</p></div></Link>)}{!friends.isLoading&&!friends.data?.length&&<Link to="/friends" className="block p-4 text-sm text-primary">Find friends to start chatting</Link>}</div>
      </aside>
      <section className="min-w-0">
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
      </section>
      <aside className="hidden border-l border-white/10 xl:block">{peer.data && <><div className="h-24 bg-gradient-to-br from-primary/70 to-[#080f19]"/><div className="px-5"><div className="-mt-7 h-14 w-14 overflow-hidden rounded-full border-2 border-primary bg-[#1b2b3d]">{peer.data.public_avatar_url && <img src={peer.data.public_avatar_url} alt="" className="h-full w-full object-cover"/>}</div><h3 className="mt-3 text-lg font-bold">{peer.data.public_display_name||peer.data.username}</h3><p className="text-sm text-slate-400">@{peer.data.username}</p><Link to="/public-profile" search={{username:peer.data.username}} className="mt-5 block rounded-lg border border-white/15 bg-white/5 p-3 text-center text-sm hover:bg-white/10">View Profile</Link></div></>}</aside>
    </div>
  </main>;
}
