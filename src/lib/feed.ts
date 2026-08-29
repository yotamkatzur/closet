import "server-only";
import { config } from "./config";
import {
  countAvailableItems,
  getBodyCard,
  listItemsByStatus,
  listPhotos,
  getUser,
} from "./db/repo";
import { matchLabelFor } from "./match-labels";
import type { Tier } from "./match";
import type { Item, ItemPhoto, OccasionTag, User } from "./types";

export interface FeedCard {
  item: Item;
  cover: ItemPhoto | null;
  owner: Pick<User, "id" | "display_name" | "avatar_url">;
  tier: Tier | null;
  score: number;
  label: string; // honest human sentence
}

export interface FeedOptions {
  showAllSizes?: boolean;
  occasion?: OccasionTag | null;
}

export interface FeedResult {
  cards: FeedCard[];
  ranked: boolean; // false = chronological (cold-start or "all sizes")
  feedMode: "chronological" | "ranked";
  viewerHasBodyCard: boolean;
  availableCount: number;
}

function coverPhoto(photos: ItemPhoto[]): ItemPhoto | null {
  if (photos.length === 0) return null;
  return photos.find((p) => p.on_body) ?? photos[0];
}

export function assembleFeed(
  viewerId: string | null,
  opts: FeedOptions = {},
): FeedResult {
  const availableCount = countAvailableItems();
  let items = listItemsByStatus(["available"]);

  if (opts.occasion) {
    items = items.filter((i) => i.occasion_tags.includes(opts.occasion!));
  }

  const viewerCard = viewerId ? getBodyCard(viewerId) : null;

  const enriched = items.map((item) => {
    const owner = getUser(item.owner_id);
    const { tier, score, label } = matchLabelFor(viewerId, item.owner_id);
    const card: FeedCard = {
      item,
      cover: coverPhoto(listPhotos(item.id)),
      owner: {
        id: item.owner_id,
        display_name: owner?.display_name ?? "",
        avatar_url: owner?.avatar_url ?? null,
      },
      tier,
      score,
      label,
    };
    return card;
  });

  // Feed assembly rules (spec section 4).
  const rankingActive =
    !!viewerCard &&
    !opts.showAllSizes &&
    availableCount >= config.matchRankingMinInventory;

  let cards: FeedCard[];
  if (rankingActive) {
    const byTier = (t: Tier) =>
      enriched
        .filter((c) => c.tier === t)
        .sort((a, b) => b.score - a.score);
    const ordered = [...byTier("A"), ...byTier("B"), ...byTier("C")];
    // Fill until at least feedMinItems, then include the rest too (never hide
    // inventory — only order it).
    cards = ordered;
  } else {
    // Chronological, newest first, labels layered on.
    cards = enriched
      .slice()
      .sort((a, b) => b.item.created_at.localeCompare(a.item.created_at));
  }

  return {
    cards,
    ranked: rankingActive,
    feedMode: rankingActive ? "ranked" : "chronological",
    viewerHasBodyCard: !!viewerCard,
    availableCount,
  };
}
