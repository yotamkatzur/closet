// Domain types. Canonical English keys everywhere; Hebrew rendering lives in
// src/data/he.ts. Money is always agorot (integers) — never floats.

// Includes the common "between sizes" (S-M, M-L) for women who fall between
// standard sizes. Ordinal values (used by the match algorithm) live in
// src/lib/match.ts — the between-sizes sit on half-steps.
export type Size =
  | "XS"
  | "S"
  | "S-M"
  | "M"
  | "M-L"
  | "L"
  | "XL"
  | "XXL";
export const SIZES: Size[] = ["XS", "S", "S-M", "M", "M-L", "L", "XL", "XXL"];

export type BodyShape = "pear" | "hourglass" | "straight" | "curvy" | "athletic";
export const BODY_SHAPES: BodyShape[] = [
  "pear",
  "hourglass",
  "straight",
  "curvy",
  "athletic",
];

export type FitVerdict = "ran_small" | "true_to_size" | "ran_large";
export const FIT_VERDICTS: FitVerdict[] = [
  "ran_small",
  "true_to_size",
  "ran_large",
];

export type Length = "mini" | "midi" | "maxi";
export const LENGTHS: Length[] = ["mini", "midi", "maxi"];

export type Neckline =
  | "strapless"
  | "v_neck"
  | "square"
  | "halter"
  | "one_shoulder"
  | "high_neck"
  | "collar"
  | "other";
export const NECKLINES: Neckline[] = [
  "strapless",
  "v_neck",
  "square",
  "halter",
  "one_shoulder",
  "high_neck",
  "collar",
  "other",
];

export type Sleeve = "sleeveless" | "short" | "three_quarter" | "long";
export const SLEEVES: Sleeve[] = [
  "sleeveless",
  "short",
  "three_quarter",
  "long",
];

export type Condition = "new_with_tags" | "like_new" | "good" | "worn";
export const CONDITIONS: Condition[] = [
  "new_with_tags",
  "like_new",
  "good",
  "worn",
];

export type OccasionTag =
  | "wedding_guest"
  | "bat_mitzva"
  | "bar_mitzva"
  | "henna"
  | "engagement"
  | "shabbat_dinner"
  | "gala_formal"
  | "cocktail"
  | "beach_event"
  | "new_years"
  | "graduation";

export type BackStyle = "open" | "closed";
export const BACK_STYLES: BackStyle[] = ["open", "closed"];

export type Fabric =
  | "satin"
  | "chiffon"
  | "lace"
  | "velvet"
  | "tulle"
  | "silk"
  | "crepe"
  | "jersey"
  | "organza"
  | "sequin"
  | "knit"
  | "other";
export const FABRICS: Fabric[] = [
  "satin",
  "chiffon",
  "lace",
  "velvet",
  "tulle",
  "silk",
  "crepe",
  "jersey",
  "organza",
  "sequin",
  "knit",
  "other",
];

export type ItemStatus =
  | "available"
  | "pending" // a purchase request is awaiting the seller's decision
  | "reserved" // request approved — 48h hold while the two women transact
  | "sold"
  | "hidden"
  | "draft";

// Payment rails a seller accepts (payment-contact spec §10). Bit P2P is the
// default; money never touches the platform in v1.
export type PaymentMethod = "bit" | "cash" | "paybox" | "other";
export const PAYMENT_METHODS: PaymentMethod[] = ["bit", "cash", "paybox", "other"];

export type HandoffMethod = "pickup" | "shipping";
export const HANDOFF_METHODS: HandoffMethod[] = ["pickup", "shipping"];

export interface User {
  id: string;
  phone: string;
  email: string | null; // optional second login channel (verified by code)
  display_name: string;
  avatar_url: string | null;
  city: string | null;
  created_at: string;
  is_admin: boolean;
  is_suspended: boolean;
  payment_methods: PaymentMethod[]; // what this seller accepts
  bit_phone: string | null; // Bit-registered number, if different from login
  blocked_user_ids: string[];
}

export interface BodyCard {
  user_id: string;
  height_cm: number; // required
  usual_size: Size; // required
  bra_size: string | null;
  body_shape_tag: BodyShape | null;
  shoulders_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  updated_at: string;
}

export interface FitHistory {
  id: string;
  user_id: string;
  brand: string;
  size: string;
  verdict: FitVerdict;
  source: "purchase" | "self_reported";
  created_at: string;
}

export interface Item {
  id: string;
  owner_id: string;
  title: string;
  brand: string | null;
  label_size: string;
  owner_verdict: FitVerdict | null;
  color: string;
  length: Length;
  neckline: Neckline;
  sleeve: Sleeve;
  back: BackStyle | null;
  fabric: Fabric | null;
  occasion_tags: OccasionTag[];
  condition: Condition;
  price_agorot: number;
  original_price_agorot: number | null;
  description: string;
  status: ItemStatus;
  created_at: string;
}

export interface ItemPhoto {
  id: string;
  item_id: string;
  url: string;
  on_body: boolean;
  sort_order: number;
}

export type PurchaseRequestState =
  | "pending"
  | "approved"
  | "declined"
  | "expired"
  | "cancelled";

export interface PurchaseRequest {
  id: string;
  item_id: string;
  buyer_id: string;
  seller_id: string;
  message: string | null; // optional note from buyer, ≤200 chars
  state: PurchaseRequestState;
  created_at: string;
  responded_at: string | null;
  expires_at: string; // created_at + 24h
}

// Coordinated Bit P2P (payment-contact spec). No escrow: the app introduces the
// two women, states the amount + reference code, and records what each reports.
export type TxState =
  | "RESERVED" // seller approved; 48h hold; phones revealed; awaiting payment
  | "PICKED_UP" // both confirmed payment; handoff done; 48h return clock running
  | "RETURN_IN_TRANSIT" // buyer is returning the dress
  | "COMPLETED" // kept — 48h elapsed or buyer confirmed fit
  | "REFUNDED" // returned & settled (socially, by the seller / by Yam)
  | "CANCELLED" // hold expired or cancelled before payment
  | "DISPUTED"; // flagged for admin

export interface Transaction {
  id: string;
  item_id: string;
  request_id: string | null;
  buyer_id: string;
  seller_id: string;
  price_agorot: number;
  fee_agorot: number; // recorded for v2; not collected in the pilot
  state: TxState;
  payment_method: PaymentMethod | null;
  payment_ref: string | null; // 'CL-' + 4 digits, typed into the Bit note
  handoff_method: HandoffMethod | null;
  phone_revealed_at: string | null;
  buyer_marked_paid_at: string | null;
  seller_confirmed_paid_at: string | null;
  hold_expires_at: string | null; // created_at + 48h
  picked_up_at: string | null; // handoff complete — starts the 48h return clock
  return_deadline: string | null; // picked_up_at + 48h
  return_started_at: string | null;
  mismatch_flagged_at: string | null;
  created_at: string;
}

export interface TransactionEvent {
  id: string;
  tx_id: string;
  from_state: TxState | null;
  to_state: TxState;
  actor_id: string | null;
  note: string;
  created_at: string;
}

export interface Follow {
  follower_id: string;
  followee_id: string;
  created_at: string;
}

export interface Like {
  user_id: string;
  item_id: string;
  created_at: string;
}

export interface Rating {
  id: string;
  tx_id: string;
  rater_id: string;
  ratee_id: string;
  score: number; // 1..5
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  target_type: "item" | "user";
  target_id: string;
  reason: string;
  created_at: string;
  resolved: boolean;
}

export type NotificationKind =
  | "new_listing"
  | "purchase_request"
  | "request_approved"
  | "request_declined"
  | "payment_marked"
  | "new_message"
  | "tx_action"
  | "return_reminder"
  | "reservation_expiring"
  | "stale_listing";

// In-app chat, scoped to a transaction (available once a request is approved).
// Runs alongside WhatsApp — some coordination stays in the app.
export interface ChatMessage {
  id: string;
  tx_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_by: string[];
}

export interface Notification {
  id: string;
  user_id: string;
  kind: NotificationKind;
  channel: "push" | "sms" | "push+sms";
  body: string;
  href: string | null;
  read: boolean;
  created_at: string;
}

// ---------------------------------------------------------------- analytics
// (analytics-spec §3). Raw, append-only. Body attributes are NEVER stored here
// — only user_id + bucketed values; body data is joined at query time.
export interface AnalyticsEvent {
  id: number;
  user_id: string | null;
  session_id: string;
  event: string;
  props: Record<string, unknown>;
  item_id: string | null;
  tx_id: string | null;
  created_at: string;
}

export interface FeedImpression {
  id: number;
  user_id: string;
  session_id: string;
  item_id: string;
  tier: "A" | "B" | "C";
  match_score: number | null; // score at render time — never recomputed
  position: number; // 0-indexed position in the feed
  feed_mode: "chronological" | "ranked";
  clicked: boolean;
  created_at: string;
}

export interface KpiSnapshot {
  week_start: string; // date
  metrics: Record<string, unknown>;
  notes: string | null;
  created_at: string;
}
