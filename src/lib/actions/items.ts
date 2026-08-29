"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  addNotification,
  addPhoto,
  createItem,
  deletePhoto,
  deletePhotosForItem,
  getItem,
  listFollowers,
  listItemsByOwner,
  listPhotos,
  updateItem,
  updatePhoto,
} from "@/lib/db/repo";
import { saveDataUrl } from "@/lib/media";
import { track } from "@/lib/analytics";
import { aiProvider, EMPTY_AUTOFILL, type AutoFill } from "@/lib/providers/ai";
import {
  BACK_STYLES,
  CONDITIONS,
  FABRICS,
  LENGTHS,
  NECKLINES,
  SLEEVES,
  FIT_VERDICTS,
} from "@/lib/types";
import type {
  BackStyle,
  Fabric,
  ItemStatus,
  OccasionTag,
} from "@/lib/types";
import { OCCASIONS, MAX_OCCASION_TAGS } from "@/data/taxonomy";

const OCC_KEYS = OCCASIONS.map((o) => o.key);

export async function autofillFromPhoto(dataUrl: string): Promise<AutoFill> {
  const t0 = Date.now();
  try {
    const user = await requireUser();
    if (!/^data:image\//.test(dataUrl)) return EMPTY_AUTOFILL;
    const result = await aiProvider().autofillFromPhoto(dataUrl);
    const filled = Object.entries(result)
      .filter(([k, v]) =>
        k === "occasion_tags"
          ? Array.isArray(v) && v.length > 0
          : v != null && v !== "",
      )
      .map(([k]) => k);
    track(filled.length > 0 ? "ai_autofill_returned" : "ai_autofill_failed", {
      userId: user.id,
      props: { latency_ms: Date.now() - t0, fields_filled: filled },
    });
    return result;
  } catch {
    track("ai_autofill_failed", { props: { reason: "error" } });
    return EMPTY_AUTOFILL; // never block the sell flow on the AI
  }
}

const listingSchema = z.object({
  title: z.string().trim().min(2).max(80),
  brand: z.string().trim().max(40).optional().or(z.literal("")),
  label_size: z.string().trim().min(1).max(12),
  owner_verdict: z
    .enum(FIT_VERDICTS as unknown as [string, ...string[]])
    .optional()
    .or(z.literal("")),
  color: z.string().trim().min(1).max(30),
  length: z.enum(LENGTHS as unknown as [string, ...string[]]),
  neckline: z.enum(NECKLINES as unknown as [string, ...string[]]),
  sleeve: z.enum(SLEEVES as unknown as [string, ...string[]]),
  back: z
    .enum(BACK_STYLES as unknown as [string, ...string[]])
    .optional()
    .or(z.literal("")),
  fabric: z
    .enum(FABRICS as unknown as [string, ...string[]])
    .optional()
    .or(z.literal("")),
  occasion_tags: z.array(z.enum(OCC_KEYS as unknown as [string, ...string[]])).max(MAX_OCCASION_TAGS),
  condition: z.enum(CONDITIONS as unknown as [string, ...string[]]),
  price_agorot: z.coerce.number().int().min(1000).max(20_000_00),
  original_price_agorot: z.coerce.number().int().min(0).max(20_000_00).optional(),
  description: z.string().trim().max(1000),
});

type ListingData = z.infer<typeof listingSchema>;

// Shared field mapping so createListing and updateListing stay in sync.
function toItemFields(d: ListingData) {
  return {
    title: d.title,
    brand: d.brand || null,
    label_size: d.label_size,
    owner_verdict: d.owner_verdict
      ? (d.owner_verdict as (typeof FIT_VERDICTS)[number])
      : null,
    color: d.color,
    length: d.length as (typeof LENGTHS)[number],
    neckline: d.neckline as (typeof NECKLINES)[number],
    sleeve: d.sleeve as (typeof SLEEVES)[number],
    back: d.back ? (d.back as BackStyle) : null,
    fabric: d.fabric ? (d.fabric as Fabric) : null,
    occasion_tags: d.occasion_tags as OccasionTag[],
    condition: d.condition as (typeof CONDITIONS)[number],
    price_agorot: d.price_agorot,
    original_price_agorot: d.original_price_agorot || null,
    description: d.description,
  };
}

export interface PhotoInput {
  dataUrl: string;
  on_body: boolean;
}

export async function createListing(
  raw: unknown,
  photos: PhotoInput[],
  publish: boolean,
): Promise<{ ok: boolean; error?: string; itemId?: string }> {
  const user = await requireUser();
  const parsed = listingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "יש שדות חסרים או שגויים" };

  if (photos.length === 0) return { ok: false, error: "צריך לפחות תמונה אחת" };
  if (publish && !photos.some((p) => p.on_body))
    return { ok: false, error: "צריך לפחות תמונה אחת עם השמלה לבושה כדי לפרסם" };

  const d = parsed.data;
  const status: ItemStatus = publish ? "available" : "draft";

  const item = createItem({
    owner_id: user.id,
    ...toItemFields(d),
    status,
  });

  photos.forEach((p, i) => {
    let url: string;
    try {
      url = saveDataUrl(p.dataUrl);
    } catch {
      return;
    }
    addPhoto({ item_id: item.id, url, on_body: p.on_body, sort_order: i });
  });

  if (publish) {
    const priorListings = listItemsByOwner(user.id).filter(
      (i) => i.id !== item.id,
    ).length;
    track("listing_published", {
      userId: user.id,
      itemId: item.id,
      props: {
        price_agorot: item.price_agorot,
        has_on_body_photo: photos.some((p) => p.on_body),
        is_first_listing: priorListings === 0,
      },
    });
    // Bell notification to followers (spec section 8).
    for (const followerId of listFollowers(user.id)) {
      addNotification({
        user_id: followerId,
        kind: "new_listing",
        body: `${user.display_name} העלתה שמלה חדשה: "${item.title}"`,
        href: `/item/${item.id}`,
      });
    }
  }

  revalidatePath("/");
  revalidatePath(`/u/${user.id}`);
  return { ok: true, itemId: item.id };
}

export interface PhotoEdit {
  keep: { id: string; on_body: boolean }[];
  add: PhotoInput[];
}

export async function updateListing(
  itemId: string,
  raw: unknown,
  photos: PhotoEdit,
): Promise<{ ok: boolean; error?: string; itemId?: string }> {
  const user = await requireUser();
  const item = getItem(itemId);
  if (!item || item.owner_id !== user.id)
    return { ok: false, error: "אין הרשאה" };
  if (item.status === "reserved" || item.status === "sold")
    return { ok: false, error: "אי אפשר לערוך שמלה שנמצאת בעסקה פעילה" };

  const parsed = listingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "יש שדות חסרים או שגויים" };

  const existing = listPhotos(itemId);
  const keepIds = new Set(photos.keep.map((k) => k.id));
  const finalCount = photos.keep.length + photos.add.length;
  if (finalCount === 0) return { ok: false, error: "צריך לפחות תמונה אחת" };

  const isPublished = item.status === "available";
  const anyOnBody =
    photos.keep.some((k) => k.on_body) || photos.add.some((p) => p.on_body);
  if (isPublished && !anyOnBody)
    return { ok: false, error: "צריך לפחות תמונה אחת עם השמלה לבושה" };

  // remove dropped photos
  for (const p of existing) if (!keepIds.has(p.id)) deletePhoto(p.id);
  // update kept photos
  photos.keep.forEach((k, i) => {
    updatePhoto(k.id, { on_body: k.on_body, sort_order: i });
  });
  // add new photos after the kept ones
  photos.add.forEach((p, i) => {
    let url: string;
    try {
      url = saveDataUrl(p.dataUrl);
    } catch {
      return;
    }
    addPhoto({
      item_id: itemId,
      url,
      on_body: p.on_body,
      sort_order: photos.keep.length + i,
    });
  });

  updateItem(itemId, toItemFields(parsed.data));

  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath(`/u/${user.id}`);
  revalidatePath(`/item/${itemId}`);
  return { ok: true, itemId };
}

export async function setListingStatus(
  itemId: string,
  status: "available" | "hidden",
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const item = getItem(itemId);
  if (!item || item.owner_id !== user.id) return { ok: false, error: "אין הרשאה" };
  if (item.status === "sold" || item.status === "reserved")
    return { ok: false, error: "אי אפשר לשנות פריט בעסקה" };
  updateItem(itemId, { status });
  revalidatePath(`/u/${user.id}`);
  revalidatePath("/");
  return { ok: true };
}

export async function publishDraft(
  itemId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const item = getItem(itemId);
  if (!item || item.owner_id !== user.id) return { ok: false, error: "אין הרשאה" };
  updateItem(itemId, { status: "available" });
  revalidatePath(`/u/${user.id}`);
  revalidatePath("/");
  return { ok: true };
}

// The most important event in the pilot (analytics-spec §4): most early sales
// happen off-platform. The owner marks what happened from her own closet.
export async function markItemOutcome(
  itemId: string,
  outcome: "on_platform" | "off_platform" | "not_relevant",
  channel: string | null,
  priceShekels: number | null,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const item = getItem(itemId);
  if (!item || item.owner_id !== user.id) return { ok: false, error: "אין הרשאה" };
  if (item.status === "reserved" || item.status === "sold")
    return { ok: false, error: "השמלה כבר בעסקה" };

  if (outcome === "off_platform") {
    updateItem(itemId, { status: "sold" });
    track("sold_offplatform", {
      userId: user.id,
      itemId,
      props: {
        channel: channel ?? "other",
        price_agorot:
          priceShekels && priceShekels > 0
            ? Math.round(priceShekels * 100)
            : item.price_agorot,
      },
    });
  } else if (outcome === "not_relevant") {
    updateItem(itemId, { status: "hidden" });
    track("listing_delisted", {
      userId: user.id,
      itemId,
      props: {
        reason: "not_relevant",
        days_live: Math.floor(
          (Date.now() - new Date(item.created_at).getTime()) / 86_400_000,
        ),
      },
    });
  }
  revalidatePath(`/u/${user.id}`);
  revalidatePath("/");
  return { ok: true };
}

export async function deleteItem(
  itemId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const item = getItem(itemId);
  if (!item || item.owner_id !== user.id) return { ok: false, error: "אין הרשאה" };
  if (item.status !== "draft") return { ok: false, error: "אפשר למחוק רק טיוטות" };
  deletePhotosForItem(itemId);
  updateItem(itemId, { status: "hidden" });
  revalidatePath(`/u/${user.id}`);
  return { ok: true };
}
