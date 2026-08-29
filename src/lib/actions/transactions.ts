"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { setHandoffMethod, transition, TxError } from "@/lib/tx/engine";
import type { HandoffMethod, PaymentMethod } from "@/lib/types";
import type { TxAction } from "@/lib/txStateMachine";

async function run(txId: string, action: TxAction) {
  const user = await requireUser();
  try {
    await transition(txId, action, {
      actorId: user.id,
      isAdmin: user.is_admin,
    });
    revalidatePath("/deals");
    revalidatePath("/admin");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof TxError ? e.message : "שגיאה" };
  }
}

export async function buyerMarkPaid(txId: string, method: PaymentMethod) {
  return run(txId, { type: "BUYER_MARK_PAID", method });
}

export async function sellerConfirmPaid(txId: string) {
  return run(txId, { type: "SELLER_CONFIRM_PAID" });
}

export async function keepDress(txId: string) {
  return run(txId, { type: "KEEP" });
}

export async function startReturn(txId: string) {
  return run(txId, { type: "START_RETURN" });
}

export async function sellerConfirmReturn(txId: string) {
  return run(txId, { type: "SELLER_CONFIRM_RETURN" });
}

export async function disputeTx(txId: string, reason: string) {
  return run(txId, { type: "DISPUTE", reason: reason || "לא צוין" });
}

export async function cancelTx(txId: string, reason: string) {
  return run(txId, { type: "CANCEL", reason: reason || "בוטל על ידי משתמש" });
}

export async function chooseHandoff(txId: string, method: HandoffMethod) {
  const user = await requireUser();
  setHandoffMethod(txId, method);
  void user;
  revalidatePath("/deals");
  return { ok: true };
}
