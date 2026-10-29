import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_REFRESH_MS, type ServiceCheck } from "./status-model";

export const serviceStatusQuery = () => queryOptions({
  queryKey: ["service-status"],
  staleTime: STATUS_REFRESH_MS,
  refetchInterval: STATUS_REFRESH_MS,
  refetchOnWindowFocus: false,
  retry: false,
  queryFn: async () => {
    const websiteStart = performance.now();
    const website: Promise<ServiceCheck> = fetch("/", { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(10000) })
      .then(response => ({ name: "Streamly website", state: response.ok ? "operational" as const : "outage" as const, detail: `Website response: HTTP ${response.status}`, duration: Math.round(performance.now() - websiteStart), checkedAt: new Date().toISOString() }))
      .catch(() => ({ name: "Streamly website", state: "unknown" as const, detail: "Website check could not be completed", duration: null, checkedAt: new Date().toISOString() }));
    const external = fetch("/api/public/service-status", { signal: AbortSignal.timeout(15000) }).then(async response => {
      if (!response.ok) throw new Error(`Service checks unavailable (HTTP ${response.status})`);
      return (await response.json() as { services: ServiceCheck[] }).services;
    });
    const [site, services] = await Promise.all([website, external]);
    return [site, ...services];
  },
});
export const incidentsQuery = () => queryOptions({
  queryKey: ["status-incidents"], staleTime: 30000, refetchInterval: STATUS_REFRESH_MS,
  queryFn: async () => {
    const { data, error } = await supabase.from("status_incidents").select("*").order("started_at", { ascending: false }).limit(500);
    if (error) throw error;
    return data;
  },
});