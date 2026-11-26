-- Points v2: separate earn / redeem rates, check-in bonus, redemption minimum
-- and points expiry, per org. Earned points become lots (remaining +
-- expires_at) consumed oldest-first, like wallet credit.
alter table public.org_settings
  add column if not exists points_earn_per_egp integer check (points_earn_per_egp is null or points_earn_per_egp > 0),
  add column if not exists points_redeem_per_egp integer not null default 500 check (points_redeem_per_egp > 0),
  add column if not exists points_checkin integer not null default 50 check (points_checkin >= 0),
  add column if not exists points_min_redeem integer not null default 10000 check (points_min_redeem >= 0),
  add column if not exists points_ttl_months integer not null default 12 check (points_ttl_months > 0);
update public.org_settings set points_earn_per_egp = 10, points_redeem_per_egp = 500, points_checkin = 50, points_min_redeem = 10000, points_ttl_months = 12;

alter table public.points_ledger
  add column if not exists remaining integer,
  add column if not exists expires_at timestamptz;

-- Test-phase reset: all points history starts fresh under the new rules.
delete from public.points_ledger;
delete from public.points_balances;
