import "server-only";
import { config, sellerFeeAgorot } from "@/lib/config";
import { track } from "@/lib/analytics";
import {
  activeRequestForItem,
  activeTxForItem,
  addFitHistory,
  addNotification,
  blockUser,
  commitTxTransition,
  createPurchaseRequest,
  createTransaction,
  getBodyCard,
  getItem,
  getPurchaseRequest,
  getTx,
  getUser,
  hasBlockBetween,
  pendingRequestByBuyerForItem,
  updateItem,
  updatePurchaseRequest,
} from "@/lib/db/repo";
import { feedTierFor } from "@/lib/match-labels";
import { paymentRecorder } from "@/lib/providers/payment";
import { sendSms } from "@/lib/sms";
import {
  applyTxAction,
  isTerminal,
  type TxAction,
  type TxContext,
} from "@/lib/txStateMachine";
import type { HandoffMethod, Transaction } from "@/lib/types";

export class TxError extends Error {}

const H = 3600_000;
const now = () => new Date();
const iso = () => new Date().toISOString();

function paymentRef(): string {
  return "CL-" + String(1000 + Math.floor(Math.random() * 9000));
}

function smsTo(userId: string, body: string) {
  const u = getUser(userId);
  if (!u) return;
  const base = process.env.PUBLIC_URL ?? "";
  // fire-and-forget; Twilio (or console) handles it
  void sendSms(u.phone, base ? `${body}\n${base}` : body);
}

function notify(
  userId: string,
  kind: Parameters<typeof addNotification>[0]["kind"],
  channel: "push" | "sms" | "push+sms",
  body: string,
  href: string | null,
) {
  addNotification({ user_id: userId, kind, channel, body, href });
  if (channel === "sms" || channel === "push+sms") smsTo(userId, body);
  track("notification_sent", { userId, props: { type: kind, channel } });
}

// ------------------------------------------------------ purchase requests
export async function sendRequest(
  buyerId: string,
  itemId: string,
  message: string | null,
  sessionId?: string,
): Promise<{ requestId: string }> {
  const item = getItem(itemId);
  if (!item) throw new TxError("השמלה לא נמצאה");
  if (item.status !== "available") throw new TxError("השמלה כבר לא זמינה");
  if (item.owner_id === buyerId)
    throw new TxError("אי אפשר לבקש שמלה של עצמך");
  if (hasBlockBetween(buyerId, item.owner_id))
    throw new TxError("לא ניתן לשלוח בקשה");
  if (activeTxForItem(itemId) || activeRequestForItem(itemId))
    throw new TxError("יש כבר בקשה או עסקה פעילה על השמלה");
  if (pendingRequestByBuyerForItem(buyerId, itemId))
    throw new TxError("כבר שלחת בקשה");

  const req = createPurchaseRequest({
    item_id: itemId,
    buyer_id: buyerId,
    seller_id: item.owner_id,
    message: message ? message.slice(0, 200) : null,
    state: "pending",
    expires_at: new Date(
      Date.now() + config.requestExpiryHours * H,
    ).toISOString(),
  });
  updateItem(itemId, { status: "pending" });

  const buyer = getUser(buyerId);
  const tier = feedTierFor(buyerId, item.owner_id);
  notify(
    item.owner_id,
    "purchase_request",
    "push+sms",
    `מישהי רוצה את השמלה שלך ב-Closet 👗 ${buyer?.display_name ?? ""} · מידה ${item.label_size} · ₪${Math.round(item.price_agorot / 100)}`,
    `/requests/${req.id}`,
  );
  track("purchase_request_sent", {
    userId: buyerId,
    sessionId,
    itemId,
    props: { tier, has_message: !!message },
  });
  return { requestId: req.id };
}

export async function respondToRequest(
  requestId: string,
  actorId: string,
  decision: "approve" | "decline",
): Promise<{ txId?: string }> {
  const req = getPurchaseRequest(requestId);
  if (!req) throw new TxError("הבקשה לא נמצאה");
  if (req.seller_id !== actorId) throw new TxError("אין הרשאה");
  if (req.state !== "pending") throw new TxError("הבקשה כבר טופלה");

  const hoursToRespond =
    (Date.now() - new Date(req.created_at).getTime()) / H;

  if (decision === "decline") {
    updatePurchaseRequest(requestId, {
      state: "declined",
      responded_at: iso(),
    });
    if (getItem(req.item_id)?.status === "pending")
      updateItem(req.item_id, { status: "available" });
    // Soft wording (payment-contact spec §7) — never "נדחתה"
    notify(
      req.buyer_id,
      "request_declined",
      "push",
      "השמלה כבר לא זמינה כרגע.",
      "/deals",
    );
    track("purchase_request_responded", {
      userId: actorId,
      props: {
        request_id: requestId,
        decision: "decline",
        hours_to_respond: Math.round(hoursToRespond * 10) / 10,
      },
    });
    return {};
  }

  // approve
  const item = getItem(req.item_id);
  if (!item) throw new TxError("השמלה לא נמצאה");
  updatePurchaseRequest(requestId, { state: "approved", responded_at: iso() });
  updateItem(req.item_id, { status: "reserved" });

  const tier = feedTierFor(req.buyer_id, req.seller_id);
  const tx = createTransaction({
    item_id: req.item_id,
    request_id: requestId,
    buyer_id: req.buyer_id,
    seller_id: req.seller_id,
    price_agorot: item.price_agorot,
    fee_agorot: sellerFeeAgorot(item.price_agorot),
    state: "RESERVED",
    payment_method: null,
    payment_ref: paymentRef(),
    handoff_method: null,
    phone_revealed_at: iso(),
    buyer_marked_paid_at: null,
    seller_confirmed_paid_at: null,
    hold_expires_at: new Date(
      Date.now() + config.reservationHoldHours * H,
    ).toISOString(),
    picked_up_at: null,
    return_deadline: null,
    return_started_at: null,
    mismatch_flagged_at: null,
  });

  commitTxTransition({
    txId: tx.id,
    patch: {},
    event: {
      from_state: null,
      to_state: "RESERVED",
      actor_id: actorId,
      note: `הבקשה אושרה. קוד תשלום ${tx.payment_ref}. מספרי הטלפון נחשפו לשני הצדדים.`,
    },
  });
  // Closet only records that a transaction exists — money moves in Bit P2P.
  await paymentRecorder().recordTransactionOpened(tx.id, tx.payment_ref ?? "");

  notify(
    req.buyer_id,
    "request_approved",
    "push+sms",
    `הבקשה אושרה! תאמו בוואטסאפ. קוד לתשלום: ${tx.payment_ref}`,
    "/deals",
  );
  track("purchase_request_responded", {
    userId: actorId,
    props: {
      request_id: requestId,
      decision: "approve",
      hours_to_respond: Math.round(hoursToRespond * 10) / 10,
    },
  });
  track("tx_created", {
    userId: req.buyer_id,
    itemId: req.item_id,
    txId: tx.id,
    props: { tier },
  });
  track("phone_revealed", {
    txId: tx.id,
    props: { buyer_id: req.buyer_id, seller_id: req.seller_id },
  });
  return { txId: tx.id };
}

export async function cancelRequest(
  requestId: string,
  actorId: string,
): Promise<void> {
  const req = getPurchaseRequest(requestId);
  if (!req) throw new TxError("הבקשה לא נמצאה");
  if (req.buyer_id !== actorId) throw new TxError("אין הרשאה");
  if (req.state !== "pending") throw new TxError("אי אפשר לבטל");
  updatePurchaseRequest(requestId, { state: "cancelled", responded_at: iso() });
  if (getItem(req.item_id)?.status === "pending")
    updateItem(req.item_id, { status: "available" });
}

export function blockFromRequest(requestId: string, actorId: string): void {
  const req = getPurchaseRequest(requestId);
  if (!req || req.seller_id !== actorId) throw new TxError("אין הרשאה");
  // decline silently + block
  if (req.state === "pending") {
    updatePurchaseRequest(requestId, {
      state: "declined",
      responded_at: iso(),
    });
    if (getItem(req.item_id)?.status === "pending")
      updateItem(req.item_id, { status: "available" });
  }
  blockUser(actorId, req.buyer_id);
}

// ---------------------------------------------------------- transitions
function ctxFor(tx: Transaction): TxContext {
  const item = getItem(tx.item_id);
  return {
    now: now(),
    actorId: null,
    returnWindowHours: config.returnWindowHours,
    item: {
      id: tx.item_id,
      brand: item?.brand ?? null,
      label_size: item?.label_size ?? "",
      owner_verdict: item?.owner_verdict ?? null,
    },
  };
}

const BUYER_ACTIONS: TxAction["type"][] = [
  "BUYER_MARK_PAID",
  "KEEP",
  "START_RETURN",
];
const SELLER_ACTIONS: TxAction["type"][] = [
  "SELLER_CONFIRM_PAID",
  "SELLER_CONFIRM_RETURN",
];
const SYSTEM_ONLY: TxAction["type"][] = ["HOLD_EXPIRED", "RETURN_WINDOW_ELAPSED"];

export interface TransitionOpts {
  actorId: string | null; // null = system/cron
  isAdmin?: boolean;
  sessionId?: string;
}

function authorize(tx: Transaction, action: TxAction, opts: TransitionOpts) {
  if (opts.isAdmin || opts.actorId === null) return;
  const isBuyer = opts.actorId === tx.buyer_id;
  const isSeller = opts.actorId === tx.seller_id;
  if (action.type === "DISPUTE") {
    if (isBuyer || isSeller) return;
    throw new TxError("אין הרשאה");
  }
  if (action.type === "CANCEL") {
    if ((isBuyer || isSeller) && tx.state === "RESERVED") return;
    throw new TxError("ביטול נעשה דרך הניהול");
  }
  if (SYSTEM_ONLY.includes(action.type)) throw new TxError("אין הרשאה");
  if (BUYER_ACTIONS.includes(action.type) && isBuyer) return;
  if (SELLER_ACTIONS.includes(action.type) && isSeller) return;
  throw new TxError("אין הרשאה לפעולה הזו");
}

export async function transition(
  txId: string,
  action: TxAction,
  opts: TransitionOpts,
): Promise<Transaction> {
  const tx = getTx(txId);
  if (!tx) throw new TxError("עסקה לא נמצאה");
  if (isTerminal(tx.state)) throw new TxError("העסקה כבר נסגרה");
  authorize(tx, action, opts);

  const ctx = ctxFor(tx);
  ctx.actorId = opts.actorId;
  const effects = applyTxAction(tx, action, ctx);

  const updated = commitTxTransition({
    txId,
    patch: effects.flagAdmin
      ? { ...effects.patch, mismatch_flagged_at: tx.mismatch_flagged_at }
      : effects.patch,
    event: {
      from_state: tx.state,
      to_state: effects.patch.state,
      actor_id: opts.actorId,
      note: effects.eventNote,
    },
    itemId: tx.item_id,
    itemStatus: effects.itemStatus,
  });

  if (effects.fitHistory && effects.fitHistory.brand) {
    addFitHistory(effects.fitHistory);
  }
  for (const n of effects.notify) {
    notify(n.user_id, n.kind, n.channel, n.body, n.href);
  }

  // analytics — server-side authoritative (analytics-spec §5 rule 4)
  track("tx_state_changed", {
    userId: opts.actorId,
    txId,
    props: {
      from: tx.state,
      to: effects.patch.state,
      actor: opts.actorId === null ? "system" : opts.isAdmin ? "admin" : "user",
    },
  });
  if (effects.patch.state === "COMPLETED") {
    track("tx_completed", {
      txId,
      props: { price_agorot: tx.price_agorot },
    });
  }
  if (effects.patch.state === "REFUNDED") {
    track("tx_returned", { txId, props: {} });
  }
  if (action.type === "BUYER_MARK_PAID") {
    // record-only: buyer self-reported. Never verified — Bit doesn't expose it.
    await paymentRecorder().recordBuyerReportedPaid(txId, action.method);
    track("payment_marked_paid", {
      userId: tx.buyer_id,
      txId,
      props: { method: action.method },
    });
  }
  if (action.type === "SELLER_CONFIRM_PAID") {
    await paymentRecorder().recordSellerReportedReceived(txId);
    track("payment_confirmed_received", { userId: tx.seller_id, txId });
  }

  return updated!;
}

// ----------------------------------------------------- timeout sweep (cron)
const reminded = new Set<string>();

export async function sweepTimeouts(): Promise<Record<string, number>> {
  const { readDB } = await import("@/lib/db/local");
  const db = readDB();
  const t = Date.now();
  const counts = {
    requests_expired: 0,
    request_reminders: 0,
    holds_expired: 0,
    returns_autocompleted: 0,
    return_reminders: 0,
    payment_mismatches: 0,
    stale_nudges: 0,
  };

  // 1. purchase requests: expiry + reminders
  for (const r of db.purchase_requests) {
    if (r.state !== "pending") continue;
    const age = t - new Date(r.created_at).getTime();
    if (t >= new Date(r.expires_at).getTime()) {
      updatePurchaseRequest(r.id, { state: "expired", responded_at: iso() });
      if (getItem(r.item_id)?.status === "pending")
        updateItem(r.item_id, { status: "available" });
      track("purchase_request_expired", { props: { request_id: r.id } });
      notify(
        r.buyer_id,
        "request_declined",
        "push",
        "הבקשה פגה ללא מענה. השמלה שוב זמינה.",
        "/deals",
      );
      counts.requests_expired++;
    } else if (age >= 6 * H && !reminded.has(`req6:${r.id}`)) {
      reminded.add(`req6:${r.id}`);
      notify(
        r.seller_id,
        "purchase_request",
        "sms",
        "יש בקשת קנייה שממתינה לתשובה שלך ב-Closet",
        `/requests/${r.id}`,
      );
      counts.request_reminders++;
    } else if (age >= 20 * H && !reminded.has(`req20:${r.id}`)) {
      reminded.add(`req20:${r.id}`);
      notify(
        r.seller_id,
        "purchase_request",
        "push",
        "בקשת קנייה עומדת לפוג בקרוב",
        `/requests/${r.id}`,
      );
      counts.request_reminders++;
    }
  }

  // 2. transactions
  for (const tx of db.transactions) {
    if (tx.state === "RESERVED" && tx.hold_expires_at) {
      const holdEnds = new Date(tx.hold_expires_at).getTime();
      const bothPaid = tx.buyer_marked_paid_at && tx.seller_confirmed_paid_at;
      if (!bothPaid && t >= holdEnds) {
        await transition(tx.id, { type: "HOLD_EXPIRED" }, { actorId: null });
        counts.holds_expired++;
      } else if (
        !bothPaid &&
        holdEnds - t <= 6 * H &&
        !reminded.has(`hold6:${tx.id}`)
      ) {
        reminded.add(`hold6:${tx.id}`);
        notify(tx.buyer_id, "reservation_expiring", "push", "ההזמנה שלך פגה בעוד 6 שעות", "/deals");
        notify(tx.seller_id, "reservation_expiring", "push", "ההזמנה פגה בעוד 6 שעות", "/deals");
        counts.return_reminders++;
      }
      // payment mismatch: buyer marked paid >72h ago, seller never confirmed
      if (
        tx.buyer_marked_paid_at &&
        !tx.seller_confirmed_paid_at &&
        !tx.mismatch_flagged_at &&
        t - new Date(tx.buyer_marked_paid_at).getTime() >=
          config.paymentMismatchHours * H
      ) {
        commitTxTransition({
          txId: tx.id,
          patch: { mismatch_flagged_at: iso() },
          event: {
            from_state: "RESERVED",
            to_state: "RESERVED",
            actor_id: null,
            note: "הקונה סימנה ששילמה אך המוכרת לא אישרה תוך 72 שעות — סומן לבדיקה.",
          },
        });
        track("payment_mismatch", { txId: tx.id, props: {} });
        counts.payment_mismatches++;
      }
    }

    if (tx.state === "PICKED_UP" && tx.return_deadline) {
      const deadline = new Date(tx.return_deadline).getTime();
      if (t >= deadline) {
        await transition(
          tx.id,
          { type: "RETURN_WINDOW_ELAPSED" },
          { actorId: null },
        );
        counts.returns_autocompleted++;
      } else if (
        deadline - t <= 12 * H &&
        !reminded.has(`ret12:${tx.id}`)
      ) {
        reminded.add(`ret12:${tx.id}`);
        addNotification({
          user_id: tx.buyer_id,
          kind: "return_reminder",
          channel: "push+sms",
          body: "נשארו 12 שעות להחזרה",
          href: "/deals",
        });
        smsTo(tx.buyer_id, "נשארו 12 שעות להחזרה");
        track("return_deadline_warning_sent", { txId: tx.id });
        track("notification_sent", {
          props: { type: "return_reminder", channel: "push+sms" },
        });
        counts.return_reminders++;
      }
    }
  }

  // 3. stale listings — one SMS nudge, ever (analytics-spec §4)
  for (const it of db.items) {
    if (it.status !== "available") continue;
    if (reminded.has(`stale:${it.id}`)) continue;
    const age = t - new Date(it.created_at).getTime();
    if (age < config.staleListingDays * 24 * H) continue;
    const hadActivity = db.analytics_events.some(
      (e) =>
        e.item_id === it.id &&
        ["item_tap", "listing_published", "sold_offplatform"].includes(e.event) &&
        t - new Date(e.created_at).getTime() < config.staleListingDays * 24 * H,
    );
    if (hadActivity) continue;
    reminded.add(`stale:${it.id}`);
    notify(
      it.owner_id,
      "stale_listing",
      "sms",
      `"${it.title}" עדיין זמינה? עדכני אותנו ב-Closet`,
      `/item/${it.id}`,
    );
    counts.stale_nudges++;
  }

  return counts;
}

export function setHandoffMethod(txId: string, method: HandoffMethod): void {
  const tx = getTx(txId);
  if (!tx) return;
  commitTxTransition({
    txId,
    patch: { handoff_method: method },
    event: {
      from_state: tx.state,
      to_state: tx.state,
      actor_id: tx.buyer_id,
      note: `שיטת מסירה: ${method === "pickup" ? "איסוף עצמי" : "משלוח"}`,
    },
  });
}

// re-export for the reveal card
export { getBodyCard };
