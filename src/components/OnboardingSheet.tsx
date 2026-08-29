"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { he } from "@/data/he";
import { SIZES, type Size } from "@/lib/types";
import { Button, inputClass } from "./ui";
import { requestOtp, completeOnboarding } from "@/lib/actions/auth";
import { track } from "@/lib/analytics/client";

type Step = "fields" | "phone" | "code" | "done";

export function OnboardingSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("fields");
  const [height, setHeight] = useState("");
  const [size, setSize] = useState<Size | "">("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) return null;

  const heightNum = Number(height);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div className="w-full max-w-2xl rounded-t-3xl bg-white p-5 pb-8 shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-200" />

        {step === "fields" && (
          <>
            <h2 className="text-lg font-bold">{he.onboarding.sheetTitle}</h2>
            <p className="mb-4 mt-1 text-sm text-stone-500">
              {he.onboarding.sheetSub}
            </p>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">
                  {he.onboarding.height} ({he.onboarding.heightUnit})
                </span>
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={height}
                  onFocus={() => track("body_card_started")}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="168"
                />
              </label>
              <div>
                <span className="mb-1 block text-sm font-medium">
                  {he.onboarding.usualSize}
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {SIZES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className={`rounded-xl border py-2 text-sm font-semibold ${
                        size === s
                          ? "border-blush-500 bg-blush-500 text-white"
                          : "border-stone-200"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <Button
              className="mt-5 w-full"
              disabled={!(heightNum >= 120 && heightNum <= 210) || !size}
              onClick={() => {
                setError(null);
                setStep("phone");
              }}
            >
              {he.onboarding.continue}
            </Button>
            <button
              onClick={onClose}
              className="mt-3 w-full text-center text-xs text-stone-400"
            >
              {he.common.cancel}
            </button>
          </>
        )}

        {step === "phone" && (
          <>
            <h2 className="text-lg font-bold">{he.onboarding.phoneTitle}</h2>
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-medium">
                {he.onboarding.phoneLabel}
              </span>
              <input
                className={inputClass}
                inputMode="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={he.onboarding.phonePlaceholder}
              />
            </label>
            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
            <Button
              className="mt-4 w-full"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  track("body_card_submitted", {
                    size,
                    height_cm_bucket:
                      heightNum < 158
                        ? "<158"
                        : heightNum < 163
                          ? "158-162"
                          : heightNum < 168
                            ? "163-167"
                            : heightNum < 173
                              ? "168-172"
                              : "173+",
                  });
                  const r = await requestOtp(phone);
                  if (r.ok) {
                    track("auth_started");
                    setStep("code");
                  } else setError(r.error ?? "שגיאה");
                })
              }
            >
              {he.onboarding.sendCode}
            </Button>
          </>
        )}

        {step === "code" && (
          <>
            <h2 className="text-lg font-bold">{he.onboarding.phoneTitle}</h2>
            <p className="mt-1 text-xs text-stone-400">
              {process.env.NEXT_PUBLIC_SMS_LIVE
                ? he.onboarding.codeHintSms
                : he.onboarding.codeHintDev}
            </p>
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-medium">
                {he.onboarding.codeLabel}
              </span>
              <input
                className={inputClass}
                inputMode="numeric"
                dir="ltr"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="______"
              />
            </label>
            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
            <Button
              className="mt-4 w-full"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await completeOnboarding({
                    phone,
                    code,
                    heightCm: heightNum,
                    usualSize: size as Size,
                  });
                  if (r.ok) {
                    track("auth_completed", { is_new_user: true });
                    track("onboarding_completed", {});
                    setStep("done");
                    router.refresh();
                    setTimeout(onClose, 1400);
                  } else setError(r.error ?? "שגיאה");
                })
              }
            >
              {he.onboarding.verify}
            </Button>
          </>
        )}

        {step === "done" && (
          <div className="py-6 text-center">
            <p className="text-2xl">🎉</p>
            <p className="mt-2 font-semibold">{he.onboarding.done}</p>
            <p className="mt-1 text-xs text-stone-400">
              {he.onboarding.enrichLater}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
