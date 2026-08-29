"use server";

import { revalidatePath } from "next/cache";
import { consumeOtp, createUser, getUserByPhone, setOtp, upsertBodyCard } from "@/lib/db/repo";
import { clearSession, setSession } from "@/lib/auth";
import { normalizeIsraeliPhone } from "@/lib/phone";
import {
  checkPhoneVerification,
  startPhoneVerification,
  verifyLive,
} from "@/lib/sms";
import type { Size } from "@/lib/types";
import { SIZES } from "@/lib/types";

const OTP_TTL_MS = 10 * 60 * 1000;

export async function requestOtp(
  phoneRaw: string,
): Promise<{ ok: boolean; error?: string }> {
  const phone = normalizeIsraeliPhone(phoneRaw);
  if (!phone) return { ok: false, error: "מספר טלפון לא תקין" };

  if (verifyLive) {
    // Twilio Verify generates, sends and rate-limits the code.
    return startPhoneVerification(phone);
  }

  // Fallback (local dev): generate a code and print it to the server console.
  const code = String(Math.floor(100000 + Math.random() * 900000));
  setOtp(phone, code, OTP_TTL_MS);
  console.info(
    `\n  ┌──────────────────────────────────────────┐\n  │  OTP for ${phone}: ${code}          │\n  └──────────────────────────────────────────┘\n`,
  );
  return { ok: true };
}

export async function completeOnboarding(input: {
  phone: string;
  code: string;
  heightCm?: number;
  usualSize?: Size;
}): Promise<{ ok: boolean; error?: string }> {
  const phone = normalizeIsraeliPhone(input.phone);
  if (!phone) return { ok: false, error: "מספר טלפון לא תקין" };
  const code = input.code.trim();

  const verified = verifyLive
    ? await checkPhoneVerification(phone, code)
    : consumeOtp(phone, code);
  if (!verified) return { ok: false, error: "קוד שגוי או שפג תוקפו" };

  let user = getUserByPhone(phone);
  if (!user) {
    const suffix = phone.slice(-4);
    // Phones listed in ADMIN_PHONES become admins on first sign-in — this is how
    // the founder gets her admin account without a seed script.
    const adminPhones = (process.env.ADMIN_PHONES ?? "")
      .split(",")
      .map((p) => normalizeIsraeliPhone(p.trim()))
      .filter(Boolean);
    user = createUser({
      phone,
      display_name: `משתמשת ${suffix}`,
      is_admin: adminPhones.includes(phone),
    });
  }

  if (
    input.heightCm &&
    input.usualSize &&
    input.heightCm >= 120 &&
    input.heightCm <= 210 &&
    SIZES.includes(input.usualSize)
  ) {
    upsertBodyCard(user.id, {
      height_cm: Math.round(input.heightCm),
      usual_size: input.usualSize,
    });
  }

  await setSession(user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signOut(): Promise<void> {
  await clearSession();
  revalidatePath("/", "layout");
}
