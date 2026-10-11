-- Coach session counts per month for the revenue report, counted by the
-- database in one pass (the report used to read every session row, a month at
-- a time). Called only by the edge function (service role).
create or replace function public.revenue_session_counts(p_org uuid, p_months text[])
returns table (coach_id uuid, month text, n integer)
language sql
stable
as $$
  select s.coach_id, s.month, count(*)::integer
  from public.sessions s
  where s.org_id = p_org and s.month = any (p_months)
  group by s.coach_id, s.month;
$$;

revoke execute on function public.revenue_session_counts(uuid, text[]) from public, anon, authenticated;
grant execute on function public.revenue_session_counts(uuid, text[]) to service_role;
