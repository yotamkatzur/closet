import "server-only";
import { readDB } from "./db/repo";
import { SIZES } from "./types";

// KPI computations (analytics-spec §7). Every rate carries its raw counts —
// nobody reads "50%" off 2 events (§1). Small numbers by design.

export interface Kpis {
  active_members: number;
  live_listings: { live: number; ever_listed: number; sold: number };
  size_coverage: { size: string; members: number; live_listings: number }[];
  height_coverage: { band: string; members: number }[];
  transactions: {
    completed: number;
    returned: number;
    in_flight: number;
    offplatform_reported: number;
  };
  buyer_rate: {
    buyers: number;
    members_with_body_card: number;
    buyer_rate_pct: number | null;
  };
  repeat_listing: {
    sellers: number;
    repeat_sellers: number;
    repeat_rate_pct: number | null;
    avg_listings_per_seller: number;
  };
  tier_ctr: {
    tier: string;
    impressions: number;
    clicks: number;
    ctr_pct: number | null;
  }[];
  tier_ctr_by_position: {
    tier: string;
    band: string;
    impressions: number;
    ctr_pct: number | null;
  }[];
  tier_purchase: {
    tier: string;
    impressions: number;
    purchases: number;
    purchase_rate_pct: number | null;
  }[];
  return_by_tier: {
    tier: string;
    kept: number;
    returned: number;
    return_rate_pct: number | null;
  }[];
  return_reasons: { reason: string; n: number }[];
  onboarding_funnel: {
    landed: number;
    prompted: number;
    started: number;
    submitted: number;
    authed: number;
    completion_pct: number | null;
  };
  zero_result_searches: { query: string; filters: unknown; at: string }[];
  ai_field_correction: { field: string; corrections: number; fills: number }[];
  stale_listings: { item_id: string; title: string; days_live: number }[];
  offplatform_channels: { channel: string; n: number }[];
  payment: {
    approval_rate_pct: number | null;
    approved: number;
    sent: number;
    reveal_to_paid_pct: number | null;
    mismatch_count: number;
  };
}

const pct = (num: number, den: number): number | null =>
  den === 0 ? null : Math.round((1000 * num) / den) / 10;

export function computeKpis(): Kpis {
  const db = readDB();
  const ev = db.analytics_events;
  const imp = db.feed_impressions.filter((i) => i.feed_mode === "chronological");
  const now = Date.now();
  const DAY = 86_400_000;

  // 7.1
  const active_members = new Set(
    ev
      .filter(
        (e) =>
          e.user_id &&
          now - new Date(e.created_at).getTime() < 14 * DAY,
      )
      .map((e) => e.user_id),
  ).size;

  // 7.2
  const live_listings = {
    live: db.items.filter((i) => i.status === "available").length,
    ever_listed: db.items.length,
    sold: db.items.filter((i) => i.status === "sold").length,
  };

  // 7.3
  const bcByUser = new Map(db.body_cards.map((b) => [b.user_id, b]));
  const size_coverage = SIZES.map((size) => {
    const members = db.body_cards.filter((b) => b.usual_size === size);
    const memberIds = new Set(members.map((m) => m.user_id));
    const live_listings = db.items.filter(
      (i) => i.status === "available" && memberIds.has(i.owner_id),
    ).length;
    return { size, members: members.length, live_listings };
  });
  const heightBand = (cm: number) =>
    cm < 158 ? "<158" : cm < 163 ? "158-162" : cm < 168 ? "163-167" : cm < 173 ? "168-172" : "173+";
  const hcMap = new Map<string, number>();
  for (const b of db.body_cards) {
    const band = heightBand(b.height_cm);
    hcMap.set(band, (hcMap.get(band) ?? 0) + 1);
  }
  const height_coverage = ["<158", "158-162", "163-167", "168-172", "173+"].map(
    (band) => ({ band, members: hcMap.get(band) ?? 0 }),
  );

  // 7.4
  const T = db.transactions;
  const transactions = {
    completed: T.filter((t) => t.state === "COMPLETED").length,
    returned: T.filter((t) => t.state === "REFUNDED").length,
    in_flight: T.filter(
      (t) => !["COMPLETED", "REFUNDED", "CANCELLED", "DISPUTED"].includes(t.state),
    ).length,
    offplatform_reported: ev.filter((e) => e.event === "sold_offplatform").length,
  };

  // 7.5
  const buyers = new Set(
    T.filter((t) => t.state === "COMPLETED").map((t) => t.buyer_id),
  ).size;
  const buyer_rate = {
    buyers,
    members_with_body_card: db.body_cards.length,
    buyer_rate_pct: pct(buyers, db.body_cards.length),
  };

  // 7.6
  const perSeller = new Map<string, number>();
  for (const it of db.items)
    perSeller.set(it.owner_id, (perSeller.get(it.owner_id) ?? 0) + 1);
  const sellers = perSeller.size;
  const repeatSellers = [...perSeller.values()].filter((n) => n >= 2).length;
  const totalListings = [...perSeller.values()].reduce((a, b) => a + b, 0);
  const repeat_listing = {
    sellers,
    repeat_sellers: repeatSellers,
    repeat_rate_pct: pct(repeatSellers, sellers),
    avg_listings_per_seller:
      sellers === 0 ? 0 : Math.round((10 * totalListings) / sellers) / 10,
  };

  // 7.7 tier CTR (the core hypothesis)
  const tiers = ["A", "B", "C"] as const;
  const tier_ctr = tiers.map((tier) => {
    const rows = imp.filter((i) => i.tier === tier);
    const clicks = rows.filter((i) => i.clicked).length;
    return {
      tier,
      impressions: rows.length,
      clicks,
      ctr_pct: pct(clicks, rows.length),
    };
  });
  const posBand = (p: number) =>
    p < 10 ? "0-9" : p < 20 ? "10-19" : p < 30 ? "20-29" : p < 40 ? "30-39" : "40+";
  const tier_ctr_by_position: Kpis["tier_ctr_by_position"] = [];
  for (const band of ["0-9", "10-19", "20-29", "30-39", "40+"]) {
    for (const tier of tiers) {
      const rows = imp.filter(
        (i) => i.tier === tier && posBand(i.position) === band,
      );
      if (rows.length === 0) continue;
      tier_ctr_by_position.push({
        tier,
        band,
        impressions: rows.length,
        ctr_pct: pct(rows.filter((i) => i.clicked).length, rows.length),
      });
    }
  }

  // downstream: purchases by tier
  const buysByTier = new Map<string, number>();
  for (const e of ev.filter((e) => e.event === "tx_created")) {
    const tier = String(e.props?.tier ?? "?");
    buysByTier.set(tier, (buysByTier.get(tier) ?? 0) + 1);
  }
  const tier_purchase = tiers.map((tier) => {
    const impressions = imp.filter((i) => i.tier === tier).length;
    const purchases = buysByTier.get(tier) ?? 0;
    return { tier, impressions, purchases, purchase_rate_pct: pct(purchases, impressions) };
  });

  // strongest signal: return rate by tier
  const txTier = new Map<string, string>();
  for (const e of ev.filter((e) => e.event === "tx_created" && e.tx_id))
    txTier.set(e.tx_id!, String(e.props?.tier ?? "?"));
  const return_by_tier = tiers.map((tier) => {
    const txs = T.filter((t) => txTier.get(t.id) === tier);
    const kept = txs.filter((t) => t.state === "COMPLETED").length;
    const returned = txs.filter((t) => t.state === "REFUNDED").length;
    return {
      tier,
      kept,
      returned,
      return_rate_pct: pct(returned, kept + returned),
    };
  });

  const return_reasons = groupCount(
    ev.filter((e) => e.event === "tx_returned"),
    (e) => String(e.props?.return_reason ?? "לא צוין"),
  );

  // 7.9 onboarding funnel
  const bySession = (event: string) =>
    new Set(ev.filter((e) => e.event === event).map((e) => e.session_id)).size;
  const landed = bySession("landing_view");
  const submitted = bySession("body_card_submitted");
  const onboarding_funnel = {
    landed,
    prompted: bySession("body_card_prompt_shown"),
    started: bySession("body_card_started"),
    submitted,
    authed: bySession("auth_completed"),
    completion_pct: pct(submitted, landed),
  };

  const zero_result_searches = ev
    .filter((e) => e.event === "search_zero_results")
    .slice(-20)
    .reverse()
    .map((e) => ({
      query: String(e.props?.query_text ?? ""),
      filters: e.props?.filters ?? {},
      at: e.created_at,
    }));

  // AI field correction rate
  const corrections = groupCount(
    ev.filter((e) => e.event === "ai_field_corrected"),
    (e) => String(e.props?.field ?? "?"),
  );
  const fills = new Map<string, number>();
  for (const e of ev.filter((e) => e.event === "ai_autofill_returned")) {
    for (const f of (e.props?.fields_filled as string[]) ?? [])
      fills.set(f, (fills.get(f) ?? 0) + 1);
  }
  const ai_field_correction = corrections.map((c) => ({
    field: c.reason,
    corrections: c.n,
    fills: fills.get(c.reason) ?? 0,
  }));

  const stale_listings = db.items
    .filter((i) => i.status === "available")
    .map((i) => ({
      item_id: i.id,
      title: i.title,
      days_live: Math.floor((now - new Date(i.created_at).getTime()) / DAY),
      tapped: ev.some((e) => e.event === "item_tap" && e.item_id === i.id),
    }))
    .filter((i) => i.days_live > 21 && !i.tapped)
    .map(({ item_id, title, days_live }) => ({ item_id, title, days_live }));

  const offplatform_channels = groupCount(
    ev.filter((e) => e.event === "sold_offplatform"),
    (e) => String(e.props?.channel ?? "other"),
  ).map((c) => ({ channel: c.reason, n: c.n }));

  // payment (payment-contact spec §8)
  const sent = ev.filter((e) => e.event === "purchase_request_sent").length;
  const approved = ev.filter(
    (e) =>
      e.event === "purchase_request_responded" &&
      e.props?.decision === "approve",
  ).length;
  const reveals = ev.filter((e) => e.event === "phone_revealed").length;
  const confirmed = ev.filter(
    (e) => e.event === "payment_confirmed_received",
  ).length;
  const payment = {
    approval_rate_pct: pct(approved, sent),
    approved,
    sent,
    reveal_to_paid_pct: pct(confirmed, reveals),
    mismatch_count: ev.filter((e) => e.event === "payment_mismatch").length,
  };

  void bcByUser;
  return {
    active_members,
    live_listings,
    size_coverage,
    height_coverage,
    transactions,
    buyer_rate,
    repeat_listing,
    tier_ctr,
    tier_ctr_by_position,
    tier_purchase,
    return_by_tier,
    return_reasons,
    onboarding_funnel,
    zero_result_searches,
    ai_field_correction,
    stale_listings,
    offplatform_channels,
    payment,
  };
}

function groupCount<T>(
  rows: T[],
  key: (r: T) => string,
): { reason: string; n: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([reason, n]) => ({ reason, n }))
    .sort((a, b) => b.n - a.n);
}
