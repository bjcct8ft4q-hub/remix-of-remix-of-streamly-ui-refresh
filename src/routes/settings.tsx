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
  { title: "JJK extras", mediaId: -113415 },
  { title: "My Hero Academia", mediaId: 21459 },
  { title: "Demon Slayer", mediaId: 101922 },
  { title: "Attack on Titan", mediaId: 16498 },
  { title: "One Piece", mediaId: 21 },
  { title: "JoJo’s Bizarre Adventure", mediaId: 14719 },
  { title: "Hellsing", mediaId: 270 },
  { title: "Tokyo Ghoul", mediaId: 20605 },
  { title: "Cyberpunk: Edgerunners", mediaId: 120377 },
  { title: "Cyberpunk: Edgerunners 2", mediaId: 195539 },
];
async function fetchCharacterAvatars(): Promise<AvatarCollection[]> {
  const query = `query ($id: Int) { Media(id: $id, type: ANIME) { characters(sort: [ROLE, RELEVANCE, ID], perPage: 12) { nodes { id name { full } image { large } } } } }`;
  const collections = await Promise.all(avatarShows.filter((show) => show.mediaId > 0).map(async (show) => {
    try {
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
    } catch { return { ...show, characters: [] as CharacterAvatar[] }; }
  }));
  const extraNames = ["Aoi Todo", "Hiromi Higuruma", "Toji Fushiguro", "Kokichi Muta"];
  const extras = await Promise.all(extraNames.map(async (characterName) => {
    try {
      const response = await fetch("https://graphql.anilist.co", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: `query ($search: String) { Character(search: $search) { id name { full } image { large } } }`, variables: { search: characterName } }),
      });
      if (!response.ok) return null;
      const result = await response.json();
      const character = result.data?.Character;
      return character?.image?.large ? { id: character.id, name: characterName, image: character.image.large } as CharacterAvatar : null;
    } catch { return null; }
  }));
  const jjk = collections.find((collection) => collection.mediaId === 113415);
  if (jjk) {
    // Supplement the original JJK cast list with characters omitted by AniList's 12-character page limit.
    const additions = extras.filter((character): character is CharacterAvatar => character !== null);
    const existing = new Set(jjk.characters.map((character) => character.id));
    jjk.characters.push(...additions.filter((character) => !existing.has(character.id)));
    collections.unshift({ title: "JJK extras", mediaId: -113415, characters: additions });
  }
  return collections.filter((collection) => collection.characters.length > 0);
}
export const Route = createFileRoute("/settings")({ component: Settings, head: () => ({ meta: [{ title: "Settings — Streamly" }] }) });
function Settings() {
  const { preference, setPreference } = useAudioPreference();
  const { user } = useAuth();
  const [settingsTab, setSettingsTab] = useState<"profile" | "playback" | "security">("profile");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [avatarTab, setAvatarTab] = useState<"anime" | "upload">("anime");
  const [selectedShow, setSelectedShow] = useState(113415);
  const [avatarSearch, setAvatarSearch] = useState("");
  const [avatarMessage, setAvatarMessage] = useState("");
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarChoice, setAvatarChoice] = useState<string | null>(null);
  const { data: animeAvatars, isPending: avatarsLoading, isError: avatarsError, refetch: retryAvatars } = useQuery({ queryKey: ["anime-avatar-collections-v3"], queryFn: fetchCharacterAvatars, staleTime: 60 * 60 * 1000, retry: 1 });
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
  const currentCollection = animeAvatars?.find((collection) => collection.mediaId === selectedShow);
  const visibleCharacters = currentCollection?.characters.filter((character) => character.name.toLowerCase().includes(avatarSearch.trim().toLowerCase())) ?? [];
  const selectedAvatar = avatarChoice ?? (typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : "");
  return <main className="mx-auto max-w-5xl px-4 pb-24 pt-32 sm:px-6 md:pt-28">
    <div className="mb-7"><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Your Streamly account</p><h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Settings</h1><p className="mt-2 text-sm text-muted-foreground">Personalise your profile and watching experience.</p></div>
    <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Settings categories" className="flex h-fit gap-2 overflow-x-auto rounded-xl border border-border bg-card p-2 md:sticky md:top-28 md:flex-col">
        <button type="button" onClick={() => setSettingsTab("profile")} aria-current={settingsTab === "profile" ? "page" : undefined} className={`whitespace-nowrap rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${settingsTab === "profile" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>Profile & avatar</button>
        <button type="button" onClick={() => setSettingsTab("playback")} aria-current={settingsTab === "playback" ? "page" : undefined} className={`whitespace-nowrap rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${settingsTab === "playback" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>Language & playback</button>
        <button type="button" onClick={() => setSettingsTab("security")} aria-current={settingsTab === "security" ? "page" : undefined} className={`whitespace-nowrap rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${settingsTab === "security" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>Account & security</button>
      </nav>
      <div className="min-w-0">
        {settingsTab === "profile" && <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h2 className="text-xl font-bold">Profile picture</h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose a character or upload a picture of your own.</p>
          {user ? <>
            <div className="mt-5 flex items-center gap-4 rounded-xl border border-border bg-muted/30 p-4"><AccountAvatar size="lg" /><div className="min-w-0"><p className="font-semibold">Your current avatar</p><p className="mt-1 text-xs text-muted-foreground">Displayed across Streamly</p><button type="button" disabled={avatarSaving} onClick={() => void saveAvatar("")} className="mt-2 text-xs font-semibold text-primary hover:underline">Reset to username initial</button></div></div>
            <div className="mt-6 flex gap-2 border-b border-border pb-2" role="tablist" aria-label="Avatar options">
              <button role="tab" aria-selected={avatarTab === "anime"} onClick={() => setAvatarTab("anime")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${avatarTab === "anime" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Anime characters</button>
              <button role="tab" aria-selected={avatarTab === "upload"} onClick={() => setAvatarTab("upload")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${avatarTab === "upload" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Upload your own</button>
            </div>
            {avatarTab === "anime" && <div className="pt-5">
              <h3 className="mb-3 text-sm font-bold">Choose an anime</h3>
              <div className="flex gap-2 overflow-x-auto pb-3" role="group" aria-label="Anime series">
                {avatarShows.map((show) => <button type="button" key={show.mediaId} onClick={() => { setSelectedShow(show.mediaId); setAvatarSearch(""); }} aria-pressed={selectedShow === show.mediaId} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition ${selectedShow === show.mediaId ? "border-primary bg-primary/15 text-primary" : "border-border bg-muted/30 hover:border-primary"}`}>{show.title}</button>)}
              </div>
              <label className="mt-2 block"><span className="sr-only">Search characters</span><input type="search" value={avatarSearch} onChange={(event) => setAvatarSearch(event.target.value)} placeholder="Find a character…" className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary" /></label>
              {avatarsLoading && <p className="py-8 text-center text-sm text-muted-foreground">Loading character avatars…</p>}
              {avatarsError && <div className="py-8 text-center text-sm text-muted-foreground">Could not load characters. <button type="button" onClick={() => void retryAvatars()} className="text-primary underline">Retry</button></div>}
              {!avatarsLoading && !avatarsError && <div className="mt-4 grid max-h-[430px] grid-cols-3 gap-3 overflow-y-auto rounded-lg border border-border bg-background/40 p-3 sm:grid-cols-4 lg:grid-cols-5">{visibleCharacters.map((character) => <button type="button" key={character.id} disabled={avatarSaving} onClick={() => void saveAvatar("", character.image)} aria-label={`Choose ${character.name}`} title={character.name} className="group min-w-0 text-center"><span className={`mx-auto block aspect-square w-full max-w-24 overflow-hidden rounded-full border-[3px] transition group-hover:scale-105 group-hover:border-primary ${selectedAvatar === character.image ? "border-primary" : "border-border"}`}><img src={character.image} alt="" loading="lazy" className="h-full w-full object-cover" /></span><span className="mt-1.5 block truncate text-xs text-muted-foreground group-hover:text-foreground">{character.name}</span></button>)}{!visibleCharacters.length && <p className="col-span-full py-6 text-center text-sm text-muted-foreground">No matching characters found.</p>}</div>}
            </div>}
            {avatarTab === "upload" && <div className="mt-5 rounded-xl border border-dashed border-primary/50 bg-primary/5 p-6 text-center"><div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-2xl">↑</div><h3 className="font-bold">Upload a custom avatar</h3><p className="mt-2 text-sm text-muted-foreground">JPG, PNG or WebP, up to 5 MB. Images are displayed as circles.</p><label className="mt-4 inline-flex cursor-pointer rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"><input type="file" accept="image/jpeg,image/png,image/webp" disabled={avatarSaving} className="sr-only" onChange={(event) => { void uploadAvatar(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />{avatarSaving ? "Saving…" : "Choose image"}</label></div>}
            {avatarMessage && <p role="status" className="mt-4 rounded-lg bg-muted p-3 text-sm">{avatarMessage}</p>}
          </> : <p className="mt-5 text-sm text-muted-foreground">Sign in to customise your avatar.</p>}
        </section>}
        {settingsTab === "playback" && <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h2 className="text-xl font-bold">Preferred audio language</h2>
          <p className="mt-2 text-sm text-muted-foreground">Choose the audio Streamly selects automatically. You can still change it for individual episodes.</p>
          <div className="mt-5 space-y-3">{choices.map((choice) => <label key={choice.value} className={"flex cursor-pointer gap-3 rounded-lg border p-4 " + (preference === choice.value ? "border-primary bg-primary/10" : "border-border")}>
            <input type="radio" name="audio" value={choice.value} checked={preference === choice.value} onChange={() => setPreference(choice.value)} className="accent-primary" />
            <span><strong className="block">{choice.label}</strong><span className="mt-1 block text-sm text-muted-foreground">{choice.detail}</span></span>
          </label>)}</div>
          <p className="mt-4 text-xs text-muted-foreground">Saved on this device. Audio and subtitle availability varies by anime and episode.</p>
        </section>}
        {settingsTab === "security" && <section className="rounded-xl border border-red-500/30 bg-card p-4 sm:p-6">
          <h2 className="text-xl font-bold">Delete your account</h2>
          <p className="mt-2 text-sm text-muted-foreground">Permanently delete your Streamly account. This cannot be undone. You must enter your password, one unused account recovery code and type DELETE to confirm.</p>
          {!user ? <p className="mt-5 text-sm">Sign in to manage your account.</p> : <form className="mt-6 space-y-4" onSubmit={async (event) => {
            event.preventDefault(); if (deleteBusy || deleteConfirmation !== "DELETE") return;
            setDeleteBusy(true); setDeleteError("");
            try {
              const session = await supabase.auth.getSession();
              if (!session.data.session?.access_token) throw new Error("Sign in again to continue.");
              const response = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.data.session.access_token}` }, body: JSON.stringify({ password: deletePassword, recoveryCode: deleteCode, confirmation: deleteConfirmation }) });
              const result = await response.json();
              if (!response.ok) throw new Error(result.error || "Could not delete account.");
              await supabase.auth.signOut();
              window.location.assign("/");
            } catch (error) { setDeleteError(error instanceof Error ? error.message : "Could not delete account."); }
            finally { setDeleteBusy(false); }
          }}>
            <label className="block text-sm font-semibold">Current password<input required type="password" autoComplete="current-password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} className="mt-2 block w-full rounded-lg border border-border bg-background p-3" /></label>
            <label className="block text-sm font-semibold">Unused recovery code<input required type="text" autoComplete="off" value={deleteCode} onChange={(event) => setDeleteCode(event.target.value)} className="mt-2 block w-full rounded-lg border border-border bg-background p-3" /></label>
            <label className="block text-sm font-semibold">Type DELETE to confirm<input required type="text" autoComplete="off" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} className="mt-2 block w-full rounded-lg border border-border bg-background p-3" /></label>
            {deleteError && <p role="alert" className="text-sm text-red-400">{deleteError}</p>}
            <button type="submit" disabled={deleteBusy || deleteConfirmation !== "DELETE"} className="rounded-lg bg-red-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">{deleteBusy ? "Deleting account…" : "Permanently delete account"}</button>
          </form>}
        </section>}
      </div>
    </div>
  </main>;
}
