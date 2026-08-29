import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  getBodyCard,
  getItem,
  getUser,
  listFitHistory,
  listLikedItemIds,
  listPhotos,
} from "@/lib/db/repo";
import { diffSentence, matchScore } from "@/lib/match";
import { DressCard } from "@/components/DressCard";
import { EmptyState, Header } from "@/components/ui";
import type { FeedCard } from "@/lib/feed";
import { he } from "@/data/he";

export default async function LikesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/profile?next=/likes");

  const viewerCard = getBodyCard(user.id);
  const ids = listLikedItemIds(user.id);
  const cards: FeedCard[] = ids
    .map((id) => getItem(id))
    .filter((i): i is NonNullable<typeof i> => !!i && i.status !== "hidden")
    .map((item) => {
      const photos = listPhotos(item.id);
      const ownerCard = getBodyCard(item.owner_id);
      let tier: "A" | "B" | "C" | null = null;
      let label: string = he.match.needBodyCard;
      if (viewerCard && ownerCard) {
        const res = matchScore(viewerCard, ownerCard, {
          viewerFitHistory: listFitHistory(user.id),
          ownerFitHistory: listFitHistory(item.owner_id),
        });
        tier = res.tier;
        label = diffSentence(viewerCard, ownerCard);
      }
      return {
        item,
        cover: photos.find((p) => p.on_body) ?? photos[0] ?? null,
        owner: {
          id: item.owner_id,
          display_name: getUser(item.owner_id)?.display_name ?? "",
          avatar_url: null,
        },
        tier,
        score: 0,
        label,
      };
    });

  return (
    <div>
      <Header title="לייקים" back="/" />
      {cards.length === 0 ? (
        <EmptyState>אין עדיין לייקים. סמני שמלות שאהבת ♥</EmptyState>
      ) : (
        <div className="masonry px-3 pt-3">
          {cards.map((c) => (
            <DressCard key={c.item.id} card={c} liked signedIn />
          ))}
        </div>
      )}
    </div>
  );
}
