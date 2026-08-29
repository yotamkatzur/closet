import "server-only";

// Transactional email — login codes and email-address verification.
//
// Two backends, picked automatically:
//   1. Resend  — set RESEND_API_KEY (+ EMAIL_FROM on a domain you verified there)
//   2. SMTP    — set SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS (e.g. Gmail
//                with an app password). Works for any recipient, ~500/day.
// If neither is set, the message is printed to the server console (local dev),
// mirroring src/lib/sms.ts.

const RESEND_KEY = process.env.RESEND_API_KEY ?? "";
const SMTP_HOST = process.env.SMTP_HOST ?? "";
const SMTP_PORT = Number(process.env.SMTP_PORT ?? "587");
const SMTP_USER = process.env.SMTP_USER ?? "";
const SMTP_PASS = process.env.SMTP_PASS ?? "";
const FROM = process.env.EMAIL_FROM ?? "Closet <onboarding@resend.dev>";

export const emailLive =
  !!RESEND_KEY || (!!SMTP_HOST && !!SMTP_USER && !!SMTP_PASS);

async function sendViaResend(
  to: string,
  subject: string,
  text: string,
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${RESEND_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, text }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(j?.message || `Resend responded ${res.status}`);
  }
}

async function sendViaSmtp(
  to: string,
  subject: string,
  text: string,
): Promise<void> {
  const nodemailer = (await import("nodemailer")).default;
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  await transport.sendMail({ from: FROM, to, subject, text });
}

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!emailLive) {
    console.info(
      `\n  ┌─ [console EMAIL] to ${to}\n  │  ${subject}\n  │  ${text.replace(/\n/g, "\n  │  ")}\n  └─ set RESEND_API_KEY or SMTP_* for real email\n`,
    );
    return { ok: true };
  }
  try {
    if (RESEND_KEY) await sendViaResend(to, subject, text);
    else await sendViaSmtp(to, subject, text);
    return { ok: true };
  } catch (e) {
    console.error(`[email failed → ${to}]`, e);
    return { ok: false, error: e instanceof Error ? e.message : "email failed" };
  }
}

export async function sendLoginCode(
  to: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  return sendEmail(
    to,
    `הקוד שלך ל-Closet: ${code}`,
    `הקוד לכניסה ל-Closet הוא: ${code}\n` +
      `הקוד תקף ל-10 דקות.\n\n` +
      `אם לא ביקשת את הקוד הזה אפשר להתעלם מהמייל.`,
  );
}
