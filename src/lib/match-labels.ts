import "server-only";
import { getBodyCard, listFitHistory } from "@/lib/db/repo";
import { diffSentence, matchScore, type Tier } from "./match";
import { he } from "@/data/he";

export interface MatchLabel {
  tier: Tier | null;
  score: number;
  label: string;
}

/** Compute tier / score / honest sentence for one viewer↔owner pair. */
export function matchLabelFor(
  viewerId: string | null,
  ownerId: string,
): MatchLabel {
  const viewer = viewerId ? getBodyCard(viewerId) : null;
  if (!viewer) return { tier: null, score: 0, label: he.match.needBodyCard };
  const owner = getBodyCard(ownerId);
  if (!owner)
    return { tier: "C", score: 0, label: "אין מידע על המידה של המוכרת" };

  const res = matchScore(viewer, owner, {
    viewerFitHistory: viewerId ? listFitHistory(viewerId) : [],
    ownerFitHistory: listFitHistory(ownerId),
  });
  return {
    tier: res.tier,
    score: res.score,
    label: diffSentence(viewer, owner),
  };
}

export function feedTierFor(
  viewerId: string | null,
  ownerId: string,
): Tier | null {
  return matchLabelFor(viewerId, ownerId).tier;
}
