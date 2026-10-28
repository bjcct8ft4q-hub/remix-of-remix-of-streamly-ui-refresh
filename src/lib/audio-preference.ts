import { useEffect, useState } from "react";
export type AudioPreference = "auto" | "sub" | "dub";
const KEY = "streamly-preferred-audio";
export function readAudioPreference(): AudioPreference {
  if (typeof window === "undefined") return "auto";
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "sub" || value === "dub" ? value : "auto";
  } catch { return "auto"; }
}
export function useAudioPreference() {
  const [preference, setPreference] = useState<AudioPreference>("auto");
  useEffect(() => {
    setPreference(readAudioPreference());
    const sync = () => setPreference(readAudioPreference());
    window.addEventListener("streamly-audio-preference", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("streamly-audio-preference", sync); window.removeEventListener("storage", sync); };
  }, []);
  const update = (next: AudioPreference) => {
    try { window.localStorage.setItem(KEY, next); } catch {}
    setPreference(next);
    window.dispatchEvent(new Event("streamly-audio-preference"));
  };
  return { preference, setPreference: update };
}
