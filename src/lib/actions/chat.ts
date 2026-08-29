"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { track } from "@/lib/analytics";
import {
  addChatMessage,
  addNotification,
  getTx,
  getUser,
  markChatRead,
} from "@/lib/db/repo";

function party(txId: string, userId: string) {
  const tx = getTx(txId);
  if (!tx) return null;
  if (tx.buyer_id !== userId && tx.seller_id !== userId) return null;
  return tx;
}

export async function sendChatMessage(
  txId: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const tx = party(txId, user.id);
  if (!tx) return { ok: false, error: "אין הרשאה" };
  const text = body.trim().slice(0, 1000);
  if (!text) return { ok: false, error: "" };

  addChatMessage(txId, user.id, text);
  const otherId = tx.buyer_id === user.id ? tx.seller_id : tx.buyer_id;
  addNotification({
    user_id: otherId,
    kind: "new_message",
    channel: "push",
    body: `הודעה חדשה מ${getUser(user.id)?.display_name ?? "המשתמשת"}`,
    href: `/chat/${txId}`,
  });
  track("chat_message_sent", { userId: user.id, txId, props: { len: text.length } });

  revalidatePath(`/chat/${txId}`);
  revalidatePath("/deals");
  return { ok: true };
}

export async function markThreadRead(txId: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!party(txId, user.id)) return { ok: false };
  markChatRead(txId, user.id);
  revalidatePath("/", "layout");
  revalidatePath("/deals");
  return { ok: true };
}
