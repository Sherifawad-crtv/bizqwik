-- A business can run in "solo" mode (the owner does the front desk's work too and
-- sees a simpler app) or "team" mode (today's behaviour). Additive; default team.
alter table public.organizations add column if not exists mode text not null default 'team' check (mode in ('solo','team'));
