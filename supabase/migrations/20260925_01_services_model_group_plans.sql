-- Services model: recurring class series, a group-plan catalog (all-access
-- memberships + class bundles), member group plans (membership / per-class
-- monthly / bundle) with at most ONE active per member, and booking coverage.
-- Private training (bundle_types / package_instances) is untouched.

alter table organizations add column if not exists timezone text not null default 'Africa/Cairo';

create table class_series (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  description text,
  weekdays smallint[] not null check (array_length(weekdays, 1) >= 1 and weekdays <@ '{0,1,2,3,4,5,6}'::smallint[]),
  start_time time not null,
  duration_min integer not null default 60 check (duration_min > 0),
  drop_in_price numeric not null check (drop_in_price >= 0),
  monthly_price numeric not null check (monthly_price >= 0),
  status text not null default 'active' check (status in ('active', 'ended')),
  generated_until date,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index class_series_org_idx on class_series(org_id);
create index class_series_created_by_idx on class_series(created_by);

alter table classes add column series_id uuid references class_series(id) on delete set null;
create index classes_series_idx on classes(series_id);
create unique index classes_series_starts_uq on classes(series_id, starts_at) where series_id is not null;

create table group_plan_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  kind text not null check (kind in ('membership', 'bundle')),
  name text not null,
  price numeric not null check (price >= 0),
  duration_months integer not null check (duration_months >= 1),
  credits integer,
  invitations_allowance integer not null default 0 check (invitations_allowance >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((kind = 'bundle' and credits is not null and credits > 0) or (kind = 'membership' and credits is null))
);
create index group_plan_types_org_idx on group_plan_types(org_id);

create table group_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  kind text not null check (kind in ('membership', 'class_monthly', 'bundle')),
  plan_type_id uuid references group_plan_types(id) on delete set null,
  series_id uuid references class_series(id) on delete set null,
  name text not null,
  price_at_sale numeric not null check (price_at_sale >= 0),
  pay_method text not null check (pay_method in ('cash', 'card', 'wallet')),
  credits_total integer,
  credits_remaining integer check (credits_remaining is null or credits_remaining >= 0),
  invitations_remaining integer not null default 0,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'finished')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  check (kind <> 'bundle' or (credits_total is not null and credits_remaining is not null))
);
create index group_plans_org_idx on group_plans(org_id);
create index group_plans_client_idx on group_plans(client_id);
create index group_plans_type_idx on group_plans(plan_type_id);
create index group_plans_series_idx on group_plans(series_id);
create index group_plans_created_by_idx on group_plans(created_by);
-- The no-overlap rule, enforced by the database itself.
create unique index group_plans_one_active_per_client on group_plans(client_id) where status = 'active';

alter table class_bookings add column coverage text not null default 'drop_in' check (coverage in ('plan', 'drop_in'));
alter table class_bookings add column group_plan_id uuid references group_plans(id) on delete set null;
create index class_bookings_group_plan_idx on class_bookings(group_plan_id);
alter table class_bookings drop constraint class_bookings_pay_method_check;
alter table class_bookings add constraint class_bookings_pay_method_check check (pay_method in ('wallet', 'desk', 'plan'));

alter table wallet_transactions drop constraint wallet_transactions_category_check;
alter table wallet_transactions add constraint wallet_transactions_category_check check (category in
  ('session', 'refund', 'topup', 'reward', 'cashback', 'compensation', 'desk_sale', 'class_booking', 'expiry', 'plan_purchase'));

-- RLS (edge function uses the service role; this is defense in depth, matching classes/class_bookings).
alter table class_series enable row level security;
alter table group_plan_types enable row level security;
alter table group_plans enable row level security;
create policy manage on class_series for all using (is_bizqwik_team() or org_id = my_org_id()) with check (is_bizqwik_team() or org_id = my_org_id());
create policy client_read on class_series for select using (org_id = my_client_org_id());
create policy manage on group_plan_types for all using (is_bizqwik_team() or org_id = my_org_id()) with check (is_bizqwik_team() or org_id = my_org_id());
create policy client_read on group_plan_types for select using (org_id = my_client_org_id());
create policy manage on group_plans for all using (is_bizqwik_team() or org_id = my_org_id()) with check (is_bizqwik_team() or org_id = my_org_id());
create policy client_own on group_plans for select using (client_id = my_client_id());

-- Move the existing membership product(s) into the new catalog (none sold yet).
insert into group_plan_types (org_id, kind, name, price, duration_months, invitations_allowance)
select org_id, 'membership', name, price, greatest(1, round(duration_days / 30.0)::int), invitations_allowance
from membership_types;
