"use client";

import { useState, useTransition } from "react";
import { toggleLikeAction } from "@/lib/actions/social";

export function LikeButton({
  itemId,
  initialLiked,
  signedIn,
  count,
}: {
  itemId: string;
  initialLiked: boolean;
  signedIn: boolean;
  count?: number;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [n, setN] = useState(count ?? 0);
  const [pending, start] = useTransition();

  return (
    <button
      aria-label="לייק"
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        if (!signedIn) {
          window.location.href = "/profile";
          return;
        }
        const next = !liked;
        setLiked(next);
        setN((v) => v + (next ? 1 : -1));
        start(async () => {
          const r = await toggleLikeAction(itemId);
          if (r.ok) {
            setLiked(r.liked);
          } else {
            setLiked(!next);
            setN((v) => v + (next ? -1 : 1));
          }
        });
      }}
      className={`flex items-center gap-1 text-sm ${
        liked ? "text-blush-500" : "text-stone-400"
      }`}
    >
      <span className="text-base leading-none">{liked ? "♥" : "♡"}</span>
      {count !== undefined && <span className="text-xs">{n}</span>}
    </button>
  );
}
