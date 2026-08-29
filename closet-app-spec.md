# Build Spec — "Closet" (working name)

A body-matched marketplace for second-hand evening dresses. Hebrew-first, Israel-only, mobile web.

**This document is the complete build brief. Build exactly what is here. Where a decision is not specified, choose the simplest option that ships.**

---

## 0. Context in one paragraph

Women buy expensive evening dresses, wear them once, photograph them on Instagram, and can never wear them again. Meanwhile finding a dress for an event is genuinely hard. Facebook resale groups solve this badly: you see the garment, never the garment on a body like yours. This app fixes exactly that — **your feed is filtered by women whose body is like yours**, so "she's my height and my size and it looks good on her" becomes the buying signal. Everything else in the app is standard marketplace plumbing that exists to make that one insight transactable.

The first version is a **pilot for ~40 women** (the founder's friends and friends-of-friends). It must feel real — real listings, real money, real shipping — but the volume is tiny, so the architecture should stay boringly simple and defer anything that only matters at scale.

---

## 1. Product decisions (already made — do not re-litigate)

| Decision | Value |
|---|---|
| Product type | Marketplace with a light social layer. Optimize for **completed transactions**, not engagement. |
| Body matching | **Declared data + fit history.** No computer vision, no measurement inference from photos. |
| Catalog scope | **Evening / occasion dresses only.** No other categories in v1. |
| Transaction | Sale only. **No rental in v1.** |
| Market | Israel. Hebrew UI, RTL, ILS. |
| Platform | Mobile-first **web app (PWA)**. No native app. |
| AI in v1 | Listing intake assistance only (auto-tagging from photo). **No conversational search agent in v1.** |

---

## 2. Tech stack

Use this stack unless something is unavailable:

- **Next.js (App Router, TypeScript)** — single codebase, server actions for mutations.
- **Supabase** — Postgres, Auth, Storage (photos), Row Level Security.
- **Auth:** phone OTP (Israeli numbers). Fall back to magic-link email if SMS provider setup is a blocker for the pilot.
- **Tailwind CSS**, RTL-first. `dir="rtl"` on `<html>`, Hebrew font stack (Heebo / Assistant / Rubik).
- **Deployment:** Vercel. Must run locally with `npm run dev` and a `.env.local`.
- **Image handling:** upload to Supabase Storage, resize client-side before upload (max 1600px long edge, ~85% JPEG quality).

### Provider interfaces (important)

Payments and shipping must sit behind interfaces with a **manual implementation for the pilot** and a real implementation later. Do not couple business logic to a vendor.

```ts
interface PaymentProvider {
  createEscrowHold(txId: string, amountAgorot: number): Promise<HoldRef>
  releaseToSeller(txId: string): Promise<void>
  refundBuyer(txId: string): Promise<void>
}

interface ShippingProvider {
  createOutboundLabel(txId: string, fromLocker: string, toLocker: string): Promise<Label>
  createReturnLabel(txId: string): Promise<Label>
  getStatus(trackingId: string): Promise<ShipmentStatus>
}
```

**Pilot implementations:**
- `ManualPaymentProvider` — records the intended state change and surfaces it in an admin queue. The founder confirms Bit/bank transfers by hand and clicks through the state machine. No card processing in v1.
- `ManualShippingProvider` — user picks a locker from a hardcoded list of Zigzag locker locations; the app generates a printable/screenshot-able shipping slip with a code. Tracking is updated manually by buyer and seller tapping "sent" / "picked up".

This keeps the pilot legal, cheap, and shippable in weeks. Real Zigzag API and a payment processor (Meshulam / Cardcom / Tranzila) come after the pilot proves the behavior.

---

## 3. Data model

### `users`
```
id                 uuid pk
phone              text unique
display_name       text
avatar_url         text
city               text
created_at         timestamptz
is_admin           boolean default false
```

### `body_cards` (1:1 with user)
```
user_id            uuid pk fk->users
height_cm          int         NOT NULL   -- required
usual_size         enum(XS,S,M,L,XL,XXL)  NOT NULL   -- required
bra_size           text        NULL       -- optional, matters for evening wear
body_shape_tag     enum(pear, hourglass, straight, curvy, athletic) NULL
shoulders_cm       int NULL
waist_cm           int NULL
hips_cm            int NULL
updated_at         timestamptz
```

Only `height_cm` and `usual_size` are required. Everything else is progressive enrichment.

### `fit_history`
```
id                 uuid pk
user_id            uuid fk
brand              text
size               text
verdict            enum(ran_small, true_to_size, ran_large)
source             enum(purchase, self_reported)
created_at         timestamptz
```

### `items`
```
id                 uuid pk
owner_id           uuid fk->users
title              text
brand              text NULL
label_size         text                 -- as printed on the label
owner_verdict      enum(ran_small, true_to_size, ran_large) NULL
color              text
length             enum(mini, midi, maxi)
neckline           enum(strapless, v_neck, square, halter, one_shoulder, high_neck, other)
sleeve             enum(sleeveless, short, three_quarter, long)
occasion_tags      text[]               -- see taxonomy below
condition          enum(new_with_tags, like_new, good, worn)
price_agorot       int
original_price_agorot int NULL
description        text
status             enum(available, reserved, sold, hidden) default 'available'
created_at         timestamptz
```

### `item_photos`
```
id                 uuid pk
item_id            uuid fk
url                text
on_body            boolean              -- at least one true photo required to publish
sort_order         int
```

### `transactions`
```
id                 uuid pk
item_id            uuid fk
buyer_id           uuid fk
seller_id          uuid fk
price_agorot       int
fee_agorot         int
state              enum(...)  -- see state machine
outbound_locker_from  text
outbound_locker_to    text
picked_up_at       timestamptz NULL     -- starts the 48h return clock
return_deadline    timestamptz NULL     -- picked_up_at + 48h
created_at         timestamptz
```

### `transaction_events`
Append-only log: `{tx_id, from_state, to_state, actor_id, note, created_at}`. Every state change writes one. This is the audit trail and the admin's debugging tool.

### `follows`
```
follower_id, followee_id, created_at   -- composite pk
```

### `likes`
```
user_id, item_id, created_at           -- composite pk
```

### Occasion taxonomy (Hebrew-local — this is the cultural layer)
```
wedding_guest      אורחת בחתונה
bat_mitzva         בת מצווה
bar_mitzva         בר מצווה
henna              חינה
engagement         אירוסין
shabbat_dinner     ארוחת שישי / שבת חתן
gala_formal        אירוע רשמי / גאלה
cocktail           קוקטייל
beach_event        אירוע על הים
new_years          סילבסטר
graduation         טקס סיום
```

Store canonical English keys, render Hebrew labels. Multi-select, max 3 per item.

---

## 4. The matching algorithm

This is the core of the product. Implement it as a single pure function so it can be unit-tested and tuned.

```ts
function matchScore(viewer: BodyCard, owner: BodyCard, ctx: MatchContext): number
```

**Components (weights sum to 1.0):**

| Component | Weight | Logic |
|---|---|---|
| `height_proximity` | 0.40 | `max(0, 1 - |Δcm| / 12)`. Identical height = 1.0, 12cm apart = 0.0. |
| `size_proximity` | 0.30 | Map sizes to ordinal 0–5. `max(0, 1 - |Δ| / 2)`. Same size = 1.0, one size apart = 0.5, two+ = 0.0. |
| `shape_agreement` | 0.15 | Same `body_shape_tag` = 1.0; both null = 0.5 (neutral); different = 0.2. |
| `fit_overlap` | 0.15 | For each brand both users have fit history on, +1 if same verdict. Normalize to 0–1. If no overlap, return 0.5 (neutral, not penalized). |

**Tiers:**

```
Tier A ("מידה כמו שלך")     score >= 0.80
Tier B ("קרוב למידה שלך")   score >= 0.50
Tier C ("כל השמלות")        everything else
```

### Feed assembly rules — critical

1. **The feed is never empty.** Fill from Tier A, then B, then C, until at least 30 items are returned. Below 30 total listings in the whole DB, show everything, chronological.
2. **Every card is labeled honestly.** Not just a tier badge — a specific human sentence generated from the diff:
   - `+4 ס"מ ממך` (4cm taller than you)
   - `בדרך כלל מידה אחת מעליך` (usually one size above you)
   - `בדיוק הגובה והמידה שלך` (exactly your height and size)
   The honesty *is* the feature. Never hide the mismatch.
3. **Cold-start override.** If `count(items where status='available') < 300`, the feed is **chronological (newest first)** with match labels layered on. Do not rank by score below this threshold — there isn't enough inventory for ranking to beat recency, and a thin ranked feed feels emptier than a thin fresh feed. Make the threshold an env var: `MATCH_RANKING_MIN_INVENTORY=300`.
4. **A prominent "show all sizes" toggle** in the feed header. Persist per user. Matching is a default, not a cage — sometimes you want the oversized dress.
5. **Never exclude.** There is no hard size filter anywhere in the app. Only ordering and labeling.

---

## 5. Screens

RTL throughout. Bottom tab bar with four tabs.

### 5.1 Onboarding (one-time)

**The single highest-risk flow in the app. Value must land before the ask.**

```
1. Land → browse the real feed immediately, no signup, no wall
2. Tap any dress → bottom sheet: "רוצה לדעת אם זה יתאים לך?"
3. Two fields only: גובה (height) + מידה רגילה (usual size)
4. Phone OTP
5. Feed visibly re-sorts, match labels appear on every card  ← the payoff
6. Later, contextual, dismissible: add a photo, shape, bra size, fit history
```

Do **not** collect the full body card at signup. Two fields, then show the magic, then earn the rest.

### 5.2 Feed (`/`)

- Two-column masonry grid of dress cards.
- Card: on-body photo, price, brand, size, **match label**, like button.
- Header: search icon, "show all sizes" toggle, occasion filter chips.
- Infinite scroll.
- Above the fold on first load for a matched user: a one-line explainer — *"הפיד שלך מסונן לפי נשים בגובה ובמידה שלך"*.

### 5.3 Item page (`/item/[id]`)

- Photo carousel, on-body photo first.
- **Match block, prominent:** owner's height + usual size vs. yours, the diff sentence, and owner's `owner_verdict` on this specific dress ("אני מידה M, זה יצא קטן").
- Full attributes, occasion tags, condition, price.
- Seller strip: avatar, name, sales count, rating, "צפי בארון שלה" (view her closet), follow button.
- **"קנייה"** CTA → checkout.
- Return policy stated inline, plainly, before purchase: *"48 שעות להחזרה מרגע האיסוף מהלוקר."*

### 5.4 Closet / profile (`/u/[id]`)

- Header: avatar, name, city, **body card** (height, usual size, shape), follow button, trust stats.
- Grid of that user's items, available first, sold shown greyed with a "נמכר" badge (social proof — do not delete sold items).
- Own closet adds: "+ העלאת שמלה", drafts, hidden items.

### 5.5 Search (`/search`)

v1 is **structured filters, not a chatbot.** Free-text over title/brand/description plus filter chips: occasion, size, length, color, price range, condition.

Leave a clean seam for the phase-3 conversational agent — put the search query construction behind `buildSearchQuery(input)` so a natural-language parser can be swapped in later.

### 5.6 Sell flow (`/sell`)

Must be **faster than posting in a Facebook group.** Target: 40 seconds.

```
1. Camera / gallery → at least one photo. Prompt explicitly for an on-body shot.
   Face may be cropped or hidden — say so, it removes the main objection.
2. AI auto-fill from the photo: color, length, neckline, sleeve, suggested
   occasion tags, brand guess.  ← the only AI in v1
3. User corrects anything wrong. All fields editable. Nothing is auto-accepted silently.
4. Size + owner_verdict ("מידה M, יצא לי קטן")
5. Price. Show comparable sold prices if any exist.
6. Publish.
```

**AI implementation:** single vision-model call, structured JSON output matching the item schema. If the call fails or times out (3s), fall through to an empty manual form — never block publishing on the AI.

### 5.7 Deals (`/deals`)

Two tabs: **קניתי** (bought) / **מכרתי** (sold). Each transaction shows current state, next required action, locker codes, and — when relevant — a live **countdown to the return deadline**.

### 5.8 Admin (`/admin`, `is_admin` only)

The pilot's control room. Needs: all transactions with state, manual state-advance buttons, payment confirmation queue, refund button, item moderation (hide/remove), user list, and a raw `transaction_events` view.

---

## 6. Transaction state machine

```
                  buyer taps קנייה
  available ──────────────────────────► RESERVED
                                           │ item.status = 'reserved' (48h hold)
                                           │ buyer pays (manual confirm in pilot)
                                           ▼
                                        PAID_HELD  (escrow — money is NOT with seller)
                                           │ seller drops at locker, taps "נשלח"
                                           ▼
                                        SHIPPED
                                           │ buyer picks up, taps "אספתי"
                                           ▼
                                     PICKED_UP  ◄── starts 48h return clock
                                        │        picked_up_at = now()
                          ┌─────────────┴──────────────┐
              buyer taps "מחזירה"          48h elapses, or buyer taps "מתאים לי"
                          │                             │
                          ▼                             ▼
                   RETURN_IN_TRANSIT                 COMPLETED
                          │                    money released to seller,
              seller confirms receipt          fee taken, fit_history row
                          ▼                    written from the purchase
                     REFUNDED
              buyer refunded in full,
              item returns to 'available'
```

**Terminal states:** `COMPLETED`, `REFUNDED`, `CANCELLED`, `DISPUTED`.

### The return policy — implement exactly

> **48 hours from locker pickup.** If the dress doesn't fit, the buyer puts it back in a locker, it ships back to the seller, and the buyer is refunded in full.

Rules:

- The clock starts at `picked_up_at`, **not** at purchase or at shipment. Set `return_deadline = picked_up_at + 48h` at that moment.
- If the buyer never taps "אספתי", the shipping provider's pickup event starts the clock. In the pilot, if neither exists, the founder sets it from the admin panel.
- Money sits in escrow the entire time. **The seller is never paid before the window closes.** This is the single reason a user tolerates the app over a WhatsApp deal, and it must never be compromised for convenience.
- After `RETURN_IN_TRANSIT`, the seller confirms receipt → automatic full refund. If the seller doesn't confirm within 5 days of the return shipment being delivered, **auto-refund the buyer anyway** and flag for admin. Never let a silent seller trap a buyer's money.
- Return shipping cost: **the buyer pays it** (small, ~₪20, disclosed before purchase). This prevents casual "order three, keep one" behavior that would destroy seller trust in a tiny pilot community.
- A returned item automatically returns to `available` and reappears in feeds.
- Prominent countdown in `/deals` for any transaction in `PICKED_UP`.
- Push/SMS at T-12h: *"נשארו 12 שעות להחזרה"*.

**Every state transition must be a single server action that writes a `transaction_events` row in the same DB transaction.** No state change anywhere else in the codebase.

---

## 7. Money

- **Seller fee: 8%** of sale price, deducted at release. Buyer pays no platform fee.
- **Listing is free.** Supply is the scarce side — never tax it.
- **Wallet:** sale proceeds land as in-app balance, spendable immediately on any purchase. Withdrawal to bank is a manual admin action in the pilot. The wallet is the cheapest retention mechanic available and directly counters the low purchase frequency of evening wear.
- All money in **agorot (integers)**. Never floats. Display as `₪1,240`.

---

## 8. Social layer (deliberately minimal)

Only three mechanics, and each exists to drive transactions, not engagement:

1. **Follow** a woman whose body and taste match yours.
2. **Bell notification** when someone you follow lists something: *"מישהי בגובה ובמידה שלך העלתה 3 שמלות"*. This is the primary re-engagement lever — occasion dresses are bought 2–4 times a year, so notifications are the only thing that brings a user back between events.
3. **Likes** — a private saved list plus a weak popularity signal.

**Explicitly out of scope for v1:** comments, DMs, public activity feed, stories, sharing to other platforms.

---

## 9. Safety and moderation

This is a women's app built on full-body photographs. Handle it seriously from day one.

- Face may be cropped or obscured in any photo. Say so in the upload UI.
- Report button on every item and every profile.
- Admin can hide an item or suspend a user immediately, single click.
- Screenshot deterrence is not achievable on the web — do not pretend otherwise. Instead: state clearly in the ToS that reposting another user's photos is grounds for a permanent ban, and enforce it.
- Photo storage: signed URLs, no public bucket listing, no guessable paths.
- Never expose a user's phone number to another user. All contact goes through the app.
- Body measurements are sensitive personal data. Store them, never log them, never send them to third-party analytics.

---

## 10. Build order

Ship in this sequence. Each step should be independently demo-able.

1. **Auth + body card + closet.** A user can sign up, enter height and size, and see an empty closet.
2. **Sell flow, manual fields only** (no AI yet). Real dresses can go in.
3. **Feed with chronological + match labels.** Founder seeds ~40 listings from her own circle. *This alone is already testable with friends.*
4. **Item page + follow + likes.**
5. **Transaction state machine + manual payment + manual locker slips + the 48h return.** This is the biggest and most important chunk.
6. **Deals screen + admin panel.**
7. **AI photo auto-fill** in the sell flow.
8. **Match scoring turned on** once inventory crosses the threshold.
9. **Search + filters.**
10. **Notifications** (bell, return countdown).

Steps 1–5 are the pilot. Everything after is improvement.

---

## 11. Seeding the pilot

The app is worthless empty. Before opening to 40 users:

- Founder personally lists 30–50 real dresses from her own closet and 5 friends' closets, all with on-body photos.
- Body cards filled for every seed account so match labels are live from the first session.
- Spread heights (155–178cm) and sizes (S–XL) across seed accounts, so a new user of almost any build finds at least a few Tier A matches. **A new user seeing zero matches on day one is the primary failure mode of this pilot.**

---

## 12. What success looks like

Instrument these from day one:

| Metric | Target for the pilot |
|---|---|
| Completed transactions | 50 |
| Live listings | 200 |
| Sellers who list a **second** item | ≥ 30% |
| Return rate | < 20% (above this, matching isn't working) |
| Tap-through on Tier A vs Tier C cards | Tier A meaningfully higher — **this is the proof the whole product rests on** |
| Onboarding completion (land → body card submitted) | > 40% |

If Tier A cards don't outperform Tier C, the core hypothesis is wrong and the product needs rethinking before any further build. Make sure this is measurable from the first week.

---

## 13. Explicitly out of scope for v1

Do not build these, even if they seem easy:

- Conversational AI search agent
- Any category other than evening dresses
- Rental
- Computer-vision body measurement from photos
- Card processing (manual payment confirmation only)
- Native iOS/Android apps
- Multi-language (Hebrew only)
- Ratings beyond a simple 1–5 post-transaction score
- Comments, DMs, stories

---

## 14. Notes for the implementer

- **RTL is not an afterthought.** Build RTL-first; every layout decision assumes it.
- Hebrew copy throughout the UI. Keep all strings in a single `he.ts` dictionary — no hardcoded strings in components — so the founder can rewrite the voice without touching code. She will want to.
- Seed script with realistic Hebrew data for local development.
- Unit tests required for: `matchScore`, the size-ordinal mapping, and every transaction state transition (especially the return path and the auto-refund timeout). Everything else can go untested in the pilot.
- The founder is non-technical. Include a `README.md` with plain-language setup steps and an `/admin` panel she can actually operate without help.
