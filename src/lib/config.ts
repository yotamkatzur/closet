// Centralised env access. Every value has a pilot-safe default so the app runs
// with an empty .env.local.

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  dataDriver: (process.env.DATA_DRIVER ?? "local") as "local" | "supabase",
  aiDriver: (process.env.AI_DRIVER ?? "stub") as "stub" | "claude",
  isProd: process.env.NODE_ENV === "production",
  publicUrl: process.env.PUBLIC_URL ?? "",

  matchRankingMinInventory: num("MATCH_RANKING_MIN_INVENTORY", 300),

  // How much of the notification traffic goes out over SMS (Twilio costs money).
  //   "all"      — every push+sms / sms notification also texts
  //   "critical" — only the two that block the core flow: "someone wants your
  //                dress" (to the seller) and "request approved + payment code"
  //                (to the buyer). Everything else stays in-app only.
  //   "off"      — no notification SMS at all (login codes still work)
  // Login OTP is separate and always sends. Default is pilot-friendly.
  smsNotifications: (process.env.SMS_NOTIFICATIONS ?? "critical") as
    | "all"
    | "critical"
    | "off",

  sellerFeeBps: num("SELLER_FEE_BPS", 800), // recorded for v2, not collected

  // Payment & contact (payment-contact spec)
  requestExpiryHours: num("REQUEST_EXPIRY_HOURS", 24),
  reservationHoldHours: num("RESERVATION_HOLD_HOURS", 48),
  returnWindowHours: num("RETURN_WINDOW_HOURS", 48),
  paymentMismatchHours: num("PAYMENT_MISMATCH_HOURS", 72),
  prepayNudgeAgorot: num("PREPAY_NUDGE_AGOROT", 40000), // ₪400 shipped-to-stranger nudge

  // Analytics (analytics-spec)
  staleListingDays: num("STALE_LISTING_DAYS", 14),
  staleNoTapDays: num("STALE_NO_TAP_DAYS", 21),

  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",

  // The pilot feed target — fill to at least this many before falling to Tier C.
  feedMinItems: 30,
};

export function sellerFeeAgorot(priceAgorot: number): number {
  return Math.round((priceAgorot * config.sellerFeeBps) / 10000);
}
