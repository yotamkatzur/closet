"use client";

import { useState, useTransition } from "react";
import { submitReport } from "@/lib/actions/misc";
import { he } from "@/data/he";
import { Button } from "./ui";

export function ReportButton({
  targetType,
  targetId,
  signedIn,
}: {
  targetType: "item" | "user";
  targetId: string;
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <button
        onClick={() => (signedIn ? setOpen(true) : (window.location.href = "/profile"))}
        className="text-[11px] text-stone-400 underline"
      >
        {he.item.report}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
          <div className="w-full max-w-2xl rounded-t-3xl bg-white p-5 pb-8">
            {done ? (
              <p className="py-6 text-center text-sm">{he.report.sent}</p>
            ) : (
              <>
                <h3 className="font-bold">{he.report.title}</h3>
                <p className="mb-3 mt-1 text-sm text-stone-500">
                  {he.report.reasonLabel}
                </p>
                <div className="space-y-2">
                  {he.report.reasons.map((r) => (
                    <label key={r} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="reason"
                        value={r}
                        onChange={(e) => setReason(e.target.value)}
                      />
                      {r}
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    disabled={!reason || pending}
                    onClick={() =>
                      start(async () => {
                        const res = await submitReport({
                          targetType,
                          targetId,
                          reason,
                        });
                        if (res.ok) setDone(true);
                      })
                    }
                  >
                    {he.report.submit}
                  </Button>
                  <Button variant="ghost" onClick={() => setOpen(false)}>
                    {he.common.cancel}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
