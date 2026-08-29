"use client";

import { useState, useTransition } from "react";
import { toggleFollowAction } from "@/lib/actions/social";
import { he } from "@/data/he";

export function FollowButton({
  followeeId,
  initialFollowing,
  signedIn,
}: {
  followeeId: string;
  initialFollowing: boolean;
  signedIn: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, start] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!signedIn) {
          window.location.href = "/profile";
          return;
        }
        const next = !following;
        setFollowing(next);
        start(async () => {
          const r = await toggleFollowAction(followeeId);
          if (r.ok) setFollowing(r.following);
          else setFollowing(!next);
        });
      }}
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        following
          ? "border border-stone-200 text-stone-500"
          : "bg-blush-500 text-white"
      }`}
    >
      {following ? he.item.following : he.item.follow}
    </button>
  );
}
