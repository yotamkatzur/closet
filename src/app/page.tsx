import Link from "next/link";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { assembleFeed } from "@/lib/feed";
import { getBodyCard, listLikedItemIds } from "@/lib/db/repo";
import { FeedGrid } from "@/components/FeedGrid";
import { ShowAllSizesToggle } from "@/components/ShowAllSizesToggle";
import { EmptyState } from "@/components/ui";
import { OCCASIONS } from "@/data/taxonomy";
import { he } from "@/data/he";
import type { OccasionTag } from "@/lib/types";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ occasion?: string }>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const jar = await cookies();
  const showAllSizes = jar.get("show_all_sizes")?.value === "1";
  const occasion = (OCCASIONS.find((o) => o.key === sp.occasion)?.key ??
    null) as OccasionTag | null;

  const feed = assembleFeed(user?.id ?? null, { showAllSizes, occasion });
  const likedIds = user ? listLikedItemIds(user.id) : [];
  const hasBodyCard = user ? !!getBodyCard(user.id) : false;
  const needsOnboarding = !user || !hasBodyCard;

  return (
    <div>
      <header className="sticky top-0 z-30 space-y-2 border-b border-blush-100 bg-paper/95 px-4 pb-2 pt-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{he.appName}</h1>
          <div className="flex items-center gap-3 text-stone-400">
            <Link href="/search" aria-label={he.nav.search} className="text-lg">
              ⌕
            </Link>
            <Link
              href="/notifications"
              aria-label={he.notifications.title}
              className="text-lg"
            >
              ◔
            </Link>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <ShowAllSizesToggle value={showAllSizes} />
          <span className="text-[11px] text-stone-400">
            {feed.ranked ? "" : "לפי חדש ביותר"}
          </span>
        </div>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <Link
            href="/"
            className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs ${
              !occasion
                ? "border-blush-500 bg-blush-500 text-white"
                : "border-stone-200 text-stone-600"
            }`}
          >
            {he.feed.allOccasions}
          </Link>
          {OCCASIONS.map((o) => (
            <Link
              key={o.key}
              href={`/?occasion=${o.key}`}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs ${
                occasion === o.key
                  ? "border-blush-500 bg-blush-500 text-white"
                  : "border-stone-200 text-stone-600"
              }`}
            >
              {o.he}
            </Link>
          ))}
        </div>
      </header>

      {user && hasBodyCard && (
        <p className="bg-blush-50 px-4 py-2 text-center text-xs text-blush-600">
          {he.feed.explainer}
        </p>
      )}

      {feed.cards.length === 0 ? (
        <EmptyState>{he.feed.empty}</EmptyState>
      ) : (
        <FeedGrid
          cards={feed.cards.map((c) => ({ ...c, liked: likedIds.includes(c.item.id) }))}
          likedIds={likedIds}
          signedIn={!!user}
          needsOnboarding={needsOnboarding}
          feedMode={feed.feedMode}
        />
      )}
    </div>
  );
}
