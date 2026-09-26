-- Ops: permanently delete an organization and everything under it, in one
-- transaction (all or nothing). Returns the auth user ids that belonged to the
-- org's staff and members, so the edge function can remove those logins once
-- they back no other identity. Callable by the service role only.
create or replace function public.delete_org(p_org uuid)
returns uuid[]
language plpgsql
set search_path = public
as $$
declare
  logins uuid[];
begin
  if not exists (select 1 from organizations where id = p_org) then
    raise exception 'No such organization';
  end if;

  select coalesce(array_agg(distinct u), '{}') into logins from (
    select id as u from profiles where org_id = p_org
    union
    select auth_user_id from clients where org_id = p_org and auth_user_id is not null
  ) s;

  -- Children before parents, so every foreign key is satisfied on the way down.
  delete from delivery_logs where org_id = p_org;
  delete from class_bookings where org_id = p_org;
  delete from drop_ins where org_id = p_org;
  delete from group_plans where org_id = p_org;
  delete from classes where org_id = p_org;
  delete from class_series where org_id = p_org;
  delete from group_plan_types where org_id = p_org;
  delete from check_ins where org_id = p_org;
  delete from invitations where org_id = p_org;
  delete from membership_instances where org_id = p_org;
  delete from membership_types where org_id = p_org;
  delete from package_instances where org_id = p_org;
  delete from bundle_types where org_id = p_org;
  delete from points_ledger where org_id = p_org;
  delete from points_balances where org_id = p_org;
  delete from wallet_transactions where org_id = p_org;
  delete from wallets where org_id = p_org;
  delete from client_notes where org_id = p_org;
  delete from client_invitations where org_id = p_org;
  delete from activity_log where org_id = p_org;
  delete from clients where org_id = p_org;
  delete from notification_log where org_id = p_org;
  delete from push_subscriptions where org_id = p_org;
  delete from sessions where org_id = p_org;
  delete from settlements where org_id = p_org;
  delete from staff_invitations where org_id = p_org;
  delete from profiles where org_id = p_org;
  delete from tiers where org_id = p_org;
  delete from org_branding where org_id = p_org;
  delete from org_settings where org_id = p_org;
  delete from organizations where id = p_org;

  return logins;
end;
$$;

revoke all on function public.delete_org(uuid) from public, anon, authenticated;
grant execute on function public.delete_org(uuid) to service_role;
