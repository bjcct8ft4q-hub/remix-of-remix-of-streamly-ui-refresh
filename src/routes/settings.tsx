import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AccountAvatar } from "@/components/AccountAvatar";
import { createFileRoute } from "@tanstack/react-router";
import { useAudioPreference, type AudioPreference } from "@/lib/audio-preference";
export const Route = createFileRoute("/settings")({ component: Settings, head: () => ({ meta: [{ title: "Settings — Streamly" }] }) });
function Settings() {
  const { preference, setPreference } = useAudioPreference();
  const { user } = useAuth();
  const [avatarMessage, setAvatarMessage] = useState("");
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarChoice, setAvatarChoice] = useState<string | null>(null);
  const avatars = ["🦊", "🐱", "🐼", "🐺", "🐉", "🌸", "⭐", "🎮", "👾", "🎃", "🌙", "🐸"];
  const saveAvatar = async (emoji: string) => {
    setAvatarSaving(true); setAvatarMessage("");
    const { error } = await supabase.auth.updateUser({ data: { avatar_emoji: emoji, avatar_url: null } });
    setAvatarSaving(false);
    if (error) setAvatarMessage(error.message);
    else { setAvatarChoice(emoji); setAvatarMessage("Avatar updated!"); }
  };
  const choices: { value: AudioPreference; label: string; detail: string }[] = [
    { value: "auto", label: "Auto", detail: "Prefer English dub when available, otherwise use Japanese audio with subtitles." },
    { value: "sub", label: "Japanese (Sub)", detail: "Prefer Japanese audio with subtitles." },
    { value: "dub", label: "English (Dub)", detail: "Prefer English dubbed audio when available; otherwise use subtitles." },
  ];
  return <main className="mx-auto max-w-3xl px-5 pb-20 pt-36 md:pt-28">
    <h1 className="mb-6 border-l-4 border-primary pl-3 text-3xl font-extrabold">Settings</h1>
    {user && <section className="mb-6 rounded-xl border border-border bg-card p-5"><h2 className="text-xl font-bold">Profile avatar</h2><p className="mt-2 text-sm text-muted-foreground">Choose an avatar for your profile and account menu.</p><div className="mt-4 flex items-center gap-3"><AccountAvatar size="lg" /><span className="text-sm text-muted-foreground">Your current avatar</span></div><div className="mt-5 grid grid-cols-6 gap-2">{avatars.map((emoji) => <button key={emoji} type="button" disabled={avatarSaving} onClick={() => void saveAvatar(emoji)} aria-label={`Choose ${emoji} avatar`} className={`grid aspect-square place-items-center rounded-full border text-2xl hover:border-primary ${avatarChoice === emoji || (!avatarChoice && user.user_metadata?.avatar_emoji === emoji) ? "border-primary bg-primary/15" : "border-border bg-muted/40"}`}>{emoji}</button>)}</div><button type="button" disabled={avatarSaving} onClick={() => void saveAvatar("")} className="mt-4 text-sm text-primary underline">Use my initial instead</button>{avatarMessage && <p role="status" className="mt-3 text-sm text-muted-foreground">{avatarMessage}</p>}</section>}
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-xl font-bold">Preferred audio language</h2>
      <p className="mt-2 text-sm text-muted-foreground">Choose the audio to select automatically when opening anime. You can still change it for individual episodes.</p>
      <div className="mt-5 space-y-3">{choices.map((choice) => <label key={choice.value} className={"flex cursor-pointer gap-3 rounded-lg border p-4 " + (preference === choice.value ? "border-primary bg-primary/10" : "border-border")}>
        <input type="radio" name="audio" value={choice.value} checked={preference === choice.value} onChange={() => setPreference(choice.value)} className="accent-primary" />
        <span><strong className="block">{choice.label}</strong><span className="mt-1 block text-sm text-muted-foreground">{choice.detail}</span></span>
      </label>)}</div>
      <p className="mt-4 text-xs text-muted-foreground">Saved on this device. Audio and subtitle availability varies by anime and episode.</p>
    </section>
  </main>;
}
