import { useState } from "react";
import { X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RecoveryCodes } from "@/components/RecoveryCodes";
import { createUsernameAccount, recoverUsernameAccount } from "@/lib/accounts.functions";
import { signupSchema, recoverySchema, usernameEmail } from "@/lib/account-schema";

const inputCls = "mt-2 w-full rounded-md border border-border bg-muted/60 px-3.5 py-3 text-sm outline-none focus:border-primary";

export function AuthDialog() {
  const { authTab, closeAuth, openAuth } = useAuth();
  const createAccount = useServerFn(createUsernameAccount);
  const recoverAccount = useServerFn(recoverUsernameAccount);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [recover, setRecover] = useState(false);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [error, setError] = useState("");
  if (!authTab) return null;
  const signup = authTab === "signup";
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      if (recover) {
        await recoverAccount({ data: recoverySchema.parse({ username, code, password }) });
        setRecover(false); setPassword(""); setCode("");
        toast.success("Password reset. Sign in with your new password.");
      } else if (factorId) {
        const verified = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
        if (verified.error) throw verified.error;
        setFactorId(null); setCode(""); setPassword(""); closeAuth();
      } else if (signup) {
        const result = await createAccount({ data: signupSchema.parse({ username, password, email }) });
        setCodes(result.codes); setSaved(false);
      } else {
        const signed = await supabase.auth.signInWithPassword({ email: username.includes("@") ? username.trim() : usernameEmail(username), password });
        if (signed.error) throw new Error("Username or password is incorrect.");
        const factors = await supabase.auth.mfa.listFactors();
        if (factors.error) throw factors.error;
        const factor = factors.data.totp[0];
        if (factor) { setFactorId(factor.id); setCode(""); }
        else { setPassword(""); toast.success("Welcome back!"); closeAuth(); }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/80 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="auth-title" className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-lg border border-border border-t-primary bg-card p-6 shadow-2xl">
        {!codes.length && <Button variant="ghost" size="icon" onClick={async () => { if (factorId) await supabase.auth.signOut(); setFactorId(null); closeAuth(); }} aria-label="Close" className="absolute right-3 top-3"><X /></Button>}
        <h2 id="auth-title" className="pr-8 text-2xl font-extrabold">{codes.length ? "Save your recovery codes" : factorId ? "Authenticator verification" : recover ? "Reset your password" : signup ? "Create an account" : "Welcome back"}</h2>
        {codes.length ? <div className="mt-5 space-y-4">
          <p className="text-sm font-bold text-primary">Screenshot or save these codes now. They are only shown once.</p>
          <RecoveryCodes codes={codes} />
          <p className="text-sm text-muted-foreground">If you forget your password and lose these codes, you may lose access to your account. Choose “Forgot password?” and enter your username and one saved code.</p>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />I have screenshotted or saved my recovery codes.</label>
          <Button disabled={!saved || busy} className="w-full" onClick={async () => { setBusy(true); const result = await supabase.auth.signInWithPassword({ email: usernameEmail(username), password }); setBusy(false); if (result.error) { setError("Account created. Please sign in."); return; } setCodes([]); setPassword(""); closeAuth(); }}>Continue to Streamly</Button>
        </div> : <form onSubmit={submit} className="mt-6 space-y-4">
          {!factorId && <>
            <label className="block text-sm font-semibold">{signup || recover ? "Username" : "Username or email"}<input value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} autoComplete="username" required maxLength={signup || recover ? 24 : 254} pattern={signup || recover ? "[A-Za-z0-9_]{3,24}" : undefined} /></label>
            {signup && <label className="block text-sm font-semibold">Email (optional)<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} autoComplete="email" maxLength={254} /><span className="mt-1 block text-xs text-muted-foreground">Your username is used to sign in. Password recovery uses your saved codes.</span></label>}
            <label className="block text-sm font-semibold">{recover ? "New password" : "Password"}<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} autoComplete={signup || recover ? "new-password" : "current-password"} minLength={signup || recover ? 12 : undefined} maxLength={128} required /></label>
          </>}
          {(recover || factorId) && <label className="block text-sm font-semibold">{factorId ? "Authenticator code" : "Recovery code"}<input value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} autoComplete="one-time-code" required maxLength={80} /></label>}
          <Button type="submit" disabled={busy} className="w-full">{busy ? "Please wait…" : factorId ? "Verify" : recover ? "Reset password" : signup ? "Create account" : "Sign in"}</Button>
          {!factorId && <div className="flex flex-wrap justify-between gap-2">
            <Button variant="link" size="sm" onClick={() => { setRecover(false); setError(""); openAuth(signup ? "signin" : "signup"); }}>{signup ? "Already registered? Sign in" : "Create account"}</Button>
            {!signup && <Button variant="link" size="sm" onClick={() => { setRecover(!recover); setError(""); }}>{recover ? "Back to sign in" : "Forgot password?"}</Button>}
          </div>}
        </form>}
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
