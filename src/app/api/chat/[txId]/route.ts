import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getTx, listChatMessages, markChatRead } from "@/lib/db/repo";

// Polled by the chat thread every few seconds (no websockets in the pilot).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ txId: string }> },
) {
  const { txId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const tx = getTx(txId);
  if (!tx || (tx.buyer_id !== user.id && tx.seller_id !== user.id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const messages = listChatMessages(txId);
  markChatRead(txId, user.id);
  return NextResponse.json({
    me: user.id,
    messages: messages.map((m) => ({
      id: m.id,
      sender_id: m.sender_id,
      body: m.body,
      created_at: m.created_at,
      mine: m.sender_id === user.id,
    })),
  });
}
