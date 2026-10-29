import { useState } from "react";
import { useAuth } from "@/lib/auth";

export function AccountAvatar({ size = "sm" }: { size?: "sm" | "lg" }) {
  const { user, username } = useAuth();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const emoji = typeof user?.user_metadata?.avatar_emoji === "string" ? user.user_metadata.avatar_emoji : "";
  const rawUrl = typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : "";
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : "";
  const fallback = emoji || (username || "U").slice(0, 1).toUpperCase();
  return (
    <span className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-primary bg-primary/15 font-extrabold text-primary ${size === "lg" ? "h-20 w-20 text-3xl" : "h-10 w-10 text-sm"}`}>
      {url && failedUrl !== url
        ? <img src={url} alt={username ? `${username}'s avatar` : "Account avatar"} className="h-full w-full object-cover" referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} />
        : fallback}
    </span>
  );
}
