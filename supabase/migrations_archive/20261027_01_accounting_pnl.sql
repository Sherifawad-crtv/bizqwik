-- Accounting module v1: expenses, recurring expenses, profit & loss.
-- See scratchpad/BIZQWIK_ACCOUNTING_PNL.md for the spec this implements.
-- Revenue and coach-payout figures are NOT new tables — the P&L reuses the
-- existing /revenue calculation and the settlements table untouched.

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);
create index if not exists expense_categories_org_idx on public.expense_categories(org_id);

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid not null references public.expense_categories(id),
  amount numeric(12,2) not null check (amount > 0),
  note text,
  day_of_month integer not null check (day_of_month between 1 and 28),
  start_month text not null, -- 'YYYY-MM', Africa/Cairo calendar month
  end_month text, -- inclusive; null = open-ended
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists recurring_expenses_org_idx on public.recurring_expenses(org_id);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid not null references public.expense_categories(id),
  amount numeric(12,2) not null check (amount > 0),
  expense_date date not null,
  note text,
  receipt_path text,
  -- Hooks for later per-department / per-branch P&L (section 4 of the spec).
  -- Not surfaced in the UI yet.
  department_id uuid,
  location_id uuid references public.locations(id) on delete set null,
  recurring_id uuid references public.recurring_expenses(id) on delete set null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists expenses_org_month_idx on public.expenses(org_id, expense_date) where deleted_at is null;
create index if not exists expenses_recurring_idx on public.expenses(recurring_id);
-- A recurring template's job never double-creates the same month's row.
create unique index if not exists expenses_recurring_month_idx on public.expenses(recurring_id, expense_date) where recurring_id is not null and deleted_at is null;

-- Everything here goes through the edge function with the service-role key
-- (same as every other staff table), so these policies are defense in depth,
-- not the enforcement path. Scoped tighter than the usual "any staff in the
-- org" policy: only accountant and dept_head, per the spec.
create or replace function public.is_accounting_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('accountant', 'dept_head')
  );
$$;
revoke all on function public.is_accounting_staff() from public, anon;
grant execute on function public.is_accounting_staff() to authenticated;

alter table public.expense_categories enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.expenses enable row level security;

create policy bizqwik_team on public.expense_categories for all using (public.is_bizqwik_team()) with check (public.is_bizqwik_team());
create policy accounting_staff on public.expense_categories for all
  using (org_id = public.my_org_id() and public.is_accounting_staff())
  with check (org_id = public.my_org_id() and public.is_accounting_staff());

create policy bizqwik_team on public.recurring_expenses for all using (public.is_bizqwik_team()) with check (public.is_bizqwik_team());
create policy accounting_staff on public.recurring_expenses for all
  using (org_id = public.my_org_id() and public.is_accounting_staff())
  with check (org_id = public.my_org_id() and public.is_accounting_staff());

create policy bizqwik_team on public.expenses for all using (public.is_bizqwik_team()) with check (public.is_bizqwik_team());
create policy accounting_staff on public.expenses for all
  using (org_id = public.my_org_id() and public.is_accounting_staff())
  with check (org_id = public.my_org_id() and public.is_accounting_staff());

-- Receipts: private bucket, same shape as payment-proofs (server uploads via
-- service role from a data URI; members and other staff never touch it).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expense-receipts', 'expense-receipts', false, 2621440, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Seed the spec's default categories for every org that exists today.
insert into public.expense_categories (org_id, name, sort_order, is_default)
select o.id, c.name, c.sort_order, true
from public.organizations o
cross join (values
  ('Rent', 1), ('Salaries', 2), ('Utilities', 3), ('Equipment', 4),
  ('Maintenance', 5), ('Marketing', 6), ('Software', 7), ('Supplies', 8), ('Other', 9)
) as c(name, sort_order)
on conflict (org_id, name) do nothing;

-- New orgs get the same defaults going forward.
create or replace function public.seed_expense_categories() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.expense_categories (org_id, name, sort_order, is_default)
  values
    (new.id, 'Rent', 1, true), (new.id, 'Salaries', 2, true), (new.id, 'Utilities', 3, true),
    (new.id, 'Equipment', 4, true), (new.id, 'Maintenance', 5, true), (new.id, 'Marketing', 6, true),
    (new.id, 'Software', 7, true), (new.id, 'Supplies', 8, true), (new.id, 'Other', 9, true);
  return new;
end;
$$;
drop trigger if exists seed_expense_categories on public.organizations;
create trigger seed_expense_categories after insert on public.organizations
  for each row execute function public.seed_expense_categories();

-- Generates this month's rows from active recurring templates, and catches up
-- any month the job missed (the unique index above makes this idempotent —
-- a second run, or a retry, never duplicates a row).
select cron.schedule('bizqwik-recurring-expenses', '17 2 * * *', $$
  select net.http_post(
    url := 'https://aylhnxniqrihpvrllpgz.supabase.co/functions/v1/make-server-980e1cbf/accounting/run-recurring',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_anon_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
$$);
