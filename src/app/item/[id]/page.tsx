import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  activeRequestForItem,
  activeTxForItem,
  countLikes,
  getBodyCard,
  getItem,
  getUser,
  isFollowing,
  isLiked,
  listFitHistory,
  listPhotos,
  pendingRequestByBuyerForItem,
  ratingStats,
  salesCount,
} from "@/lib/db/repo";
import { diffSentence, matchScore } from "@/lib/match";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { MatchBadge } from "@/components/MatchBadge";
import { FollowButton } from "@/components/FollowButton";
import { RequestButton } from "@/components/RequestButton";
import { LikeButton } from "@/components/LikeButton";
import { OwnerItemBar } from "@/components/OwnerItemBar";
import { ReportButton } from "@/components/ReportButton";
import { Avatar } from "@/components/Avatar";
import { Header } from "@/components/ui";
import { OCCASION_HE } from "@/data/taxonomy";
import {
  BACK_HE,
  CONDITION_HE,
  FABRIC_HE,
  LENGTH_HE,
  NECKLINE_HE,
  PAYMENT_METHOD_HE,
  SLEEVE_HE,
  VERDICT_HE,
  he,
  shekels,
} from "@/data/he";

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = getItem(id);
  if (!item) notFound();

  const owner = getUser(item.owner_id);
  if (!owner) notFound();

  const viewer = await getCurrentUser();
  const isOwner = viewer?.id === item.owner_id;
  // hidden / draft items are visible only to their owner and admins
  if (
    (item.status === "hidden" || item.status === "draft") &&
    !isOwner &&
    !viewer?.is_admin
  ) {
    notFound();
  }
  const photos = listPhotos(item.id).sort(
    (a, b) => Number(b.on_body) - Number(a.on_body) || a.sort_order - b.sort_order,
  );
  const ownerCard = getBodyCard(item.owner_id);
  const viewerCard = viewer ? getBodyCard(viewer.id) : null;
  const stats = ratingStats(item.owner_id);
  const activeTx = activeTxForItem(item.id);
  const activeReq = activeRequestForItem(item.id);
  const myPendingReq = viewer
    ? pendingRequestByBuyerForItem(viewer.id, item.id)
    : null;
  const myApprovedTx =
    viewer && activeTx && activeTx.buyer_id === viewer.id ? activeTx : null;

  let matchTier: "A" | "B" | "C" | null = null;
  let matchLabel: string = he.match.needBodyCard;
  if (viewerCard && ownerCard) {
    const res = matchScore(viewerCard, ownerCard, {
      viewerFitHistory: listFitHistory(viewer!.id),
      ownerFitHistory: listFitHistory(item.owner_id),
    });
    matchTier = res.tier;
    matchLabel = diffSentence(viewerCard, ownerCard);
  }

  return (
    <div className="pb-40">
      <Header title={item.title} back="/" />

      <PhotoCarousel photos={photos} />

      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-2xl font-bold">{shekels(item.price_agorot)}</p>
            {item.original_price_agorot && (
              <p className="text-xs text-stone-400 line-through">
                {he.item.originalPrice} {shekels(item.original_price_agorot)}
              </p>
            )}
          </div>
          <LikeButton
            itemId={item.id}
            initialLiked={viewer ? isLiked(viewer.id, item.id) : false}
            signedIn={!!viewer}
            count={countLikes(item.id)}
          />
        </div>

        {/* Match block — prominent */}
        <div className="rounded-2xl border border-blush-200 bg-blush-50 p-4">
          <MatchBadge tier={matchTier} label={matchLabel} size="lg" />
          {ownerCard && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-white p-2">
                <p className="text-stone-400">{he.match.ownerVsYou}</p>
                <p className="font-semibold">
                  {ownerCard.height_cm} {he.common.cm} · {ownerCard.usual_size}
                </p>
              </div>
              <div className="rounded-xl bg-white p-2">
                <p className="text-stone-400">
                  {he.match.yourHeight} / {he.match.yourSize}
                </p>
                <p className="font-semibold">
                  {viewerCard
                    ? `${viewerCard.height_cm} ${he.common.cm} · ${viewerCard.usual_size}`
                    : "—"}
                </p>
              </div>
            </div>
          )}
          {item.owner_verdict && (
            <p className="mt-3 rounded-xl bg-white p-2 text-xs">
              <span className="text-stone-400">
                {he.match.ownerVerdictPrefix}:{" "}
              </span>
              <span className="font-semibold">
                {item.brand ? `${item.brand}, ` : ""}מידה {item.label_size} —{" "}
                {VERDICT_HE[item.owner_verdict]}
              </span>
            </p>
          )}
        </div>

        {/* Attributes */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Row k={he.item.brand} v={item.brand ?? "—"} />
          <Row k={he.item.labelSize} v={item.label_size} />
          <Row k={he.item.color} v={item.color} />
          <Row k={he.item.length} v={LENGTH_HE[item.length]} />
          <Row k={he.item.neckline} v={NECKLINE_HE[item.neckline]} />
          <Row k={he.item.sleeve} v={SLEEVE_HE[item.sleeve]} />
          {item.back && <Row k={he.item.back} v={BACK_HE[item.back]} />}
          {item.fabric && <Row k={he.item.fabric} v={FABRIC_HE[item.fabric]} />}
          <Row k={he.item.condition} v={CONDITION_HE[item.condition]} />
        </dl>

        {item.occasion_tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.occasion_tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600"
              >
                {OCCASION_HE[t]}
              </span>
            ))}
          </div>
        )}

        {item.description && (
          <p className="whitespace-pre-wrap text-sm text-stone-600">
            {item.description}
          </p>
        )}

        {owner.payment_methods.length > 0 && (
          <div className="rounded-xl bg-stone-50 p-2 text-xs text-stone-500">
            <p>
              {he.item.acceptsPayment}{" "}
              <b>
                {owner.payment_methods
                  .map((m) => PAYMENT_METHOD_HE[m])
                  .join(" · ")}
              </b>
            </p>
            <p className="mt-1 text-[11px] text-stone-400">
              {he.payment.disclaimerShort}
            </p>
          </div>
        )}

        {/* Seller strip */}
        <Link
          href={`/u/${owner.id}`}
          className="flex items-center gap-3 rounded-2xl border border-blush-100 p-3"
        >
          <Avatar name={owner.display_name} url={owner.avatar_url} size={40} />
          <div className="flex-1">
            <p className="text-sm font-semibold">{owner.display_name}</p>
            <p className="text-xs text-stone-400">
              {salesCount(owner.id)} {he.item.sales} ·{" "}
              {stats.avg
                ? `★ ${stats.avg.toFixed(1)}`
                : he.item.noRating}{" "}
              · {he.item.viewCloset}
            </p>
          </div>
          {!isOwner && (
            <FollowButton
              followeeId={owner.id}
              initialFollowing={viewer ? isFollowing(viewer.id, owner.id) : false}
              signedIn={!!viewer}
            />
          )}
        </Link>

        {!isOwner && (
          <div className="flex justify-end">
            <ReportButton targetType="item" targetId={item.id} signedIn={!!viewer} />
          </div>
        )}
      </div>

      {isOwner ? (
        <OwnerItemBar itemId={item.id} status={item.status} />
      ) : myApprovedTx ? (
        <div className="fixed inset-x-0 bottom-[4.25rem] mx-auto max-w-2xl bg-blush-50 py-3 text-center text-sm font-semibold text-blush-600">
          <Link href="/deals" className="underline">
            {he.deals.matched} — לפרטי התיאום
          </Link>
        </div>
      ) : item.status === "sold" ? (
        <div className="fixed inset-x-0 bottom-[4.25rem] mx-auto max-w-2xl bg-stone-100 py-3 text-center text-sm font-semibold text-stone-500">
          {he.item.sold}
        </div>
      ) : (
        <RequestButton
          itemId={item.id}
          sellerName={owner.display_name}
          priceAgorot={item.price_agorot}
          tier={matchTier}
          signedIn={!!viewer}
          disabled={
            item.status !== "available" ||
            (!!activeReq && activeReq.buyer_id !== viewer?.id) ||
            (!!activeTx && activeTx.buyer_id !== viewer?.id)
          }
          existingState={
            myPendingReq ? "pending" : null
          }
        />
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-stone-100 py-1">
      <dt className="text-stone-400">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
