import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

/** Badge details are rendered in a body-level portal so narrow mobile layouts cannot clip them. */
export function ProfileBadges({ badges = [] }: { badges?: string[] }) {
  const set = new Set<string>([...badges, "verified"]);
  const [openBadge, setOpenBadge] = useState<BadgeKey | null>(null);
  const [hoverBadge, setHoverBadge] = useState<BadgeKey | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0, below: false });
  const containerRef = useRef<HTMLDivElement>(null);
  const activeBadge = openBadge ?? hoverBadge;

  const positionTooltip = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const width = Math.min(240, window.innerWidth - 24);
    const left = Math.max(12 + width / 2, Math.min(window.innerWidth - 12 - width / 2, rect.left + rect.width / 2));
    const below = window.innerWidth < 640 || rect.top < 160;
    setPosition({ left, top: below ? rect.bottom + 9 : rect.top - 9, below });
  };

  useEffect(() => {
    if (!openBadge) return;
    const closeOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpenBadge(null);
    };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenBadge(null); };
    const closeOnScroll = () => { setOpenBadge(null); setHoverBadge(null); };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    window.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnScroll);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
      window.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("resize", closeOnScroll);
    };
  }, [openBadge]);

  const detail = activeBadge ? BADGES[activeBadge] : null;
  return (
    <>
      <div ref={containerRef} className="flex flex-wrap items-center gap-3" aria-label="Profile badges">
        {ORDER.filter((k) => set.has(k)).map((k) => {
          const { label, description, Icon, color } = BADGES[k];
          return (
            <button
              type="button"
              key={k}
              aria-label={`${label}: ${description}`}
              aria-expanded={openBadge === k}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") { positionTooltip(event.currentTarget); setHoverBadge(k); }
              }}
              onPointerLeave={() => setHoverBadge(null)}
              onFocus={(event) => { positionTooltip(event.currentTarget); setHoverBadge(k); }}
              onBlur={() => setHoverBadge(null)}
              onClick={(event) => {
                positionTooltip(event.currentTarget);
                setOpenBadge((current) => current === k ? null : k);
              }}
              className="inline-flex cursor-pointer rounded-md outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary"
              style={{ color }}
            >
              <Icon size={28} strokeWidth={2.2} fill="currentColor" fillOpacity={0.25} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      {detail && typeof document !== "undefined" && createPortal(
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[9999] w-60 max-w-[calc(100vw-24px)] rounded-lg border border-white/10 bg-[#101115] px-3 py-2.5 text-white shadow-[0_10px_30px_rgba(0,0,0,.55)]"
          style={{ left: position.left, top: position.top, transform: position.below ? "translate(-50%, 0)" : "translate(-50%, -100%)" }}
        >
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-current bg-white/5" style={{ color: detail.color }}>
              <detail.Icon size={21} strokeWidth={2.2} aria-hidden="true" />
            </span>
            <div className="min-w-0 text-left">
              <span className="block text-xs font-extrabold uppercase tracking-wide text-white">{detail.label}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-gray-400">{detail.description}</span>
            </div>
          </div>
          <span className={`absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-white/10 bg-[#101115] ${position.below ? "-top-[6px] border-l border-t" : "-bottom-[6px] border-b border-r"}`} />
        </div>,
        document.body
      )}
    </>
  );
}
