-- A solo gym's classes take no bookings or payment: a member just says "I'm
-- coming" so the owner can see how many to expect.
create table if not exists public.class_rsvps (
  class_id uuid not null references public.classes(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, client_id)
);
create index if not exists class_rsvps_org_idx on public.class_rsvps(org_id, class_id);
alter table public.class_rsvps enable row level security;
create policy bizqwik_team on public.class_rsvps for all using (is_bizqwik_team()) with check (is_bizqwik_team());
