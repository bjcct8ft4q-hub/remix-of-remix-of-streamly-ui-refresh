import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/account/delete")({
  server: { handlers: {
    POST: async ({ request }) => {
      const json = (status: number, message: string) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
      const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
      if (!token) return json(401, "Please sign in.");
      let body: { password?: string; recoveryCode?: string; confirmation?: string };
      try { body = await request.json(); } catch { return json(400, "Invalid request."); }
      if (!body.password || !body.recoveryCode || body.confirmation !== "DELETE") return json(400, "Password, recovery code and DELETE confirmation are required.");
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { checkLimit, hashCode } = await import("@/lib/accounts.server");
        const { data: verified, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !verified.user?.email) return json(401, "Session expired. Sign in again.");
        const user = verified.user;
        await checkLimit(supabaseAdmin, `delete-account:${user.id}`, 5);
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key) return json(503, "Account service is unavailable.");
        const client = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { fetch: (input, init) => {
            const headers = new Headers(init?.headers);
            if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
            headers.set("apikey", key);
            return fetch(input, { ...init, headers });
          } },
        });
        const signedIn = await client.auth.signInWithPassword({ email: user.email, password: body.password });
        if (signedIn.error || signedIn.data.user?.id !== user.id) return json(403, "Incorrect password.");
        const consumed = await supabaseAdmin.rpc("consume_account_recovery_code", { p_user_id: user.id, p_hash: await hashCode(body.recoveryCode) });
        if (consumed.error || !consumed.data) return json(403, "Invalid or previously used recovery code.");
        const deleted = await supabaseAdmin.auth.admin.deleteUser(user.id);
        if (deleted.error) return json(500, "Deletion failed. Please contact support. Your recovery code was used.");
        return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
      } catch { return json(503, "Could not verify account deletion. Try again later."); }
    },
  } },
});
