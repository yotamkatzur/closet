"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestOtp, completeOnboarding } from "@/lib/actions/auth";
import { he } from "@/data/he";
import { Button, inputClass } from "./ui";

type Method = "phone" | "email";

export function SignInPanel({ next }: { next?: string }) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("phone");
  const [step, setStep] = useState<"id" | "code">("id");
  const [value, setValue] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const tab = (m: Method, label: string) => (
    <button
      onClick={() => {
        setMethod(m);
        setStep("id");
        setValue("");
        setError(null);
      }}
      className={`flex-1 rounded-xl py-2 text-sm font-semibold ${
        method === m ? "bg-blush-500 text-white" : "bg-stone-100 text-stone-500"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-lg font-bold">{he.auth.signInToContinue}</h2>

      {step === "id" ? (
        <>
          <div className="flex gap-2">
            {tab("phone", he.auth.withPhone)}
            {tab("email", he.auth.withEmail)}
          </div>
          <input
            className={inputClass}
            inputMode={method === "phone" ? "tel" : "email"}
            dir="ltr"
            placeholder={
              method === "phone"
                ? he.onboarding.phonePlaceholder
                : he.auth.emailPlaceholder
            }
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button
            className="w-full"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await requestOtp({ method, value });
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
            {method === "email"
              ? he.auth.codeHintEmail
              : process.env.NEXT_PUBLIC_SMS_LIVE
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
                const r = await completeOnboarding({ method, value, code });
                if (r.ok) {
                  router.replace(next || "/");
                  router.refresh();
                } else setError(r.error ?? "שגיאה");
              })
            }
          >
            {he.onboarding.verify}
          </Button>
          <button
            onClick={() => {
              setStep("id");
              setCode("");
              setError(null);
            }}
            className="w-full text-center text-xs text-stone-400"
          >
            {he.common.back}
          </button>
        </>
      )}
    </div>
  );
}
