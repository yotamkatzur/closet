"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  blockFromRequest,
  cancelRequest,
  respondToRequest,
  sendRequest,
  TxError,
} from "@/lib/tx/engine";

export async function sendPurchaseRequest(
  itemId: string,
  message: string,
): Promise<{ ok: boolean; error?: string; requestId?: string }> {
  const user = await requireUser();
  try {
    const { requestId } = await sendRequest(
      user.id,
      itemId,
      message.trim() || null,
    );
    revalidatePath("/");
    revalidatePath(`/item/${itemId}`);
    revalidatePath("/deals");
    return { ok: true, requestId };
  } catch (e) {
    return { ok: false, error: e instanceof TxError ? e.message : "שגיאה" };
  }
}

export async function respondPurchaseRequest(
  requestId: string,
  decision: "approve" | "decline",
): Promise<{ ok: boolean; error?: string; txId?: string }> {
  const user = await requireUser();
  try {
    const { txId } = await respondToRequest(requestId, user.id, decision);
    revalidatePath("/requests");
    revalidatePath("/deals");
    revalidatePath("/");
    return { ok: true, txId };
  } catch (e) {
    return { ok: false, error: e instanceof TxError ? e.message : "שגיאה" };
  }
}

export async function cancelPurchaseRequest(
  requestId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  try {
    await cancelRequest(requestId, user.id);
    revalidatePath("/deals");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof TxError ? e.message : "שגיאה" };
  }
}

export async function blockAndDecline(
  requestId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  try {
    blockFromRequest(requestId, user.id);
    revalidatePath("/requests");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof TxError ? e.message : "שגיאה" };
  }
}
