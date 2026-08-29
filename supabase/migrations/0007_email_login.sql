-- Optional second login channel: email + a one-time code.
-- Phone stays the primary identity (Bit / WhatsApp / phone-reveal need it);
-- email is a shortcut for returning users so they don't burn an SMS every time.

alter table users add column email text unique;

-- Login codes. In the pilot this lives in the local JSON store; in production
-- phone codes go through Twilio Verify and only email codes land here.
create table login_codes (
  target     text not null,           -- canonical phone (+972…) or lower-cased email
  code       text not null,
  expires_at timestamptz not null,
  primary key (target)
);

alter table login_codes enable row level security;
-- No policies: only the server (service role) touches this table.
