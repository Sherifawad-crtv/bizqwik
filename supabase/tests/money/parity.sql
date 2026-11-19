-- Phase 2 M4: wallet/points RPC parity smoke (local seed client).
\set ON_ERROR_STOP on

do $$
declare
  v_org uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_client uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  r jsonb;
  bal numeric;
begin
  -- Fresh lot on top of seed
  r := public.wallet_credit(v_org, v_client, 100, 'compensation', 'parity credit');
  if (r->>'ok')::boolean is not true then raise exception 'credit failed %', r; end if;

  r := public.wallet_debit(v_org, v_client, 30, 'desk_sale', 'parity debit');
  if (r->>'ok')::boolean is not true then raise exception 'debit failed %', r; end if;

  r := public.wallet_debit(v_org, v_client, 1000000, 'desk_sale', 'parity short');
  if (r->>'ok')::boolean is not false then raise exception 'expected short %', r; end if;

  select coalesce(sum(remaining),0) into bal
  from wallet_transactions
  where client_id = v_client and org_id = v_org and type = 'credit' and remaining > 0
    and (expires_at is null or expires_at > now());
  if bal <> (r->>'balance')::numeric then
    raise exception 'balance mismatch lots=% rpc=%', bal, r->>'balance';
  end if;

  begin
    perform public.wallet_debit('00000000-0000-0000-0000-000000000099', v_client, 1, 'desk_sale', 'bad');
    raise exception 'cross-org should fail';
  exception when others then
    if sqlerrm not like '%client/org mismatch%' and sqlerrm not like '%42501%' then
      raise notice 'cross-org error: %', sqlerrm;
    end if;
  end;

  update org_settings set points_earn_per_egp = 1 where org_id = v_org;
  r := public.points_earn(v_org, v_client, 50, 'purchase');
  if (r->>'ok')::boolean is not true then raise exception 'earn failed %', r; end if;
  r := public.points_spend(v_org, v_client, 20, 'redeem');
  if (r->>'ok')::boolean is not true then raise exception 'spend failed %', r; end if;
  r := public.points_spend(v_org, v_client, 999999, 'redeem');
  if (r->>'ok')::boolean is not false then raise exception 'expected points short %', r; end if;

  raise notice 'parity.sql OK balance=%', bal;
end $$;
