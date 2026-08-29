import { describe, expect, it } from "vitest";
import {
  applyTxAction,
  InvalidTransitionError,
  isTerminal,
  type TxContext,
} from "./txStateMachine";
import type { Transaction, TxState } from "./types";

const baseTx = (state: TxState, over: Partial<Transaction> = {}): Transaction => ({
  id: "tx1",
  item_id: "item1",
  request_id: "req1",
  buyer_id: "buyer1",
  seller_id: "seller1",
  price_agorot: 100_00,
  fee_agorot: 8_00,
  state,
  payment_method: null,
  payment_ref: "CL-1234",
  handoff_method: null,
  phone_revealed_at: "2026-01-01T00:00:00.000Z",
  buyer_marked_paid_at: null,
  seller_confirmed_paid_at: null,
  hold_expires_at: "2026-01-03T00:00:00.000Z",
  picked_up_at: null,
  return_deadline: null,
  return_started_at: null,
  mismatch_flagged_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  ...over,
});

const ctx = (now = new Date("2026-01-02T12:00:00.000Z")): TxContext => ({
  now,
  actorId: "actor",
  returnWindowHours: 48,
  item: {
    id: "item1",
    brand: "Zara",
    label_size: "M",
    owner_verdict: "ran_small",
  },
});

describe("guards", () => {
  it("rejects an action not allowed from the current state", () => {
    expect(() =>
      applyTxAction(baseTx("RESERVED"), { type: "KEEP" }, ctx()),
    ).toThrow(InvalidTransitionError);
  });
  it("terminal states accept nothing", () => {
    for (const s of ["COMPLETED", "REFUNDED", "CANCELLED", "DISPUTED"] as TxState[]) {
      expect(isTerminal(s)).toBe(true);
      expect(() =>
        applyTxAction(baseTx(s), { type: "DISPUTE", reason: "x" }, ctx()),
      ).toThrow();
    }
  });
});

describe("dual payment confirmation → PICKED_UP", () => {
  it("first confirm (buyer) keeps state RESERVED and records the timestamp", () => {
    const e = applyTxAction(
      baseTx("RESERVED"),
      { type: "BUYER_MARK_PAID", method: "bit" },
      ctx(),
    );
    expect(e.patch.state).toBe("RESERVED");
    expect(e.patch.buyer_marked_paid_at).toBe(ctx().now.toISOString());
    expect(e.patch.payment_method).toBe("bit");
    expect(e.itemStatus).toBeNull();
  });

  it("first confirm (seller) keeps state RESERVED", () => {
    const e = applyTxAction(
      baseTx("RESERVED"),
      { type: "SELLER_CONFIRM_PAID" },
      ctx(),
    );
    expect(e.patch.state).toBe("RESERVED");
    expect(e.patch.seller_confirmed_paid_at).toBe(ctx().now.toISOString());
  });

  it("second confirm completes the handoff: PICKED_UP, item sold, 48h return clock", () => {
    const now = new Date("2026-01-02T12:00:00.000Z");
    const e = applyTxAction(
      baseTx("RESERVED", { seller_confirmed_paid_at: "2026-01-02T10:00:00.000Z" }),
      { type: "BUYER_MARK_PAID", method: "bit" },
      ctx(now),
    );
    expect(e.patch.state).toBe("PICKED_UP");
    expect(e.itemStatus).toBe("sold");
    expect(e.patch.picked_up_at).toBe(now.toISOString());
    expect(e.patch.return_deadline).toBe(
      new Date("2026-01-04T12:00:00.000Z").toISOString(),
    );
    expect(e.patch.buyer_marked_paid_at).toBe(now.toISOString());
  });

  it("second confirm from the seller side also reaches PICKED_UP", () => {
    const e = applyTxAction(
      baseTx("RESERVED", { buyer_marked_paid_at: "2026-01-02T10:00:00.000Z" }),
      { type: "SELLER_CONFIRM_PAID" },
      ctx(),
    );
    expect(e.patch.state).toBe("PICKED_UP");
    expect(e.itemStatus).toBe("sold");
  });
});

describe("keep / auto-complete", () => {
  it("KEEP → COMPLETED and writes fit history from the purchase", () => {
    const e = applyTxAction(baseTx("PICKED_UP"), { type: "KEEP" }, ctx());
    expect(e.patch.state).toBe("COMPLETED");
    expect(e.fitHistory).toMatchObject({
      user_id: "buyer1",
      brand: "Zara",
      size: "M",
      verdict: "ran_small",
      source: "purchase",
    });
  });

  it("RETURN_WINDOW_ELAPSED → COMPLETED", () => {
    const e = applyTxAction(
      baseTx("PICKED_UP", { return_deadline: "2026-01-01T00:00:00.000Z" }),
      { type: "RETURN_WINDOW_ELAPSED" },
      ctx(),
    );
    expect(e.patch.state).toBe("COMPLETED");
    expect(e.fitHistory).not.toBeNull();
  });
});

describe("return path (no escrow — settled socially)", () => {
  it("START_RETURN → RETURN_IN_TRANSIT and flags admin", () => {
    const e = applyTxAction(
      baseTx("PICKED_UP", { picked_up_at: "2026-01-01T00:00:00.000Z" }),
      { type: "START_RETURN" },
      ctx(),
    );
    expect(e.patch.state).toBe("RETURN_IN_TRANSIT");
    expect(e.patch.return_started_at).toBe(ctx().now.toISOString());
    expect(e.flagAdmin).toBe(true);
  });

  it("SELLER_CONFIRM_RETURN → REFUNDED and item back to available", () => {
    const e = applyTxAction(
      baseTx("RETURN_IN_TRANSIT"),
      { type: "SELLER_CONFIRM_RETURN" },
      ctx(),
    );
    expect(e.patch.state).toBe("REFUNDED");
    expect(e.itemStatus).toBe("available");
  });
});

describe("hold expiry", () => {
  it("HOLD_EXPIRED → CANCELLED and item back to available", () => {
    const e = applyTxAction(
      baseTx("RESERVED"),
      { type: "HOLD_EXPIRED" },
      ctx(),
    );
    expect(e.patch.state).toBe("CANCELLED");
    expect(e.itemStatus).toBe("available");
  });
});

describe("cancel / dispute", () => {
  it("CANCEL from RESERVED → CANCELLED, item available", () => {
    const e = applyTxAction(
      baseTx("RESERVED"),
      { type: "CANCEL", reason: "changed mind" },
      ctx(),
    );
    expect(e.patch.state).toBe("CANCELLED");
    expect(e.itemStatus).toBe("available");
  });

  it("DISPUTE from any non-terminal state → DISPUTED, admin flagged", () => {
    for (const s of ["RESERVED", "PICKED_UP", "RETURN_IN_TRANSIT"] as TxState[]) {
      const e = applyTxAction(baseTx(s), { type: "DISPUTE", reason: "x" }, ctx());
      expect(e.patch.state).toBe("DISPUTED");
      expect(e.flagAdmin).toBe(true);
    }
  });
});
