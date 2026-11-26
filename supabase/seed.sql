-- Local-only seed for Phase 1. Password for all seeded users: local-dev-password
-- Do NOT use these emails/passwords on remote/Production.

create extension if not exists pgcrypto with schema extensions;

-- Fixed IDs so re-seeds and docs stay stable.
-- dept_head / founder
-- front_desk
-- client auth user
-- coach (so PT packages can be sold locally)

do $$
declare
  v_head uuid := '11111111-1111-1111-1111-111111111111';
  v_desk uuid := '22222222-2222-2222-2222-222222222222';
  v_client_user uuid := '33333333-3333-3333-3333-333333333333';
  v_coach uuid := '44444444-4444-4444-4444-444444444444';
  v_org uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_client uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_loc uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  v_pw text := extensions.crypt('local-dev-password', extensions.gen_salt('bf'));
begin
  -- Auth users + identities (local GoTrue)
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values
    ('00000000-0000-0000-0000-000000000000', v_head, 'authenticated', 'authenticated',
     'depthead@local.test', v_pw, now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
     '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_desk, 'authenticated', 'authenticated',
     'frontdesk@local.test', v_pw, now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
     '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_client_user, 'authenticated', 'authenticated',
     'client@local.test', v_pw, now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
     '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_coach, 'authenticated', 'authenticated',
     'coach@local.test', v_pw, now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
     '', '', '', '')
  on conflict (id) do nothing;

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) values
    (v_head, v_head,
     jsonb_build_object('sub', v_head::text, 'email', 'depthead@local.test'),
     'email', v_head::text, now(), now(), now()),
    (v_desk, v_desk,
     jsonb_build_object('sub', v_desk::text, 'email', 'frontdesk@local.test'),
     'email', v_desk::text, now(), now(), now()),
    (v_client_user, v_client_user,
     jsonb_build_object('sub', v_client_user::text, 'email', 'client@local.test'),
     'email', v_client_user::text, now(), now(), now()),
    (v_coach, v_coach,
     jsonb_build_object('sub', v_coach::text, 'email', 'coach@local.test'),
     'email', v_coach::text, now(), now(), now())
  on conflict do nothing;

  insert into public.bizqwik_team (id, name, email, role)
  values (v_head, 'Local Founder', 'depthead@local.test', 'founder')
  on conflict (id) do nothing;

  insert into public.organizations (id, name, slug, created_by, status, mode, timezone)
  values (v_org, 'Local Dev Gym', 'local-dev-gym', v_head, 'active', 'team', 'Africa/Cairo')
  on conflict (id) do nothing;

  insert into public.org_settings (org_id) values (v_org)
  on conflict (org_id) do nothing;

  insert into public.profiles (id, org_id, role, name, email) values
    (v_head, v_org, 'dept_head', 'Local Dept Head', 'depthead@local.test'),
    (v_desk, v_org, 'front_desk', 'Local Front Desk', 'frontdesk@local.test'),
    (v_coach, v_org, 'coach', 'Local Coach', 'coach@local.test')
  on conflict (id) do nothing;

  insert into public.locations (id, org_id, name, sort)
  values (v_loc, v_org, 'Main Floor', 0)
  on conflict (id) do nothing;

  insert into public.clients (id, org_id, name, email, phone, status, auth_user_id, home_location_id)
  values (v_client, v_org, 'Local Client', 'client@local.test', '+201000000000', 'active', v_client_user, v_loc)
  on conflict (id) do nothing;

  insert into public.wallets (client_id, org_id, balance)
  values (v_client, v_org, 500)
  on conflict (client_id) do nothing;

  -- Real spendable credit lot (balance is sum of remaining, not wallets.balance alone).
  insert into public.wallet_transactions (
    org_id, client_id, type, amount, category, description, expires_at, remaining
  )
  select v_org, v_client, 'credit', 500, 'compensation', 'Seed wallet credit',
         now() + interval '12 months', 500
  where not exists (
    select 1 from public.wallet_transactions
    where client_id = v_client and org_id = v_org and type = 'credit' and remaining > 0
  );
end $$;
