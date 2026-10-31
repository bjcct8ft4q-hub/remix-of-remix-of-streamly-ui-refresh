import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BADGES, type BadgeKey } from "@/components/ProfileBadges";
import { toast } from "sonner";

type Member = { id: string; username: string | null; display_name: string | null; avatar_url: string | null; badges: string[] };
const badgeKeys = Object.keys(BADGES).filter(k => !["owner", "admin"].includes(k)) as BadgeKey[];

export function AdminMembers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const members = useQuery({
    queryKey: ["admin-member-directory"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_member_directory");
      if (error) throw error;
      return data as Member[];
    },
  });
  const current = members.data?.find(m => m.id === selected);
  const change = async (action: string, value: string) => {
    if (!selected || busy) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc("admin_manage_member", { target_user: selected, action, new_value: value });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Member updated"); void qc.invalidateQueries({ queryKey: ["admin-member-directory"] }); }
  };
  const authAction = async (action: "reset_password" | "delete") => {
    if (!selected || busy) return;
    if (action === "delete" && (!confirmDelete || deleteConfirmation !== "DELETE")) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-member-auth", {
      body: { action, targetUserId: selected, confirmation: action === "delete" ? deleteConfirmation : undefined },
    });
    setBusy(false);
    if (error || data?.error) { toast.error(data?.error || error?.message || "Action failed"); return; }
    toast.success(data?.message || "Action completed");
    if (action === "delete") { setSelected(null); setConfirmDelete(false); setDeleteConfirmation(""); void qc.invalidateQueries({ queryKey: ["admin-member-directory"] }); }
  };
  return <section className="space-y-5">
    <div><h2 className="text-2xl font-extrabold">Member management</h2><p className="text-sm text-muted-foreground">Find members, update their public names and manage community badges. Privileged Owner and Admin roles cannot be granted here.</p></div>
    <input className="w-full rounded-lg border border-border bg-background p-3" placeholder="Search usernames or display names..." aria-label="Search members" value={search} onChange={e => setSearch(e.target.value)} />
    {members.isPending && <p>Loading members…</p>}
    {members.isError && <p role="alert" className="text-red-400">Could not load members. Check administrator permissions.</p>}
    <div className="grid gap-5 md:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
      <div className="max-h-[540px] space-y-2 overflow-y-auto">
        {members.data?.filter(m => (m.username + " " + m.display_name).toLowerCase().includes(search.toLowerCase())).map(m =>
          <button key={m.id} onClick={() => { setSelected(m.id); setUsername(m.username || ""); setDisplayName(m.display_name || ""); }} className={"flex w-full items-center gap-3 rounded-xl border p-3 text-left " + (selected === m.id ? "border-primary bg-primary/10" : "border-border bg-card")}>
            {m.avatar_url ? <img src={m.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover" /> : <div className="grid h-11 w-11 place-items-center rounded-full bg-muted">{(m.username || "?")[0]?.toUpperCase()}</div>}
            <span className="min-w-0"><strong className="block truncate">{m.display_name || m.username}</strong><small className="block truncate text-muted-foreground">@{m.username}</small></span>
          </button>)}
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        {!current ? <p className="text-muted-foreground">Select a member to manage their account.</p> : <div className="space-y-6">
          <div className="flex items-center gap-3">{current.avatar_url && <img src={current.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover" />}<div><h3 className="text-xl font-bold">{current.display_name || current.username}</h3><p className="text-sm text-muted-foreground">@{current.username}</p></div></div>
          <div className="space-y-2"><label className="block text-sm font-semibold">Username</label><div className="flex gap-2"><input className="min-w-0 flex-1 rounded-lg border border-border bg-background p-2" value={username} onChange={e => setUsername(e.target.value)} /><button disabled={busy} className="rounded-lg bg-primary px-4 text-primary-foreground" onClick={() => void change("username", username)}>Save</button></div></div>
          <div className="space-y-2"><label className="block text-sm font-semibold">Display name</label><div className="flex gap-2"><input className="min-w-0 flex-1 rounded-lg border border-border bg-background p-2" value={displayName} onChange={e => setDisplayName(e.target.value)} /><button disabled={busy} className="rounded-lg bg-primary px-4 text-primary-foreground" onClick={() => void change("display_name", displayName)}>Save</button></div></div>
          <div><h4 className="mb-1 font-bold">Badges (select multiple)</h4><p className="mb-3 text-xs text-muted-foreground">Existing badges are already checked. Verified is automatic for every registered member.</p><div className="grid gap-2 sm:grid-cols-2">{badgeKeys.map(key => { const badge = BADGES[key]; const active = key === "verified" || current.badges.includes(key); return <label key={key} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3"><input type="checkbox" checked={active} disabled={busy || key === "verified"} onChange={() => void change(active ? "remove_badge" : "grant_badge", key)} /><badge.Icon size={19} style={{color:badge.color}} /><span>{badge.label}</span></label>; })}</div></div>
          <div className="space-y-3 border-t border-border pt-5">
            <h4 className="font-bold">Account security</h4>
            <p className="text-sm text-muted-foreground">Send this member a secure password reset email. Their password is never revealed or replaced with a shared temporary password.</p>
            <button type="button" disabled={busy} onClick={() => void authAction("reset_password")} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50">Send password reset email</button>
          </div>
          <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
            <h4 className="font-bold text-red-400">Danger zone</h4>
            <p className="text-sm text-muted-foreground">Permanently delete this member's authentication account. This cannot be undone. Linked records may require additional cleanup.</p>
            {!confirmDelete ? <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-lg border border-red-500/50 px-4 py-2 text-sm font-bold text-red-400">Delete account…</button> : <div className="space-y-3">
              <label className="block text-sm">Type <strong>DELETE</strong> to confirm deleting @{current.username}.</label>
              <input aria-label="Type DELETE to confirm" className="w-full rounded-lg border border-red-500/50 bg-background p-2" value={deleteConfirmation} onChange={e => setDeleteConfirmation(e.target.value)} />
              <div className="flex gap-2"><button type="button" disabled={busy || deleteConfirmation !== "DELETE"} onClick={() => void authAction("delete")} className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white disabled:opacity-50">Permanently delete</button><button type="button" onClick={() => {setConfirmDelete(false);setDeleteConfirmation("");}} className="rounded-lg border border-border px-4 py-2">Cancel</button></div>
            </div>}
          </div>
        </div>}
      </div>
    </div>
  </section>;
}
