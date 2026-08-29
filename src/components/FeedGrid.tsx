"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FeedCard } from "@/lib/feed";
import { track, trackImpressions } from "@/lib/analytics/client";
import { DressCard } from "./DressCard";
import { OnboardingSheet } from "./OnboardingSheet";

export function FeedGrid({
  cards,
  likedIds,
  signedIn,
  needsOnboarding,
  feedMode,
}: {
  cards: (FeedCard & { liked: boolean })[];
  likedIds: string[];
  signedIn: boolean;
  needsOnboarding: boolean;
  feedMode: "chronological" | "ranked";
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string>>(new Set());
  const dwell = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    track(signedIn ? "feed_view" : "feed_view_anon", {
      feed_mode: feedMode,
      items_shown: cards.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Impression tracking: ≥50% visible for ≥500ms, deduped per session (§5.3)
  useEffect(() => {
    if (!signedIn || !containerRef.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          const id = el.dataset.itemId!;
          if (seen.current.has(id)) continue;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            if (dwell.current.has(id)) continue;
            const t = setTimeout(() => {
              if (seen.current.has(id)) return;
              seen.current.add(id);
              const card = cards.find((c) => c.item.id === id);
              if (card && card.tier) {
                trackImpressions([
                  {
                    item_id: id,
                    tier: card.tier,
                    match_score: card.score || null,
                    position: Number(el.dataset.position),
                    feed_mode: feedMode,
                  },
                ]);
              }
            }, 500);
            dwell.current.set(id, t);
          } else {
            const t = dwell.current.get(id);
            if (t) {
              clearTimeout(t);
              dwell.current.delete(id);
            }
          }
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    const cells = containerRef.current.querySelectorAll("[data-item-id]");
    cells.forEach((c) => io.observe(c));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, feedMode, signedIn]);

  return (
    <>
      <div ref={containerRef} className="masonry px-3 pt-3">
        {cards.map((c, i) => (
          <div
            key={c.item.id}
            data-item-id={c.item.id}
            data-position={i}
            onClickCapture={(e) => {
              if (needsOnboarding) {
                e.preventDefault();
                e.stopPropagation();
                track("body_card_prompt_shown", { trigger: "item_tap" });
                setSheet(true);
                return;
              }
              track(
                "item_tap",
                {
                  tier: c.tier,
                  position: i,
                  feed_mode: feedMode,
                  source: "feed",
                },
                { item_id: c.item.id },
              );
            }}
          >
            <DressCard
              card={c}
              liked={likedIds.includes(c.item.id)}
              signedIn={signedIn}
            />
          </div>
        ))}
      </div>
      <OnboardingSheet
        open={sheet}
        onClose={() => {
          setSheet(false);
          router.refresh();
        }}
      />
    </>
  );
}
