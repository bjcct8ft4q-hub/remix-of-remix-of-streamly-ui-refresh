import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function checkLimit(client: SupabaseClient<Database>, key: string, limit: number) {
  const result = await client.rpc("check_account_rate_limit", { p_key: key, p_limit: limit });
  if (result.error || !result.data) throw new Error("Too many attempts. Please try again in an hour.");
}

export async function hashCode(code: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code.replaceAll("-", "").toLowerCase()));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function issueCodes(client: SupabaseClient<Database>, userId: string) {
  const codes = Array.from({ length: 8 }, () => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").match(/.{1,8}/g)?.join("-") ?? "";
  });
  const rows = await Promise.all(codes.map(async (code) => ({ user_id: userId, code_hash: await hashCode(code) })));
  // Invalidate before replacement: no previous code stays valid after regeneration.
  const revoked = await client.from("account_recovery_codes").update({ used_at: new Date().toISOString() }).eq("user_id", userId).is("used_at", null);
  if (revoked.error) throw new Error("Recovery codes couldn’t be replaced.");
  const inserted = await client.from("account_recovery_codes").insert(rows);
  if (inserted.error) throw new Error("Recovery codes couldn’t be saved. Try again from account settings.");
  return codes;
}