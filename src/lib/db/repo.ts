// Repository layer. The rest of the app imports ONLY from here, never from
// local.ts directly — so swapping in a Supabase driver later is one file.

import { randomUUID } from "node:crypto";
import { mutate, readDB } from "./local";

export { readDB } from "./local";
import type {
  AnalyticsEvent,
  BodyCard,
  ChatMessage,
  FeedImpression,
  FitHistory,
  Item,
  ItemPhoto,
  ItemStatus,
  KpiSnapshot,
  Notification,
  PurchaseRequest,
  Rating,
  Report,
  Transaction,
  TransactionEvent,
  User,
} from "../types";

const now = () => new Date().toISOString();
export const newId = () => randomUUID();

// ---------------------------------------------------------------- users
export function getUser(id: string): User | null {
  return readDB().users.find((u) => u.id === id) ?? null;
}
export function getUserByPhone(phone: string): User | null {
  return readDB().users.find((u) => u.phone === phone) ?? null;
}
export function getUserByEmail(email: string): User | null {
  return readDB().users.find((u) => u.email === email) ?? null;
}
export function listUsers(): User[] {
  return readDB().users.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function createUser(input: {
  phone: string;
  email?: string | null;
  display_name: string;
  city?: string | null;
  is_admin?: boolean;
}): User {
  return mutate((db) => {
    const u: User = {
      id: newId(),
      phone: input.phone,
      email: input.email ?? null,
      display_name: input.display_name,
      avatar_url: null,
      city: input.city ?? null,
      created_at: now(),
      is_admin: input.is_admin ?? false,
      is_suspended: false,
      payment_methods: ["bit"],
      bit_phone: null,
      blocked_user_ids: [],
    };
    db.users.push(u);
    return u;
  });
}

export function blockUser(blockerId: string, blockedId: string): void {
  mutate((db) => {
    const u = db.users.find((x) => x.id === blockerId);
    if (u && !u.blocked_user_ids.includes(blockedId))
      u.blocked_user_ids.push(blockedId);
  });
}
export function hasBlockBetween(a: string, b: string): boolean {
  const users = readDB().users;
  const ua = users.find((u) => u.id === a);
  const ub = users.find((u) => u.id === b);
  return (
    !!ua?.blocked_user_ids.includes(b) || !!ub?.blocked_user_ids.includes(a)
  );
}
export function updateUser(id: string, patch: Partial<User>): User | null {
  return mutate((db) => {
    const u = db.users.find((x) => x.id === id);
    if (!u) return null;
    Object.assign(u, patch);
    return u;
  });
}

// ------------------------------------------------------------ body cards
export function getBodyCard(userId: string): BodyCard | null {
  return readDB().body_cards.find((b) => b.user_id === userId) ?? null;
}
export function upsertBodyCard(
  userId: string,
  patch: Partial<Omit<BodyCard, "user_id" | "updated_at">>,
): BodyCard {
  return mutate((db) => {
    let card = db.body_cards.find((b) => b.user_id === userId);
    if (!card) {
      card = {
        user_id: userId,
        height_cm: patch.height_cm ?? 0,
        usual_size: patch.usual_size ?? "M",
        bra_size: null,
        body_shape_tag: null,
        shoulders_cm: null,
        waist_cm: null,
        hips_cm: null,
        updated_at: now(),
      };
      db.body_cards.push(card);
    }
    Object.assign(card, patch, { updated_at: now() });
    return card;
  });
}

// ----------------------------------------------------------- fit history
export function listFitHistory(userId: string): FitHistory[] {
  return readDB().fit_history.filter((f) => f.user_id === userId);
}
export function addFitHistory(input: Omit<FitHistory, "id" | "created_at">): FitHistory {
  return mutate((db) => {
    const f: FitHistory = { ...input, id: newId(), created_at: now() };
    db.fit_history.push(f);
    return f;
  });
}

// ----------------------------------------------------------------- items
export function getItem(id: string): Item | null {
  return readDB().items.find((i) => i.id === id) ?? null;
}
export function listItemsByOwner(ownerId: string): Item[] {
  return readDB()
    .items.filter((i) => i.owner_id === ownerId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function listItemsByStatus(statuses: ItemStatus[]): Item[] {
  return readDB()
    .items.filter((i) => statuses.includes(i.status))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function listAllItems(): Item[] {
  return readDB().items.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function countAvailableItems(): number {
  return readDB().items.filter((i) => i.status === "available").length;
}
export function createItem(
  input: Omit<Item, "id" | "created_at" | "status"> & { status?: ItemStatus },
): Item {
  return mutate((db) => {
    const it: Item = {
      ...input,
      status: input.status ?? "draft",
      id: newId(),
      created_at: now(),
    };
    db.items.push(it);
    return it;
  });
}
export function updateItem(id: string, patch: Partial<Item>): Item | null {
  return mutate((db) => {
    const it = db.items.find((x) => x.id === id);
    if (!it) return null;
    Object.assign(it, patch);
    return it;
  });
}

// ---------------------------------------------------------- item photos
export function listPhotos(itemId: string): ItemPhoto[] {
  return readDB()
    .item_photos.filter((p) => p.item_id === itemId)
    .sort((a, b) => a.sort_order - b.sort_order);
}
export function addPhoto(input: Omit<ItemPhoto, "id">): ItemPhoto {
  return mutate((db) => {
    const p: ItemPhoto = { ...input, id: newId() };
    db.item_photos.push(p);
    return p;
  });
}
export function deletePhotosForItem(itemId: string): void {
  mutate((db) => {
    db.item_photos = db.item_photos.filter((p) => p.item_id !== itemId);
  });
}
export function updatePhoto(id: string, patch: Partial<ItemPhoto>): void {
  mutate((db) => {
    const p = db.item_photos.find((x) => x.id === id);
    if (p) Object.assign(p, patch);
  });
}
export function deletePhoto(id: string): void {
  mutate((db) => {
    db.item_photos = db.item_photos.filter((p) => p.id !== id);
  });
}

// ----------------------------------------------------- purchase requests
export function createPurchaseRequest(
  input: Omit<PurchaseRequest, "id" | "created_at" | "responded_at">,
): PurchaseRequest {
  return mutate((db) => {
    const r: PurchaseRequest = {
      ...input,
      id: newId(),
      created_at: now(),
      responded_at: null,
    };
    db.purchase_requests.push(r);
    return r;
  });
}
export function getPurchaseRequest(id: string): PurchaseRequest | null {
  return readDB().purchase_requests.find((r) => r.id === id) ?? null;
}
export function updatePurchaseRequest(
  id: string,
  patch: Partial<PurchaseRequest>,
): PurchaseRequest | null {
  return mutate((db) => {
    const r = db.purchase_requests.find((x) => x.id === id);
    if (!r) return null;
    Object.assign(r, patch);
    return r;
  });
}
export function activeRequestForItem(itemId: string): PurchaseRequest | null {
  return (
    readDB().purchase_requests.find(
      (r) =>
        r.item_id === itemId &&
        (r.state === "pending" || r.state === "approved"),
    ) ?? null
  );
}
export function pendingRequestByBuyerForItem(
  buyerId: string,
  itemId: string,
): PurchaseRequest | null {
  return (
    readDB().purchase_requests.find(
      (r) =>
        r.item_id === itemId &&
        r.buyer_id === buyerId &&
        r.state === "pending",
    ) ?? null
  );
}
export function listRequestsForSeller(sellerId: string): PurchaseRequest[] {
  return readDB()
    .purchase_requests.filter((r) => r.seller_id === sellerId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function listRequestsByBuyer(buyerId: string): PurchaseRequest[] {
  return readDB()
    .purchase_requests.filter((r) => r.buyer_id === buyerId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function listAllRequests(): PurchaseRequest[] {
  return readDB()
    .purchase_requests.slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// ---------------------------------------------------------- transactions
export function getTx(id: string): Transaction | null {
  return readDB().transactions.find((t) => t.id === id) ?? null;
}
export function listTxByBuyer(buyerId: string): Transaction[] {
  return readDB()
    .transactions.filter((t) => t.buyer_id === buyerId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function listTxBySeller(sellerId: string): Transaction[] {
  return readDB()
    .transactions.filter((t) => t.seller_id === sellerId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function listAllTx(): Transaction[] {
  return readDB()
    .transactions.slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function activeTxForItem(itemId: string): Transaction | null {
  const TERMINAL = ["COMPLETED", "REFUNDED", "CANCELLED", "DISPUTED"];
  return (
    readDB().transactions.find(
      (t) => t.item_id === itemId && !TERMINAL.includes(t.state),
    ) ?? null
  );
}

export function listEvents(txId: string): TransactionEvent[] {
  return readDB()
    .transaction_events.filter((e) => e.tx_id === txId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}
export function listAllEvents(): TransactionEvent[] {
  return readDB()
    .transaction_events.slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// ----------------------------------------------------------------- chat
export function addChatMessage(
  txId: string,
  senderId: string,
  body: string,
): ChatMessage {
  return mutate((db) => {
    const m: ChatMessage = {
      id: newId(),
      tx_id: txId,
      sender_id: senderId,
      body,
      created_at: now(),
      read_by: [senderId],
    };
    db.chat_messages.push(m);
    return m;
  });
}
export function listChatMessages(txId: string): ChatMessage[] {
  return readDB()
    .chat_messages.filter((m) => m.tx_id === txId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}
export function markChatRead(txId: string, userId: string): void {
  mutate((db) => {
    for (const m of db.chat_messages) {
      if (m.tx_id === txId && !m.read_by.includes(userId))
        m.read_by.push(userId);
    }
  });
}
export function countUnreadChat(userId: string): number {
  const db = readDB();
  const myTxIds = new Set(
    db.transactions
      .filter((t) => t.buyer_id === userId || t.seller_id === userId)
      .map((t) => t.id),
  );
  return db.chat_messages.filter(
    (m) =>
      myTxIds.has(m.tx_id) &&
      m.sender_id !== userId &&
      !m.read_by.includes(userId),
  ).length;
}
export function lastChatMessage(txId: string): ChatMessage | null {
  const msgs = listChatMessages(txId);
  return msgs.length ? msgs[msgs.length - 1] : null;
}

// -------------------------------------------------------------- follows
export function isFollowing(followerId: string, followeeId: string): boolean {
  return readDB().follows.some(
    (f) => f.follower_id === followerId && f.followee_id === followeeId,
  );
}
export function toggleFollow(followerId: string, followeeId: string): boolean {
  return mutate((db) => {
    const idx = db.follows.findIndex(
      (f) => f.follower_id === followerId && f.followee_id === followeeId,
    );
    if (idx >= 0) {
      db.follows.splice(idx, 1);
      return false;
    }
    db.follows.push({
      follower_id: followerId,
      followee_id: followeeId,
      created_at: now(),
    });
    return true;
  });
}
export function listFollowing(followerId: string): string[] {
  return readDB()
    .follows.filter((f) => f.follower_id === followerId)
    .map((f) => f.followee_id);
}
export function listFollowers(followeeId: string): string[] {
  return readDB()
    .follows.filter((f) => f.followee_id === followeeId)
    .map((f) => f.follower_id);
}

// --------------------------------------------------------------- likes
export function isLiked(userId: string, itemId: string): boolean {
  return readDB().likes.some((l) => l.user_id === userId && l.item_id === itemId);
}
export function toggleLike(userId: string, itemId: string): boolean {
  return mutate((db) => {
    const idx = db.likes.findIndex(
      (l) => l.user_id === userId && l.item_id === itemId,
    );
    if (idx >= 0) {
      db.likes.splice(idx, 1);
      return false;
    }
    db.likes.push({ user_id: userId, item_id: itemId, created_at: now() });
    return true;
  });
}
export function listLikedItemIds(userId: string): string[] {
  return readDB()
    .likes.filter((l) => l.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((l) => l.item_id);
}
export function countLikes(itemId: string): number {
  return readDB().likes.filter((l) => l.item_id === itemId).length;
}

// ------------------------------------------------------------- ratings
export function addRating(input: Omit<Rating, "id" | "created_at">): Rating {
  return mutate((db) => {
    const r: Rating = { ...input, id: newId(), created_at: now() };
    db.ratings.push(r);
    return r;
  });
}
export function readRatingsForRater(raterId: string): Rating[] {
  return readDB().ratings.filter((r) => r.rater_id === raterId);
}
export function ratingStats(userId: string): { avg: number | null; count: number } {
  const rs = readDB().ratings.filter((r) => r.ratee_id === userId);
  if (rs.length === 0) return { avg: null, count: 0 };
  return {
    avg: rs.reduce((s, r) => s + r.score, 0) / rs.length,
    count: rs.length,
  };
}
export function salesCount(userId: string): number {
  return readDB().transactions.filter(
    (t) => t.seller_id === userId && t.state === "COMPLETED",
  ).length;
}

// ------------------------------------------------------------- reports
export function addReport(input: Omit<Report, "id" | "created_at" | "resolved">): Report {
  return mutate((db) => {
    const r: Report = { ...input, id: newId(), created_at: now(), resolved: false };
    db.reports.push(r);
    return r;
  });
}
export function listReports(): Report[] {
  return readDB()
    .reports.slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function resolveReport(id: string): void {
  mutate((db) => {
    const r = db.reports.find((x) => x.id === id);
    if (r) r.resolved = true;
  });
}

// -------------------------------------------------------- notifications
export function addNotification(
  input: Omit<Notification, "id" | "created_at" | "read" | "channel"> & {
    channel?: Notification["channel"];
  },
): Notification {
  return mutate((db) => {
    const n: Notification = {
      channel: "push",
      ...input,
      id: newId(),
      created_at: now(),
      read: false,
    };
    db.notifications.push(n);
    return n;
  });
}
export function listNotifications(userId: string): Notification[] {
  return readDB()
    .notifications.filter((n) => n.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function countUnreadNotifications(userId: string): number {
  return readDB().notifications.filter((n) => n.user_id === userId && !n.read)
    .length;
}
export function markNotificationsRead(userId: string): void {
  mutate((db) => {
    for (const n of db.notifications) if (n.user_id === userId) n.read = true;
  });
}

// ------------------------------------------------------------- analytics
export function insertAnalyticsEvent(
  input: Omit<AnalyticsEvent, "id" | "created_at">,
): void {
  mutate((db) => {
    db._seq.analytics += 1;
    db.analytics_events.push({
      ...input,
      id: db._seq.analytics,
      created_at: now(),
    });
  });
}
export function insertFeedImpressions(
  rows: Omit<FeedImpression, "id" | "created_at">[],
): void {
  if (rows.length === 0) return;
  mutate((db) => {
    for (const r of rows) {
      db._seq.impressions += 1;
      db.feed_impressions.push({ ...r, id: db._seq.impressions, created_at: now() });
    }
  });
}
export function markImpressionClicked(
  userId: string,
  sessionId: string,
  itemId: string,
): void {
  mutate((db) => {
    for (const imp of db.feed_impressions) {
      if (
        imp.user_id === userId &&
        imp.session_id === sessionId &&
        imp.item_id === itemId &&
        !imp.clicked
      ) {
        imp.clicked = true;
      }
    }
  });
}
export function backfillSessionUser(sessionId: string, userId: string): void {
  mutate((db) => {
    for (const e of db.analytics_events) {
      if (e.session_id === sessionId && e.user_id === null) e.user_id = userId;
    }
  });
}
export function readAnalytics(): AnalyticsEvent[] {
  return readDB().analytics_events;
}
export function readImpressions(): FeedImpression[] {
  return readDB().feed_impressions;
}

export function saveKpiSnapshot(snap: Omit<KpiSnapshot, "created_at">): void {
  mutate((db) => {
    db.kpi_snapshots = db.kpi_snapshots.filter(
      (s) => s.week_start !== snap.week_start,
    );
    db.kpi_snapshots.push({ ...snap, created_at: now() });
  });
}
export function listKpiSnapshots(): KpiSnapshot[] {
  return readDB()
    .kpi_snapshots.slice()
    .sort((a, b) => a.week_start.localeCompare(b.week_start));
}

// ----------------------------------------------------------------- OTP
// `target` is a canonical phone (+972…) or a lower-cased email address.
export function setOtp(target: string, code: string, ttlMs: number): void {
  mutate((db) => {
    const now = Date.now();
    db.otps = db.otps.filter(
      (o) => o.target !== target && new Date(o.expires_at).getTime() > now,
    );
    db.otps.push({
      target,
      code,
      expires_at: new Date(now + ttlMs).toISOString(),
    });
  });
}
export function consumeOtp(target: string, code: string): boolean {
  return mutate((db) => {
    const o = db.otps.find((x) => x.target === target && x.code === code);
    if (!o) return false;
    if (new Date(o.expires_at).getTime() < Date.now()) return false;
    db.otps = db.otps.filter((x) => x.target !== target);
    return true;
  });
}

// --------------------------------------------- atomic transaction write
// Used by the state-machine action layer. Persists the transaction patch and
// its event together (spec section 6: "single server action ... same DB
// transaction").
export function commitTxTransition(args: {
  txId: string;
  patch: Partial<Transaction>;
  event: Omit<TransactionEvent, "id" | "created_at" | "tx_id">;
  itemId?: string;
  itemStatus?: ItemStatus | null;
}): Transaction | null {
  return mutate((db) => {
    const tx = db.transactions.find((t) => t.id === args.txId);
    if (!tx) return null;
    Object.assign(tx, args.patch);
    db.transaction_events.push({
      ...args.event,
      id: newId(),
      tx_id: args.txId,
      created_at: now(),
    });
    if (args.itemId && args.itemStatus) {
      const it = db.items.find((i) => i.id === args.itemId);
      if (it) it.status = args.itemStatus;
    }
    return tx;
  });
}

export function createTransaction(
  input: Omit<Transaction, "id" | "created_at">,
): Transaction {
  return mutate((db) => {
    const t: Transaction = { ...input, id: newId(), created_at: now() };
    db.transactions.push(t);
    return t;
  });
}
