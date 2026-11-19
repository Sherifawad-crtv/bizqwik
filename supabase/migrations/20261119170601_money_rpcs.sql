-- Phase 2 money RPCs (local expand). Additive only.
-- Private logic in app_private; thin public wrappers for PostgREST/service_role.
-- EXECUTE revoked from anon/authenticated. Edge calls public.* via admin().rpc.

create schema if not exists app_private;

revoke all on schema app_private from public;
grant usage on schema app_private to postgres, service_role;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function app_private.assert_client_org(p_org_id uuid, p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_org_id is null or p_client_id is null then
    raise exception 'org_id and client_id are required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.clients c
    where c.id = p_client_id and c.org_id = p_org_id
  ) then
    raise exception 'client/org mismatch' using errcode = '42501';
  end if;
end;
$$;

create or replace function app_private.lock_wallet(p_org_id uuid, p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.wallets (client_id, org_id, balance, updated_at)
  values (p_client_id, p_org_id, 0, now())
  on conflict (client_id) do nothing;

  perform 1 from public.wallets w
  where w.client_id = p_client_id and w.org_id = p_org_id
  for update;
end;
$$;

-- Lazy expiry: zero remaining on stale credit lots + expiry debit rows (matches JS sweepWalletExpiry).
create or replace function app_private.sweep_wallet_expiry(p_org_id uuid, p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select id, remaining
    from public.wallet_transactions
    where client_id = p_client_id
      and org_id = p_org_id
      and type = 'credit'
      and remaining > 0
      and expires_at is not null
      and expires_at <= now()
    for update
  loop
    update public.wallet_transactions
      set remaining = 0
      where id = r.id;

    insert into public.wallet_transactions (org_id, client_id, type, amount, category, description)
    values (p_org_id, p_client_id, 'debit', r.remaining, 'expiry', 'Store credit expired');

    insert into public.activity_log (org_id, actor_id, subject_client_id, type, amount, meta)
    values (p_org_id, null, p_client_id, 'wallet_expired', r.remaining, '{}'::jsonb);
  end loop;
end;
$$;

create or replace function app_private.wallet_balance_compute(p_org_id uuid, p_client_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(remaining), 0)
  from public.wallet_transactions
  where client_id = p_client_id
    and org_id = p_org_id
    and type = 'credit'
    and remaining > 0
    and (expires_at is null or expires_at > now());
$$;

create or replace function app_private.wallet_balance_refresh(p_org_id uuid, p_client_id uuid)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  bal numeric;
begin
  perform app_private.sweep_wallet_expiry(p_org_id, p_client_id);
  bal := app_private.wallet_balance_compute(p_org_id, p_client_id);
  insert into public.wallets (client_id, org_id, balance, updated_at)
  values (p_client_id, p_org_id, bal, now())
  on conflict (client_id) do update
    set balance = excluded.balance,
        org_id = excluded.org_id,
        updated_at = excluded.updated_at;
  return bal;
end;
$$;

-- ---------------------------------------------------------------------------
-- Wallet credit / debit
-- ---------------------------------------------------------------------------

create or replace function app_private.wallet_credit(
  p_org_id uuid,
  p_client_id uuid,
  p_amount numeric,
  p_category text,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ttl int;
  expires timestamptz;
  bal numeric;
begin
  perform app_private.assert_client_org(p_org_id, p_client_id);

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be > 0' using errcode = '22023';
  end if;

  perform app_private.lock_wallet(p_org_id, p_client_id);

  select coalesce(wallet_credit_ttl_months, 12) into ttl
  from public.org_settings
  where org_id = p_org_id;
  ttl := coalesce(ttl, 12);
  expires := now() + make_interval(months => ttl);

  insert into public.wallet_transactions (
    org_id, client_id, type, amount, category, description, expires_at, remaining
  ) values (
    p_org_id, p_client_id, 'credit', p_amount, p_category, p_description, expires, p_amount
  );

  bal := app_private.wallet_balance_refresh(p_org_id, p_client_id);
  return jsonb_build_object('ok', true, 'balance', bal);
end;
$$;

create or replace function app_private.wallet_debit(
  p_org_id uuid,
  p_client_id uuid,
  p_amount numeric,
  p_category text,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  bal numeric;
  need numeric;
  r record;
  take numeric;
begin
  perform app_private.assert_client_org(p_org_id, p_client_id);

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be > 0' using errcode = '22023';
  end if;

  perform app_private.lock_wallet(p_org_id, p_client_id);
  perform app_private.sweep_wallet_expiry(p_org_id, p_client_id);

  -- Lock live credit lots before balance check (blocks concurrent debit).
  perform 1
  from public.wallet_transactions
  where client_id = p_client_id
    and org_id = p_org_id
    and type = 'credit'
    and remaining > 0
    and (expires_at is null or expires_at > now())
  for update;

  bal := app_private.wallet_balance_compute(p_org_id, p_client_id);
  if bal < p_amount then
    perform app_private.wallet_balance_refresh(p_org_id, p_client_id);
    return jsonb_build_object('ok', false, 'balance', bal);
  end if;

  -- Debit row first (same ordering as JS), then FIFO lots.
  insert into public.wallet_transactions (
    org_id, client_id, type, amount, category, description
  ) values (
    p_org_id, p_client_id, 'debit', p_amount, p_category, p_description
  );

  need := p_amount;
  for r in
    select id, remaining
    from public.wallet_transactions
    where client_id = p_client_id
      and org_id = p_org_id
      and type = 'credit'
      and remaining > 0
      and (expires_at is null or expires_at > now())
    order by expires_at asc nulls last
    for update
  loop
    exit when need <= 0;
    take := least(need, r.remaining);
    update public.wallet_transactions
      set remaining = r.remaining - take
      where id = r.id;
    need := need - take;
  end loop;

  bal := app_private.wallet_balance_refresh(p_org_id, p_client_id);
  return jsonb_build_object('ok', true, 'balance', bal);
end;
$$;

-- ---------------------------------------------------------------------------
-- Points
-- ---------------------------------------------------------------------------

create or replace function app_private.sweep_points_expiry(p_org_id uuid, p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select id, remaining
    from public.points_ledger
    where client_id = p_client_id
      and org_id = p_org_id
      and remaining > 0
      and expires_at is not null
      and expires_at <= now()
    for update
  loop
    update public.points_ledger set remaining = 0 where id = r.id;
    insert into public.points_ledger (org_id, client_id, points, reason, remaining, expires_at)
    values (p_org_id, p_client_id, -r.remaining, 'expired', null, null);
  end loop;
end;
$$;

create or replace function app_private.points_balance_refresh(p_org_id uuid, p_client_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  total int;
begin
  perform app_private.sweep_points_expiry(p_org_id, p_client_id);
  select coalesce(sum(points), 0)::int into total
  from public.points_ledger
  where client_id = p_client_id and org_id = p_org_id;

  insert into public.points_balances (client_id, org_id, total_points, updated_at)
  values (p_client_id, p_org_id, total, now())
  on conflict (client_id) do update
    set total_points = excluded.total_points,
        org_id = excluded.org_id,
        updated_at = excluded.updated_at;
  return total;
end;
$$;

create or replace function app_private.lock_points(p_org_id uuid, p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.points_balances (client_id, org_id, total_points, updated_at)
  values (p_client_id, p_org_id, 0, now())
  on conflict (client_id) do nothing;

  perform 1 from public.points_balances b
  where b.client_id = p_client_id and b.org_id = p_org_id
  for update;
end;
$$;

create or replace function app_private.points_earn(
  p_org_id uuid,
  p_client_id uuid,
  p_points integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ttl int;
  expires timestamptz;
  bal int;
begin
  perform app_private.assert_client_org(p_org_id, p_client_id);
  perform app_private.lock_points(p_org_id, p_client_id);
  if p_points is null or p_points <= 0 then
    return jsonb_build_object('ok', true, 'balance', app_private.points_balance_refresh(p_org_id, p_client_id));
  end if;

  select coalesce(points_ttl_months, 12) into ttl
  from public.org_settings where org_id = p_org_id;
  ttl := coalesce(ttl, 12);
  expires := now() + make_interval(months => ttl);

  insert into public.points_ledger (org_id, client_id, points, reason, remaining, expires_at)
  values (p_org_id, p_client_id, p_points, p_reason, p_points, expires);

  bal := app_private.points_balance_refresh(p_org_id, p_client_id);
  return jsonb_build_object('ok', true, 'balance', bal);
end;
$$;

create or replace function app_private.points_spend(
  p_org_id uuid,
  p_client_id uuid,
  p_points integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  bal int;
  need int;
  r record;
  take int;
  debit_id uuid;
begin
  perform app_private.assert_client_org(p_org_id, p_client_id);
  if p_points is null or p_points <= 0 then
    raise exception 'points must be > 0' using errcode = '22023';
  end if;

  perform app_private.lock_points(p_org_id, p_client_id);
  perform app_private.sweep_points_expiry(p_org_id, p_client_id);

  insert into public.points_ledger (org_id, client_id, points, reason)
  values (p_org_id, p_client_id, -p_points, p_reason)
  returning id into debit_id;

  bal := (select coalesce(sum(points), 0)::int from public.points_ledger
          where client_id = p_client_id and org_id = p_org_id);

  if bal < 0 then
    delete from public.points_ledger where id = debit_id;
    bal := app_private.points_balance_refresh(p_org_id, p_client_id);
    return jsonb_build_object('ok', false, 'balance', bal);
  end if;

  need := p_points;
  for r in
    select id, remaining
    from public.points_ledger
    where client_id = p_client_id
      and org_id = p_org_id
      and remaining > 0
    order by expires_at asc nulls last
    for update
  loop
    exit when need <= 0;
    take := least(need, r.remaining);
    update public.points_ledger set remaining = r.remaining - take where id = r.id;
    need := need - take;
  end loop;

  bal := app_private.points_balance_refresh(p_org_id, p_client_id);
  return jsonb_build_object('ok', true, 'balance', bal);
end;
$$;

create or replace function app_private.points_clawback(
  p_org_id uuid,
  p_client_id uuid,
  p_egp numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  earn_per int;
  bal int;
  n int;
  res jsonb;
begin
  perform app_private.assert_client_org(p_org_id, p_client_id);

  select points_earn_per_egp into earn_per
  from public.org_settings where org_id = p_org_id;

  if earn_per is null or p_egp is null or p_egp <= 0 then
    return jsonb_build_object('ok', true, 'balance', app_private.points_balance_refresh(p_org_id, p_client_id));
  end if;

  bal := app_private.points_balance_refresh(p_org_id, p_client_id);
  n := least(floor(p_egp * earn_per)::int, bal);
  if n > 0 then
    res := app_private.points_spend(p_org_id, p_client_id, n, 'refund');
    return res;
  end if;
  return jsonb_build_object('ok', true, 'balance', bal);
end;
$$;

-- ---------------------------------------------------------------------------
-- Public wrappers (PostgREST / admin().rpc) — service_role only
-- ---------------------------------------------------------------------------

create or replace function public.wallet_credit(
  p_org_id uuid,
  p_client_id uuid,
  p_amount numeric,
  p_category text,
  p_description text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select app_private.wallet_credit(p_org_id, p_client_id, p_amount, p_category, p_description);
$$;

create or replace function public.wallet_debit(
  p_org_id uuid,
  p_client_id uuid,
  p_amount numeric,
  p_category text,
  p_description text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select app_private.wallet_debit(p_org_id, p_client_id, p_amount, p_category, p_description);
$$;

create or replace function public.points_earn(
  p_org_id uuid,
  p_client_id uuid,
  p_points integer,
  p_reason text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select app_private.points_earn(p_org_id, p_client_id, p_points, p_reason);
$$;

create or replace function public.points_spend(
  p_org_id uuid,
  p_client_id uuid,
  p_points integer,
  p_reason text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select app_private.points_spend(p_org_id, p_client_id, p_points, p_reason);
$$;

create or replace function public.points_clawback(
  p_org_id uuid,
  p_client_id uuid,
  p_egp numeric
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select app_private.points_clawback(p_org_id, p_client_id, p_egp);
$$;

revoke all on function public.wallet_credit(uuid, uuid, numeric, text, text) from public, anon, authenticated;
revoke all on function public.wallet_debit(uuid, uuid, numeric, text, text) from public, anon, authenticated;
revoke all on function public.points_earn(uuid, uuid, integer, text) from public, anon, authenticated;
revoke all on function public.points_spend(uuid, uuid, integer, text) from public, anon, authenticated;
revoke all on function public.points_clawback(uuid, uuid, numeric) from public, anon, authenticated;

grant execute on function public.wallet_credit(uuid, uuid, numeric, text, text) to service_role;
grant execute on function public.wallet_debit(uuid, uuid, numeric, text, text) to service_role;
grant execute on function public.points_earn(uuid, uuid, integer, text) to service_role;
grant execute on function public.points_spend(uuid, uuid, integer, text) to service_role;
grant execute on function public.points_clawback(uuid, uuid, numeric) to service_role;

revoke all on function app_private.assert_client_org(uuid, uuid) from public, anon, authenticated;
revoke all on function app_private.lock_wallet(uuid, uuid) from public, anon, authenticated;
revoke all on function app_private.sweep_wallet_expiry(uuid, uuid) from public, anon, authenticated;
revoke all on function app_private.wallet_balance_compute(uuid, uuid) from public, anon, authenticated;
revoke all on function app_private.wallet_balance_refresh(uuid, uuid) from public, anon, authenticated;
revoke all on function app_private.wallet_credit(uuid, uuid, numeric, text, text) from public, anon, authenticated;
revoke all on function app_private.wallet_debit(uuid, uuid, numeric, text, text) from public, anon, authenticated;
revoke all on function app_private.sweep_points_expiry(uuid, uuid) from public, anon, authenticated;
revoke all on function app_private.points_balance_refresh(uuid, uuid) from public, anon, authenticated;
revoke all on function app_private.points_earn(uuid, uuid, integer, text) from public, anon, authenticated;
revoke all on function app_private.points_spend(uuid, uuid, integer, text) from public, anon, authenticated;
revoke all on function app_private.points_clawback(uuid, uuid, numeric) from public, anon, authenticated;

grant execute on all functions in schema app_private to postgres, service_role;
