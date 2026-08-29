import type { Tier } from "@/lib/match";
import { he } from "@/data/he";

const tierMeta: Record<Tier, { label: string; cls: string }> = {
  A: { label: he.match.tierA, cls: "bg-blush-500 text-white" },
  B: { label: he.match.tierB, cls: "bg-blush-100 text-blush-600" },
  C: { label: he.match.tierC, cls: "bg-stone-100 text-stone-500" },
};

export function MatchBadge({
  tier,
  label,
  size = "sm",
}: {
  tier: Tier | null;
  label: string;
  size?: "sm" | "lg";
}) {
  if (tier === null) {
    return (
      <span className="text-[11px] text-stone-400">{label}</span>
    );
  }
  const m = tierMeta[tier];
  return (
    <div className={size === "lg" ? "space-y-1" : ""}>
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${m.cls}`}
      >
        {m.label}
      </span>
      <p
        className={`${
          size === "lg" ? "text-sm text-stone-700" : "text-[11px] text-stone-500"
        } leading-tight`}
      >
        {label}
      </p>
    </div>
  );
}
