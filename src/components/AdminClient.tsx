"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminCancel,
  adminForceComplete,
  adminHideItem,
  adminResolveReport,
  adminResolveReturn,
  adminRunSweep,
  adminSuspendUser,
} from "@/lib/actions/admin";

type Res = { ok: boolean; error?: string };

function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const act = (fn: () => Promise<Res | { ok: true; [k: string]: unknown }>) =>
    start(async () => {
      setMsg(null);
      const r = (await fn()) as Res;
      if (r.ok) router.refresh();
      else setMsg(r.error ?? "שגיאה");
    });
  return { act, pending, msg };
}

const btn =
  "rounded-full border border-stone-300 px-2 py-1 text-[11px] font-semibold disabled:opacity-40";

export function TxAdminControls({
  txId,
  state,
}: {
  txId: string;
  state: string;
}) {
  const { act, pending, msg } = useAct();
  const active = !["COMPLETED", "REFUNDED", "CANCELLED", "DISPUTED"].includes(
    state,
  );
  return (
    <div className="flex flex-wrap items-center gap-1">
      {state === "PICKED_UP" && (
        <button
          className={btn}
          disabled={pending}
          onClick={() => act(() => adminForceComplete(txId))}
        >
          סגור כהושלם
        </button>
      )}
      {state === "RETURN_IN_TRANSIT" && (
        <button
          className={btn}
          disabled={pending}
          onClick={() => act(() => adminResolveReturn(txId))}
        >
          אשר החזרה
        </button>
      )}
      {active && (
        <button
          className={btn + " border-red-300 text-red-600"}
          disabled={pending}
          onClick={() => act(() => adminCancel(txId, "ביטול ידני מהניהול"))}
        >
          בטל עסקה
        </button>
      )}
      {msg && <span className="text-[11px] text-red-500">{msg}</span>}
    </div>
  );
}

export function ItemModControls({
  itemId,
  hidden,
}: {
  itemId: string;
  hidden: boolean;
}) {
  const { act, pending } = useAct();
  return (
    <button
      className={btn}
      disabled={pending}
      onClick={() => act(() => adminHideItem(itemId, !hidden))}
    >
      {hidden ? "בטל הסתרה" : "הסתר"}
    </button>
  );
}

export function UserModControls({
  userId,
  suspended,
}: {
  userId: string;
  suspended: boolean;
}) {
  const { act, pending } = useAct();
  return (
    <button
      className={btn}
      disabled={pending}
      onClick={() => act(() => adminSuspendUser(userId, !suspended))}
    >
      {suspended ? "בטל השעיה" : "השעה"}
    </button>
  );
}

export function ResolveReportButton({ reportId }: { reportId: string }) {
  const { act, pending } = useAct();
  return (
    <button
      className={btn}
      disabled={pending}
      onClick={() => act(() => adminResolveReport(reportId))}
    >
      טופל
    </button>
  );
}

export function RunSweepButton() {
  const { act, pending } = useAct();
  return (
    <button
      className="rounded-full bg-blush-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
      disabled={pending}
      onClick={() => act(() => adminRunSweep())}
    >
      הרץ בדיקת פקיעת חלונות ותזכורות
    </button>
  );
}
