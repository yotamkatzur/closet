-- In-app chat, scoped to a transaction (available once a request is approved).
-- Runs alongside WhatsApp. Payment still happens in Bit only — chat is
-- coordination, not money.

create table chat_messages (
  id         uuid primary key default gen_random_uuid(),
  tx_id      uuid not null references transactions(id) on delete cascade,
  sender_id  uuid not null references users(id),
  body       text not null check (char_length(body) <= 1000),
  read_by    uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index on chat_messages (tx_id, created_at);

alter table chat_messages enable row level security;

-- Only the two parties to the transaction (or admin) can read/write the thread.
create policy chat_read on chat_messages for select using (
  exists (
    select 1 from transactions t
    where t.id = tx_id
      and (t.buyer_id = auth.uid() or t.seller_id = auth.uid() or is_admin())
  )
);
create policy chat_write on chat_messages for insert with check (
  sender_id = auth.uid()
  and exists (
    select 1 from transactions t
    where t.id = tx_id
      and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
  )
);
create policy chat_update on chat_messages for update using (
  exists (
    select 1 from transactions t
    where t.id = tx_id
      and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
  )
);

-- Avatars: users.avatar_url already exists (0001). In production it points at a
-- Supabase Storage object with a signed URL; the pilot writes to public/uploads.
