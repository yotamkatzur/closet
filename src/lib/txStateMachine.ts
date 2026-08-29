// Transaction state machine — coordinated Bit P2P, no escrow
// (payment-contact spec §3). PURE: given a transaction, an action and a context
// it returns the next transaction shape plus side effects (item-status changes,
// fit-history writes, notifications). The engine layer (src/lib/tx/engine.ts)
// is the only place that persists these, together with a transaction_events row.
//
// No state change may happen anywhere else in the codebase.

import type {
  FitVerdict,
  ItemStatus,
  PaymentMethod,
  Transaction,
  TxState,
} from "./types";

export type TxAction =
  | { type: "BUYER_MARK_PAID"; method: PaymentMethod }
  | { type: "SELLER_CONFIRM_PAID" }
  | { type: "KEEP" } // buyer confirms fit
  | { type: "RETURN_WINDOW_ELAPSED" } // 48h passed, kept by default
  | { type: "START_RETURN" }
  | { type: "SELLER_CONFIRM_RETURN" }
  | { type: "HOLD_EXPIRED" } // 48h approval hold, no payment
  | { type: "CANCEL"; reason: string }
  | { type: "DISPUTE"; reason: string };

export interface TxContext {
  now: Date;
  actorId: string | null;
  returnWindowHours: number;
  item: {
    id: string;
    brand: string | null;
    label_size: string;
    owner_verdict: FitVerdict | null;
  };
}

export interface NotifyEffect {
  user_id: string;
  kind:
    | "tx_action"
    | "return_reminder"
    | "payment_marked"
    | "reservation_expiring";
  channel: "push" | "sms" | "push+sms";
  body: string;
  href: string | null;
}

export interface FitHistoryWrite {
  user_id: string;
  brand: string;
  size: string;
  verdict: FitVerdict;
  source: "purchase";
}

export interface TxEffects {
  patch: Partial<Transaction> & { state: TxState };
  itemStatus: ItemStatus | null;
  eventNote: string;
  fitHistory: FitHistoryWrite | null;
  flagAdmin: boolean;
  notify: NotifyEffect[];
}

export const TERMINAL_STATES: TxState[] = [
  "COMPLETED",
  "REFUNDED",
  "CANCELLED",
  "DISPUTED",
];

export function isTerminal(state: TxState): boolean {
  return TERMINAL_STATES.includes(state);
}

const ALLOWED: Record<TxState, TxAction["type"][]> = {
  RESERVED: ["BUYER_MARK_PAID", "SELLER_CONFIRM_PAID", "HOLD_EXPIRED", "CANCEL", "DISPUTE"],
  PICKED_UP: ["KEEP", "RETURN_WINDOW_ELAPSED", "START_RETURN", "DISPUTE"],
  RETURN_IN_TRANSIT: ["SELLER_CONFIRM_RETURN", "DISPUTE"],
  COMPLETED: [],
  REFUNDED: [],
  CANCELLED: [],
  DISPUTED: [],
};

function iso(d: Date): string {
  return d.toISOString();
}

export class InvalidTransitionError extends Error {
  constructor(state: TxState, action: TxAction["type"]) {
    super(`action ${action} is not allowed from state ${state}`);
    this.name = "InvalidTransitionError";
  }
}

function base(tx: Transaction): TxEffects {
  return {
    patch: { state: tx.state },
    itemStatus: null,
    eventNote: "",
    fitHistory: null,
    flagAdmin: false,
    notify: [],
  };
}

const HREF = "/deals";

// When both sides have confirmed payment, the handoff is done: start the 48h
// return clock and mark the dress sold.
function pickedUpEffects(tx: Transaction, ctx: TxContext): TxEffects {
  const pickedUp = ctx.now;
  const deadline = new Date(
    pickedUp.getTime() + ctx.returnWindowHours * 3600_000,
  );
  return {
    ...base(tx),
    patch: {
      state: "PICKED_UP",
      picked_up_at: iso(pickedUp),
      return_deadline: iso(deadline),
    },
    itemStatus: "sold",
    eventNote: `שני הצדדים אישרו תשלום. חלון ההחזרה עד ${iso(deadline)}`,
    notify: [
      {
        user_id: tx.buyer_id,
        kind: "tx_action",
        channel: "push",
        body: `יש לך ${ctx.returnWindowHours} שעות להחליט אם השמלה מתאימה`,
        href: HREF,
      },
      {
        user_id: tx.seller_id,
        kind: "tx_action",
        channel: "push",
        body: "העסקה נסגרה — השמלה סומנה כנמכרה 🎉",
        href: HREF,
      },
    ],
  };
}

export function applyTxAction(
  tx: Transaction,
  action: TxAction,
  ctx: TxContext,
): TxEffects {
  const allowed = ALLOWED[tx.state] ?? [];
  if (!allowed.includes(action.type)) {
    throw new InvalidTransitionError(tx.state, action.type);
  }

  switch (action.type) {
    case "BUYER_MARK_PAID": {
      if (tx.seller_confirmed_paid_at) {
        const e = pickedUpEffects(tx, ctx);
        e.patch.buyer_marked_paid_at = iso(ctx.now);
        e.patch.payment_method = action.method;
        return e;
      }
      return {
        ...base(tx),
        patch: {
          state: "RESERVED",
          buyer_marked_paid_at: iso(ctx.now),
          payment_method: action.method,
        },
        eventNote: "הקונה סימנה ששילמה — ממתין לאישור המוכרת",
        notify: [
          {
            user_id: tx.seller_id,
            kind: "payment_marked",
            channel: "push+sms",
            body: "הקונה סימנה ששילמה. אשרי קבלת תשלום כדי לסגור.",
            href: HREF,
          },
        ],
      };
    }

    case "SELLER_CONFIRM_PAID": {
      if (tx.buyer_marked_paid_at) {
        const e = pickedUpEffects(tx, ctx);
        e.patch.seller_confirmed_paid_at = iso(ctx.now);
        return e;
      }
      return {
        ...base(tx),
        patch: { state: "RESERVED", seller_confirmed_paid_at: iso(ctx.now) },
        eventNote: "המוכרת אישרה קבלת תשלום — ממתין לאישור הקונה",
        notify: [
          {
            user_id: tx.buyer_id,
            kind: "payment_marked",
            channel: "push",
            body: "המוכרת אישרה קבלת תשלום. סמני 'שילמתי' כשתעבירי.",
            href: HREF,
          },
        ],
      };
    }

    case "KEEP":
    case "RETURN_WINDOW_ELAPSED": {
      const reason =
        action.type === "KEEP"
          ? 'הקונה אישרה "מתאים לי"'
          : "חלון ההחזרה של 48 שעות הסתיים";
      return {
        ...base(tx),
        patch: { state: "COMPLETED" },
        itemStatus: "sold",
        eventNote: `${reason}. העסקה הושלמה.`,
        fitHistory: {
          user_id: tx.buyer_id,
          brand: ctx.item.brand ?? "",
          size: ctx.item.label_size,
          verdict: ctx.item.owner_verdict ?? "true_to_size",
          source: "purchase",
        },
        notify: [
          {
            user_id: tx.seller_id,
            kind: "tx_action",
            channel: "push",
            body: "העסקה הושלמה 🎉",
            href: HREF,
          },
        ],
      };
    }

    case "START_RETURN":
      return {
        ...base(tx),
        patch: { state: "RETURN_IN_TRANSIT", return_started_at: iso(ctx.now) },
        eventNote: "הקונה מבקשת להחזיר את השמלה",
        notify: [
          {
            user_id: tx.seller_id,
            kind: "tx_action",
            channel: "push+sms",
            body: "הקונה מבקשת להחזיר. תאמו החזרה והחזר כספי בוואטסאפ.",
            href: HREF,
          },
        ],
        flagAdmin: true, // no escrow — Yam mediates the refund
      };

    case "SELLER_CONFIRM_RETURN":
      return {
        ...base(tx),
        patch: { state: "REFUNDED" },
        itemStatus: "available",
        eventNote: "המוכרת אישרה קבלת ההחזרה והחזר לקונה. השמלה חזרה למכירה.",
        notify: [
          {
            user_id: tx.buyer_id,
            kind: "tx_action",
            channel: "push",
            body: "ההחזרה נסגרה. תודה!",
            href: HREF,
          },
        ],
      };

    case "HOLD_EXPIRED":
      return {
        ...base(tx),
        patch: { state: "CANCELLED" },
        itemStatus: "available",
        eventNote: "48 שעות עברו ללא תשלום — ההזמנה בוטלה והשמלה חזרה למכירה.",
        notify: [
          {
            user_id: tx.buyer_id,
            kind: "tx_action",
            channel: "push",
            body: "ההזמנה פגה. השמלה שוב זמינה אם עדיין רלוונטי.",
            href: HREF,
          },
          {
            user_id: tx.seller_id,
            kind: "tx_action",
            channel: "push",
            body: "ההזמנה פגה והשמלה חזרה למכירה.",
            href: HREF,
          },
        ],
      };

    case "CANCEL":
      return {
        ...base(tx),
        patch: { state: "CANCELLED" },
        itemStatus: "available",
        eventNote: `בוטלה: ${action.reason}`,
        notify: [
          {
            user_id: tx.buyer_id,
            kind: "tx_action",
            channel: "push",
            body: "העסקה בוטלה.",
            href: HREF,
          },
          {
            user_id: tx.seller_id,
            kind: "tx_action",
            channel: "push",
            body: "העסקה בוטלה והשמלה חזרה למכירה.",
            href: HREF,
          },
        ],
      };

    case "DISPUTE":
      return {
        ...base(tx),
        patch: { state: "DISPUTED" },
        eventNote: `סומן כמחלוקת: ${action.reason}`,
        flagAdmin: true,
        notify: [],
      };

    /* c8 ignore next 2 */
    default:
      throw new InvalidTransitionError(tx.state, (action as TxAction).type);
  }
}
