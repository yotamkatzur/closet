import "server-only";
import { insertAnalyticsEvent } from "@/lib/db/repo";

// Self-hosted analytics only (analytics-spec §2). Events go into our own store.
// track() is fire-and-forget and MUST NEVER throw — analytics can't break a
// purchase (§5 rule 1).

export interface TrackOpts {
  props?: Record<string, unknown>;
  userId?: string | null;
  sessionId?: string;
  itemId?: string | null;
  txId?: string | null;
}

export function track(event: string, opts: TrackOpts = {}): void {
  try {
    insertAnalyticsEvent({
      event,
      props: scrubBody(opts.props ?? {}),
      user_id: opts.userId ?? null,
      session_id: opts.sessionId ?? "server",
      item_id: opts.itemId ?? null,
      tx_id: opts.txId ?? null,
    });
  } catch {
    /* swallow — never break the caller */
  }
}

// Body measurements are sensitive personal data (analytics-spec §2). They are
// NEVER written into analytics — only user_id + bucketed values. This strips
// them defensively in case a caller passes a body-card-shaped object.
const BODY_KEYS = new Set([
  "height_cm",
  "usual_size",
  "bra_size",
  "shoulders_cm",
  "waist_cm",
  "hips_cm",
  "body_shape_tag",
  "avatar_url",
  "url",
  "photos",
]);

export function scrubBody<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (BODY_KEYS.has(k)) continue;
    out[k] = v && typeof v === "object" && !Array.isArray(v)
      ? scrubBody(v as Record<string, unknown>)
      : v;
  }
  return out as T;
}

export function heightBucket(cm: number): string {
  if (cm < 158) return "<158";
  if (cm < 163) return "158-162";
  if (cm < 168) return "163-167";
  if (cm < 173) return "168-172";
  return "173+";
}
