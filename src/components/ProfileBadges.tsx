import { BadgeCheck, Bot, Code2, Crown, Disc3, Gamepad2, Gem, Shield, Sword } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type BadgeKey = "owner" | "moderator" | "developer" | "verified" | "supporter" | "gamer" | "creator" | "partner" | "bot";

export const BADGES: Record<BadgeKey, { label: string; description: string; Icon: LucideIcon; color: string }> = {
  owner: { label: "Owner", description: "Website owner / highest role", Icon: Crown, color: "var(--badge-owner)" },
  moderator: { label: "Moderator", description: "Server moderator / community moderator", Icon: Shield, color: "var(--badge-moderator)" },
  developer: { label: "Developer", description: "Website developer", Icon: Code2, color: "var(--badge-developer)" },
  verified: { label: "Verified", description: "Verified Streamly account (automatic for all users)", Icon: BadgeCheck, color: "var(--badge-verified)" },
  supporter: { label: "Supporter", description: "Supports Streamly", Icon: Gem, color: "var(--badge-supporter)" },
  gamer: { label: "Gamer", description: "Gaming related content / active gamer", Icon: Gamepad2, color: "var(--badge-gamer)" },
  creator: { label: "Content Creator", description: "Creates content (e.g. streaming / YouTube)", Icon: Disc3, color: "var(--badge-creator)" },
  partner: { label: "Partner", description: "Official partner", Icon: Sword, color: "var(--badge-partner)" },
  bot: { label: "Bot", description: "Official bot account", Icon: Bot, color: "var(--badge-bot)" },
};

const ORDER: BadgeKey[] = ["owner", "moderator", "developer", "verified", "supporter", "gamer", "creator", "partner", "bot"];

/** Renders role badges in a fixed order. "verified" is always shown. */
export function ProfileBadges({ badges = [] }: { badges?: string[] }) {
  const set = new Set<string>([...badges, "verified"]);
  return (
    <div className="flex flex-wrap items-center gap-3" aria-label="Profile badges">
      {ORDER.filter((k) => set.has(k)).map((k) => {
        const { label, description, Icon, color } = BADGES[k];
        return (
          <span key={k} tabIndex={0} title={`${label} — ${description}`} aria-label={`${label}: ${description}`} className="inline-flex transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" style={{ color }}>
            <Icon size={28} strokeWidth={2.2} fill="currentColor" fillOpacity={0.25} />
          </span>
        );
      })}
    </div>
  );
}
