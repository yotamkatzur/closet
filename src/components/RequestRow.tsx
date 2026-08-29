"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  blockAndDecline,
  cancelPurchaseRequest,
  respondPurchaseRequest,
} from "@/lib/actions/requests";
import { he, shekels } from "@/data/he";

export function RequestRow({
  requestId,
  asSeller,
  itemTitle,
  counterpartyName,
  priceAgorot,
  expiresAt,
  message,
}: {
  requestId: string;
  asSeller: boolean;
  itemTitle: string;
  counterpartyName: string;
  priceAgorot: number;
  expiresAt: string;
  message?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hoursLeft = Math.max(
    0,
    Math.round((new Date(expiresAt).getTime() - Date.now()) / 3600_000),
  );

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) router.refresh();
      else setError(r.error ?? "שגיאה");
    });

  return (
    <div className="rounded-2xl border border-blush-100 bg-white p-3">
      <p className="text-sm font-semibold">
        {asSeller ? he.request.wants(counterpartyName) : itemTitle}
      </p>
      <p className="text-xs text-stone-400">
        {asSeller ? itemTitle : `מוכרת: ${counterpartyName}`} ·{" "}
        {shekels(priceAgorot)}
      </p>
      {message && (
        <p className="mt-1 rounded-lg bg-stone-50 p-2 text-xs text-stone-600">
          “{message}”
        </p>
      )}
      <p className="mt-1 text-[11px] text-stone-400">
        {he.request.expiresIn(hoursLeft)}
      </p>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      {asSeller ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            disabled={pending}
            onClick={() => run(() => respondPurchaseRequest(requestId, "approve"))}
            className="rounded-full bg-blush-500 px-4 py-1.5 text-xs font-bold text-white"
          >
            {he.request.approve}
          </button>
          <button
            disabled={pending}
            onClick={() => run(() => respondPurchaseRequest(requestId, "decline"))}
            className="rounded-full border border-stone-200 px-4 py-1.5 text-xs text-stone-500"
          >
            {he.request.decline}
          </button>
          <button
            disabled={pending}
            onClick={() => run(() => blockAndDecline(requestId))}
            className="rounded-full px-2 py-1.5 text-[11px] text-stone-300 underline"
          >
            {he.request.block}
          </button>
        </div>
      ) : (
        <button
          disabled={pending}
          onClick={() => run(() => cancelPurchaseRequest(requestId))}
          className="mt-2 text-xs text-stone-400 underline"
        >
          {he.common.cancel}
        </button>
      )}
    </div>
  );
}
