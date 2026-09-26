-- Class bundles are used on arrival, not on booking. A bundle booking only
-- reserves the spot; the session comes off the bundle when the member checks
-- in (at most one per gym day). Cancelling or not showing up costs nothing.

-- Whether this booking has actually used a bundle session. Bookings made
-- before this change already spent theirs at booking time, so they're marked
-- as spent: cancelling one still gives the session back, exactly as promised.
alter table public.class_bookings add column credit_spent boolean not null default false;
update public.class_bookings b
   set credit_spent = true
  from public.group_plans p
 where b.group_plan_id = p.id
   and b.coverage = 'plan'
   and p.kind = 'bundle'
   and b.attendance <> 'cancelled';

-- The bundle a check-in used a session from (null = nothing was deducted:
-- membership, class monthly, PT-only, or a second check-in that day).
alter table public.check_ins add column group_plan_id uuid references public.group_plans(id) on delete set null;
create index if not exists check_ins_client_time_idx on public.check_ins (client_id, checked_in_at);
