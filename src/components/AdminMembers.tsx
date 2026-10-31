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
          <div><h4 className="mb-3 font-bold">Badges (select multiple)</h4><div className="grid gap-2 sm:grid-cols-2">{badgeKeys.map(key => { const badge = BADGES[key]; const active = current.badges.includes(key); return <label key={key} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3"><input type="checkbox" checked={active} disabled={busy} onChange={() => void change(active ? "remove_badge" : "grant_badge", key)} /><badge.Icon size={19} style={{color:badge.color}} /><span>{badge.label}</span></label>; })}</div></div>
          <p className="border-t border-border pt-4 text-xs text-muted-foreground">Password resets and permanent account deletion require secure server-side Auth administration. These actions are not enabled until that integration is configured.</p>
        </div>}
      </div>
    </div>
  </section>;
}
