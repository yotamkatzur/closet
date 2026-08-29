"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setShowAllSizes } from "@/lib/actions/prefs";
import { he } from "@/data/he";

export function ShowAllSizesToggle({ value }: { value: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setShowAllSizes(!value);
          router.refresh();
        })
      }
      className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
        value
          ? "border-blush-500 bg-blush-50 text-blush-600"
          : "border-stone-200 text-stone-500"
      }`}
    >
      <span
        className={`inline-block h-3 w-3 rounded-full ${
          value ? "bg-blush-500" : "bg-stone-300"
        }`}
      />
      {value ? he.feed.showAllSizes : he.feed.matchedOnly}
    </button>
  );
}
