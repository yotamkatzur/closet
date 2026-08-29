import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  getBodyCard,
  getUser,
  isFollowing,
  listFitHistory,
  listFollowers,
  listItemsByOwner,
  listPhotos,
  ratingStats,
  salesCount,
} from "@/lib/db/repo";
import { FollowButton } from "@/components/FollowButton";
import { ReportButton } from "@/components/ReportButton";
import { Avatar } from "@/components/Avatar";
import { AvatarUpload } from "@/components/AvatarUpload";
import { ProfileForms } from "@/components/ProfileForms";
import { EmptyState, Header } from "@/components/ui";
import { SHAPE_HE, he, shekels } from "@/data/he";

export default async function ClosetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = getUser(id);
  if (!profile) notFound();

  const viewer = await getCurrentUser();
  const isOwn = viewer?.id === id;
  const card = getBodyCard(id);
  const stats = ratingStats(id);
  const items = listItemsByOwner(id);

  const visible = items.filter((i) =>
    isOwn ? i.status !== "hidden" : i.status === "available" || i.status === "sold",
  );
  const available = visible.filter((i) => i.status === "available");
  const reserved = visible.filter((i) => i.status === "reserved");
  const sold = visible.filter((i) => i.status === "sold");
  const drafts = visible.filter((i) => i.status === "draft");
  const ordered = [...available, ...reserved, ...sold, ...drafts];

  return (
    <div>
      <Header
        title={isOwn ? he.closet.myCloset : profile.display_name}
        back="/"
      />

      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          {isOwn ? (
            <AvatarUpload
              name={profile.display_name}
              url={profile.avatar_url}
              size={56}
            />
          ) : (
            <Avatar name={profile.display_name} url={profile.avatar_url} size={56} />
          )}
          <div className="flex-1">
            <p className="font-bold">{profile.display_name}</p>
            <p className="text-xs text-stone-400">
              {profile.city ?? ""} · {salesCount(id)} {he.item.sales} ·{" "}
              {stats.avg ? `★ ${stats.avg.toFixed(1)}` : he.item.noRating} ·{" "}
              {listFollowers(id).length} עוקבות
            </p>
          </div>
          {!isOwn && viewer && (
            <FollowButton
              followeeId={id}
              initialFollowing={isFollowing(viewer.id, id)}
              signedIn
            />
          )}
        </div>

        {/* Body card */}
        {card ? (
          <div className="flex gap-2 text-xs">
            <Stat k={he.closet.height} v={`${card.height_cm} ${he.common.cm}`} />
            <Stat k={he.onboarding.usualSize} v={card.usual_size} />
            {card.body_shape_tag && (
              <Stat k={he.closet.shape} v={SHAPE_HE[card.body_shape_tag]} />
            )}
          </div>
        ) : (
          isOwn && (
            <p className="rounded-xl bg-blush-50 p-2 text-xs text-blush-600">
              {he.match.needBodyCard}
            </p>
          )
        )}

        {isOwn && (
          <div className="flex gap-2">
            <Link
              href="/sell"
              className="flex-1 rounded-full bg-blush-500 py-2 text-center text-sm font-semibold text-white"
            >
              {he.closet.uploadDress}
            </Link>
            <Link
              href="/requests"
              className="rounded-full border border-blush-200 px-4 py-2 text-center text-sm font-semibold text-blush-600"
            >
              {he.request.inboxTitle}
            </Link>
          </div>
        )}

        {!isOwn && viewer && (
          <div className="flex justify-end">
            <ReportButton targetType="user" targetId={id} signedIn />
          </div>
        )}
      </div>

      {ordered.length === 0 ? (
        <EmptyState>{he.closet.noItems}</EmptyState>
      ) : (
        <div className="masonry px-3">
          {ordered.map((it) => {
            const photos = listPhotos(it.id);
            const cover = photos.find((p) => p.on_body) ?? photos[0];
            const dim = it.status === "sold" || it.status === "draft";
            return (
              <Link
                key={it.id}
                href={`/item/${it.id}`}
                className={`block overflow-hidden rounded-2xl border border-blush-100 bg-white ${
                  dim ? "opacity-60" : ""
                }`}
              >
                <div className="relative aspect-[3/4] bg-blush-50">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cover.url}
                      alt={it.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl text-blush-200">
                      ◇
                    </div>
                  )}
                  {it.status === "sold" && (
                    <span className="absolute right-2 top-2 rounded-full bg-stone-800/80 px-2 py-0.5 text-[10px] font-bold text-white">
                      {he.item.sold}
                    </span>
                  )}
                  {it.status === "draft" && (
                    <span className="absolute right-2 top-2 rounded-full bg-blush-500 px-2 py-0.5 text-[10px] font-bold text-white">
                      {he.closet.drafts}
                    </span>
                  )}
                  {it.status === "reserved" && (
                    <span className="absolute right-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                      {he.item.reserved}
                    </span>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-sm font-bold">{shekels(it.price_agorot)}</p>
                  <p className="truncate text-xs text-stone-500">{it.title}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {isOwn && (
        <ProfileForms
          bodyCard={card}
          displayName={profile.display_name}
          city={profile.city}
          fitHistory={listFitHistory(id)}
          paymentMethods={profile.payment_methods}
          bitPhone={profile.bit_phone}
        />
      )}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex-1 rounded-xl bg-stone-50 p-2 text-center">
      <p className="text-stone-400">{k}</p>
      <p className="font-bold">{v}</p>
    </div>
  );
}
