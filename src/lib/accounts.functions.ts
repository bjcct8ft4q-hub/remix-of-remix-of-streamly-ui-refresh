import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recoverySchema, signupSchema, usernameEmail } from "@/lib/account-schema";
import { z } from "zod";

export const createUsernameAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => signupSchema.extend({ turnstileToken: z.string().max(2048).optional() }).parse(input))
  .handler(async ({ data }) => {
    const turnstileSecret = process.env["TURNSTILE_SECRET_KEY"];
    if (turnstileSecret) {
      if (!data.turnstileToken) throw new Error("Complete the human verification challenge.");
      const verification = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({secret:turnstileSecret,response:data.turnstileToken}),signal:AbortSignal.timeout(8000)});
      if (!verification.ok || !(await verification.json()).success) throw new Error("Human verification failed. Please try again.");
    }
    if (!turnstileSecret && process.env["VITE_TURNSTILE_SITE_KEY"]) throw new Error("Human verification is not configured on the server.");
    setResponseHeader("Cache-Control", "no-store");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { checkLimit, issueCodes } = await import("@/lib/accounts.server");
    await checkLimit(supabaseAdmin, `signup:${getRequestHeader("x-vercel-forwarded-for")?.split(",")[0] || getRequestHeader("x-real-ip") || "unknown"}`, 10);
    if (!data.email) throw new Error("An email address is required for new accounts.");
    const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
      email: usernameEmail(data.username), password: data.password, email_confirm: true,
      user_metadata: { username: data.username },
    });
    if (error || !user.user) throw new Error("Account couldn’t be created. Try a different username or password.");
    const id = user.user.id;
    const duplicateEmail = await supabaseAdmin.from("account_credentials").select("user_id").ilike("recovery_email", data.email).maybeSingle();
    if (duplicateEmail.error || duplicateEmail.data) {
      await supabaseAdmin.auth.admin.deleteUser(id);
      throw new Error("This email address is already registered or cannot be verified.");
    }
    const stored = await supabaseAdmin.from("account_credentials").insert({ user_id: id, username: data.username, recovery_email: data.email || null });
    if (stored.error) {
      await supabaseAdmin.auth.admin.deleteUser(id);
      throw new Error("Account couldn’t be created. Please try again.");
    }
    // The auth trigger grants only the ordinary user role, including the first signup.
    return { codes: await issueCodes(supabaseAdmin, id) };
  });


// Resolve an email to the internal Supabase Auth login address without exposing
// the credentials table to the browser. Unknown emails return a dummy address.
export const resolveLoginIdentifier = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    if (typeof input !== "string" || input.trim().length < 3 || input.length > 254) throw new Error("Invalid login.");
    return input.trim();
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    if (!data.includes("@")) return { email: usernameEmail(data) };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { checkLimit } = await import("@/lib/accounts.server");
    await checkLimit(supabaseAdmin, "email-lookup:" + (getRequestHeader("x-vercel-forwarded-for")?.split(",")[0] || getRequestHeader("x-real-ip") || "unknown"), 30);
    const { data: row, error } = await supabaseAdmin.from("account_credentials")
      .select("username").ilike("recovery_email", data.replace(/[\\%_]/g, "\\$&")).maybeSingle();
    if (error) throw new Error("Sign in is temporarily unavailable.");
    return { email: row ? usernameEmail(row.username) : "nonexistent@username.streamly.invalid" };
  });

export const recoverUsernameAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => recoverySchema.parse(input))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { checkLimit, hashCode } = await import("@/lib/accounts.server");
    await checkLimit(supabaseAdmin, `recovery-ip:${getRequestHeader("x-vercel-forwarded-for")?.split(",")[0] || getRequestHeader("x-real-ip") || "unknown"}`, 20);
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
/** Update the account login name and optional recovery email without exposing the synthetic auth email. */
export const updateAccountIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => signupSchema.pick({ username: true, email: true }).parse(input))
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { checkLimit } = await import("@/lib/accounts.server");
    await checkLimit(supabaseAdmin, `identity:${context.userId}`, 10);
    const existing = await supabaseAdmin.from("account_credentials").select("username").eq("user_id", context.userId).single();
    if (existing.error || !existing.data) throw new Error("Account credentials unavailable.");
    const oldUsername = existing.data.username;
    const newUsername = data.username;
    if (oldUsername !== newUsername) {
      const taken = await supabaseAdmin.from("account_credentials").select("user_id").eq("username", newUsername).maybeSingle();
      if (taken.data && taken.data.user_id !== context.userId) throw new Error("That username is already taken.");
      const auth = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
        email: usernameEmail(newUsername), email_confirm: true, user_metadata: { username: newUsername },
      });
      if (auth.error) throw new Error("Couldn't update your username. Please choose another.");
    }
    const saved = await supabaseAdmin.from("account_credentials").update({ username: newUsername, recovery_email: data.email || null }).eq("user_id", context.userId);
    if (saved.error) {
      if (oldUsername !== newUsername) await supabaseAdmin.auth.admin.updateUserById(context.userId, { email: usernameEmail(oldUsername), email_confirm: true, user_metadata: { username: oldUsername } });
      throw new Error("Couldn't save account details. The username may already be taken.");
    }
    await supabaseAdmin.from("profiles").update({ username: newUsername }).eq("id", context.userId);
    return { username: newUsername, email: data.email || null };
  });

export const getAccountIdentity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin.from("account_credentials").select("username,recovery_email").eq("user_id", context.userId).single();
    if (result.error || !result.data) throw new Error("Account details unavailable.");
    return { username: result.data.username, email: result.data.recovery_email || "" };
  });
