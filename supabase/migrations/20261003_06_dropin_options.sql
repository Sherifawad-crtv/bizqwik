-- A location can sell more than one drop-in (e.g. Kids and Adults), each with
-- its own label and price: [{"label":"Kids","price":600}, ...].
alter table public.locations add column if not exists dropin_options jsonb not null default '[]'::jsonb;
