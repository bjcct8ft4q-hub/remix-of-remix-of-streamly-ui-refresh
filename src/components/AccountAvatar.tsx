import { useAuth } from "@/lib/auth";
export function AccountAvatar({ size = "sm" }: { size?: "sm" | "lg" }) {
  const { user, username } = useAuth();
  const emoji = typeof user?.user_metadata?.avatar_emoji === "string" ? user.user_metadata.avatar_emoji : "";
  const url = typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : "";
  return <span className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-primary bg-primary/15 font-extrabold text-primary ${size === "lg" ? "h-20 w-20 text-3xl" : "h-10 w-10 text-sm"}`}>
    {url ? <img src={url} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : emoji || (username || "U").slice(0, 1).toUpperCase()}
  </span>;
}
