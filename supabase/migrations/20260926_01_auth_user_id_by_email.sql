-- Service-role-only lookup of an auth user by email. Signup uses it to adopt an
-- orphaned login (auth user with no profile / client / bizqwik_team row, e.g.
-- left behind when a test client was deleted) instead of failing with
-- "already registered".
create or replace function public.auth_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1
$$;
revoke all on function public.auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;
