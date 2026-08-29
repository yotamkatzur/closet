import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  getBodyCard,
  getItem,
  getPurchaseRequest,
  getUser,
  listPhotos,
} from "@/lib/db/repo";
import { RequestRow } from "@/components/RequestRow";
import { Header } from "@/components/ui";
import { REQUEST_STATE_HE, SHAPE_HE, he, shekels } from "@/data/he";

// Seller decision screen (payment-contact spec §6.3) — the SMS short link.
export default async function RequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/profile?next=/requests/${id}`);

  const req = getPurchaseRequest(id);
  if (!req) notFound();
  if (req.seller_id !== user.id) redirect("/deals");

  const item = getItem(req.item_id);
  const buyer = getUser(req.buyer_id);
  const buyerCard = getBodyCard(req.buyer_id);
  const photos = item ? listPhotos(item.id) : [];
  const cover = photos.find((p) => p.on_body) ?? photos[0];

  return (
    <div>
      <Header title={he.request.inboxTitle} back="/deals" />
      <div className="space-y-4 p-4">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.url}
            alt=""
            className="mx-auto h-48 w-40 rounded-xl object-cover"
          />
        )}
        <div className="text-center">
          <p className="text-lg font-bold">
            {he.request.wants(buyer?.display_name ?? "מישהי")}
          </p>
          <p className="text-sm text-stone-500">
            {item?.title} · {shekels(item?.price_agorot ?? 0)}
          </p>
        </div>

        {buyerCard && (
          <div className="rounded-2xl border border-blush-200 bg-blush-50 p-4 text-center">
            <p className="font-semibold">
              {he.closet.height} {buyerCard.height_cm} {he.common.cm} · מידה{" "}
              {buyerCard.usual_size}
              {buyerCard.body_shape_tag
                ? ` · ${SHAPE_HE[buyerCard.body_shape_tag]}`
                : ""}
            </p>
          </div>
        )}

        {req.message && (
          <p className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600">
            “{req.message}”
          </p>
        )}

        {req.state === "pending" ? (
          <RequestRow
            requestId={req.id}
            asSeller
            itemTitle={item?.title ?? "שמלה"}
            counterpartyName={buyer?.display_name ?? "—"}
            priceAgorot={item?.price_agorot ?? 0}
            expiresAt={req.expires_at}
            message={req.message}
          />
        ) : (
          <p className="text-center text-sm text-stone-400">
            {REQUEST_STATE_HE[req.state]}
          </p>
        )}

        <p className="text-center text-[11px] text-stone-400">
          {he.request.revealNote}
        </p>
      </div>
    </div>
  );
}
