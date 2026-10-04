-- A class plan sold by a solo gym includes a freeze: 1-month plans 1 week, 3-month
-- plans 2 weeks, used once. Freezing pauses the plan (no check-ins) and pushes its
-- end date out by the same time; it restarts by itself when the freeze is over.
alter table public.group_plans
  add column if not exists freeze_days int not null default 0,
  add column if not exists freeze_used boolean not null default false,
  add column if not exists frozen_from timestamptz,
  add column if not exists frozen_until timestamptz,
  add column if not exists thaw_notified boolean not null default true;
