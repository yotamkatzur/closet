"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  addFitHistory,
  consumeOtp,
  getUserByEmail,
  setOtp,
  upsertBodyCard,
  updateUser,
} from "@/lib/db/repo";
import { saveDataUrl } from "@/lib/media";
import { normalizeIsraeliPhone } from "@/lib/phone";
import { normalizeEmail } from "@/lib/email-addr";
import { emailLive, sendEmail, sendLoginCode } from "@/lib/email";
import {
  BODY_SHAPES,
  FIT_VERDICTS,
  PAYMENT_METHODS,
  SIZES,
  type PaymentMethod,
} from "@/lib/types";

const bodyCardSchema = z.object({
  height_cm: z.coerce.number().int().min(120).max(210),
  usual_size: z.enum(SIZES as unknown as [string, ...string[]]),
  bra_size: z.string().trim().max(12).optional().or(z.literal("")),
  body_shape_tag: z
    .enum(BODY_SHAPES as unknown as [string, ...string[]])
    .optional()
    .or(z.literal("")),
  shoulders_cm: z.coerce.number().int().min(20).max(80).optional().or(z.nan()),
  waist_cm: z.coerce.number().int().min(40).max(160).optional().or(z.nan()),
  hips_cm: z.coerce.number().int().min(50).max(180).optional().or(z.nan()),
});

export async function saveBodyCard(
  raw: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const parsed = bodyCardSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "נתונים לא תקינים" };
  const d = parsed.data;
  const numOrNull = (n: number | undefined) =>
    typeof n === "number" && Number.isFinite(n) ? n : null;

  upsertBodyCard(user.id, {
    height_cm: d.height_cm,
    usual_size: d.usual_size as (typeof SIZES)[number],
    bra_size: d.bra_size ? d.bra_size : null,
    body_shape_tag: d.body_shape_tag
      ? (d.body_shape_tag as (typeof BODY_SHAPES)[number])
      : null,
    shoulders_cm: numOrNull(d.shoulders_cm),
    waist_cm: numOrNull(d.waist_cm),
    hips_cm: numOrNull(d.hips_cm),
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateProfile(input: {
  display_name?: string;
  city?: string | null;
  avatar_url?: string | null;
}): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const patch: Record<string, unknown> = {};
  if (input.display_name && input.display_name.trim())
    patch.display_name = input.display_name.trim().slice(0, 40);
  if (input.city !== undefined) patch.city = input.city || null;
  if (input.avatar_url !== undefined) patch.avatar_url = input.avatar_url || null;
  updateUser(user.id, patch);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function uploadAvatar(
  dataUrl: string,
): Promise<{ ok: boolean; error?: string; url?: string }> {
  const user = await requireUser();
  if (!/^data:image\//.test(dataUrl))
    return { ok: false, error: "קובץ לא תקין" };
  let url: string;
  try {
    url = saveDataUrl(dataUrl);
  } catch {
    return { ok: false, error: "לא הצלחנו לשמור את התמונה" };
  }
  updateUser(user.id, { avatar_url: url });
  revalidatePath("/", "layout");
  revalidatePath(`/u/${user.id}`);
  return { ok: true, url };
}

export async function removeAvatar(): Promise<{ ok: boolean }> {
  const user = await requireUser();
  updateUser(user.id, { avatar_url: null });
  revalidatePath("/", "layout");
  revalidatePath(`/u/${user.id}`);
  return { ok: true };
}

export async function savePaymentMethods(input: {
  methods: string[];
  bitPhone?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const methods = input.methods.filter((m) =>
    (PAYMENT_METHODS as string[]).includes(m),
  ) as PaymentMethod[];
  if (methods.length === 0) return { ok: false, error: "בחרי לפחות אמצעי אחד" };
  let bit_phone: string | null = null;
  if (input.bitPhone && input.bitPhone.trim()) {
    bit_phone = normalizeIsraeliPhone(input.bitPhone);
    if (!bit_phone) return { ok: false, error: "מספר ביט לא תקין" };
  }
  updateUser(user.id, { payment_methods: methods, bit_phone });
  revalidatePath("/", "layout");
  return { ok: true };
}

// --- email login channel ---------------------------------------------------
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;

export async function startEmailVerification(
  emailRaw: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const email = normalizeEmail(emailRaw);
  if (!email) return { ok: false, error: "כתובת אימייל לא תקינה" };

  const taken = getUserByEmail(email);
  if (taken && taken.id !== user.id)
    return { ok: false, error: "האימייל הזה כבר משויך לחשבון אחר" };
  if (taken && taken.id === user.id) return { ok: true }; // already verified

  const code = String(Math.floor(100000 + Math.random() * 900000));
  setOtp(email, code, EMAIL_CODE_TTL_MS);

  if (!emailLive) {
    // dev: setOtp already logged nothing — sendEmail logs to console
    await sendEmail(email, `אימות אימייל ל-Closet: ${code}`, `הקוד לאימות: ${code}`);
    return { ok: true };
  }
  const r = await sendLoginCode(email, code);
  return r.ok ? { ok: true } : { ok: false, error: "לא הצלחנו לשלוח מייל" };
}

export async function confirmEmailVerification(input: {
  email: string;
  code: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "כתובת אימייל לא תקינה" };

  const taken = getUserByEmail(email);
  if (taken && taken.id !== user.id)
    return { ok: false, error: "האימייל הזה כבר משויך לחשבון אחר" };

  if (!consumeOtp(email, input.code.trim()))
    return { ok: false, error: "קוד שגוי או שפג תוקפו" };

  updateUser(user.id, { email });
  revalidatePath("/u/" + user.id);
  return { ok: true };
}

export async function removeEmail(): Promise<{ ok: boolean }> {
  const user = await requireUser();
  updateUser(user.id, { email: null });
  revalidatePath("/u/" + user.id);
  return { ok: true };
}

export async function addFitHistoryEntry(input: {
  brand: string;
  size: string;
  verdict: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (!input.brand.trim() || !input.size.trim())
    return { ok: false, error: "חסרים פרטים" };
  if (!(FIT_VERDICTS as string[]).includes(input.verdict))
    return { ok: false, error: "פדבק לא תקין" };
  addFitHistory({
    user_id: user.id,
    brand: input.brand.trim(),
    size: input.size.trim(),
    verdict: input.verdict as (typeof FIT_VERDICTS)[number],
    source: "self_reported",
  });
  revalidatePath("/u/" + user.id);
  return { ok: true };
}
