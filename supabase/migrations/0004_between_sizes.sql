-- Add "between" sizes S-M and M-L to size_enum (used by body_cards.usual_size).
-- Placed on the half-steps between S/M and M/L. Safe on a DB with 0001 applied.
alter type size_enum add value if not exists 'S-M' before 'M';
alter type size_enum add value if not exists 'M-L' after 'M';
