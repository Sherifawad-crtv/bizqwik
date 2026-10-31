-- Shared bundles: one sale, shared by N clients. Each client gets their own
-- plan (their own sessions and expiry); the plans of one sale share a
-- share_group_id. credits and price on the plan type are the totals for the
-- whole sale, split evenly across shared_seats.
alter table public.group_plan_types add column if not exists shared_seats integer check (shared_seats is null or shared_seats >= 2);
alter table public.group_plans add column if not exists share_group_id uuid;

-- Solid: Shared 100 = 2 clients x 50 sessions, 4 months each, EGP 11,000 total.
insert into public.group_plan_types (org_id, kind, name, price, duration_months, credits, invitations_allowance, active, shared_seats)
select '8d903220-2a8d-4780-a069-5b61e0e58279', 'bundle', 'Shared 100 (2 × 50)', 11000, 4, 100, 0, true, 2
where not exists (select 1 from public.group_plan_types where org_id = '8d903220-2a8d-4780-a069-5b61e0e58279' and name = 'Shared 100 (2 × 50)');
