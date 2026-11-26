# 0016 — Backend Phase 2: money RPCs

**Date:** 2026-11-19  
**Branch:** `dev-mahmoud`  
**Playbook:** `docs/architecture/backend-phase-2.md`

## What landed

- Migration `supabase/migrations/20261119170601_money_rpcs.sql`
  - `app_private` wallet/points helpers + public wrappers
  - `wallet_credit` / `wallet_debit` / `points_earn` / `points_spend` / `points_clawback`
  - Row locks on `wallets` / `points_balances`; org/client assert; service_role only
- Edge dual-path in `make-server-980e1cbf/index.ts` via `MONEY_RPC` (default **on**)
- Seed creates a real wallet credit lot (not only `wallets.balance` cache)
- Tests: `supabase/tests/money/` (`parity.sql`, `concurrency.sql`, `concurrency_parallel.py`)

## How to verify locally

```bash
supabase db reset
MONEY_RPC=1 supabase functions serve --no-verify-jwt --env-file supabase/functions/.env.local
psql "$DB_URL" -f supabase/tests/money/parity.sql
python3 supabase/tests/money/concurrency_parallel.py
# smoke.sh --live with local SMOKE_* env
```

## Decisions

- No shadow mode — SQL/parallel parity instead.
- Legacy JS helpers kept behind `MONEY_RPC=0` for emergency parity until GATE/cutover cleanup (not deleted yet).
- Activity log for credits/earns still written in Edge after RPC success.

## Still out of scope

No Production deploy; no Edge source split (Phase 3).
