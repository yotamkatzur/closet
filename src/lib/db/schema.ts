import type {
  AnalyticsEvent,
  BodyCard,
  ChatMessage,
  FeedImpression,
  FitHistory,
  Follow,
  Item,
  ItemPhoto,
  KpiSnapshot,
  Like,
  Notification,
  PurchaseRequest,
  Rating,
  Report,
  Transaction,
  TransactionEvent,
  User,
} from "../types";

// Shape of the local JSON database (.data/db.json). Mirrors the Supabase tables
// one-to-one so the repository layer is driver-agnostic.
export interface DBShape {
  users: User[];
  body_cards: BodyCard[];
  fit_history: FitHistory[];
  items: Item[];
  item_photos: ItemPhoto[];
  purchase_requests: PurchaseRequest[];
  transactions: Transaction[];
  transaction_events: TransactionEvent[];
  chat_messages: ChatMessage[];
  follows: Follow[];
  likes: Like[];
  ratings: Rating[];
  reports: Report[];
  notifications: Notification[];
  analytics_events: AnalyticsEvent[];
  feed_impressions: FeedImpression[];
  kpi_snapshots: KpiSnapshot[];
  // pilot-only helper
  // login codes — `target` is the canonical phone (+972…) or lower-cased email
  otps: { target: string; code: string; expires_at: string }[];
  // monotonic counter for analytics_events.id / feed_impressions.id
  _seq: { analytics: number; impressions: number };
}

export function emptyDB(): DBShape {
  return {
    users: [],
    body_cards: [],
    fit_history: [],
    items: [],
    item_photos: [],
    purchase_requests: [],
    transactions: [],
    transaction_events: [],
    chat_messages: [],
    follows: [],
    likes: [],
    ratings: [],
    reports: [],
    notifications: [],
    analytics_events: [],
    feed_impressions: [],
    kpi_snapshots: [],
    otps: [],
    _seq: { analytics: 0, impressions: 0 },
  };
}
