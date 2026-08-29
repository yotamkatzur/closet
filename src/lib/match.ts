// The matching algorithm — the core of the product (spec section 4).
// Pure functions only, so this file is fully unit-tested and tunable.

import type { BodyCard, FitHistory, Size } from "./types";

export type Tier = "A" | "B" | "C";

export interface MatchContext {
  viewerFitHistory: FitHistory[];
  ownerFitHistory: FitHistory[];
}

export interface MatchResult {
  score: number;
  tier: Tier;
  components: {
    height_proximity: number;
    size_proximity: number;
    shape_agreement: number;
    fit_overlap: number;
  };
}

// Map a size to an ordinal. Standard sizes keep XS=0 … XXL=5; "between" sizes
// sit exactly halfway (spec section 4 kept the 0–5 scale, half-steps extend it
// without shifting anything).
const SIZE_ORDINAL: Record<Size, number> = {
  XS: 0,
  S: 1,
  "S-M": 1.5,
  M: 2,
  "M-L": 2.5,
  L: 3,
  XL: 4,
  XXL: 5,
};

export function sizeOrdinal(size: Size): number {
  const n = SIZE_ORDINAL[size];
  if (n === undefined) throw new Error(`unknown size: ${size}`);
  return n;
}

const WEIGHTS = {
  height_proximity: 0.4,
  size_proximity: 0.3,
  shape_agreement: 0.15,
  fit_overlap: 0.15,
} as const;

export function heightProximity(viewerCm: number, ownerCm: number): number {
  return Math.max(0, 1 - Math.abs(viewerCm - ownerCm) / 12);
}

export function sizeProximity(viewer: Size, owner: Size): number {
  const delta = Math.abs(sizeOrdinal(viewer) - sizeOrdinal(owner));
  return Math.max(0, 1 - delta / 2);
}

export function shapeAgreement(
  viewer: BodyCard["body_shape_tag"],
  owner: BodyCard["body_shape_tag"],
): number {
  if (viewer === null && owner === null) return 0.5; // neutral
  if (viewer === owner) return 1.0;
  return 0.2;
}

export function fitOverlap(
  viewerHistory: FitHistory[],
  ownerHistory: FitHistory[],
): number {
  const ownerByBrand = new Map<string, Set<string>>();
  for (const h of ownerHistory) {
    const key = h.brand.trim().toLowerCase();
    if (!ownerByBrand.has(key)) ownerByBrand.set(key, new Set());
    ownerByBrand.get(key)!.add(h.verdict);
  }

  let brandsInCommon = 0;
  let agreements = 0;
  const seen = new Set<string>();
  for (const h of viewerHistory) {
    const key = h.brand.trim().toLowerCase();
    if (seen.has(key)) continue;
    const ownerVerdicts = ownerByBrand.get(key);
    if (!ownerVerdicts) continue;
    seen.add(key);
    brandsInCommon++;
    if (ownerVerdicts.has(h.verdict)) agreements++;
  }

  if (brandsInCommon === 0) return 0.5; // no overlap → neutral, not penalised
  return agreements / brandsInCommon;
}

export function tierFor(score: number): Tier {
  if (score >= 0.8) return "A";
  if (score >= 0.5) return "B";
  return "C";
}

export function matchScore(
  viewer: BodyCard,
  owner: BodyCard,
  ctx: MatchContext,
): MatchResult {
  const components = {
    height_proximity: heightProximity(viewer.height_cm, owner.height_cm),
    size_proximity: sizeProximity(viewer.usual_size, owner.usual_size),
    shape_agreement: shapeAgreement(
      viewer.body_shape_tag,
      owner.body_shape_tag,
    ),
    fit_overlap: fitOverlap(ctx.viewerFitHistory, ctx.ownerFitHistory),
  };

  const score =
    components.height_proximity * WEIGHTS.height_proximity +
    components.size_proximity * WEIGHTS.size_proximity +
    components.shape_agreement * WEIGHTS.shape_agreement +
    components.fit_overlap * WEIGHTS.fit_overlap;

  return { score, tier: tierFor(score), components };
}

// ---------------------------------------------------------------------------
// Honest per-card diff sentence (spec section 4, rule 2). Returns a Hebrew
// string describing exactly how the owner's body differs from the viewer's.
// ---------------------------------------------------------------------------

export function diffSentence(viewer: BodyCard, owner: BodyCard): string {
  const dCm = owner.height_cm - viewer.height_cm;
  const dSize = sizeOrdinal(owner.usual_size) - sizeOrdinal(viewer.usual_size);

  const sameHeight = Math.abs(dCm) <= 1;
  const sameSize = dSize === 0;

  if (sameHeight && sameSize) return 'בדיוק הגובה והמידה שלך';

  const parts: string[] = [];

  if (sameHeight) {
    parts.push('הגובה שלך');
  } else if (dCm > 0) {
    parts.push(`גבוהה ממך ב-${dCm} ס"מ`);
  } else {
    parts.push(`נמוכה ממך ב-${Math.abs(dCm)} ס"מ`);
  }

  if (sameSize) {
    parts.push('אותה מידה');
  } else {
    const n = Math.abs(dSize);
    const word = n === 1 ? 'מידה אחת' : `${n} מידות`;
    parts.push(dSize > 0 ? `בדרך כלל ${word} מעליך` : `בדרך כלל ${word} מתחתיך`);
  }

  return parts.join(' · ');
}
