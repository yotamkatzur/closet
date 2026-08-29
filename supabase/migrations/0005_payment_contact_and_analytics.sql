-- Payment & Buyer↔Seller Contact + Analytics (companion specs).
-- Coordinated Bit P2P — NO escrow, NO wallet in v1. Analytics is self-hosted
-- and admin-only at the RLS level.
--
-- NOTE: this migration REPLACES the escrow/locker model from 0001. If you
-- applied 0001 already, run the drops at the bottom first (guarded).

-- --------------------------------------------------- enum changes
alter type item_status_enum add value if not exists 'pending' before 'reserved';

create type payment_method_enum as enum ('bit','cash','paybox','other');
create type handoff_method_enum as enum ('pickup','shipping');
create type request_state_enum  as enum
  ('pending','approved','declined','expired','cancelled');

-- --------------------------------------------------- users
alter table users drop column if exists wallet_agorot;
alter table users add column if not exists payment_methods payment_method_enum[]
  not null default '{bit}';
alter table users add column if not exists bit_phone text;
alter table users add column if not exists blocked_user_ids uuid[] not null default '{}';

-- --------------------------------------------------- purchase_requests
create table purchase_requests (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references items(id),
  buyer_id     uuid not null references users(id),
  seller_id    uuid not null references users(id),
  message      text,                       -- ≤200 chars, from the buyer
  state        request_state_enum not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  expires_at   timestamptz not null        -- created_at + 24h
);
create index on purchase_requests (seller_id, state);
create index on purchase_requests (buyer_id, state);
create index on purchase_requests (item_id) where state in ('pending','approved');

-- --------------------------------------------------- transactions (reshape)
alter table transactions drop column if exists return_shipping_agorot;
alter table transactions drop column if exists outbound_locker_from;
alter table transactions drop column if exists outbound_locker_to;
alter table transactions drop column if exists return_locker_from;
alter table transactions drop column if exists return_locker_to;
alter table transactions drop column if exists paid_at;
alter table transactions drop column if exists shipped_at;
alter table transactions drop column if exists return_shipped_at;
alter table transactions drop column if exists return_delivered_at;

alter table transactions add column if not exists request_id uuid references purchase_requests(id);
alter table transactions add column if not exists payment_method payment_method_enum;
alter table transactions add column if not exists payment_ref text;          -- 'CL-####'
alter table transactions add column if not exists handoff_method handoff_method_enum;
alter table transactions add column if not exists phone_revealed_at timestamptz;
alter table transactions add column if not exists buyer_marked_paid_at timestamptz;
alter table transactions add column if not exists seller_confirmed_paid_at timestamptz;
alter table transactions add column if not exists hold_expires_at timestamptz;   -- created_at + 48h
alter table transactions add column if not exists return_started_at timestamptz;
alter table transactions add column if not exists mismatch_flagged_at timestamptz;

-- tx_state_enum loses PAID_HELD / SHIPPED. Postgres can't drop enum values;
-- for a fresh project recreate the type. For an existing pilot they simply
-- stop being used.

-- =====================================================================
-- Analytics (analytics-spec §3) — admin read only
-- =====================================================================
create table analytics_events (
  id          bigserial primary key,
  user_id     uuid references users(id),
  session_id  text not null,
  event       text not null,
  props       jsonb not null default '{}',
  item_id     uuid references items(id),
  tx_id       uuid references transactions(id),
  created_at  timestamptz not null default now()
);
create index on analytics_events (event, created_at);
create index on analytics_events (user_id, created_at);
create index on analytics_events (item_id) where item_id is not null;
create index on analytics_events using gin (props);

create table feed_impressions (
  id          bigserial primary key,
  user_id     uuid not null references users(id),
  session_id  text not null,
  item_id     uuid not null references items(id),
  tier        char(1) not null,
  match_score numeric(4,3),
  position    int not null,
  feed_mode   text not null,          -- 'chronological' | 'ranked'
  clicked     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on feed_impressions (user_id, created_at);
create index on feed_impressions (tier, feed_mode);

create table kpi_snapshots (
  week_start  date primary key,
  metrics     jsonb not null,
  notes       text,
  created_at  timestamptz default now()
);

-- --------------------------------------------------- RLS
alter table purchase_requests enable row level security;
alter table analytics_events  enable row level security;
alter table feed_impressions  enable row level security;
alter table kpi_snapshots     enable row level security;

create policy pr_read on purchase_requests for select
  using (buyer_id = auth.uid() or seller_id = auth.uid() or is_admin());
-- requests are created/updated by server actions with the service key.

-- analytics is admin-only; the client never reads it (analytics-spec §2)
create policy ae_admin on analytics_events for select using (is_admin());
create policy fi_admin on feed_impressions for select using (is_admin());
create policy ks_admin on kpi_snapshots  for select using (is_admin());

-- drop the wallet ledger from 0001 if present
drop table if exists wallet_ledger;
