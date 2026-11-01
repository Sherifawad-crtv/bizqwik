-- Part payments: a settled month can be paid in several instalments (e.g. the
-- group sessions first, the PT cut later). The month stays "settled" until the
-- payments add up to its total, then it flips to "paid" (settlements.paid_at).
create table if not exists public.settlement_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  settlement_id uuid not null references public.settlements(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  paid_on date not null,
  method text not null check (method in ('cash', 'bank', 'instapay', 'other')),
  note text,
  paid_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists settlement_payments_settlement_idx on public.settlement_payments(settlement_id);
create index if not exists settlement_payments_org_idx on public.settlement_payments(org_id);

alter table public.settlement_payments enable row level security;
create policy bizqwik_team on public.settlement_payments for all using (public.is_bizqwik_team()) with check (public.is_bizqwik_team());

-- Months already marked paid become one full payment on their paid date
-- ('other' = recorded before methods were tracked).
insert into public.settlement_payments (org_id, settlement_id, amount, paid_on, method, paid_by, created_at)
select s.org_id, s.id, s.group_total + s.private_total, (s.paid_at at time zone 'Africa/Cairo')::date, 'other', s.paid_by, s.paid_at
from public.settlements s
where s.paid_at is not null and s.group_total + s.private_total > 0
  and not exists (select 1 from public.settlement_payments p where p.settlement_id = s.id);
