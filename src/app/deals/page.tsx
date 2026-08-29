import Link from "next/link";
import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { getCurrentUser } from "@/lib/auth";
import {
  getItem,
  getUser,
  listChatMessages,
  listEvents,
  listPhotos,
  listRequestsByBuyer,
  listRequestsForSeller,
  listTxByBuyer,
  listTxBySeller,
  readRatingsForRater,
} from "@/lib/db/repo";
import { DealCard, type DealView } from "@/components/DealCard";
import { RequestRow } from "@/components/RequestRow";
import { EmptyState, Header } from "@/components/ui";
import { he } from "@/data/he";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/profile?next=/deals");
  const { tab } = await searchParams;
  const activeTab = tab === "sold" ? "sold" : "bought";
  const isBought = activeTab === "bought";

  const txs = isBought ? listTxByBuyer(user.id) : listTxBySeller(user.id);
  const ratedTxIds = new Set(readRatingsForRater(user.id).map((r) => r.tx_id));

  const openRequests = (
    isBought
      ? listRequestsByBuyer(user.id)
      : listRequestsForSeller(user.id)
  ).filter((r) => r.state === "pending");

  const views: DealView[] = txs.map((tx) => {
    const item = getItem(tx.item_id);
    const photos = item ? listPhotos(item.id) : [];
    const cover = photos.find((p) => p.on_body) ?? photos[0];
    const role = isBought ? "buyer" : "seller";
    const cp = getUser(role === "buyer" ? tx.seller_id : tx.buyer_id);
    return {
      tx,
      role,
      itemId: tx.item_id,
      itemTitle: item?.title ?? "שמלה",
      coverUrl: cover?.url ?? null,
      counterpartyName: cp?.display_name ?? "—",
      counterpartyAvatar: cp?.avatar_url ?? null,
      counterpartyPhone: cp?.phone ?? "",
      counterpartyBitPhone: cp?.bit_phone ?? null,
      counterpartyPaymentMethods: cp?.payment_methods ?? ["bit"],
      events: listEvents(tx.id),
      alreadyRated: ratedTxIds.has(tx.id),
      unreadChat: listChatMessages(tx.id).filter(
        (m) => m.sender_id !== user.id && !m.read_by.includes(user.id),
      ).length,
      prepayNudge:
        role === "buyer" &&
        tx.handoff_method === "shipping" &&
        tx.price_agorot > config.prepayNudgeAgorot,
    };
  });

  return (
    <div>
      <Header title={he.nav.deals} back="/" />
      <div className="flex border-b border-blush-100">
        {(["bought", "sold"] as const).map((t) => (
          <Link
            key={t}
            href={`/deals?tab=${t}`}
            className={`flex-1 py-3 text-center text-sm font-semibold ${
              activeTab === t
                ? "border-b-2 border-blush-500 text-blush-600"
                : "text-stone-400"
            }`}
          >
            {t === "bought" ? he.deals.bought : he.deals.sold}
          </Link>
        ))}
      </div>

      {openRequests.length > 0 && (
        <section className="space-y-2 p-3">
          <h2 className="text-xs font-bold text-stone-500">
            {he.deals.requests}
          </h2>
          {openRequests.map((r) => {
            const item = getItem(r.item_id);
            const cp = getUser(isBought ? r.seller_id : r.buyer_id);
            return (
              <RequestRow
                key={r.id}
                requestId={r.id}
                asSeller={!isBought}
                itemTitle={item?.title ?? "שמלה"}
                counterpartyName={cp?.display_name ?? "—"}
                priceAgorot={item?.price_agorot ?? 0}
                expiresAt={r.expires_at}
              />
            );
          })}
        </section>
      )}

      {views.length === 0 && openRequests.length === 0 ? (
        <EmptyState>{he.deals.none}</EmptyState>
      ) : (
        <div className="space-y-3 p-3">
          {views.map((v) => (
            <DealCard key={v.tx.id} view={v} />
          ))}
        </div>
      )}
    </div>
  );
}
