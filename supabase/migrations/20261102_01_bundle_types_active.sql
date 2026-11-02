-- PT packages can be taken off sale (like group plans) without deleting them,
-- so people who hold one keep it.
alter table public.bundle_types add column if not exists active boolean not null default true;
