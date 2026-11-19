-- Members of a solo gym pay by InstaPay outside the app, upload the receipt
-- screenshot, and the owner approves it. Nothing is granted until approval.
alter table public.organizations add column if not exists instapay_address text;

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  offer_type text not null check (offer_type in ('plan_type', 'bundle_type')),
  plan_type_id uuid references public.group_plan_types(id) on delete set null,
  bundle_type_id uuid references public.bundle_types(id) on delete set null,
  name text not null,
  price numeric not null check (price >= 0),
  location_id uuid references public.locations(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  proof_path text,
  note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists payment_requests_org_status_idx on public.payment_requests(org_id, status, created_at desc);
-- One waiting request per member.
create unique index if not exists payment_requests_one_pending on public.payment_requests(client_id) where status = 'pending';
alter table public.payment_requests enable row level security;
create policy bizqwik_team on public.payment_requests for all using (is_bizqwik_team()) with check (is_bizqwik_team());

-- Receipt screenshots: private; only the edge function (service role) reads/writes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
