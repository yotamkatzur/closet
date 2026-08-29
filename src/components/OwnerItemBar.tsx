"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markItemOutcome,
  publishDraft,
  setListingStatus,
} from "@/lib/actions/items";
import type { ItemStatus } from "@/lib/types";
import { he } from "@/data/he";

const CHANNELS = ["facebook", "whatsapp", "instagram", "in_person", "other"] as const;

export function OwnerItemBar({
  itemId,
  status,
}: {
  itemId: string;
  status: ItemStatus;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "outcome" | "channel">(null);
  const [channel, setChannel] = useState<string>("facebook");
  const [price, setPrice] = useState("");

  const locked = status === "reserved" || status === "sold";

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) {
        setSheet(null);
        router.refresh();
      } else setError(r.error ?? "שגיאה");
    });

  return (
    <div className="fixed inset-x-0 bottom-[4.25rem] z-30 mx-auto max-w-2xl border-t border-blush-100 bg-paper/95 px-4 py-3 backdrop-blur">
      {error && <p className="mb-1 text-center text-xs text-red-500">{error}</p>}
      {locked && (
        <p className="mb-1 text-center text-[11px] text-stone-400">
          {status === "reserved" ? he.item.pendingRequest : he.item.sold}
        </p>
      )}
      <div className="flex gap-2">
        <Link
          href={`/item/${itemId}/edit`}
          aria-disabled={locked}
          className={`flex-1 rounded-full py-2.5 text-center text-sm font-semibold ${
            locked
              ? "pointer-events-none bg-stone-100 text-stone-300"
              : "bg-blush-500 text-white"
          }`}
        >
          {he.item.edit}
        </Link>

        {status === "draft" && (
          <button
            disabled={pending}
            onClick={() => run(() => publishDraft(itemId))}
            className="rounded-full border border-blush-200 px-4 text-sm font-semibold text-blush-600"
          >
            {he.item.publishNow}
          </button>
        )}
        {status === "available" && (
          <>
            <button
              disabled={pending}
              onClick={() => setSheet("outcome")}
              className="rounded-full border border-blush-200 px-3 text-sm font-semibold text-blush-600"
            >
              {he.item.markSold}
            </button>
            <button
              disabled={pending}
              onClick={() => run(() => setListingStatus(itemId, "hidden"))}
              className="rounded-full border border-stone-200 px-3 text-sm font-semibold text-stone-500"
            >
              {he.item.hide}
            </button>
          </>
        )}
        {status === "hidden" && (
          <button
            disabled={pending}
            onClick={() => run(() => setListingStatus(itemId, "available"))}
            className="rounded-full border border-blush-200 px-4 text-sm font-semibold text-blush-600"
          >
            {he.item.unhide}
          </button>
        )}
      </div>

      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
          <div className="w-full max-w-2xl space-y-2 rounded-t-3xl bg-white p-5 pb-8">
            <h3 className="font-bold">{he.sellOff.title}</h3>
            {sheet === "outcome" && (
              <div className="space-y-2">
                <button
                  disabled={pending}
                  onClick={() => setSheet("channel")}
                  className="w-full rounded-xl border border-blush-200 py-2 text-sm font-semibold text-blush-600"
                >
                  {he.sellOff.offPlatform}
                </button>
                <button
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      markItemOutcome(itemId, "not_relevant", null, null),
                    )
                  }
                  className="w-full rounded-xl border border-stone-200 py-2 text-sm text-stone-500"
                >
                  {he.sellOff.notRelevant}
                </button>
              </div>
            )}
            {sheet === "channel" && (
              <div className="space-y-2">
                <p className="text-sm text-stone-500">{he.sellOff.channelQ}</p>
                <div className="flex flex-wrap gap-2">
                  {CHANNELS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setChannel(c)}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        channel === c
                          ? "border-blush-500 bg-blush-500 text-white"
                          : "border-stone-200"
                      }`}
                    >
                      {he.sellOff.channels[c]}
                    </button>
                  ))}
                </div>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  inputMode="numeric"
                  placeholder={he.sellOff.priceQ}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                />
                <button
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      markItemOutcome(
                        itemId,
                        "off_platform",
                        channel,
                        price ? Number(price) : null,
                      ),
                    )
                  }
                  className="w-full rounded-full bg-blush-500 py-2 text-sm font-bold text-white"
                >
                  {he.sellOff.submit}
                </button>
              </div>
            )}
            <button
              onClick={() => setSheet(null)}
              className="w-full text-center text-xs text-stone-400"
            >
              {he.common.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
