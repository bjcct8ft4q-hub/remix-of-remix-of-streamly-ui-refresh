import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Bot, Code2, Crown, Disc3, Gamepad2, Gem, Shield, Sword } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type BadgeKey = "owner" | "admin" | "moderator" | "developer" | "verified" | "supporter" | "gamer" | "creator" | "partner" | "bot";

export const BADGES: Record<BadgeKey, { label: string; description: string; Icon: LucideIcon; color: string }> = {
  owner: { label: "Owner", description: "The person responsible for running and managing Streamly.", Icon: Crown, color: "var(--badge-owner)" },
  admin: { label: "Admin", description: "A Streamly administrator who manages the platform and its community.", Icon: Shield, color: "#f97316" },
  moderator: { label: "Moderator", description: "Helps keep the Streamly community safe and welcoming.", Icon: Shield, color: "var(--badge-moderator)" },
  developer: { label: "Developer", description: "Builds and maintains Streamly features and improvements.", Icon: Code2, color: "var(--badge-developer)" },
  verified: { label: "Verified", description: "Registered Streamly member. This badge is given automatically when you join; it does not verify your real-world identity.", Icon: BadgeCheck, color: "var(--badge-verified)" },
  supporter: { label: "Supporter", description: "Recognized for supporting the Streamly community.", Icon: Gem, color: "var(--badge-supporter)" },
  gamer: { label: "Gamer", description: "A Streamly member who enjoys gaming.", Icon: Gamepad2, color: "var(--badge-gamer)" },
  creator: { label: "Content Creator", description: "Creates videos, streams, or other community content.", Icon: Disc3, color: "var(--badge-creator)" },
  partner: { label: "Partner", description: "An official Streamly community partner.", Icon: Sword, color: "var(--badge-partner)" },
  bot: { label: "Bot", description: "An automated account operated for Streamly.", Icon: Bot, color: "var(--badge-bot)" },
};

const ORDER: BadgeKey[] = ["owner", "admin", "moderator", "developer", "verified", "supporter", "gamer", "creator", "partner", "bot"];

/** Renders role badges in a fixed order. "verified" is always shown. */
export function ProfileBadges({ badges = [] }: { badges?: string[] }) {
  const set = new Set<string>([...badges, "verified"]);
  const [openBadge, setOpenBadge] = useState<BadgeKey | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!openBadge) return;
    const closeOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpenBadge(null);
    };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenBadge(null); };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeEscape); };
  }, [openBadge]);
  return (
    <div ref={containerRef} className="flex flex-wrap items-center gap-3" aria-label="Profile badges">
      {ORDER.filter((k) => set.has(k)).map((k) => {
        const { label, description, Icon, color } = BADGES[k];
        return (
          <button type="button" key={k} aria-label={`${label}: ${description}`} aria-expanded={openBadge === k} onClick={() => setOpenBadge((current) => current === k ? null : k)} className="group relative inline-flex cursor-pointer rounded-md outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary" style={{ color }}>
            <Icon size={28} strokeWidth={2.2} fill="currentColor" fillOpacity={0.25} aria-hidden="true" />
            <span role="tooltip" className={`pointer-events-none absolute bottom-[calc(100%+14px)] left-1/2 z-[100] w-56 max-w-[80vw] -translate-x-1/2 translate-y-1 rounded-xl border border-white/10 bg-[#101115] px-4 py-3 text-left text-white opacity-0 shadow-[0_16px_45px_rgba(0,0,0,.65)] transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 ${openBadge === k ? "translate-y-0 opacity-100" : ""}`}>
              <span className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full border-2 border-current bg-white/5" style={{ color }}><Icon size={32} strokeWidth={2.2} aria-hidden="true" /></span>
              <span className="block text-center text-sm font-extrabold uppercase italic tracking-wide text-white">{label}</span>
              <span className="mt-1 block text-center text-xs leading-relaxed text-gray-400">{description}</span>
              <span className="absolute -bottom-[6px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-white/10 bg-[#101115]" />
            </span>
          </button>
        );
      })}
    </div>
  );
}
