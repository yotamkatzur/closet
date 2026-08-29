import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  getItem,
  getTx,
  getUser,
  listChatMessages,
  markChatRead,
} from "@/lib/db/repo";
import { ChatThread } from "@/components/ChatThread";
import { Avatar } from "@/components/Avatar";
import { Header } from "@/components/ui";
import { he } from "@/data/he";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ txId: string }>;
}) {
  const { txId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/profile?next=/chat/${txId}`);

  const tx = getTx(txId);
  if (!tx) notFound();
  if (tx.buyer_id !== user.id && tx.seller_id !== user.id) redirect("/deals");

  markChatRead(txId, user.id);
  const cp = getUser(tx.buyer_id === user.id ? tx.seller_id : tx.buyer_id);
  const item = getItem(tx.item_id);
  const messages = listChatMessages(txId).map((m) => ({
    id: m.id,
    sender_id: m.sender_id,
    body: m.body,
    created_at: m.created_at,
    mine: m.sender_id === user.id,
  }));

  return (
    <div className="pb-24">
      <Header
        title={cp?.display_name ?? he.chat.title}
        back="/deals"
        right={
          <Avatar name={cp?.display_name ?? ""} url={cp?.avatar_url ?? null} size={32} />
        }
      />
      <p className="bg-blush-50 px-4 py-1.5 text-center text-[11px] text-blush-600">
        {item?.title} · {he.payment.disclaimerShort}
      </p>
      <ChatThread
        txId={txId}
        initial={messages}
        counterpartyName={cp?.display_name ?? ""}
      />
    </div>
  );
}
