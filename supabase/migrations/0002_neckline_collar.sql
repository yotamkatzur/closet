-- Add "collar" (קולר) to the neckline options. Safe to run on a database that
-- already has 0001 applied; no-op'd into 0001 for fresh installs.
alter type neckline_enum add value if not exists 'collar' before 'other';
