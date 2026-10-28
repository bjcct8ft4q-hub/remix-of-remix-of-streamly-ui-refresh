import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recoverySchema, signupSchema, usernameEmail } from "@/lib/account-schema";

export const createUsernameAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => signupSchema.parse(input))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { checkLimit, issueCodes } = await import("@/lib/accounts.server");
    await checkLimit(supabaseAdmin, `signup:${getRequestHeader("cf-connecting-ip") || "local"}`, 10);
    const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
      email: usernameEmail(data.username), password: data.password, email_confirm: true,
      user_metadata: { username: data.username },
    });
    if (error || !user.user) throw new Error("Account couldn’t be created. Try a different username or password.");
    const id = user.user.id;
    const stored = await supabaseAdmin.from("account_credentials").insert({ user_id: id, username: data.username, recovery_email: data.email || null });
    if (stored.error) {
      await supabaseAdmin.auth.admin.deleteUser(id);
      throw new Error("Account couldn’t be created. Please try again.");
    }
    // The auth trigger grants only the ordinary user role, including the first signup.
    return { codes: await issueCodes(supabaseAdmin, id) };
  });

export const recoverUsernameAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => recoverySchema.parse(input))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { checkLimit, hashCode } = await import("@/lib/accounts.server");
    await checkLimit(supabaseAdmin, `recovery-ip:${getRequestHeader("cf-connecting-ip") || "local"}`, 20);
    await checkLimit(supabaseAdmin, `recovery-user:${data.username}`, 10);
    const account = await supabaseAdmin.from("account_credentials").select("user_id").eq("username", data.username).maybeSingle();
    const hash = await hashCode(data.code);
    if (!account.data) throw new Error("Username or recovery code is incorrect.");
    const consumed = await supabaseAdmin.rpc("consume_account_recovery_code", { p_user_id: account.data.user_id, p_hash: hash });
    if (consumed.error || !consumed.data) throw new Error("Username or recovery code is incorrect.");
    // This authorizes password recovery only: existing TOTP factors are never removed or bypassed.
    const updated = await supabaseAdmin.auth.admin.updateUserById(account.data.user_id, { password: data.password });
    if (updated.error) throw new Error("Password couldn’t be updated. This code has been used; try another saved code.");
    const user = await supabaseAdmin.auth.admin.getUserById(account.data.user_id);
    if (user.data.user?.email) {
      const { createClient } = await import("@supabase/supabase-js");
      const url = process.env["SUPABASE_URL"];
      const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
      if (!url || !key) throw new Error("Password changed. Sign in again.");
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } } });
      const session = await client.auth.signInWithPassword({ email: user.data.user.email, password: data.password });
      if (session.data.session) await supabaseAdmin.auth.admin.signOut(session.data.session.access_token, "global");
    }
    return { ok: true };
  });

export const regenerateAccountCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    setResponseHeader("Cache-Control", "no-store");
    const factors = await context.supabase.auth.mfa.listFactors();
    if (factors.error) throw new Error("Account security couldn’t be checked.");
    if (factors.data.totp.length && context.claims["aal"] !== "aal2") throw new Error("Verify your authenticator before replacing recovery codes.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { checkLimit, issueCodes } = await import("@/lib/accounts.server");
    await checkLimit(supabaseAdmin, `codes:${context.userId}`, 5);
    return { codes: await issueCodes(supabaseAdmin, context.userId) };
  });