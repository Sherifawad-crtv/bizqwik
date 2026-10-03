-- Locations: a business can run sessions in more than one place. Everything
-- here is optional (nullable): an org with no locations behaves exactly as
-- before, so team gyms are unaffected.
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists locations_org_idx on public.locations(org_id);
alter table public.locations enable row level security;
create policy manage on public.locations for all
  using (is_bizqwik_team() or org_id = my_org_id())
  with check (is_bizqwik_team() or org_id = my_org_id());
create policy client_read on public.locations for select
  using (org_id = my_client_org_id());

-- Where each session / recurring class happens.
alter table public.class_series add column if not exists location_id uuid references public.locations(id) on delete set null;
alter table public.classes add column if not exists location_id uuid references public.locations(id) on delete set null;
-- Which location a plan or PT bundle is sold for (and only works at).
alter table public.group_plan_types add column if not exists location_id uuid references public.locations(id) on delete set null;
alter table public.bundle_types add column if not exists location_id uuid references public.locations(id) on delete set null;
-- Snapshot on each sale, so renaming/changing the catalog never moves a sold plan.
alter table public.group_plans add column if not exists location_id uuid references public.locations(id) on delete set null;
alter table public.package_instances add column if not exists location_id uuid references public.locations(id) on delete set null;
-- A member's home location (chosen in the member app, or by staff).
alter table public.clients add column if not exists home_location_id uuid references public.locations(id) on delete set null;

create index if not exists class_series_location_idx on public.class_series(location_id);
create index if not exists classes_location_idx on public.classes(location_id);
create index if not exists group_plan_types_location_idx on public.group_plan_types(location_id);
create index if not exists bundle_types_location_idx on public.bundle_types(location_id);
create index if not exists group_plans_location_idx on public.group_plans(location_id);
create index if not exists package_instances_location_idx on public.package_instances(location_id);
create index if not exists clients_home_location_idx on public.clients(home_location_id);
