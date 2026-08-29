"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PaymentMethod, Transaction, TransactionEvent } from "@/lib/types";
import { PAYMENT_METHOD_HE, TX_STATE_HE, he, shekels } from "@/data/he";
import {
  buyerMarkPaid,
  cancelTx,
  chooseHandoff,
  disputeTx,
  keepDress,
  sellerConfirmPaid,
  sellerConfirmReturn,
  startReturn,
} from "@/lib/actions/transactions";
import { rateCounterparty } from "@/lib/actions/misc";
import { track } from "@/lib/analytics/client";
import { Avatar } from "./Avatar";
import { Button } from "./ui";

export interface DealView {
  tx: Transaction;
  role: "buyer" | "seller";
  itemId: string;
  itemTitle: string;
  coverUrl: string | null;
  counterpartyName: string;
  counterpartyAvatar: string | null;
  counterpartyPhone: string;
  counterpartyBitPhone: string | null;
  counterpartyPaymentMethods: PaymentMethod[];
  events: TransactionEvent[];
  alreadyRated: boolean;
  prepayNudge: boolean;
  unreadChat: number;
}

function useNow() {
  const [n, setN] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setN(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return n;
}

function Countdown({ deadline, label }: { deadline: string; label: string }) {
  const now = useNow();
  const ms = new Date(deadline).getTime() - now;
  if (ms <= 0)
    return (
      <p className="rounded-xl bg-stone-100 p-2 text-center text-xs font-semibold text-stone-500">
        {he.deals.countdownDone}
      </p>
    );
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const urgent = ms <= 12 * 3600_000;
  return (
    <div
      className={`rounded-xl p-2 text-center ${
        urgent ? "bg-red-50 text-red-600" : "bg-blush-50 text-blush-600"
      }`}
    >
      <p className="text-[11px]">{label}</p>
      <p className="font-mono text-lg font-bold" dir="ltr">
        {h}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </p>
    </div>
  );
}

function Copyable({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => {},
        );
      }}
      className="flex w-full items-center justify-between rounded-lg bg-white px-2 py-1.5 text-sm"
      dir="ltr"
    >
      <span className="text-[11px] text-stone-400">
        {copied ? he.deals.copied : he.deals.copy}
      </span>
      <span>
        <span className="text-stone-400">{label}: </span>
        <span className="font-semibold">{value}</span>
      </span>
    </button>
  );
}

function waLink(phone: string, itemTitle: string, ref: string) {
  const digits = phone.replace(/[^\d]/g, "").replace(/^972/, "");
  return (
    `https://wa.me/972${digits.replace(/^0/, "")}?text=` +
    encodeURIComponent(`היי! זו הודעה מ-Closet לגבי "${itemTitle}" (${ref})`)
  );
}

export function DealCard({ view }: { view: DealView }) {
  const router = useRouter();
  const { tx, role } = view;
  const isBuyer = role === "buyer";
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>(
    view.counterpartyPaymentMethods[0] ?? "bit",
  );

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) router.refresh();
      else setError(r.error ?? "שגיאה");
    });

  const terminal = ["COMPLETED", "REFUNDED", "CANCELLED", "DISPUTED"].includes(
    tx.state,
  );
  const bitNumber = view.counterpartyBitPhone ?? view.counterpartyPhone;

  return (
    <div className="space-y-3 rounded-2xl border border-blush-100 bg-white p-3">
      <Link href={`/item/${view.itemId}`} className="flex gap-3">
        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-blush-50">
          {view.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={view.coverUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{view.itemTitle}</p>
          <p className="text-xs text-stone-400">
            {isBuyer ? "מוכרת" : "קונה"}: {view.counterpartyName}
          </p>
          <p className="text-xs font-bold">{shekels(tx.price_agorot)}</p>
        </div>
      </Link>

      <div className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-xs">
        <span className="text-stone-400">{he.deals.state}</span>
        <span className="font-semibold">{TX_STATE_HE[tx.state]}</span>
      </div>

      {["RESERVED", "PICKED_UP", "RETURN_IN_TRANSIT"].includes(tx.state) && (
        <a
          href={`/chat/${tx.id}`}
          className="flex items-center justify-center gap-1 rounded-xl border border-blush-200 py-2 text-sm font-semibold text-blush-600"
        >
          💬 {he.chat.open}
          {view.unreadChat > 0 && (
            <span className="rounded-full bg-blush-500 px-1.5 text-[10px] text-white">
              {view.unreadChat}
            </span>
          )}
        </a>
      )}

      {tx.mismatch_flagged_at && tx.state === "RESERVED" && (
        <p className="rounded-xl bg-amber-50 p-2 text-xs text-amber-700">
          {he.deals.mismatchFlagged}
        </p>
      )}

      {/* Reveal + payment card (RESERVED) */}
      {tx.state === "RESERVED" && (
        <div className="space-y-2 rounded-2xl border border-blush-200 bg-blush-50 p-3">
          <p className="text-sm font-bold">{he.deals.matched}</p>
          <div className="flex items-center gap-2">
            <Avatar
              name={view.counterpartyName}
              url={view.counterpartyAvatar}
              size={32}
            />
            <p className="text-sm" dir="ltr">
              {view.counterpartyName} · {view.counterpartyPhone}
            </p>
          </div>
          <a
            href={waLink(view.counterpartyPhone, view.itemTitle, tx.payment_ref ?? "")}
            target="_blank"
            rel="noreferrer"
            onClick={() =>
              track("whatsapp_opened", { tx_id: tx.id, side: role })
            }
            className="block rounded-xl bg-green-600 py-2 text-center text-sm font-semibold text-white"
          >
            💬 {he.deals.openWhatsapp}
          </a>

          <div className="space-y-1 rounded-xl bg-white/60 p-2">
            <p className="text-xs font-semibold">{he.deals.payment}</p>
            <p className="text-sm">
              {he.deals.amount}: <b>{shekels(tx.price_agorot)}</b>
            </p>
            <Copyable label={he.deals.toBit} value={bitNumber} />
            {tx.payment_ref && (
              <Copyable label={he.deals.inNote} value={tx.payment_ref} />
            )}
            <p className="pt-1 text-[11px] text-stone-500">
              {he.deals.payOnHandoff}
            </p>
            <p className="text-[11px] text-stone-400">
              {he.payment.disclaimer}
            </p>
            {view.prepayNudge && (
              <p className="text-[11px] text-red-500">{he.deals.prepayWarn}</p>
            )}
          </div>

          {isBuyer && !tx.handoff_method && (
            <div className="flex gap-2">
              <button
                onClick={() => act(() => chooseHandoff(tx.id, "pickup"))}
                className="flex-1 rounded-full border border-blush-300 py-1.5 text-xs font-semibold text-blush-600"
              >
                {he.deals.pickup}
              </button>
              <button
                onClick={() => act(() => chooseHandoff(tx.id, "shipping"))}
                className="flex-1 rounded-full border border-stone-200 py-1.5 text-xs text-stone-500"
              >
                {he.deals.shipping}
              </button>
            </div>
          )}

          {tx.hold_expires_at && (
            <Countdown
              deadline={tx.hold_expires_at}
              label={he.deals.heldForYou(48)}
            />
          )}

          {isBuyer ? (
            tx.buyer_marked_paid_at ? (
              <p className="text-center text-xs text-stone-400">
                {he.deals.waitingSeller}
              </p>
            ) : (
              <div className="space-y-2">
                {view.counterpartyPaymentMethods.length > 1 && (
                  <select
                    value={method}
                    onChange={(e) =>
                      setMethod(e.target.value as PaymentMethod)
                    }
                    className="w-full rounded-lg border border-stone-200 p-2 text-sm"
                  >
                    {view.counterpartyPaymentMethods.map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_METHOD_HE[m]}
                      </option>
                    ))}
                  </select>
                )}
                <Button
                  className="w-full"
                  disabled={pending}
                  onClick={() => act(() => buyerMarkPaid(tx.id, method))}
                >
                  {he.deals.actions.markPaid}
                </Button>
              </div>
            )
          ) : tx.seller_confirmed_paid_at ? (
            <p className="text-center text-xs text-stone-400">
              {he.deals.waitingBuyer}
            </p>
          ) : (
            <Button
              className="w-full"
              disabled={pending}
              onClick={() => act(() => sellerConfirmPaid(tx.id))}
            >
              {he.deals.actions.confirmPaid}
            </Button>
          )}
          <button
            className="w-full text-[11px] text-stone-400 underline"
            onClick={() => act(() => cancelTx(tx.id, "בוטל על ידי משתמש"))}
          >
            {he.deals.actions.cancel}
          </button>
        </div>
      )}

      {tx.state === "PICKED_UP" && tx.return_deadline && (
        <Countdown
          deadline={tx.return_deadline}
          label={he.deals.returnCountdown}
        />
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {tx.state === "PICKED_UP" && isBuyer && (
        <div className="space-y-2">
          <Button
            className="w-full"
            disabled={pending}
            onClick={() => act(() => keepDress(tx.id))}
          >
            {he.deals.actions.keep}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            disabled={pending}
            onClick={() => act(() => startReturn(tx.id))}
          >
            {he.deals.actions.startReturn}
          </Button>
        </div>
      )}
      {tx.state === "PICKED_UP" && !isBuyer && (
        <p className="text-xs text-stone-400">
          הקונה מודדת. אם לא תחזיר תוך 48 שעות — העסקה נסגרת אוטומטית.
        </p>
      )}

      {tx.state === "RETURN_IN_TRANSIT" && !isBuyer && (
        <Button
          className="w-full"
          disabled={pending}
          onClick={() => act(() => sellerConfirmReturn(tx.id))}
        >
          {he.deals.actions.sellerConfirmReturn}
        </Button>
      )}
      {tx.state === "RETURN_IN_TRANSIT" && isBuyer && (
        <p className="text-xs text-stone-400">
          תאמו את ההחזרה וההחזר הכספי בוואטסאפ. המוכרת תאשר כאן כשתקבל.
        </p>
      )}

      {terminal && !view.alreadyRated && tx.state !== "CANCELLED" && (
        <RateRow
          onRate={(n) => act(() => rateCounterparty({ txId: tx.id, score: n }))}
          pending={pending}
        />
      )}

      {!terminal && (
        <button
          className="w-full text-[11px] text-stone-300 underline"
          onClick={() => {
            const reason = window.prompt("מה הבעיה?") ?? "";
            if (reason) act(() => disputeTx(tx.id, reason));
          }}
        >
          דיווח על בעיה בעסקה
        </button>
      )}

      <details className="text-[11px] text-stone-400">
        <summary>יומן העסקה ({view.events.length})</summary>
        <ul className="mt-1 space-y-1">
          {view.events.map((e) => (
            <li key={e.id}>
              {new Date(e.created_at).toLocaleString("he-IL")} — {e.note}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function RateRow({
  onRate,
  pending,
}: {
  onRate: (n: number) => void;
  pending: boolean;
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl bg-stone-50 p-2">
      <span className="text-xs text-stone-400">{he.deals.actions.rate}:</span>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          disabled={pending}
          onClick={() => onRate(n)}
          className="text-lg text-amber-400"
        >
          ☆
        </button>
      ))}
    </div>
  );
}
