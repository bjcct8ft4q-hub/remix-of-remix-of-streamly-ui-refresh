import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AccountAvatar } from "@/components/AccountAvatar";
import { createFileRoute } from "@tanstack/react-router";
import { useAudioPreference, type AudioPreference } from "@/lib/audio-preference";
type CharacterAvatar = { id: number; name: string; image: string };
type AvatarCollection = { title: string; mediaId: number; characters: CharacterAvatar[] };
const avatarShows = [
  { title: "Jujutsu Kaisen", mediaId: 113415 },
  { title: "My Hero Academia", mediaId: 21459 },
  { title: "Demon Slayer", mediaId: 101922 },
  { title: "Attack on Titan", mediaId: 16498 },
  { title: "One Piece", mediaId: 21 },
];
async function fetchCharacterAvatars(): Promise<AvatarCollection[]> {
  const query = `query ($id: Int) { Media(id: $id, type: ANIME) { characters(sort: [ROLE, RELEVANCE, ID], perPage: 12) { nodes { id name { full } image { large } } } } }`;
  const collections = await Promise.all(avatarShows.map(async (show) => {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { id: show.mediaId } }),
    });
    if (!response.ok) throw new Error("Character portraits could not be loaded");
    const json = await response.json();
    if (json.errors?.length) throw new Error("Character portraits could not be loaded");
    const characters: CharacterAvatar[] = (json.data?.Media?.characters?.nodes ?? [])
      .filter((character: { id: number; name?: { full?: string }; image?: { large?: string } }) => character.image?.large && character.name?.full)
      .map((character: { id: number; name: { full: string }; image: { large: string } }) => ({
        id: character.id, name: character.name.full, image: character.image.large,
      }));
    return { ...show, characters };
  }));
  return collections.filter((collection) => collection.characters.length > 0);
}
export const Route = createFileRoute("/settings")({ component: Settings, head: () => ({ meta: [{ title: "Settings — Streamly" }] }) });
function Settings() {
  const { preference, setPreference } = useAudioPreference();
  const { user } = useAuth();
  const [avatarMessage, setAvatarMessage] = useState("");
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarChoice, setAvatarChoice] = useState<string | null>(null);
  const { data: animeAvatars, isPending: avatarsLoading, isError: avatarsError, refetch: retryAvatars } = useQuery({ queryKey: ["anime-avatar-collections-v1"], queryFn: fetchCharacterAvatars, staleTime: 60 * 60 * 1000, retry: 1 });
  const uploadAvatar = async (file?: File) => {
    if (!file || !user) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setAvatarMessage("Choose a JPG, PNG or WebP image."); return; }
    if (file.size > 5 * 1024 * 1024) { setAvatarMessage("Image must be smaller than 5 MB."); return; }
    setAvatarSaving(true); setAvatarMessage("");
    try {
      const extension = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
      const path = user.id + "/" + crypto.randomUUID() + "." + extension;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const result = await supabase.auth.updateUser({ data: { avatar_url: data.publicUrl, avatar_emoji: "" } });
      if (result.error) throw result.error;
      setAvatarChoice(data.publicUrl); setAvatarMessage("Avatar updated!");
    } catch (error) { setAvatarMessage(error instanceof Error ? error.message : "Upload failed."); }
    finally { setAvatarSaving(false); }
  };
  const saveAvatar = async (emoji: string, url?: string) => {
    setAvatarSaving(true); setAvatarMessage("");
    const { error } = await supabase.auth.updateUser({ data: { avatar_emoji: url ? "" : emoji, avatar_url: url ?? null } });
    setAvatarSaving(false);
    if (error) setAvatarMessage(error.message);
    else { setAvatarChoice(url ?? emoji); setAvatarMessage("Avatar updated!"); }
  };
  const choices: { value: AudioPreference; label: string; detail: string }[] = [
    { value: "auto", label: "Auto", detail: "Prefer English dub when available, otherwise use Japanese audio with subtitles." },
    { value: "sub", label: "Japanese (Sub)", detail: "Prefer Japanese audio with subtitles." },
    { value: "dub", label: "English (Dub)", detail: "Prefer English dubbed audio when available; otherwise use subtitles." },
  ];
  return <main className="mx-auto max-w-3xl px-5 pb-20 pt-36 md:pt-28">
    <h1 className="mb-6 border-l-4 border-primary pl-3 text-3xl font-extrabold">Settings</h1>
    {user && <section className="mb-6 rounded-xl border border-border bg-card p-5"><h2 className="text-xl font-bold">Profile avatar</h2><p className="mt-2 text-sm text-muted-foreground">Choose an anime character portrait, upload your own image, or use your initial. Your choice appears on your profile and account menu.</p><div className="mt-4 flex items-center gap-3"><AccountAvatar size="lg" /><span className="text-sm text-muted-foreground">Your current avatar</span></div><h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-primary">Anime character avatars</h3>{avatarsLoading && <p className="mt-3 text-sm text-muted-foreground">Loading anime characters…</p>}{avatarsError && <p className="mt-3 text-sm text-muted-foreground">Character portraits are unavailable right now. <button type="button" onClick={() => void retryAvatars()} className="text-primary underline">Retry</button></p>}{animeAvatars?.map((collection) => <div key={collection.mediaId} className="mt-4"><h4 className="mb-3 text-sm font-semibold">{collection.title}</h4><div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">{collection.characters.map((character) => <button type="button" key={character.id} disabled={avatarSaving} onClick={() => void saveAvatar("", character.image)} aria-label={`Choose ${character.name} from ${collection.title}`} title={character.name} className="group min-w-0 text-center"><span className={`mx-auto block aspect-square w-full max-w-24 overflow-hidden rounded-full border-[3px] bg-muted transition group-hover:scale-105 group-hover:border-primary ${avatarChoice === character.image || (!avatarChoice && user.user_metadata?.avatar_url === character.image) ? "border-primary" : "border-border"}`}><img src={character.image} alt="" loading="lazy" className="h-full w-full object-cover" /></span><span className="mt-1 block truncate text-xs text-muted-foreground group-hover:text-foreground">{character.name}</span></button>)}</div></div>)}<div className="mt-7 rounded-lg border border-border bg-muted/20 p-4"><h3 className="text-sm font-bold uppercase tracking-wide text-primary">Upload your own avatar</h3><p className="mt-2 text-sm text-muted-foreground">JPG, PNG or WebP, up to 5 MB. Your image will appear as a circular profile picture.</p><label className="mt-3 inline-flex cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><input type="file" accept="image/jpeg,image/png,image/webp" disabled={avatarSaving} className="sr-only" onChange={(event) => { void uploadAvatar(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />{avatarSaving ? "Saving…" : "Choose image"}</label></div><button type="button" disabled={avatarSaving} onClick={() => void saveAvatar("")} className="mt-4 text-sm text-primary underline">Use my initial instead</button>{avatarMessage && <p role="status" className="mt-3 text-sm text-muted-foreground">{avatarMessage}</p>}</section>}
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
