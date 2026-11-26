-- ===== Client app v1 — Phase 1 schema (additive) =====

-- 1) Client auth linkage
alter table public.clients
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
create unique index if not exists clients_auth_user_id_key on public.clients(auth_user_id) where auth_user_id is not null;

create or replace function public.my_client_id()
returns uuid language sql stable security definer set search_path to '' as
$$ select id from public.clients where auth_user_id = auth.uid() $$;

create or replace function public.my_client_org_id()
returns uuid language sql stable security definer set search_path to '' as
$$ select org_id from public.clients where auth_user_id = auth.uid() $$;

-- 2) Client invitations (mirror staff_invitations; invited_by nullable)
create table if not exists public.client_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  email text not null unique,
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists client_invitations_org_idx on public.client_invitations(org_id);

-- 3) Per-org branding (served pre-auth via the edge function)
create table if not exists public.org_branding (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  app_name text,
  logo_url text,
  icon_url text,
  primary_color text,
  onboarding_assets jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- 4) Per-org settings (points rate + wallet ttl); rate null = points not configured
create table if not exists public.org_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  points_per_egp int,
  wallet_credit_ttl_months int not null default 12,
  updated_at timestamptz not null default now()
);

-- 5) Wallet: extend wallet_transactions for FIFO 12-month expiry + wider categories
alter table public.wallet_transactions
  add column if not exists expires_at timestamptz,
  add column if not exists remaining numeric;
alter table public.wallet_transactions drop constraint if exists wallet_transactions_category_check;
alter table public.wallet_transactions add constraint wallet_transactions_category_check
  check (category = any (array['session','refund','topup','reward','cashback','compensation','desk_sale','class_booking','expiry']));

-- 6) Classes (dept_head-created dated classes; uncapped, no staff/slots)
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  price_egp numeric not null default 0,
  created_by uuid references public.profiles(id),
  status text not null default 'active' check (status in ('active','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists classes_org_starts_idx on public.classes(org_id, starts_at);

-- 7) Class bookings
create table if not exists public.class_bookings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  pay_method text not null check (pay_method in ('wallet','desk')),
  pay_status text not null default 'pending' check (pay_status in ('paid','pending','refunded')),
  attendance text not null default 'booked' check (attendance in ('booked','arrived','no_show','cancelled')),
  price_egp numeric not null,
  booked_at timestamptz not null default now(),
  unique (class_id, client_id)
);
create index if not exists class_bookings_org_idx on public.class_bookings(org_id);
create index if not exists class_bookings_client_idx on public.class_bookings(client_id);

-- 8) Activity log (feed + Logs tab)
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid,
  subject_client_id uuid references public.clients(id) on delete set null,
  type text not null,
  amount numeric,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_log_org_created_idx on public.activity_log(org_id, created_at desc);

-- ===== RLS (defense-in-depth; edge function uses service role) =====
alter table public.client_invitations enable row level security;
alter table public.org_branding      enable row level security;
alter table public.org_settings       enable row level security;
alter table public.classes             enable row level security;
alter table public.class_bookings      enable row level security;
alter table public.activity_log        enable row level security;

-- initial team + staff policies (collapsed into one "manage" policy by 20260924_02)
create policy team_all on public.client_invitations for all using (public.is_bizqwik_team()) with check (public.is_bizqwik_team());
create policy team_all on public.org_branding      for all using (public.is_bizqwik_team()) with check (public.is_bizqwik_team());
create policy team_all on public.org_settings      for all using (public.is_bizqwik_team()) with check (public.is_bizqwik_team());
create policy team_all on public.classes           for all using (public.is_bizqwik_team()) with check (public.is_bizqwik_team());
create policy team_all on public.class_bookings    for all using (public.is_bizqwik_team()) with check (public.is_bizqwik_team());
create policy team_all on public.activity_log      for all using (public.is_bizqwik_team()) with check (public.is_bizqwik_team());
create policy staff_org on public.client_invitations for all using (org_id = public.my_org_id()) with check (org_id = public.my_org_id());
create policy staff_org on public.org_branding      for all using (org_id = public.my_org_id()) with check (org_id = public.my_org_id());
create policy staff_org on public.org_settings      for all using (org_id = public.my_org_id()) with check (org_id = public.my_org_id());
create policy staff_org on public.classes           for all using (org_id = public.my_org_id()) with check (org_id = public.my_org_id());
create policy staff_org on public.class_bookings    for all using (org_id = public.my_org_id()) with check (org_id = public.my_org_id());
create policy staff_org on public.activity_log      for all using (org_id = public.my_org_id()) with check (org_id = public.my_org_id());

-- members: read classes of their org; read/manage their own bookings
create policy client_read on public.classes for select using (org_id = public.my_client_org_id());
create policy client_own on public.class_bookings for all
  using (client_id = public.my_client_id()) with check (client_id = public.my_client_id());

-- members: read their own profile/wallet/points rows
create policy client_self_select on public.clients for select using (auth_user_id = auth.uid());
create policy client_self_select on public.wallets for select using (client_id = public.my_client_id());
create policy client_self_select on public.wallet_transactions for select using (client_id = public.my_client_id());
create policy client_self_select on public.points_balances for select using (client_id = public.my_client_id());
create policy client_self_select on public.points_ledger for select using (client_id = public.my_client_id());
