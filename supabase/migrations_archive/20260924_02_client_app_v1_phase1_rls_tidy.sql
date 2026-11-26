-- Phase 1 tidy: covering indexes for new FKs, collapse team+staff policies,
-- fix the RLS initplan warning on clients.

create index if not exists activity_log_subject_client_idx on public.activity_log(subject_client_id);
create index if not exists classes_created_by_idx on public.classes(created_by);
create index if not exists client_invitations_client_idx on public.client_invitations(client_id);
create index if not exists client_invitations_invited_by_idx on public.client_invitations(invited_by);

-- one "manage" policy per new table instead of separate team_all + staff_org
do $$
declare t text;
begin
  foreach t in array array['client_invitations','org_branding','org_settings','classes','class_bookings','activity_log'] loop
    execute format('drop policy if exists team_all on public.%I', t);
    execute format('drop policy if exists staff_org on public.%I', t);
    execute format($f$create policy manage on public.%I for all
      using (public.is_bizqwik_team() or org_id = public.my_org_id())
      with check (public.is_bizqwik_team() or org_id = public.my_org_id())$f$, t);
  end loop;
end $$;

-- wrap auth.uid() in a scalar subquery (RLS initplan perf)
drop policy if exists client_self_select on public.clients;
create policy client_self_select on public.clients for select using (auth_user_id = (select auth.uid()));
