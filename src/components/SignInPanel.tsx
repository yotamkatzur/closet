"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestOtp, completeOnboarding } from "@/lib/actions/auth";
import { he } from "@/data/he";
import { Button, inputClass } from "./ui";

export function SignInPanel({ next }: { next?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-lg font-bold">{he.auth.signInToContinue}</h2>
      {step === "phone" ? (
        <>
          <input
            className={inputClass}
            inputMode="tel"
            dir="ltr"
            placeholder={he.onboarding.phonePlaceholder}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button
            className="w-full"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await requestOtp(phone);
                if (r.ok) setStep("code");
                else setError(r.error ?? "שגיאה");
              })
            }
          >
            {he.onboarding.sendCode}
          </Button>
        </>
      ) : (
        <>
          <p className="text-xs text-stone-400">
            {process.env.NEXT_PUBLIC_SMS_LIVE
              ? he.onboarding.codeHintSms
              : he.onboarding.codeHintDev}
          </p>
          <input
            className={inputClass}
            inputMode="numeric"
            dir="ltr"
            placeholder="______"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button
            className="w-full"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await completeOnboarding({ phone, code });
                if (r.ok) {
                  router.replace(next || "/");
                  router.refresh();
                } else setError(r.error ?? "שגיאה");
              })
            }
          >
            {he.onboarding.verify}
          </Button>
        </>
      )}
    </div>
  );
}
