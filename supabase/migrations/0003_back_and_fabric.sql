-- Add "back" (גב: פתוח/סגור) and "fabric" (סוג בד) attributes to items.
-- Safe on a database that already has 0001/0002 applied.
do $$ begin
  create type back_style_enum as enum ('open','closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fabric_enum as enum
    ('satin','chiffon','lace','velvet','tulle','silk','crepe','jersey','organza','sequin','knit','other');
exception when duplicate_object then null; end $$;

alter table items add column if not exists back   back_style_enum;
alter table items add column if not exists fabric fabric_enum;
