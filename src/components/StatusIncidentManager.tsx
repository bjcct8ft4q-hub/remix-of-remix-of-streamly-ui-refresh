import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { incidentsQuery } from "@/lib/status-queries";
import { SERVICE_NAMES, incidentSchema } from "@/lib/status-model";
import type { Database } from "@/integrations/supabase/types";

type Incident = Database["public"]["Tables"]["status_incidents"]["Row"];
const inputClass = "w-full rounded-md border border-border bg-muted px-3 py-2 text-sm";
export function StatusIncidentManager() {
  const qc = useQueryClient();
  const incidents = useQuery(incidentsQuery());
  const [editing, setEditing] = useState<Incident | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const legacyIncidents = [
    { title: "Cloudflare Maintenance – Account Registration Issues", service: "Cloudflare", body: "Some users have reported being unable to create Streamly accounts while Cloudflare maintenance is underway. We are investigating the registration flow and reviewing Cloudflare-related signup verification. Existing site-wide security protections remain enabled.", status: "investigating", severity: "maintenance", started_at: "2026-10-30T00:00:00Z", resolved_at: null },
    { title: "Cloudflare partial service disruption", service: "Cloudflare", body: "Some parts of Cloudflare have experienced partial system outages affecting certain services and regions. This does not mean Cloudflare is completely down, and many of its services may still be available to use.", status: "resolved", severity: "degraded", started_at: "2026-10-29T00:37:00Z", resolved_at: "2026-10-29T08:28:00Z" },
  ] as const;
  const missingLegacy = legacyIncidents.filter(item => !incidents.data?.some(existing => existing.title === item.title));
  async function importLegacy() {
    setBusy(true);
    try {
      const { error } = await supabase.from("status_incidents").insert(missingLegacy.map(item => ({ ...item })));
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["status-incidents"] });
      toast.success("Existing advisories imported. You can edit them below.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Import failed"); }
    finally { setBusy(false); }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const parsed = incidentSchema.safeParse({ id: editing?.id, title: fields.get("title"), service: fields.get("service"), body: fields.get("body"), status: fields.get("status"), severity: fields.get("severity"), started_at: editing?.started_at ?? new Date().toISOString() });
    if (!parsed.success) return void toast.error(parsed.error.issues[0]?.message ?? "Check the incident details");
    setBusy(true);
    try {
      const { id, ...values } = parsed.data;
      const payload = { ...values, resolved_at: values.status === "resolved" ? (editing?.resolved_at ?? new Date().toISOString()) : null };
      const result = id ? await supabase.from("status_incidents").update(payload).eq("id", id).select().single() : await supabase.from("status_incidents").insert(payload).select().single();
      if (result.error) throw result.error;
      toast.success(id ? "Incident updated" : "Incident published");
      setEditing(null); setCreating(false);
      await qc.invalidateQueries({ queryKey: ["status-incidents"] });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Incident could not be saved"); }
    finally { setBusy(false); }
  }
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-bold">Status & incident responses</h2><Button onClick={() => { setEditing(null); setCreating(true); }}><Plus /> New incident</Button></div>
    {missingLegacy.length > 0 && <div className="rounded-lg border border-border bg-card p-4"><h3 className="font-semibold">Existing Cloudflare advisories</h3><p className="mt-1 text-sm text-muted-foreground">These older incidents were hard-coded into the public status page, so they do not appear in the editable database list yet. Import them to manage their status, description and resolution from here.</p><div className="mt-3 space-y-2">{missingLegacy.map(item => <p key={item.title} className="text-sm">{item.title} · <span className="capitalize">{item.status}</span></p>)}</div><Button className="mt-4" type="button" disabled={busy || incidents.isPending || incidents.isError} onClick={() => void importLegacy()}>{busy ? "Importing…" : "Import existing incidents"}</Button></div>}
    {(creating || editing) && <form key={editing?.id ?? "new"} onSubmit={submit} className="space-y-4 border-y border-border py-5">
      <label className="block space-y-2 text-sm">Title<input name="title" required maxLength={160} defaultValue={editing?.title} className={inputClass} /></label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-2 text-sm">Service<select name="service" defaultValue={editing?.service ?? SERVICE_NAMES[0]} className={inputClass}>{SERVICE_NAMES.map(name => <option key={name}>{name}</option>)}</select></label>
        <label className="space-y-2 text-sm">Status<select name="status" defaultValue={editing?.status ?? "investigating"} className={inputClass}>{["investigating", "identified", "monitoring", "resolved"].map(value => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}</select></label>
        <label className="space-y-2 text-sm">Impact<select name="severity" defaultValue={editing?.severity ?? "degraded"} className={inputClass}>{["degraded", "outage", "maintenance"].map(value => <option key={value}>{value}</option>)}</select></label>
      </div>
      <label className="block space-y-2 text-sm">Response<textarea name="body" required maxLength={5000} rows={5} defaultValue={editing?.body} className={inputClass} /></label>
      <div className="flex gap-2"><Button disabled={busy} type="submit"><Save />{busy ? "Saving…" : "Publish response"}</Button><Button variant="ghost" type="button" onClick={() => { setCreating(false); setEditing(null); }}><X />Cancel</Button></div>
    </form>}
    {incidents.isError && <p role="alert" className="text-destructive">Incident reports could not be loaded.</p>}
    {incidents.data?.map(incident => <article key={incident.id} className="flex items-start justify-between gap-4 border-b border-border py-4"><div className="min-w-0"><h3 className="break-words font-semibold">{incident.title}</h3><p className="mt-1 text-xs text-muted-foreground">{incident.service} · <span className="capitalize">{incident.status}</span> · {new Date(incident.started_at).toLocaleString()}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">{incident.body}</p></div><Button variant="ghost" size="icon" aria-label={`Edit ${incident.title}`} title="Edit incident" onClick={() => { setEditing(incident); setCreating(false); }}><Pencil /></Button></article>)}
    {incidents.data?.length === 0 && <p className="text-muted-foreground">No published incidents.</p>}
  </section>;
}