import Link from "next/link";
import type { FeedCard } from "@/lib/feed";
import { he, shekels } from "@/data/he";
import { MatchBadge } from "./MatchBadge";
import { LikeButton } from "./LikeButton";

export function DressCard({
  card,
  liked,
  signedIn,
}: {
  card: FeedCard;
  liked: boolean;
  signedIn: boolean;
}) {
  const { item, cover } = card;
  return (
    <Link
      href={`/item/${item.id}`}
      className="block overflow-hidden rounded-2xl border border-blush-100 bg-white"
    >
      <div className="relative aspect-[3/4] bg-blush-50">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.url}
            alt={item.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl text-blush-200">
            ◇
          </div>
        )}
        {item.status === "sold" && (
          <span className="absolute right-2 top-2 rounded-full bg-stone-800/80 px-2 py-0.5 text-[10px] font-bold text-white">
            {he.item.sold}
          </span>
        )}
        <span className="absolute left-2 top-2">
          <LikeButton itemId={item.id} initialLiked={liked} signedIn={signedIn} />
        </span>
      </div>
      <div className="space-y-1 p-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-bold">{shekels(item.price_agorot)}</span>
          <span className="text-[11px] text-stone-400">{item.label_size}</span>
        </div>
        <p className="truncate text-xs text-stone-500">
          {item.brand ? item.brand + " · " : ""}
          {item.title}
        </p>
        <MatchBadge tier={card.tier} label={card.label} />
      </div>
    </Link>
  );
}
