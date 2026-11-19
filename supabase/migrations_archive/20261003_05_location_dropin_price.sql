-- Each location has its own one-off drop-in price (solo owners).
alter table public.locations add column if not exists dropin_price numeric check (dropin_price is null or dropin_price >= 0);
