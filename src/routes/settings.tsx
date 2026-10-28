import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAccountIdentity, updateAccountIdentity } from "@/lib/accounts.functions";
import { usernameSchema, passwordSchema } from "@/lib/account-schema";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  { title: "JoJo’s Bizarre Adventure", mediaId: 14719 },
  { title: "Hellsing", mediaId: 270 },
  { title: "Tokyo Ghoul", mediaId: 20605 },
  { title: "Cyberpunk: Edgerunners", mediaId: 120377 },
  { title: "Cyberpunk: Edgerunners 2", mediaId: 195539 },
];
async function fetchCharacterAvatars(mediaId: number, page: number): Promise<{ characters: CharacterAvatar[]; hasNextPage: boolean }> {
  const query = `query ($id: Int, $page: Int) {
    Media(id: $id, type: ANIME) {
      characters(page: $page, perPage: 50, sort: [ROLE, RELEVANCE, ID]) {
        pageInfo { hasNextPage }
        nodes { id name { full } image { large } }
      }
    }
  }`;
  const response = await fetch("https://graphql.anilist.co", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables: { id: mediaId, page } }),
  });
  if (!response.ok) throw new Error("Unable to load characters. Try again.");
  const json = await response.json();
  if (json.errors?.length) throw new Error("Unable to load characters. Try again.");
  const connection = json.data?.Media?.characters;
  const characters: CharacterAvatar[] = (connection?.nodes ?? [])
    .filter((character: { id: number; name?: { full?: string }; image?: { large?: string } }) => character.image?.large && character.name?.full)
    .map((character: { id: number; name: { full: string }; image: { large: string } }) => ({
      id: character.id, name: character.name.full, image: character.image.large,
    }));
  return { characters, hasNextPage: Boolean(connection?.pageInfo?.hasNextPage) };
}
async function searchAvatarAnime(term: string): Promise<{ title: string; mediaId: number; image: string | null }[]> {
  if (term.trim().length < 2) return [];
  const query = `query ($search: String) {
    Page(page: 1, perPage: 25) {
      media(type: ANIME, search: $search, isAdult: false, sort: SEARCH_MATCH) {
        id title { english romaji } coverImage { medium }
      }
    }
  }`;
  const response = await fetch("https://graphql.anilist.co", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables: { search: term.trim() } }),
  });
  if (!response.ok) throw new Error("Unable to search anime.");
  const json = await response.json();
  if (json.errors?.length) throw new Error("Unable to search anime.");
  return (json.data?.Page?.media ?? []).map((media: { id: number; title: { english?: string; romaji: string }; coverImage?: { medium?: string } }) => ({
    mediaId: media.id, title: media.title.english || media.title.romaji, image: media.coverImage?.medium ?? null,
  }));
}
export const Route = createFileRoute("/settings")({ component: Settings, head: () => ({ meta: [{ title: "Settings — Streamly" }] }) });
function Settings() {
  const { preference, setPreference } = useAudioPreference();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [bannerUrl, setBannerUrl] = useState(() => typeof user?.user_metadata?.profile_banner_url === "string" ? user.user_metadata.profile_banner_url : "");
  const [bannerMessage, setBannerMessage] = useState("");
  const [bannerSaving, setBannerSaving] = useState(false);
  const saveBanner = async () => {
    if (!user) return;
    const value = bannerUrl.trim();
    if (value && (!value.startsWith("https://") || value.length > 2000)) { setBannerMessage("Enter a valid HTTPS image URL (maximum 2,000 characters)."); return; }
    setBannerSaving(true);
    const { error } = await supabase.auth.updateUser({ data: { profile_banner_url: value || null } });
    setBannerSaving(false);
    setBannerMessage(error ? error.message : "Profile banner saved.");
  };
  const fetchIdentity = useServerFn(getAccountIdentity);
  const updateIdentity = useServerFn(updateAccountIdentity);
  const [accountName, setAccountName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [identityStatus, setIdentityStatus] = useState("");
  const [identityBusy, setIdentityBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  useEffect(() => {
    if (!user) return;
    let active = true;
    void fetchIdentity().then((value) => { if (active) { setAccountName(value.username); setAccountEmail(value.email); } }).catch(() => {});
    return () => { active = false; };
  }, [user?.id]);
  const [settingsTab, setSettingsTab] = useState<"profile" | "playback" | "security" | "display">("profile");
  const [displayPrefs,setDisplayPrefs]=useState<Record<string,boolean>>({});
  useEffect(()=>{try{setDisplayPrefs(JSON.parse(localStorage.getItem("streamly-display-preferences")||"{}"));}catch{}},[]);
  const toggleDisplay=(key:string)=>{const next={...displayPrefs,[key]:!displayPrefs[key]};setDisplayPrefs(next);localStorage.setItem("streamly-display-preferences",JSON.stringify(next));};
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [avatarTab, setAvatarTab] = useState<"anime" | "upload">("anime");
  const [selectedShow, setSelectedShow] = useState(113415);
  const [avatarSearch, setAvatarSearch] = useState("");
  const [animeAvatarSearch, setAnimeAvatarSearch] = useState("");
  const [avatarPage, setAvatarPage] = useState(1);
  const [customAvatarShow, setCustomAvatarShow] = useState<{ title: string; mediaId: number } | null>(null);
  const [avatarMessage, setAvatarMessage] = useState("");
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarChoice, setAvatarChoice] = useState<string | null>(null);
  const [debouncedAnimeSearch, setDebouncedAnimeSearch] = useState("");
  useEffect(() => { const timer = setTimeout(() => setDebouncedAnimeSearch(animeAvatarSearch), 350); return () => clearTimeout(timer); }, [animeAvatarSearch]);
  const { data: animeMatches = [], isFetching: searchingAnime } = useQuery({
    queryKey: ["avatar-anime-search", debouncedAnimeSearch],
    queryFn: () => searchAvatarAnime(debouncedAnimeSearch),
    enabled: debouncedAnimeSearch.trim().length >= 2,
    staleTime: 10 * 60 * 1000,
  });
  const { data: animeAvatars, isPending: avatarsLoading, isError: avatarsError, refetch: retryAvatars } = useQuery({
    queryKey: ["anime-avatar-pages", selectedShow, avatarPage],
    queryFn: async () => {
      const pages = await Promise.all(Array.from({ length: avatarPage }, (_, index) => fetchCharacterAvatars(selectedShow, index + 1)));
      const seen = new Set<number>();
      return { characters: pages.flatMap((page) => page.characters).filter((character) => {
        if (seen.has(character.id)) return false;
        seen.add(character.id);
        return true;
      }), hasNextPage: pages.at(-1)?.hasNextPage ?? false };
    },
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
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
  const visibleCharacters = animeAvatars?.characters.filter((character) => character.name.toLowerCase().includes(avatarSearch.trim().toLowerCase())) ?? [];
  const selectedAvatar = avatarChoice ?? (typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : "");
  return <main className="mx-auto max-w-5xl px-4 pb-24 pt-32 sm:px-6 md:pt-28">
    <div className="mb-7"><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Your Streamly account</p><h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Settings</h1><p className="mt-2 text-sm text-muted-foreground">Personalise your profile and watching experience.</p></div>
    <div className="grid gap-6 md:grid-cols-[230px_minmax(0,1fr)]">
      <nav aria-label="Settings categories" className="flex h-fit gap-2 overflow-x-auto rounded-2xl border border-border bg-card/80 p-2 shadow-xl shadow-black/10 md:sticky md:top-28 md:flex-col">
        <button type="button" onClick={() => setSettingsTab("profile")} aria-current={settingsTab === "profile" ? "page" : undefined} className={`whitespace-nowrap rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${settingsTab === "profile" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>Profile & avatar</button>
        <button type="button" onClick={() => setSettingsTab("playback")} aria-current={settingsTab === "playback" ? "page" : undefined} className={`whitespace-nowrap rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${settingsTab === "playback" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>Language & playback</button>
        <button type="button" onClick={() => setSettingsTab("security")} aria-current={settingsTab === "security" ? "page" : undefined} className={`whitespace-nowrap rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${settingsTab === "security" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>Account & security</button>
        <button type="button" onClick={() => setSettingsTab("display")} aria-current={settingsTab === "display" ? "page" : undefined} className={`whitespace-nowrap rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${settingsTab === "display" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>Display & preferences</button>
      </nav>
      <div className="min-w-0">
        {settingsTab === "display" && <section className="rounded-2xl border border-border bg-card/90 p-6"><h2 className="text-xl font-bold">Display & preferences</h2><p className="mt-2 text-sm text-muted-foreground">Save personal preferences on this device. These options are stored locally; they do not yet change player behaviour across the site.</p><div className="mt-6 space-y-4">{[["compact","Compact cards"],["reduceAnimations","Reduce decorative animations"],["showRatings","Show anime ratings"],["showDescriptions","Show full descriptions"],["dimWatched","Dim watched episodes"],["showComments","Show comments"],["autoNext","Auto next episode"],["skipIntro","Skip intros"],["skipOutro","Skip outros"],["autoPlay","Auto play"],["notifications","Episode notifications"]].map(([key,label])=><label key={key} className="flex items-center justify-between gap-4 rounded-xl border border-border p-4 text-sm"><span>{label}</span><input type="checkbox" checked={!!displayPrefs[key]} onChange={()=>toggleDisplay(key)} className="h-5 w-5 accent-primary"/></label>)}</div></section>}
        {settingsTab === "profile" && <section className="rounded-2xl border border-border bg-card/90 p-4 shadow-xl shadow-black/10 sm:p-7">
          <div className="mb-7 rounded-xl border border-border bg-background/50 p-4">
            <h2 className="text-lg font-bold">Profile banner</h2>
            <p className="mt-1 text-xs text-muted-foreground">Add an HTTPS image URL for the banner at the top of your profile. Wide images work best.</p>
            {bannerUrl.trim().startsWith("https://") && <img src={bannerUrl.trim()} alt="Banner preview" className="mt-3 h-32 w-full rounded-lg object-cover" onError={() => setBannerMessage("Could not preview this image. Check the URL.")} />}
            <label htmlFor="profile-banner-url" className="mt-3 block text-xs font-semibold">Banner image URL</label>
            <input id="profile-banner-url" type="url" value={bannerUrl} onChange={(e) => { setBannerUrl(e.target.value); setBannerMessage(""); }} placeholder="https://example.com/banner.jpg" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <div className="mt-3 flex items-center gap-3"><button type="button" onClick={() => void saveBanner()} disabled={!user || bannerSaving} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">{bannerSaving ? "Saving…" : "Save banner"}</button><button type="button" onClick={() => { setBannerUrl(""); setBannerMessage(""); }} className="text-xs text-muted-foreground hover:text-primary">Clear</button></div>
            {bannerMessage && <p role="status" className="mt-2 text-xs text-muted-foreground">{bannerMessage}</p>}
          </div>
          <h2 className="text-xl font-bold">Profile picture</h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose a character or upload a picture of your own.</p>
          {user ? <>
            <div className="mt-5 flex items-center gap-4 rounded-xl border border-border bg-muted/30 p-4"><AccountAvatar size="lg" /><div className="min-w-0"><p className="font-semibold">Your current avatar</p><p className="mt-1 text-xs text-muted-foreground">Displayed across Streamly</p><button type="button" disabled={avatarSaving} onClick={() => void saveAvatar("")} className="mt-2 text-xs font-semibold text-primary hover:underline">Reset to username initial</button></div></div>
            <div className="mt-6 flex gap-2 border-b border-border pb-2" role="tablist" aria-label="Avatar options">
              <button role="tab" aria-selected={avatarTab === "anime"} onClick={() => setAvatarTab("anime")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${avatarTab === "anime" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Anime characters</button>
              <button role="tab" aria-selected={avatarTab === "upload"} onClick={() => setAvatarTab("upload")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${avatarTab === "upload" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Upload your own</button>
            </div>
            {avatarTab === "anime" && <div className="pt-5">
              <h3 className="mb-1 text-lg font-bold">Anime character library</h3>
              <p className="mb-4 text-xs text-muted-foreground">Search any anime, choose its cast, then select a portrait. Browse more characters with Load more.</p>
              <label className="block"><span className="sr-only">Search anime titles for avatars</span><input type="search" value={animeAvatarSearch} onChange={(event) => setAnimeAvatarSearch(event.target.value)} placeholder="Search any anime, e.g. JoJo, Naruto, Bleach…" className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" /></label>
              {animeAvatarSearch.trim().length >= 2 && <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-border bg-background p-2">
                {searchingAnime && <p className="px-3 py-2 text-xs text-muted-foreground">Searching anime…</p>}
                {animeMatches.map((show) => <button type="button" key={show.mediaId} onClick={() => { setSelectedShow(show.mediaId); setCustomAvatarShow({ title: show.title, mediaId: show.mediaId }); setAvatarPage(1); setAvatarSearch(""); setAnimeAvatarSearch(""); }} className="flex w-full items-center gap-3 rounded-lg p-2 text-left text-sm hover:bg-primary/10 focus-visible:outline-primary">{show.image && <img src={show.image} alt="" loading="lazy" className="h-12 w-9 rounded object-cover" />}<span className="line-clamp-2">{show.title}</span></button>)}
                {!searchingAnime && !animeMatches.length && <p className="px-3 py-2 text-xs text-muted-foreground">No matching anime found.</p>}
              </div>}
              <h4 className="mb-3 mt-5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Popular anime</h4>
              <div className="flex gap-2 overflow-x-auto pb-3" role="group" aria-label="Anime series">
                {avatarShows.map((show) => <button type="button" key={show.mediaId} onClick={() => { setSelectedShow(show.mediaId); setCustomAvatarShow(null); setAvatarPage(1); setAvatarSearch(""); }} aria-pressed={selectedShow === show.mediaId} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition ${selectedShow === show.mediaId ? "border-primary bg-primary/15 text-primary" : "border-border bg-muted/30 hover:border-primary"}`}>{show.title}</button>)}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3"><h4 className="font-semibold">{customAvatarShow?.mediaId === selectedShow ? customAvatarShow.title : avatarShows.find((show) => show.mediaId === selectedShow)?.title}</h4><span className="text-xs text-muted-foreground">{animeAvatars?.characters.length ?? 0} characters loaded</span></div>
              <label className="mt-3 block"><span className="sr-only">Search characters</span><input type="search" value={avatarSearch} onChange={(event) => setAvatarSearch(event.target.value)} placeholder="Find a character…" className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary" /></label>
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
        {settingsTab === "security" && <div className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
            <h2 className="text-xl font-bold">Account details</h2>
            <p className="mt-2 text-sm text-muted-foreground">Change your Streamly username or optional recovery email. Your username is what other people see and use to sign in.</p>
            <form className="mt-5 space-y-4" onSubmit={async (event) => {
              event.preventDefault(); setIdentityStatus(""); setIdentityBusy(true);
              try {
                const name = usernameSchema.parse(accountName);
                const saved = await updateIdentity({ data: { username: name, email: accountEmail.trim() } });
                setAccountName(saved.username); setAccountEmail(saved.email ?? "");
                await queryClient.invalidateQueries({ queryKey: ["account-identity", user?.id] });
                setIdentityStatus("Account details saved. Your new username is ready to use. Refresh if the header hasn't updated yet.");
              } catch (error) { setIdentityStatus(error instanceof Error ? error.message : "Couldn't save changes."); }
              finally { setIdentityBusy(false); }
            }}>
              <label className="block text-sm font-semibold">Username<input required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]+" autoComplete="username" value={accountName} onChange={(e) => setAccountName(e.target.value)} className="mt-2 block w-full rounded-lg border border-border bg-background p-3" /></label>
              <label className="block text-sm font-semibold">Recovery email (optional)<input type="email" autoComplete="email" value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} placeholder="you@example.com" className="mt-2 block w-full rounded-lg border border-border bg-background p-3" /></label>
              <p className="text-xs text-muted-foreground">Recovery email is optional. Streamly still uses your username to sign in. Changing these details doesn't require your old password, but you must be signed in.</p>
              <button disabled={identityBusy || !accountName} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">{identityBusy ? "Saving…" : "Save account details"}</button>
              {identityStatus && <p role="status" className="text-sm text-muted-foreground">{identityStatus}</p>}
            </form>
          </section>
          <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
            <h2 className="text-xl font-bold">Change password</h2>
            <p className="mt-2 text-sm text-muted-foreground">Choose a new password of at least 12 characters. No old password is needed while signed in.</p>
            <form className="mt-4 space-y-4" onSubmit={async (event) => {
              event.preventDefault(); setPasswordStatus("");
              if (newPassword !== confirmNewPassword) { setPasswordStatus("Passwords don't match."); return; }
              setPasswordBusy(true);
              try {
                passwordSchema.parse(newPassword);
                const { error } = await supabase.auth.updateUser({ password: newPassword });
                if (error) throw error;
                setNewPassword(""); setConfirmNewPassword(""); setPasswordStatus("Password updated successfully.");
              } catch (error) { setPasswordStatus(error instanceof Error ? error.message : "Couldn't change password."); }
              finally { setPasswordBusy(false); }
            }}>
              <label className="block text-sm font-semibold">New password<input required type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-2 block w-full rounded-lg border border-border bg-background p-3" /></label>
              <label className="block text-sm font-semibold">Confirm new password<input required type="password" autoComplete="new-password" minLength={12} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className="mt-2 block w-full rounded-lg border border-border bg-background p-3" /></label>
              <button disabled={passwordBusy} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">{passwordBusy ? "Updating…" : "Update password"}</button>
              {passwordStatus && <p role="status" className="text-sm text-muted-foreground">{passwordStatus}</p>}
            </form>
          </section>
          <section className="rounded-xl border border-red-500/30 bg-card p-4 sm:p-6">
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
        </section></div>}
      </div>
    </div>
  </main>;
}
