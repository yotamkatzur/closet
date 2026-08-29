"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getItem, resolveReport, updateItem, updateUser } from "@/lib/db/repo";
import { sweepTimeouts, transition, TxError } from "@/lib/tx/engine";
import type { TxAction } from "@/lib/txStateMachine";

async function adminRun(txId: string, action: TxAction) {
  await requireAdmin();
  try {
    await transition(txId, action, { actorId: null, isAdmin: true });
    revalidatePath("/admin");
    revalidatePath("/deals");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof TxError ? e.message : "שגיאה" };
  }
}

export async function adminForceComplete(txId: string) {
  return adminRun(txId, { type: "RETURN_WINDOW_ELAPSED" });
}

export async function adminResolveReturn(txId: string) {
  return adminRun(txId, { type: "SELLER_CONFIRM_RETURN" });
}

export async function adminCancel(txId: string, reason: string) {
  return adminRun(txId, {
    type: "CANCEL",
    reason: reason || "ביטול על ידי הניהול",
  });
}

export async function adminHideItem(itemId: string, hide: boolean) {
  await requireAdmin();
  const item = getItem(itemId);
  if (!item) return { ok: false, error: "לא נמצא" };
  updateItem(itemId, { status: hide ? "hidden" : "available" });
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true };
}

export async function adminSuspendUser(userId: string, suspend: boolean) {
  const me = await requireAdmin();
  if (userId === me.id) return { ok: false, error: "אי אפשר להשעות את עצמך" };
  updateUser(userId, { is_suspended: suspend });
  revalidatePath("/admin");
  return { ok: true };
}

export async function adminResolveReport(reportId: string) {
  await requireAdmin();
  resolveReport(reportId);
  revalidatePath("/admin");
  return { ok: true };
}

export async function adminRunSweep() {
  await requireAdmin();
  const r = await sweepTimeouts();
  revalidatePath("/admin");
  revalidatePath("/deals");
  return { ok: true, ...r };
}
