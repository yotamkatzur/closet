/**
 * Seeds the local JSON store with realistic Hebrew pilot data:
 * ~11 sellers (heights 155–178, sizes S–XL), ~40 dresses with on-body photos,
 * body cards for everyone, some fit history, and follows.
 *
 * Run:  npm run seed        (writes .data/db.json)
 *       npm run db:reset     (wipes .data first, then seeds)
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), ".data");
const UPLOADS = path.join(DATA_DIR, "uploads");

type Size = "XS" | "S" | "S-M" | "M" | "M-L" | "L" | "XL" | "XXL";
const now = () => new Date().toISOString();
const id = () => randomUUID();
const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });

// ---- placeholder on-body dress image -------------------------------------
function dressSvg(color: string, accent: string, label: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
  <rect width="600" height="800" fill="${accent}"/>
  <circle cx="300" cy="140" r="52" fill="#e8d5c4"/>
  <path d="M248 190 Q300 220 352 190 L392 300 Q300 340 208 300 Z" fill="${color}"/>
  <path d="M208 300 Q300 340 392 300 L440 660 Q300 720 160 660 Z" fill="${color}"/>
  <path d="M160 660 Q300 720 440 660 L455 700 Q300 770 145 700 Z" fill="${color}" opacity="0.85"/>
  <text x="300" y="770" text-anchor="middle" font-family="Arial" font-size="26" fill="#fff" opacity="0.9">${label}</text>
</svg>`;
}
function writeImg(color: string, accent: string, label: string): string {
  const name = `seed-${id()}.svg`;
  fs.writeFileSync(path.join(UPLOADS, name), dressSvg(color, accent, label));
  return `/media/${name}`;
}

// ---- catalogue ----------------------------------------------------------
const SELLERS: { name: string; city: string; height: number; size: Size; shape: string | null }[] = [
  { name: "נועה ל.", city: "תל אביב", height: 172, size: "M", shape: "hourglass" },
  { name: "שיר מ.", city: "רמת גן", height: 165, size: "S", shape: "straight" },
  { name: "דנה כ.", city: "ירושלים", height: 178, size: "L", shape: "athletic" },
  { name: "רוני א.", city: "חיפה", height: 160, size: "S", shape: "pear" },
  { name: "יעל ב.", city: "ראשון לציון", height: 168, size: "S-M", shape: "curvy" },
  { name: "מאיה ט.", city: "פתח תקווה", height: 155, size: "XS", shape: "straight" },
  { name: "תמר ש.", city: "נתניה", height: 170, size: "L", shape: "hourglass" },
  { name: "ליהי ר.", city: "מודיעין", height: 163, size: "M-L", shape: "pear" },
  { name: "עדי פ.", city: "הרצליה", height: 175, size: "XL", shape: "curvy" },
  { name: "גל ד.", city: "כפר סבא", height: 167, size: "M", shape: null },
  { name: "אורית נ.", city: "רעננה", height: 158, size: "S", shape: "hourglass" },
];

const TITLES = [
  "שמלת ערב מקסי",
  "שמלת מחוך נצנצים",
  "שמלת סאטן פתוחה בגב",
  "שמלת קוקטייל קצרה",
  "שמלת שיפון זורמת",
  "שמלת כתף אחת",
  "שמלת תחרה צמודה",
  "שמלת א-סימטרית",
  "שמלת מלמלה נפוחה",
  "שמלת עיפרון אלגנטית",
];
const BRANDS = ["Zara", "Maya Negri", "Dorin Frankfurt", "ASOS", "Nili Lotan", "Rese", "H&M", null];
const COLORS = [
  ["שחור", "#1c1917", "#3f3a36"],
  ["אדום יין", "#7f1d1d", "#a13b3b"],
  ["כחול נייבי", "#1e3a5f", "#3c5a7a"],
  ["אמרלד", "#065f46", "#2f7a63"],
  ["שמפניה", "#d8c39a", "#b9a67e"],
  ["ורוד עתיק", "#c9899a", "#a86e7f"],
  ["לבנדר", "#8b7aa8", "#6f6089"],
];
const LENGTHS = ["mini", "midi", "maxi"];
const NECKLINES = ["strapless", "v_neck", "square", "halter", "one_shoulder", "high_neck", "collar"];
const SLEEVES = ["sleeveless", "short", "three_quarter", "long"];
const BACKS = ["open", "closed"];
const FABRICS = ["satin", "chiffon", "lace", "velvet", "tulle", "silk", "crepe", "sequin"];
const CONDITIONS = ["new_with_tags", "like_new", "good", "worn"];
const OCC = [
  ["wedding_guest", "gala_formal"],
  ["cocktail", "engagement"],
  ["bat_mitzva", "shabbat_dinner"],
  ["new_years", "cocktail"],
  ["henna", "engagement"],
  ["graduation", "cocktail"],
];
const VERDICTS = ["ran_small", "true_to_size", "ran_large"];

// ---- build db ----------------------------------------------------------
const db: any = {
  users: [],
  body_cards: [],
  fit_history: [],
  items: [],
  item_photos: [],
  purchase_requests: [],
  transactions: [],
  transaction_events: [],
  chat_messages: [],
  follows: [],
  likes: [],
  ratings: [],
  reports: [],
  notifications: [],
  analytics_events: [],
  feed_impressions: [],
  kpi_snapshots: [],
  otps: [],
  _seq: { analytics: 0, impressions: 0 },
};

const PAY_SETS = [["bit"], ["bit", "cash"], ["bit", "paybox"], ["cash"]];

// admin / founder
const admin = {
  id: id(),
  phone: "+972500000000",
  email: null,
  display_name: "המייסדת (ניהול)",
  avatar_url: null,
  city: "תל אביב",
  created_at: now(),
  is_admin: true,
  is_suspended: false,
  payment_methods: ["bit"],
  bit_phone: null,
  blocked_user_ids: [],
};
db.users.push(admin);
db.body_cards.push({
  user_id: admin.id,
  height_cm: 169,
  usual_size: "M",
  bra_size: "75C",
  body_shape_tag: "hourglass",
  shoulders_cm: null,
  waist_cm: null,
  hips_cm: null,
  updated_at: now(),
});

let phoneCounter = 501;
const sellerIds: string[] = [];
SELLERS.forEach((s, si) => {
  const u = {
    id: id(),
    phone: `+9725${String(phoneCounter++).padStart(8, "0")}`,
    email: null,
    display_name: s.name,
    avatar_url: null,
    city: s.city,
    created_at: now(),
    is_admin: false,
    is_suspended: false,
    payment_methods: pick(PAY_SETS, si),
    bit_phone: null,
    blocked_user_ids: [],
  };
  db.users.push(u);
  sellerIds.push(u.id);
  db.body_cards.push({
    user_id: u.id,
    height_cm: s.height,
    usual_size: s.size,
    bra_size: null,
    body_shape_tag: s.shape,
    shoulders_cm: null,
    waist_cm: null,
    hips_cm: null,
    updated_at: now(),
  });

  // a couple of fit-history rows per seller (shared brands → fit_overlap signal)
  for (let k = 0; k < 2; k++) {
    db.fit_history.push({
      id: id(),
      user_id: u.id,
      brand: pick(["Zara", "ASOS", "H&M", "Mango"], si + k),
      size: s.size,
      verdict: pick(VERDICTS, si + k),
      source: "self_reported",
      created_at: now(),
    });
  }

  // 3–4 dresses each
  const count = 3 + (si % 2);
  for (let d = 0; d < count; d++) {
    const seed = si * 7 + d;
    const [colorName, colorHex, accentHex] = pick(COLORS, seed);
    const label = pick(TITLES, seed);
    const price = (300 + ((seed * 137) % 20) * 60) * 100; // agorot
    const item = {
      id: id(),
      owner_id: u.id,
      title: label,
      brand: pick(BRANDS, seed),
      label_size: s.size,
      owner_verdict: pick(VERDICTS, seed),
      color: colorName,
      length: pick(LENGTHS, seed),
      neckline: pick(NECKLINES, seed),
      sleeve: pick(SLEEVES, seed),
      back: pick(BACKS, seed),
      fabric: pick(FABRICS, seed),
      occasion_tags: pick(OCC, seed),
      condition: pick(CONDITIONS, seed),
      price_agorot: price,
      original_price_agorot: price * 3,
      description: "נלבשה פעם אחת לאירוע. שמורה מצוין, מהבית ללא עישון.",
      status: "available",
      created_at: new Date(Date.now() - seed * 3600_000).toISOString(),
    };
    db.items.push(item);
    db.item_photos.push({
      id: id(),
      item_id: item.id,
      url: writeImg(colorHex, accentHex, `${colorName} · ${s.size}`),
      on_body: true,
      sort_order: 0,
    });
    db.item_photos.push({
      id: id(),
      item_id: item.id,
      url: writeImg(colorHex, "#efe6dd", "פרט"),
      on_body: false,
      sort_order: 1,
    });
  }
});

// a web of follows
sellerIds.forEach((sid, i) => {
  db.follows.push({
    follower_id: sid,
    followee_id: sellerIds[(i + 1) % sellerIds.length],
    created_at: now(),
  });
  db.follows.push({
    follower_id: admin.id,
    followee_id: sid,
    created_at: now(),
  });
});

// ---- synthetic analytics so /admin/kpi renders before real traffic --------
const allUsers = db.users;
const availItems: any[] = db.items.filter((i: any) => i.status === "available");
const bcByUser = new Map(db.body_cards.map((b: any) => [b.user_id, b]));

const SIZE_ORD: Record<string, number> = {
  XS: 0, S: 1, "S-M": 1.5, M: 2, "M-L": 2.5, L: 3, XL: 4, XXL: 5,
};
function tierOf(a: any, b: any): "A" | "B" | "C" {
  if (!a || !b) return "C";
  const h = Math.max(0, 1 - Math.abs(a.height_cm - b.height_cm) / 12);
  const sz = Math.max(0, 1 - Math.abs(SIZE_ORD[a.usual_size] - SIZE_ORD[b.usual_size]) / 2);
  const shape = a.body_shape_tag === b.body_shape_tag ? 1 : a.body_shape_tag || b.body_shape_tag ? 0.2 : 0.5;
  const score = h * 0.4 + sz * 0.3 + shape * 0.15 + 0.5 * 0.15;
  return score >= 0.8 ? "A" : score >= 0.5 ? "B" : "C";
}

let seq = 0;
const ev = (
  daysAgo: number,
  session: string,
  event: string,
  props: any = {},
  userId: string | null = null,
  itemId: string | null = null,
  txId: string | null = null,
) => {
  db._seq.analytics = ++seq;
  db.analytics_events.push({
    id: seq,
    user_id: userId,
    session_id: session,
    event,
    props,
    item_id: itemId,
    tx_id: txId,
    created_at: new Date(Date.now() - daysAgo * 86400_000).toISOString(),
  });
};

// onboarding funnel: 30 landed → 18 prompted → 14 started → 11 submitted → 10 authed
for (let i = 0; i < 30; i++) {
  const s = `seed-onb-${i}`;
  const d = 1 + (i % 40);
  ev(d, s, "landing_view", { referrer: null });
  ev(d, s, "feed_view_anon", { items_shown: 12 });
  if (i < 18) ev(d, s, "body_card_prompt_shown", { trigger: "item_tap" });
  if (i < 14) ev(d, s, "body_card_started", {});
  if (i < 11) ev(d, s, "body_card_submitted", { size: pick(["S", "M", "L"], i), height_cm_bucket: "163-167" });
  if (i < 10) {
    ev(d, s, "auth_started", {});
    ev(d, s, "auth_completed", { is_new_user: true });
    ev(d, s, "onboarding_completed", {});
  }
}

// feed impressions + taps for the members (chronological window)
allUsers.forEach((viewer: any, vi: number) => {
  const vc = bcByUser.get(viewer.id);
  const session = `seed-${viewer.id.slice(0, 8)}`;
  availItems.forEach((it, pos) => {
    if ((vi + pos) % 2 === 0) return; // ~half the catalogue seen
    const tier = tierOf(vc, bcByUser.get(it.owner_id));
    const clickProb = tier === "A" ? 0.28 : tier === "B" ? 0.12 : 0.06;
    const clicked = ((vi * 7 + pos * 13) % 100) / 100 < clickProb;
    db._seq.impressions++;
    db.feed_impressions.push({
      id: db._seq.impressions,
      user_id: viewer.id,
      session_id: session,
      item_id: it.id,
      tier,
      match_score: null,
      position: pos,
      feed_mode: "chronological",
      clicked,
      created_at: new Date(Date.now() - (2 + (pos % 20)) * 86400_000).toISOString(),
    });
    if (clicked) {
      ev(2 + (pos % 20), session, "item_tap", { tier, position: pos, feed_mode: "chronological", source: "feed" }, viewer.id, it.id);
    }
  });
  ev(1 + (vi % 10), session, "session_start", { days_since_last_session: vi % 5 }, viewer.id);
  ev(1 + (vi % 10), session, "feed_view", { feed_mode: "chronological", items_shown: 20 }, viewer.id);
});

// listing_published for every item
db.items.forEach((it: any, i: number) => {
  ev(3 + (i % 30), `seed-${it.owner_id.slice(0, 8)}`, "listing_published", {
    price_agorot: it.price_agorot,
    has_on_body_photo: true,
    is_first_listing: i % 4 === 0,
  }, it.owner_id, it.id);
});

// a couple of completed transactions with tier + fit feedback
[0, 5].forEach((n, k) => {
  const it = availItems[n];
  if (!it) return;
  const buyer = allUsers.find((u: any) => u.id !== it.owner_id);
  const txId = id();
  const tier = tierOf(bcByUser.get(buyer.id), bcByUser.get(it.owner_id));
  db.transactions.push({
    id: txId,
    item_id: it.id,
    request_id: null,
    buyer_id: buyer.id,
    seller_id: it.owner_id,
    price_agorot: it.price_agorot,
    fee_agorot: Math.round(it.price_agorot * 0.08),
    state: k === 0 ? "COMPLETED" : "REFUNDED",
    payment_method: "bit",
    payment_ref: "CL-" + (2000 + n),
    handoff_method: "pickup",
    phone_revealed_at: now(),
    buyer_marked_paid_at: now(),
    seller_confirmed_paid_at: now(),
    hold_expires_at: now(),
    picked_up_at: now(),
    return_deadline: now(),
    return_started_at: k === 1 ? now() : null,
    mismatch_flagged_at: null,
    created_at: new Date(Date.now() - (5 + n) * 86400_000).toISOString(),
  });
  it.status = "sold";
  db.chat_messages.push(
    {
      id: id(),
      tx_id: txId,
      sender_id: buyer.id,
      body: "היי! מתי נוח לך להיפגש?",
      created_at: new Date(Date.now() - (5 + n) * 86400_000 + 3600_000).toISOString(),
      read_by: [buyer.id, it.owner_id],
    },
    {
      id: id(),
      tx_id: txId,
      sender_id: it.owner_id,
      body: "מחר בערב בדיזנגוף? אשלח מיקום מדויק",
      created_at: new Date(Date.now() - (5 + n) * 86400_000 + 7200_000).toISOString(),
      read_by: [buyer.id, it.owner_id],
    },
  );
  ev(5 + n, `seed-tx-${k}`, "purchase_request_sent", { tier, has_message: true }, buyer.id, it.id);
  ev(5 + n, `seed-tx-${k}`, "purchase_request_responded", { decision: "approve", hours_to_respond: 3 }, it.owner_id);
  ev(5 + n, `seed-tx-${k}`, "tx_created", { tier }, buyer.id, it.id, txId);
  ev(5 + n, `seed-tx-${k}`, "phone_revealed", { buyer_id: buyer.id, seller_id: it.owner_id }, null, null, txId);
  ev(4 + n, `seed-tx-${k}`, "payment_confirmed_received", {}, it.owner_id, null, txId);
  if (k === 0) ev(3 + n, `seed-tx-${k}`, "tx_completed", { price_agorot: it.price_agorot }, null, null, txId);
  else ev(3 + n, `seed-tx-${k}`, "tx_returned", { return_reason: "לא התאים" }, null, null, txId);
});

// a few off-platform sales + zero-result searches
["facebook", "whatsapp", "facebook"].forEach((ch, i) => {
  const it = availItems[10 + i];
  if (!it) return;
  it.status = "sold";
  ev(4 + i, `seed-off-${i}`, "sold_offplatform", { channel: ch, price_agorot: it.price_agorot }, it.owner_id, it.id);
});
["שמלה אדומה מקסי", "שמלת כלה", "אוברול"].forEach((q, i) =>
  ev(2 + i, `seed-zs-${i}`, "search_zero_results", { query_text: q, filters: {} }),
);

fs.writeFileSync(
  path.join(DATA_DIR, "db.json"),
  JSON.stringify(db, null, 2),
);

console.log(
  `Seeded: ${db.users.length} users, ${db.items.length} dresses, ${db.item_photos.length} photos.`,
);
console.log(
  `\nAdmin login: phone 050-0000000 — request an OTP in the app, the code prints here in the server console.`,
);
console.log(
  `Sample seller login: phone 050-0000501 (and 0502, 0503 … up to 05${String(phoneCounter - 1).slice(1)}).`,
);
