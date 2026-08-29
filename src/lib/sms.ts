import "server-only";

// SMS via Twilio. Two things:
//  - login codes  → Twilio Verify (handles generation, rate-limit, IL sender)
//  - notifications → Twilio Messaging API (plain SMS)
//
// If TWILIO_ACCOUNT_SID is not set, everything falls back to the server console
// so local dev needs no account.

const SID = process.env.TWILIO_ACCOUNT_SID ?? "";
const TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";
const VERIFY_SID = process.env.TWILIO_VERIFY_SERVICE_SID ?? "";
const SMS_FROM = process.env.TWILIO_SMS_FROM ?? "";
const MESSAGING_SID = process.env.TWILIO_MESSAGING_SERVICE_SID ?? "";

export const smsLive = !!SID && !!TOKEN;
export const verifyLive = smsLive && !!VERIFY_SID;

function auth(): string {
  return "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64");
}

async function twilioPost(
  url: string,
  form: Record<string, string>,
): Promise<{ ok: boolean; json: unknown }> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: auth(),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form).toString(),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

// --------------------------------------------------------------- login codes
export async function startPhoneVerification(
  phoneE164: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!verifyLive) {
    console.info(
      `\n  ┌─ [console SMS] verification requested for ${phoneE164}\n  └─ set TWILIO_* env vars for real SMS; use code from consumeOtp fallback\n`,
    );
    return { ok: true };
  }
  const { ok, json } = await twilioPost(
    `https://verify.twilio.com/v2/Services/${VERIFY_SID}/Verifications`,
    { To: phoneE164, Channel: "sms" },
  );
  if (!ok) {
    const msg = (json as { message?: string })?.message ?? "SMS failed";
    return { ok: false, error: msg };
  }
  return { ok: true };
}

export async function checkPhoneVerification(
  phoneE164: string,
  code: string,
): Promise<boolean> {
  if (!verifyLive) return false; // caller uses the local consumeOtp fallback
  const { ok, json } = await twilioPost(
    `https://verify.twilio.com/v2/Services/${VERIFY_SID}/VerificationCheck`,
    { To: phoneE164, Code: code },
  );
  return ok && (json as { status?: string })?.status === "approved";
}

// -------------------------------------------------------------- notifications
export async function sendSms(phoneE164: string, body: string): Promise<void> {
  if (!smsLive || (!SMS_FROM && !MESSAGING_SID)) {
    console.info(`[SMS → ${phoneE164}] ${body}`);
    return;
  }
  const form: Record<string, string> = { To: phoneE164, Body: body };
  if (MESSAGING_SID) form.MessagingServiceSid = MESSAGING_SID;
  else form.From = SMS_FROM;
  const { ok, json } = await twilioPost(
    `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`,
    form,
  );
  if (!ok) {
    console.error(
      `[SMS failed → ${phoneE164}]`,
      (json as { message?: string })?.message,
    );
  }
}
