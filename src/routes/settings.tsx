import "./settings-reanime.css";
import { UserRound, Settings2, RefreshCw, LockKeyhole } from "lucide-react";
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
const SETTINGS_SECTIONS = ["profile", "playback", "sync", "security"] as const;
function useActiveSettingsSection(setActive: (section: typeof SETTINGS_SECTIONS[number]) => void) {
  useEffect(() => {
    const container = document.getElementById("settings-scroll-content");
    if (!container) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const top = container.getBoundingClientRect().top;
        let active: typeof SETTINGS_SECTIONS[number] = "profile";
        for (const section of SETTINGS_SECTIONS) {
          const element = document.getElementById("settings-section-" + section);
          if (element && element.getBoundingClientRect().top <= top + 120) active = section;
        }
        if (container.scrollHeight - container.scrollTop - container.clientHeight < 24) active = "security";
        setActive(active);
      });
    };
    container.addEventListener("scroll", update, { passive: true });
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => { cancelAnimationFrame(frame); container.removeEventListener("scroll", update); window.removeEventListener("scroll", update); };
  }, [setActive]);
}
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
  const { user, username } = useAuth();
  const queryClient = useQueryClient();
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState("");
  const privacySettings = useQuery({
    queryKey: ["settings-profile-privacy", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("show_watchlist, show_history").eq("id", user!.id).single();
      if (error) throw error;
      return data as { show_watchlist: boolean | null; show_history: boolean | null };
    },
  });
  const updateProfilePrivacy = async (field: "show_watchlist" | "show_history", value: boolean) => {
    if (!user || privacyBusy) return;
    setPrivacyBusy(true);
    setPrivacyMessage("");
    const { error } = await supabase.from("profiles").update({ [field]: value }).eq("id", user.id);
    setPrivacyBusy(false);
    if (error) setPrivacyMessage(error.message);
    else {
      setPrivacyMessage("Privacy preferences saved.");
      void queryClient.invalidateQueries({ queryKey: ["settings-profile-privacy", user.id] });
      void queryClient.invalidateQueries({ queryKey: ["public-profile"] });
    }
  };


  const [bannerUrl, setBannerUrl] = useState(() => typeof user?.user_metadata?.["profile_banner_url"] === "string" ? user.user_metadata["profile_banner_url"] : "");
  const [bannerMessage, setBannerMessage] = useState("");
  const [bannerSaving, setBannerSaving] = useState(false);
  const saveBanner = async () => {
    if (!user) return;
    const value = bannerUrl.trim();
    if (value && (!value.startsWith("https://") || value.length > 2000)) { setBannerMessage("Enter a valid HTTPS image URL (maximum 2,000 characters)."); return; }
    setBannerSaving(true);
    const { error } = await supabase.auth.updateUser({ data: { profile_banner_url: value || null } });
    if (!error) await supabase.from("profiles").update({ public_banner_url: value || null }).eq("id", user.id);
    setBannerSaving(false);
    setBannerMessage(error ? error.message : "Profile banner saved.");
  };
  const uploadBanner = async (file?: File) => {
    if (!file || !user) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setBannerMessage("Choose a JPG, PNG or WebP image."); return; }
    if (file.size > 5 * 1024 * 1024) { setBannerMessage("Banner must be smaller than 5 MB."); return; }
    setBannerSaving(true);
    setBannerMessage("");
    try {
      const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
      const path = user.id + "/banners/" + crypto.randomUUID() + "." + extension;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: authError } = await supabase.auth.updateUser({ data: { profile_banner_url: data.publicUrl } });
      if (authError) throw authError;
      const { error: profileError } = await supabase.from("profiles").update({ public_banner_url: data.publicUrl }).eq("id", user.id);
      if (profileError) throw profileError;
      setBannerUrl(data.publicUrl);
      setBannerMessage("Profile banner uploaded and saved.");
    } catch (error) { setBannerMessage(error instanceof Error ? error.message : "Banner upload failed."); }
    finally { setBannerSaving(false); }
  };
  const fetchIdentity = useServerFn(getAccountIdentity);
  const updateIdentity = useServerFn(updateAccountIdentity);
  const [accountName, setAccountName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [identityStatus, setIdentityStatus] = useState("");
  const [identityBusy, setIdentityBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  useEffect(() => {
    if (!user) return;
    setDisplayName(typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : "");
    let active = true;
    void fetchIdentity().then((value) => { if (active) { setAccountName(value.username); setAccountEmail(value.email); } }).catch(() => {});
    return () => { active = false; };
  }, [user?.id]);
  const [settingsTab, setSettingsTab] = useState<"profile" | "playback" | "security" | "display" | "titles" | "sync">("profile");
  useActiveSettingsSection(setSettingsTab);
  const titleDefaults: Record<string, { main: string[]; supporting: string[] }> = {
    Default: { main: ["English", "Romaji", "Native"], supporting: ["Romaji"] },
    Japanese: { main: ["English", "Romaji", "Native"], supporting: ["Romaji"] },
    Korean: { main: ["English", "Romaji", "Native"], supporting: ["Native"] },
    Chinese: { main: ["English", "Romaji", "Native"], supporting: ["Native"] },
  };
  const [titlePrefs, setTitlePrefs] = useState(titleDefaults);
  const [titleSaved, setTitleSaved] = useState(false);
  useEffect(() => { try { const stored = JSON.parse(localStorage.getItem("streamly-title-preferences") || "null"); if (stored && typeof stored === "object") setTitlePrefs({ ...titleDefaults, ...stored }); } catch {} }, []);
  const changeTitle = (region: string, field: "main" | "supporting", index: number, value: string) => {
    setTitleSaved(false);
    setTitlePrefs(prev => ({ ...prev, [region]: { ...prev[region], [field]: prev[region][field].map((item, i) => i === index ? value : item) } }));
  };
  const addTitle = (region: string, field: "main" | "supporting") => { setTitleSaved(false); setTitlePrefs(prev => ({ ...prev, [region]: { ...prev[region], [field]: [...prev[region][field], "English"] } })); };
  const removeTitle = (region: string, field: "main" | "supporting", index: number) => { setTitleSaved(false); setTitlePrefs(prev => ({ ...prev, [region]: { ...prev[region], [field]: prev[region][field].filter((_, i) => i !== index) } })); };
  const moveTitle = (region: string, field: "main" | "supporting", index: number, direction: number) => {
    const next = [...titlePrefs[region][field]]; const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setTitleSaved(false); setTitlePrefs(prev => ({ ...prev, [region]: { ...prev[region], [field]: next } }));
  };
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
      const { error: profileError } = await supabase.from("profiles").update({ public_avatar_url: data.publicUrl }).eq("id", user.id);
      if (profileError) throw profileError;
      setAvatarChoice(data.publicUrl); setAvatarMessage("Avatar updated!");
    } catch (error) { setAvatarMessage(error instanceof Error ? error.message : "Upload failed."); }
    finally { setAvatarSaving(false); }
  };
  const saveAvatar = async (emoji: string, url?: string) => {
    setAvatarSaving(true); setAvatarMessage("");
    const { error } = await supabase.auth.updateUser({ data: { avatar_emoji: url ? "" : emoji, avatar_url: url ?? null } });
    if (!error && user) await supabase.from("profiles").update({ public_avatar_url: url ?? null }).eq("id", user.id);
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
  return <main className="streamly-settings mx-auto max-w-5xl px-4 pb-24 pt-32 sm:px-6 md:pt-28">
    <div className="streamly-settings-heading"><span>STREAMLY / SETTINGS</span><h1>{settingsTab === "profile" ? "Account" : settingsTab === "playback" || settingsTab === "display" || settingsTab === "titles" ? "Preferences" : settingsTab === "sync" ? "Sync" : "Security"}</h1></div>
    <div className="streamly-settings-grid grid gap-6 md:grid-cols-[230px_minmax(0,1fr)]">
      <nav aria-label="Settings categories" className="streamly-settings-nav flex h-fit gap-2 overflow-x-auto rounded-2xl border border-border bg-card/80 p-2 shadow-xl shadow-black/10 md:sticky md:top-28 md:flex-col">
        <button type="button" onClick={() => { setSettingsTab("profile"); document.getElementById("settings-section-profile")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} aria-current={settingsTab === "profile" ? "page" : undefined} className={`whitespace-nowrap rounded-lg px-4 py-3 text-left text-sm font-semibold transition flex items-center gap-2.5 ${settingsTab === "profile" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><UserRound className="h-4 w-4 shrink-0" aria-hidden="true" /><span>Account</span></button>
        <button type="button" onClick={() => { setSettingsTab("playback"); document.getElementById("settings-section-playback")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} aria-current={settingsTab === "playback" ? "page" : undefined} className={`whitespace-nowrap rounded-lg px-4 py-3 text-left text-sm font-semibold transition flex items-center gap-2.5 ${settingsTab === "playback" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Settings2 className="h-4 w-4 shrink-0" aria-hidden="true" /><span>Preferences</span></button>
        <button type="button" onClick={() => { setSettingsTab("sync"); document.getElementById("settings-section-sync")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} aria-current={settingsTab === "sync" ? "page" : undefined} className={`whitespace-nowrap rounded-lg px-4 py-3 text-left text-sm font-semibold transition flex items-center gap-2.5 ${settingsTab === "sync" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" /><span>Sync</span></button>
        <button type="button" onClick={() => { setSettingsTab("security"); document.getElementById("settings-section-security")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} aria-current={settingsTab === "security" ? "page" : undefined} className={`whitespace-nowrap rounded-lg px-4 py-3 text-left text-sm font-semibold transition flex items-center gap-2.5 ${settingsTab === "security" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><LockKeyhole className="h-4 w-4 shrink-0" aria-hidden="true" /><span>Security</span></button>
        <div className="streamly-settings-account-info mt-auto hidden border-t border-border/60 px-3 pt-5 text-[11px] text-muted-foreground md:block">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest">Account info</p>
          <p className="font-semibold">Username</p>
          <p className="mb-3 break-words text-[11px] text-foreground">{user ? (accountName || username || "Loading…") : "Not signed in"}</p>
          <p className="font-semibold">Recovery email</p>
          <p className="mb-3 break-words text-[11px]">{user ? (accountEmail || "Not set") : "Not signed in"}</p>
          <p className="font-semibold">Status</p>
          <p className="font-semibold text-foreground"><span className="mr-1 text-primary">●</span>{user ? user.email_confirmed_at ? "Verified" : "Unverified" : "Guest"}</p>
        </div>
      </nav>
      <div className="streamly-settings-content min-w-0" id="settings-scroll-content">
        {true && <section id="settings-section-profile" className="rounded-2xl border border-border bg-card/90 p-4 shadow-xl shadow-black/10 sm:p-7"><h2 className="mb-6 text-3xl font-bold">Account</h2>
          <div className="mb-7 rounded-xl border border-border bg-background/50 p-4">
            <h3 className="text-lg font-bold">Profile privacy</h3>
            <p className="mt-1 text-sm text-muted-foreground">Choose what other people can see on your public profile. Both options are private by default.</p>
            {user ? <div className="mt-4 space-y-3">
              <label className="flex cursor-pointer items-center gap-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" disabled={privacyBusy || privacySettings.isPending} checked={!!privacySettings.data?.show_watchlist} onChange={(event) => void updateProfilePrivacy("show_watchlist", event.target.checked)} /> Public watchlist</label>
              <label className="flex cursor-pointer items-center gap-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" disabled={privacyBusy || privacySettings.isPending} checked={!!privacySettings.data?.show_history} onChange={(event) => void updateProfilePrivacy("show_history", event.target.checked)} /> Public viewing history and episode stats</label>
              {privacyMessage && <p role="status" className="text-xs text-muted-foreground">{privacyMessage}</p>}
              {privacySettings.isError && <p role="alert" className="text-xs text-red-400">Unable to load privacy preferences.</p>}
            </div> : <p className="mt-3 text-sm text-muted-foreground">Sign in to change privacy preferences.</p>}
          </div>
          <div className="mb-7 rounded-xl border border-border bg-background/50 p-4">
            <h2 className="text-lg font-bold">Profile banner</h2>
            <p className="mt-1 text-xs text-muted-foreground">Upload a wide JPG, PNG or WebP image (up to 5 MB), or paste an HTTPS image URL.</p>
            {bannerUrl.trim().startsWith("https://") && <img src={bannerUrl.trim()} alt="Banner preview" className="mt-3 h-32 w-full rounded-lg object-cover" onError={() => setBannerMessage("Could not preview this image. Check the URL.")} />}
            <label htmlFor="profile-banner-upload" className="mt-3 block text-xs font-semibold">Upload banner image</label>
            <input id="profile-banner-upload" type="file" accept="image/jpeg,image/png,image/webp" disabled={!user || bannerSaving} onChange={(e) => { const file = e.currentTarget.files?.[0]; if (file) void uploadBanner(file); e.currentTarget.value = ""; }} className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:font-semibold file:text-primary-foreground disabled:opacity-50" />
            <p className="mt-2 text-xs text-muted-foreground">A wide landscape image works best. Uploading automatically saves your new banner.</p>
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
        {true && <section id="settings-section-playback" className="rounded-xl border border-border bg-card p-4 sm:p-6"><h2 className="mb-5 text-3xl font-bold">Preferences</h2>
          <h2 className="text-xl font-bold">Preferred audio language</h2>
          <p className="mt-2 text-sm text-muted-foreground">Choose the audio Streamly selects automatically. You can still change it for individual episodes.</p>
          <div className="mt-5 space-y-3">{choices.map((choice) => <label key={choice.value} className={"flex cursor-pointer gap-3 rounded-lg border p-4 " + (preference === choice.value ? "border-primary bg-primary/10" : "border-border")}>
            <input type="radio" name="audio" value={choice.value} checked={preference === choice.value} onChange={() => setPreference(choice.value)} className="accent-primary" />
            <span><strong className="block">{choice.label}</strong><span className="mt-1 block text-sm text-muted-foreground">{choice.detail}</span></span>
          </label>)}</div>
          <p className="mt-4 text-xs text-muted-foreground">Saved on this device. Audio and subtitle availability varies by anime and episode.</p>
        </section>}
        {true && <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-extrabold">Title preferences</h2><p className="mt-1 text-sm text-muted-foreground">Choose your preferred language order for main and supporting anime titles.</p></div><div className="flex gap-2"><button type="button" className="rounded-lg border border-border px-4 py-2 text-sm font-semibold" onClick={() => { setTitlePrefs(titleDefaults); setTitleSaved(false); }}>Reset</button><button type="button" className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground" onClick={() => { localStorage.setItem("streamly-title-preferences", JSON.stringify(titlePrefs)); setTitleSaved(true); }}>Save</button></div></div>
          <p className="text-xs text-muted-foreground">Preferences are saved on this device. Applying these choices throughout search results and anime pages requires a separate integration.</p>
          {titleSaved && <p role="status" className="text-sm text-primary">Title preferences saved on this device.</p>}
          {Object.entries(titlePrefs).map(([region, config]) => <div key={region} className="rounded-2xl border border-border bg-card/90 p-5 sm:p-6"><h3 className="text-xl font-bold">{region === "Japanese" ? "🇯🇵 " : region === "Korean" ? "🇰🇷 " : region === "Chinese" ? "🇨🇳 " : ""}{region}</h3><p className="mt-1 text-xs text-muted-foreground">{region === "Default" ? "Fallback order for anime from any original language." : `Preferred title order for anime originally in ${region}.`}</p><div className="mt-5 grid gap-6 sm:grid-cols-2">{(["main","supporting"] as const).map(field => <div key={field}><h4 className="mb-3 font-bold">{field === "main" ? "Main title" : "Supporting title"}</h4><div className="space-y-2">{config[field].map((language, index) => <div key={index} className="flex items-center gap-1 rounded-lg border border-border bg-background/50 p-2"><select aria-label={`${region} ${field} language ${index + 1}`} className="min-w-0 flex-1 bg-transparent px-2 py-1 text-sm" value={language} onChange={e => changeTitle(region,field,index,e.target.value)}>{["English","Romaji","Native"].map(option => <option key={option} value={option}>{option}</option>)}</select><button type="button" aria-label="Move up" disabled={index===0} onClick={()=>moveTitle(region,field,index,-1)} className="px-1 text-muted-foreground disabled:opacity-30">↑</button><button type="button" aria-label="Move down" disabled={index===config[field].length-1} onClick={()=>moveTitle(region,field,index,1)} className="px-1 text-muted-foreground disabled:opacity-30">↓</button><button type="button" aria-label="Remove language" onClick={()=>removeTitle(region,field,index)} className="px-1 text-red-400">×</button></div>)}</div><button type="button" onClick={()=>addTitle(region,field)} className="mt-3 text-sm font-semibold text-primary hover:underline">+ Add language option</button><p className="mt-3 text-xs text-muted-foreground">{field === "main" ? "Falls back to any available title." : "Hidden if no preferred supporting title is available."}</p></div>)}</div></div>)}
        </section>}
        {true && <section className="rounded-2xl border border-border bg-card/90 p-6"><h2 className="text-xl font-bold">Display & preferences</h2><p className="mt-2 text-sm text-muted-foreground">Save personal preferences on this device. These options are stored locally; they do not yet change player behaviour across the site.</p><div className="mt-6 space-y-4">{[["compact","Compact cards"],["reduceAnimations","Reduce decorative animations"],["showRatings","Show anime ratings"],["showDescriptions","Show full descriptions"],["dimWatched","Dim watched episodes"],["showComments","Show comments"],["autoNext","Auto next episode"],["skipIntro","Skip intros"],["skipOutro","Skip outros"],["autoPlay","Auto play"],["notifications","Episode notifications"]].map(([key,label])=><label key={key} className="flex items-center justify-between gap-4 rounded-xl border border-border p-4 text-sm"><span>{label}</span><input type="checkbox" checked={!!displayPrefs[key]} onChange={()=>toggleDisplay(key)} className="h-5 w-5 accent-primary"/></label>)}</div></section>}
        {true && <section id="settings-section-sync" className="space-y-6"><h2 className="text-3xl font-bold">Sync</h2><div className="rounded-xl border border-border bg-card p-6"><h2 className="text-xl font-bold">AniList Sync</h2><p className="mt-3 text-sm text-muted-foreground">Streamly uses AniList for anime information. Connecting your personal AniList account and syncing watch progress is not available yet.</p><p className="mt-4 text-sm text-muted-foreground">Your Streamly watch history is not being sent to AniList.</p><button type="button" disabled className="mt-5 rounded-lg border border-border px-5 py-2 text-sm opacity-50">Connect — Coming soon</button></div><div className="rounded-xl border border-border bg-card p-6"><h2 className="text-lg font-bold">Data Management</h2><p className="mt-2 text-sm text-muted-foreground">Watchlist import and export are not available yet. These controls will appear when secure data transfer is implemented.</p></div></section>}
        {true && <div id="settings-section-security" className="space-y-6"><h2 className="text-3xl font-bold">Security</h2>
          <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
            <h2 className="text-xl font-bold">Account details</h2>
            <p className="mt-2 text-sm text-muted-foreground">Set a display name for the large white heading on your profile. Your unique username appears below it in smaller grey text and is used for account identification.</p>
            <form className="mt-5 space-y-4" onSubmit={async (event) => {
              event.preventDefault(); setIdentityStatus(""); setIdentityBusy(true);
              try {
                const name = usernameSchema.parse(accountName);
                const cleanDisplayName = displayName.trim();
                if (cleanDisplayName.length > 40) throw new Error("Display name must be 40 characters or fewer.");
                const saved = await updateIdentity({ data: { username: name, email: accountEmail.trim() } });
                const displayResult = await supabase.auth.updateUser({ data: { display_name: cleanDisplayName || name } });
                if (displayResult.error) throw displayResult.error;
                setAccountName(saved.username); setAccountEmail(saved.email ?? "");
                await queryClient.invalidateQueries({ queryKey: ["account-identity", user?.id] });
                setIdentityStatus("Account details saved. Your new username is ready to use. Refresh if the header hasn't updated yet.");
              } catch (error) { setIdentityStatus(error instanceof Error ? error.message : "Couldn't save changes."); }
              finally { setIdentityBusy(false); }
            }}>
              <label className="block text-sm font-semibold">Display name<input maxLength={40} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="How your name appears on your profile" className="mt-2 block w-full rounded-lg border border-border bg-background p-3" /></label>
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
