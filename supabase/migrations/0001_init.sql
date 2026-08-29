-- Closet — initial schema. Mirrors src/lib/types.ts and the local JSON store
-- one-to-one. Apply with the Supabase CLI (`supabase db push`) or paste into
-- the SQL editor. RLS policies at the bottom.
--
-- The pilot runs on DATA_DRIVER=local and does NOT need this. Use it when you
-- move to a real Supabase project (see README → "Going to production").

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------ enums
create type size_enum        as enum ('XS','S','S-M','M','M-L','L','XL','XXL');
create type body_shape_enum  as enum ('pear','hourglass','straight','curvy','athletic');
create type fit_verdict_enum as enum ('ran_small','true_to_size','ran_large');
create type fit_source_enum  as enum ('purchase','self_reported');
create type length_enum      as enum ('mini','midi','maxi');
create type neckline_enum    as enum ('strapless','v_neck','square','halter','one_shoulder','high_neck','collar','other');
create type sleeve_enum      as enum ('sleeveless','short','three_quarter','long');
create type back_style_enum  as enum ('open','closed');
create type fabric_enum      as enum ('satin','chiffon','lace','velvet','tulle','silk','crepe','jersey','organza','sequin','knit','other');
create type condition_enum   as enum ('new_with_tags','like_new','good','worn');
create type item_status_enum as enum ('available','reserved','sold','hidden','draft');
create type tx_state_enum    as enum (
  'RESERVED','PAID_HELD','SHIPPED','PICKED_UP','RETURN_IN_TRANSIT',
  'COMPLETED','REFUNDED','CANCELLED','DISPUTED'
);

-- ------------------------------------------------------------------ users
create table users (
  id            uuid primary key default gen_random_uuid(),
  phone         text unique not null,
  display_name  text not null,
  avatar_url    text,
  city          text,
  created_at    timestamptz not null default now(),
  is_admin      boolean not null default false,
  is_suspended  boolean not null default false,
  wallet_agorot integer not null default 0
);

create table body_cards (
  user_id        uuid primary key references users(id) on delete cascade,
  height_cm      integer not null,
  usual_size     size_enum not null,
  bra_size       text,
  body_shape_tag body_shape_enum,
  shoulders_cm   integer,
  waist_cm       integer,
  hips_cm        integer,
  updated_at     timestamptz not null default now()
);

create table fit_history (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  brand      text not null,
  size       text not null,
  verdict    fit_verdict_enum not null,
  source     fit_source_enum not null,
  created_at timestamptz not null default now()
);
create index on fit_history (user_id);

-- ------------------------------------------------------------------ items
create table items (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               uuid not null references users(id) on delete cascade,
  title                  text not null,
  brand                  text,
  label_size             text not null,
  owner_verdict          fit_verdict_enum,
  color                  text not null,
  length                 length_enum not null,
  neckline               neckline_enum not null,
  sleeve                 sleeve_enum not null,
  back                   back_style_enum,
  fabric                 fabric_enum,
  occasion_tags          text[] not null default '{}',
  condition              condition_enum not null,
  price_agorot           integer not null check (price_agorot > 0),
  original_price_agorot  integer,
  description            text not null default '',
  status                 item_status_enum not null default 'draft',
  created_at             timestamptz not null default now()
);
create index on items (status, created_at desc);
create index on items (owner_id);

create table item_photos (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references items(id) on delete cascade,
  url        text not null,
  on_body    boolean not null default false,
  sort_order integer not null default 0
);
create index on item_photos (item_id);

-- ----------------------------------------------------------- transactions
create table transactions (
  id                    uuid primary key default gen_random_uuid(),
  item_id               uuid not null references items(id),
  buyer_id              uuid not null references users(id),
  seller_id             uuid not null references users(id),
  price_agorot          integer not null,
  fee_agorot            integer not null,
  return_shipping_agorot integer not null default 2000,
  state                 tx_state_enum not null default 'RESERVED',
  outbound_locker_from  text,
  outbound_locker_to    text,
  return_locker_from    text,
  return_locker_to      text,
  paid_at               timestamptz,
  shipped_at            timestamptz,
  picked_up_at          timestamptz,           -- starts the 48h return clock
  return_deadline       timestamptz,           -- picked_up_at + 48h
  return_shipped_at     timestamptz,
  return_delivered_at   timestamptz,
  created_at            timestamptz not null default now()
);
create index on transactions (buyer_id);
create index on transactions (seller_id);
create index on transactions (state);

-- Append-only audit log. Every state change writes exactly one row.
create table transaction_events (
  id         uuid primary key default gen_random_uuid(),
  tx_id      uuid not null references transactions(id) on delete cascade,
  from_state tx_state_enum,
  to_state   tx_state_enum not null,
  actor_id   uuid references users(id),
  note       text not null default '',
  created_at timestamptz not null default now()
);
create index on transaction_events (tx_id, created_at);

-- --------------------------------------------------------------- social
create table follows (
  follower_id uuid not null references users(id) on delete cascade,
  followee_id uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id)
);

create table likes (
  user_id    uuid not null references users(id) on delete cascade,
  item_id    uuid not null references items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table ratings (
  id         uuid primary key default gen_random_uuid(),
  tx_id      uuid not null references transactions(id) on delete cascade,
  rater_id   uuid not null references users(id),
  ratee_id   uuid not null references users(id),
  score      smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  unique (tx_id, rater_id)
);

create table reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references users(id),
  target_type text not null check (target_type in ('item','user')),
  target_id   uuid not null,
  reason      text not null,
  created_at  timestamptz not null default now(),
  resolved    boolean not null default false
);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  kind       text not null,
  body       text not null,
  href       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index on notifications (user_id, read);

create table wallet_ledger (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id),
  amount_agorot integer not null,          -- + credit, - debit
  memo         text not null,
  tx_id        uuid references transactions(id),
  created_at   timestamptz not null default now()
);
create index on wallet_ledger (user_id, created_at desc);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table users               enable row level security;
alter table body_cards          enable row level security;
alter table fit_history         enable row level security;
alter table items               enable row level security;
alter table item_photos         enable row level security;
alter table transactions        enable row level security;
alter table transaction_events  enable row level security;
alter table follows             enable row level security;
alter table likes               enable row level security;
alter table ratings             enable row level security;
alter table reports             enable row level security;
alter table notifications       enable row level security;
alter table wallet_ledger       enable row level security;

-- helper: is the current user an admin?
create or replace function is_admin() returns boolean language sql stable as $$
  select coalesce((select is_admin from users where id = auth.uid()), false);
$$;

-- users: everyone can read public profile fields; you edit only yourself.
-- NOTE: phone is sensitive — expose it through a view that omits phone for
-- non-self rows, or keep reads server-side with the service key.
create policy users_read   on users for select using (true);
create policy users_update on users for update using (id = auth.uid() or is_admin());

-- body measurements: readable by anyone (needed for match labels), writable
-- only by the owner. They are not secret, but they ARE personal — never log
-- them, never send to third-party analytics (spec section 9).
create policy body_read   on body_cards for select using (true);
create policy body_write  on body_cards for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy fit_read    on fit_history for select using (true);
create policy fit_write   on fit_history for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- items: public listings are visible to all; drafts/hidden only to owner/admin.
create policy items_read on items for select
  using (status in ('available','reserved','sold') or owner_id = auth.uid() or is_admin());
create policy items_write on items for all
  using (owner_id = auth.uid() or is_admin())
  with check (owner_id = auth.uid() or is_admin());

create policy photos_read on item_photos for select using (true);
create policy photos_write on item_photos for all
  using (exists (select 1 from items i where i.id = item_id and (i.owner_id = auth.uid() or is_admin())))
  with check (exists (select 1 from items i where i.id = item_id and (i.owner_id = auth.uid() or is_admin())));

-- transactions: visible only to the two parties + admin. State changes go
-- through server actions using the service key, so no client write policy.
create policy tx_read on transactions for select
  using (buyer_id = auth.uid() or seller_id = auth.uid() or is_admin());

create policy tx_events_read on transaction_events for select
  using (exists (select 1 from transactions t where t.id = tx_id
    and (t.buyer_id = auth.uid() or t.seller_id = auth.uid() or is_admin())));

create policy follows_read  on follows for select using (true);
create policy follows_write on follows for all using (follower_id = auth.uid()) with check (follower_id = auth.uid());

create policy likes_read  on likes for select using (user_id = auth.uid());
create policy likes_write on likes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy ratings_read  on ratings for select using (true);
create policy ratings_write on ratings for insert with check (rater_id = auth.uid());

create policy reports_write on reports for insert with check (reporter_id = auth.uid());
create policy reports_admin on reports for select using (is_admin());

create policy notif_read  on notifications for select using (user_id = auth.uid());
create policy notif_update on notifications for update using (user_id = auth.uid());

create policy ledger_read on wallet_ledger for select using (user_id = auth.uid() or is_admin());
