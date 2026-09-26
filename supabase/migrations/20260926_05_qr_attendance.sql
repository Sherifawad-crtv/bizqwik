-- QR attendance.
-- Coaches log group attendance by scanning a coaches'-room QR (separate from
-- the members' check-in QR, which stays the org slug). PT sessions are
-- deducted only by the coach scanning the member's per-bundle QR shown in the
-- client app. A renewal is a new package_instance, so it gets a new code.

alter table public.organizations
  add column if not exists coach_qr_token text not null
    default ('bqc_' || replace(gen_random_uuid()::text, '-', ''));
create unique index if not exists organizations_coach_qr_token_key on public.organizations (coach_qr_token);

alter table public.package_instances
  add column if not exists qr_token text not null
    default ('bqpt_' || replace(gen_random_uuid()::text, '-', ''));
create unique index if not exists package_instances_qr_token_key on public.package_instances (qr_token);

-- How the entry was made: 'qr' (scanned) or 'manual' (a head's correction).
alter table public.sessions
  add column if not exists source text not null default 'manual' check (source in ('manual', 'qr'));
alter table public.delivery_logs
  add column if not exists source text not null default 'manual' check (source in ('manual', 'qr'));

-- One PT session per bundle per day.
create index if not exists delivery_logs_pkg_date_idx on public.delivery_logs (package_instance_id, date);

-- The scan tokens are the proof of presence, so no signed-in user may read
-- (or write around) them directly. Both apps reach these tables only through
-- the edge function (service role), so direct API access is closed off.
revoke all on public.organizations, public.package_instances, public.sessions, public.delivery_logs from anon, authenticated;
