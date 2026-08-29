"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { addRating, addReport, getTx, markNotificationsRead } from "@/lib/db/repo";

export async function submitReport(input: {
  targetType: "item" | "user";
  targetId: string;
  reason: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (!input.reason.trim()) return { ok: false, error: "צריך לבחור סיבה" };
  addReport({
    reporter_id: user.id,
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason.trim().slice(0, 300),
  });
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await requireUser();
  markNotificationsRead(user.id);
  revalidatePath("/", "layout");
  revalidatePath("/notifications");
}

export async function rateCounterparty(input: {
  txId: string;
  score: number;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const tx = getTx(input.txId);
  if (!tx) return { ok: false, error: "עסקה לא נמצאה" };
  if (tx.state !== "COMPLETED" && tx.state !== "REFUNDED")
    return { ok: false, error: "אפשר לדרג רק אחרי סגירת העסקה" };
  const isBuyer = tx.buyer_id === user.id;
  const isSeller = tx.seller_id === user.id;
  if (!isBuyer && !isSeller) return { ok: false, error: "אין הרשאה" };
  const score = Math.round(input.score);
  if (score < 1 || score > 5) return { ok: false, error: "דירוג 1 עד 5" };
  addRating({
    tx_id: input.txId,
    rater_id: user.id,
    ratee_id: isBuyer ? tx.seller_id : tx.buyer_id,
    score,
  });
  revalidatePath("/deals");
  return { ok: true };
}
