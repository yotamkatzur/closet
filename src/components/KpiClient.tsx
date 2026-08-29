"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { takeKpiSnapshot } from "@/lib/actions/kpi";

export function SnapshotButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-blush-200 px-3 py-1 text-xs font-semibold text-blush-600"
      >
        שמירת מדד שבועי
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="מה קרה השבוע?"
        className="w-32 rounded-lg border border-stone-200 px-2 py-1 text-xs"
      />
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            await takeKpiSnapshot(note);
            setOpen(false);
            setNote("");
            router.refresh();
          })
        }
        className="rounded-full bg-blush-500 px-3 py-1 text-xs font-semibold text-white"
      >
        שמירה
      </button>
    </div>
  );
}
