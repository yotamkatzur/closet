"use server";

import { revalidatePath } from "next/cache";
import {
  consumeOtp,
  createUser,
  getUserByEmail,
  getUserByPhone,
  setOtp,
  upsertBodyCard,
} from "@/lib/db/repo";
import { clearSession, setSession } from "@/lib/auth";
import { normalizeIsraeliPhone } from "@/lib/phone";
import { normalizeEmail } from "@/lib/email-addr";
import {
  checkPhoneVerification,
  startPhoneVerification,
  verifyLive,
} from "@/lib/sms";
import { emailLive, sendLoginCode } from "@/lib/email";
import type { Size, User } from "@/lib/types";
import { SIZES } from "@/lib/types";

const OTP_TTL_MS = 10 * 60 * 1000;

export type LoginMethod = "phone" | "email";

type Resolved =
  | { ok: true; method: "phone"; phone: string }
  | { ok: true; method: "email"; email: string }
  | { ok: false; error: string };

function resolveTarget(method: LoginMethod, value: string): Resolved {
  if (method === "email") {
    const email = normalizeEmail(value);
    if (!email) return { ok: false, error: "כתובת אימייל לא תקינה" };
    return { ok: true, method: "email", email };
  }
  const phone = normalizeIsraeliPhone(value);
  if (!phone) return { ok: false, error: "מספר טלפון לא תקין" };
  return { ok: true, method: "phone", phone };
}

// Generate a code, store it, print to the server console. Local-dev fallback
// used whenever the real channel (Twilio Verify / email) isn't configured.
function consoleOtp(target: string): void {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  setOtp(target, code, OTP_TTL_MS);
  console.info(
    `\n  ┌──────────────────────────────────────────┐\n  │  login code for ${target}: ${code}\n  └──────────────────────────────────────────┘\n`,
  );
}

export async function requestOtp(input: {
  method: LoginMethod;
  value: string;
}): Promise<{ ok: boolean; error?: string }> {
  const t = resolveTarget(input.method, input.value);
  if (!t.ok) return { ok: false, error: t.error };

  if (t.method === "email") {
    // Email is a login shortcut, not a sign-up path — the account must exist.
    if (!getUserByEmail(t.email)) {
      return {
        ok: false,
        error: "לא נמצא חשבון עם האימייל הזה. התחברי עם הטלפון והוסיפי אימייל בפרופיל.",
      };
    }
    if (!emailLive) {
      consoleOtp(t.email);
      return { ok: true };
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setOtp(t.email, code, OTP_TTL_MS);
    const r = await sendLoginCode(t.email, code);
    return r.ok ? { ok: true } : { ok: false, error: "לא הצלחנו לשלוח מייל, נסי טלפון" };
  }

  // phone
  if (verifyLive) {
    // Twilio Verify generates, sends and rate-limits the code.
    return startPhoneVerification(t.phone);
  }
  consoleOtp(t.phone);
  return { ok: true };
}

async function verifyCode(
  t: Extract<Resolved, { ok: true }>,
  code: string,
): Promise<boolean> {
  const clean = code.trim();
  if (t.method === "email") return consumeOtp(t.email, clean);
  if (verifyLive) return checkPhoneVerification(t.phone, clean);
  return consumeOtp(t.phone, clean);
}

export async function completeOnboarding(input: {
  method?: LoginMethod;
  value?: string;
  // legacy callers passed `phone`
  phone?: string;
  code: string;
  heightCm?: number;
  usualSize?: Size;
}): Promise<{ ok: boolean; error?: string }> {
  const method: LoginMethod = input.method ?? "phone";
  const value = input.value ?? input.phone ?? "";
  const t = resolveTarget(method, value);
  if (!t.ok) return { ok: false, error: t.error };

  const verified = await verifyCode(t, input.code);
  if (!verified) return { ok: false, error: "קוד שגוי או שפג תוקפו" };

  let user: User | null =
    t.method === "email" ? getUserByEmail(t.email) : getUserByPhone(t.phone);

  if (!user && t.method === "email") {
    // Shouldn't happen (requestOtp already guarded), but never sign up by email.
    return {
      ok: false,
      error: "לא נמצא חשבון עם האימייל הזה. התחברי עם הטלפון קודם.",
    };
  }

  if (!user && t.method === "phone") {
    const suffix = t.phone.slice(-4);
    // Phones listed in ADMIN_PHONES become admins on first sign-in — this is how
    // the founder gets her admin account without a seed script.
    const adminPhones = (process.env.ADMIN_PHONES ?? "")
      .split(",")
      .map((p) => normalizeIsraeliPhone(p.trim()))
      .filter(Boolean);
    user = createUser({
      phone: t.phone,
      display_name: `משתמשת ${suffix}`,
      is_admin: adminPhones.includes(t.phone),
    });
  }

  if (!user) return { ok: false, error: "שגיאה" };

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
