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

-- One atomic step: lock the settlement, check what's left, record the payment
-- and close the month when it's fully paid. Two taps at once can't overpay.
create or replace function public.record_settlement_payment(p_settlement uuid, p_org uuid, p_amount numeric, p_paid_on date, p_method text, p_note text, p_by uuid)
returns table(payment_id uuid, paid_total numeric, total numeric, remaining numeric)
language plpgsql as $fn$
declare s record; paid numeric; rem numeric; pid uuid;
begin
  select * into s from public.settlements where id = p_settlement and org_id = p_org for update;
  if not found then raise exception 'no_settlement'; end if;
  select coalesce(sum(amount), 0) into paid from public.settlement_payments where settlement_id = p_settlement;
  rem := (s.group_total + s.private_total) - paid;
  if rem <= 0 then raise exception 'nothing_left'; end if;
  if p_amount > rem then raise exception 'over_remaining:%', rem; end if;
  insert into public.settlement_payments (org_id, settlement_id, amount, paid_on, method, note, paid_by)
  values (p_org, p_settlement, p_amount, p_paid_on, p_method, p_note, p_by) returning id into pid;
  if p_amount >= rem then update public.settlements set paid_by = p_by, paid_at = now() where id = p_settlement; end if;
  return query select pid, paid + p_amount, s.group_total + s.private_total, rem - p_amount;
end $fn$;
