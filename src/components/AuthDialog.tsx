import { useState, useEffect, useRef } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RecoveryCodes } from "@/components/RecoveryCodes";
import { createUsernameAccount, recoverUsernameAccount, resolveLoginIdentifier } from "@/lib/accounts.functions";
import { signupSchema, recoverySchema, usernameEmail } from "@/lib/account-schema";

declare global { interface Window { turnstile?: { render:(element:HTMLElement,options:Record<string,unknown>)=>string; remove:(id:string)=>void; reset:(id:string)=>void } } }
const siteKey=import.meta.env.VITE_TURNSTILE_SITE_KEY as string|undefined;
function TurnstileChallenge({onVerify}:{onVerify:(token:string)=>void}) {
  const container = useRef<HTMLDivElement>(null);
  const [verified, setVerified] = useState(false);
  useEffect(() => {
    if (!siteKey || !container.current) return;
    let active = true;
    let widget: string | undefined;
    const mount = () => {
      if (!active || !container.current || !window.turnstile) return;
      widget = window.turnstile.render(container.current, {
        sitekey: siteKey, theme: "dark",
        callback: (token: string) => { setVerified(true); onVerify(token); },
        "expired-callback": () => { setVerified(false); onVerify(""); },
        "error-callback": () => { setVerified(false); onVerify(""); },
      });
    };
    if (window.turnstile) mount();
    else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = mount;
      document.head.appendChild(script);
    }
    return () => { active = false; if (widget && window.turnstile) window.turnstile.remove(widget); };
  }, []);
  return <div className="space-y-2">
    <div className={verified ? "sr-only" : "rounded-md border border-border bg-black/40 p-3"} ref={container} aria-label="Cloudflare verification challenge" />
    <div role="status" className={`flex min-h-10 items-center justify-between gap-2 rounded-sm border border-orange-600/60 bg-orange-950/30 px-3 py-2 text-xs font-bold ${verified ? "text-orange-400" : "text-muted-foreground"}`}>
      <span className="flex items-center gap-2"><span aria-hidden="true" className="text-orange-500">⬡</span>{verified ? "Verified — you're human" : "Complete the verification above"}</span>
      <span className="text-[10px] font-extrabold tracking-[0.12em] text-muted-foreground">CLOUDFLARE</span>
    </div>
  </div>;
}

const inputCls = "mt-2 w-full rounded-md border border-border bg-background/70 px-4 py-3.5 pr-12 text-base font-normal normal-case tracking-normal text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary";

export function AuthDialog() {
  const { authTab, closeAuth, openAuth } = useAuth();
  const createAccount = useServerFn(createUsernameAccount);
  const recoverAccount = useServerFn(recoverUsernameAccount);
  const resolveLogin = useServerFn(resolveLoginIdentifier);
  const [turnstileToken,setTurnstileToken]=useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    if (signup && password !== confirmPassword) { setError("Passwords do not match."); return; }
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
        const result = await createAccount({ data: { ...signupSchema.parse({ username, password, email }), turnstileToken } });
        setCodes(result.codes); setSaved(false);
      } else {
        const login = await resolveLogin({ data: username });
        const signed = await supabase.auth.signInWithPassword({ email: login.email, password });
        if (signed.error) throw new Error("Email/username or password is incorrect. If you registered on an older version of Streamly, you may need to create an account on the new database.");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/85 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget && !codes.length) closeAuth(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="auth-title" className="streamly-auth relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card px-6 py-9 shadow-2xl sm:px-9">
        {!codes.length && <button type="button" onClick={async () => { if (factorId) await supabase.auth.signOut(); setFactorId(null); closeAuth(); }} aria-label="Close" className="absolute right-5 top-5 z-10 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"><X size={22} /></button>}
        <h2 id="auth-title" className="relative pr-8 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{codes.length ? "Save your recovery codes" : factorId ? "Verify your account" : recover ? "Reset your password" : signup ? "Join Streamly" : "Welcome back"}</h2>
        <p className="relative mt-2 text-sm text-muted-foreground sm:text-base">{codes.length ? "Keep these codes somewhere safe." : factorId ? "Enter the code from your authenticator." : recover ? "Use your saved recovery code to reset your password." : signup ? "Start your anime journey today." : "Sign in to continue your journey."}</p>
        {!codes.length && !factorId && !recover && (
          <div className="relative mt-7 flex gap-7 border-b border-border" role="tablist" aria-label="Account">
            <button type="button" role="tab" aria-selected={!signup} onClick={() => { setError(""); openAuth("signin"); }} className={`streamly-auth-tab ${!signup ? "streamly-auth-tab-active" : ""}`}>Sign In</button>
            <button type="button" role="tab" aria-selected={signup} onClick={() => { setError(""); openAuth("signup"); }} className={`streamly-auth-tab ${signup ? "streamly-auth-tab-active" : ""}`}>Create Account</button>
          </div>
        )}
        {codes.length ? <div className="relative mt-7 space-y-4">
          <p className="text-sm font-bold text-primary">Screenshot or save these codes now. They are only shown once.</p>
          <RecoveryCodes codes={codes} />
          <p className="text-sm text-muted-foreground">If you forget your password and lose these codes, you may lose access to your account. Choose “Forgot password?” and enter your username and one saved code.</p>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />I have screenshotted or saved my recovery codes.</label>
          <Button disabled={!saved || busy} className="streamly-auth-submit w-full" onClick={async () => { setBusy(true); const result = await supabase.auth.signInWithPassword({ email: usernameEmail(username), password }); setBusy(false); if (result.error) { setError("Account created. Please sign in."); return; } setCodes([]); setPassword(""); closeAuth(); }}>Continue to Streamly</Button>
        </div> : <form onSubmit={submit} className="relative mt-7 space-y-5">
          {!factorId && <>
            {signup && <label className="streamly-auth-label">Email <span className="normal-case tracking-normal text-muted-foreground">(required for email sign-in)</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} autoComplete="email" maxLength={254} placeholder="you@example.com" /></label>}
            <label className="streamly-auth-label">{signup || recover ? "Username" : "Email or username"}<input value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} autoComplete="username" required maxLength={signup || recover ? 24 : 254} pattern={signup || recover ? "[A-Za-z0-9_]{3,24}" : undefined} placeholder={signup || recover ? "coolweeb42" : "you@example.com"} /></label>
            <label className="streamly-auth-label">
              <span className="flex items-center justify-between gap-2"><span>{recover ? "New password" : "Password"}</span>{!signup && !recover && <button type="button" className="text-xs font-semibold normal-case tracking-normal text-primary hover:underline" onClick={() => { setRecover(true); setError(""); }}>Forgot password?</button>}</span>
              <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} autoComplete={signup || recover ? "new-password" : "current-password"} minLength={signup || recover ? 12 : undefined} maxLength={128} required placeholder="••••••••••••" />
              <button type="button" className="streamly-auth-eye" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
            </label>
            {signup && <label className="streamly-auth-label">Confirm password<input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputCls} autoComplete="new-password" minLength={12} maxLength={128} required placeholder="••••••••••••" /></label>}
            {signup && siteKey && <TurnstileChallenge onVerify={setTurnstileToken} />}
            {signup && <p className="text-xs normal-case tracking-normal text-muted-foreground">You can sign in using your username or email. Your account is saved to Streamly’s Supabase database. Save the recovery codes provided after registration.</p>}
          </>}
          {(recover || factorId) && <label className="streamly-auth-label">{factorId ? "Authenticator code" : "Recovery code"}<input value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} autoComplete="one-time-code" required maxLength={80} /></label>}
          <Button type="submit" disabled={busy || (signup && !!siteKey && !turnstileToken)} className={`streamly-auth-submit w-full ${signup ? "!bg-orange-500 !text-black hover:!bg-orange-400" : ""}`}>{busy ? "Please wait…" : factorId ? "Verify" : recover ? "Reset password" : signup ? "Create account" : "Sign in"}</Button>
          {!factorId && <p className="text-center text-sm text-muted-foreground">
            {recover ? <>Remembered your password? <button type="button" className="font-semibold text-primary hover:underline" onClick={() => { setRecover(false); setError(""); }}>Sign in</button></> : signup ? <>Already have an account? <button type="button" className="font-semibold text-primary hover:underline" onClick={() => { setError(""); openAuth("signin"); }}>Sign in</button></> : <>Don't have an account? <button type="button" className="font-semibold text-primary hover:underline" onClick={() => { setError(""); openAuth("signup"); }}>Sign up</button></>}
          </p>}
        </form>}
        {error && <p role="alert" className="relative mt-4 text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
