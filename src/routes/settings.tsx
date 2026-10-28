import { createFileRoute } from "@tanstack/react-router";
import { useAudioPreference, type AudioPreference } from "@/lib/audio-preference";
export const Route = createFileRoute("/settings")({ component: Settings, head: () => ({ meta: [{ title: "Settings — Streamly" }] }) });
function Settings() {
  const { preference, setPreference } = useAudioPreference();
  const choices: { value: AudioPreference; label: string; detail: string }[] = [
    { value: "auto", label: "Auto", detail: "Prefer English dub when available, otherwise use Japanese audio with subtitles." },
    { value: "sub", label: "Japanese (Sub)", detail: "Prefer Japanese audio with subtitles." },
    { value: "dub", label: "English (Dub)", detail: "Prefer English dubbed audio when available; otherwise use subtitles." },
  ];
  return <main className="mx-auto max-w-3xl px-5 pb-20 pt-36 md:pt-28">
    <h1 className="mb-6 border-l-4 border-primary pl-3 text-3xl font-extrabold">Settings</h1>
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
