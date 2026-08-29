"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendPurchaseRequest } from "@/lib/actions/requests";
import { track } from "@/lib/analytics/client";
import { he, shekels } from "@/data/he";

export function RequestButton({
  itemId,
  sellerName,
  priceAgorot,
  tier,
  signedIn,
  disabled,
  existingState,
}: {
  itemId: string;
  sellerName: string;
  priceAgorot: number;
  tier: "A" | "B" | "C" | null;
  signedIn: boolean;
  disabled?: boolean;
  existingState?: "pending" | "approved" | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const alreadyRequested = existingState === "pending" || existingState === "approved";

  return (
    <div className="fixed inset-x-0 bottom-[4.25rem] z-30 mx-auto max-w-2xl border-t border-blush-100 bg-paper/95 px-4 py-3 backdrop-blur">
      {error && <p className="mb-1 text-center text-xs text-red-500">{error}</p>}
      <p className="mb-1 text-center text-[11px] text-stone-400">{he.item.buySub}</p>
      <button
        disabled={disabled || pending || !signedIn || alreadyRequested}
        onClick={() => {
          if (!signedIn) {
            window.location.href = "/profile";
            return;
          }
          track("buy_intent", { item_id: itemId, tier, price_agorot: priceAgorot }, { item_id: itemId });
          setOpen(true);
        }}
        className="w-full rounded-full bg-blush-500 py-3 font-bold text-white disabled:opacity-40"
      >
        {alreadyRequested
          ? he.item.requestSent
          : disabled
            ? he.item.reserved
            : `${he.item.buy} · ${shekels(priceAgorot)}`}
      </button>
      {!signedIn && (
        <a
          href="/profile"
          className="mt-1 block text-center text-xs text-blush-600 underline"
        >
          {he.auth.signInToContinue}
        </a>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
          <div className="w-full max-w-2xl rounded-t-3xl bg-white p-5 pb-8">
            <h3 className="text-lg font-bold">
              {he.request.sheetTitle(sellerName)}
            </h3>
            <p className="mb-2 mt-1 text-sm text-stone-500">
              {he.request.sheetBody}
            </p>
            <p className="mb-3 rounded-lg bg-stone-50 p-2 text-[11px] text-stone-400">
              {he.payment.disclaimerShort}
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 200))}
              placeholder={he.request.messagePlaceholder}
              className="h-20 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
            />
            <div className="mt-3 flex gap-2">
              <button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const r = await sendPurchaseRequest(itemId, message);
                    if (r.ok) {
                      track("purchase_request_sent", {
                        item_id: itemId,
                        tier,
                        has_message: !!message.trim(),
                      });
                      setOpen(false);
                      router.push("/deals");
                      router.refresh();
                    } else setError(r.error ?? "שגיאה");
                  })
                }
                className="flex-1 rounded-full bg-blush-500 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {he.request.send}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full border border-stone-200 px-4 text-sm text-stone-500"
              >
                {he.common.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
