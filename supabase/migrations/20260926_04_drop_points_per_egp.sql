-- Replaced by points_earn_per_egp / points_redeem_per_egp (points v2).
alter table public.org_settings drop column if exists points_per_egp;
