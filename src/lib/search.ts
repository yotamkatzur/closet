import "server-only";
import { getBodyCard, getUser, listFitHistory, listItemsByStatus, listPhotos } from "./db/repo";
import { diffSentence, matchScore, type Tier } from "./match";
import type {
  Condition,
  Item,
  ItemPhoto,
  Length,
  OccasionTag,
  Size,
} from "./types";
import { he } from "@/data/he";

// v1 search is structured filters, not a chatbot. Query construction is behind
// this one function so a natural-language parser can be swapped in for phase 3
// without touching the executor (spec section 5.5).
export interface SearchQuery {
  text: string | null;
  occasion: OccasionTag | null;
  size: Size | null;
  length: Length | null;
  color: string | null;
  minAgorot: number | null;
  maxAgorot: number | null;
  condition: Condition | null;
}

export interface RawSearchInput {
  q?: string;
  occasion?: string;
  size?: string;
  length?: string;
  color?: string;
  min?: string; // shekels
  max?: string; // shekels
  condition?: string;
}

export function buildSearchQuery(input: RawSearchInput): SearchQuery {
  const shekelToAgorot = (v?: string) => {
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
  };
  const clean = (v?: string) => (v && v.trim() ? v.trim() : null);
  return {
    text: clean(input.q),
    occasion: (clean(input.occasion) as OccasionTag | null) ?? null,
    size: (clean(input.size) as Size | null) ?? null,
    length: (clean(input.length) as Length | null) ?? null,
    color: clean(input.color),
    minAgorot: shekelToAgorot(input.min),
    maxAgorot: shekelToAgorot(input.max),
    condition: (clean(input.condition) as Condition | null) ?? null,
  };
}

export interface SearchCard {
  item: Item;
  cover: ItemPhoto | null;
  ownerName: string;
  tier: Tier | null;
  label: string;
}

export function runSearch(q: SearchQuery, viewerId: string | null): SearchCard[] {
  let items = listItemsByStatus(["available"]);

  if (q.text) {
    const needle = q.text.toLowerCase();
    items = items.filter((i) =>
      [i.title, i.brand ?? "", i.description]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }
  if (q.occasion) items = items.filter((i) => i.occasion_tags.includes(q.occasion!));
  // Note: size is a filter chip here (explicit user intent), NOT the implicit
  // body-match filter — which never exists (spec section 4, rule 5).
  if (q.size) items = items.filter((i) => i.label_size === q.size);
  if (q.length) items = items.filter((i) => i.length === q.length);
  if (q.color) {
    const c = q.color.toLowerCase();
    items = items.filter((i) => i.color.toLowerCase().includes(c));
  }
  if (q.minAgorot != null) items = items.filter((i) => i.price_agorot >= q.minAgorot!);
  if (q.maxAgorot != null) items = items.filter((i) => i.price_agorot <= q.maxAgorot!);
  if (q.condition) items = items.filter((i) => i.condition === q.condition);

  const viewerCard = viewerId ? getBodyCard(viewerId) : null;

  return items.map((item) => {
    const photos = listPhotos(item.id);
    const ownerCard = getBodyCard(item.owner_id);
    let tier: Tier | null = null;
    let label = viewerCard ? "" : he.match.needBodyCard;
    if (viewerCard && ownerCard) {
      const res = matchScore(viewerCard, ownerCard, {
        viewerFitHistory: viewerId ? listFitHistory(viewerId) : [],
        ownerFitHistory: listFitHistory(item.owner_id),
      });
      tier = res.tier;
      label = diffSentence(viewerCard, ownerCard);
    }
    return {
      item,
      cover: photos.find((p) => p.on_body) ?? photos[0] ?? null,
      ownerName: getUser(item.owner_id)?.display_name ?? "",
      tier,
      label,
    };
  });
}
