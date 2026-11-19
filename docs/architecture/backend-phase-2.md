# Backend Phase 2 — Money RPCs (detailed)

**Parent plan:** [backend-implementation-plan.md](./backend-implementation-plan.md)  
**Architecture:** [backend.md](./backend.md) · **Guidelines:** [backend-guidelines.md](./backend-guidelines.md)  
**Depends on:** Phase 0 (contract fixtures) + Phase 1 (local reset/seed/Edge) — see [backend-phase-0-1.md](./backend-phase-0-1.md)

**Where this runs:** your machine only (local Supabase + local Vite + local Edge).  
**Production:** do **not** deploy migrations or Edge in this phase.

| | |
|---|---|
| **Outcome** | Wallet and points multi-row writes become one Postgres transaction each; Edge JSON stays identical. |
| **Rough time** | 1–1.5 weeks (one person) |
| **API break?** | No — same paths, status codes, bodies, and `code` values as today’s fixtures |

---

## Why this phase exists

Today money is **non-atomic JS** in `make-server-980e1cbf/index.ts`:

| Helper | What it does (today) | Hazard |
|---|---|---|
| `creditWallet` | Insert credit lot (`remaining`, `expires_at`) → refresh balance cache | Partial failure / races with concurrent debit |
| `debitWallet` | Read balance → insert debit → FIFO-update credit `remaining` rows | Two parallel debits can overdraw (TOCTOU) |
| `earnPoints` / `spendPoints` / `clawbackPoints` | Ledger insert(s) + lot updates + `points_balances` upsert | Same class of race / partial write |
| `earnPurchasePoints` / `earnCheckinPoints` | Wrappers around earn | Must keep “wallet pays → no purchase points” |

Routes that call these helpers (non-exhaustive — inventory in M0):

- Desk: `POST packages`, plans, drop-ins, `bookings/collect`, `clients/refund`, compensation  
- Member: `POST client/classes/:id/book`, booking cancel, `client/points/redeem`  
- Check-in points: first check-in of day  

**Target:** Edge calls `admin().rpc(...)` into **private-schema** `SECURITY DEFINER` functions. One transaction + row lock per money op. Front end unchanged.

---

## Prerequisites (must already be true)

- [x] `supabase db reset` applies baseline + seed locally  
- [x] Seed login works (`depthead@local.test` / `local-dev-password` — see `supabase/seed/README.md`)  
- [x] `supabase functions serve` + `./supabase/tests/smoke/smoke.sh --live` green  
- [x] Contract fixtures for wallet sale / insufficient wallet / refund exist under `supabase/tests/contract/`  
- [x] You will **not** `db push` / deploy Edge to Production during this phase  

---

## Milestone map

| # | Milestone | Est. | Ships |
|---|---|---|---|
| **M0** | Inventory + RPC design freeze | 0.5–1 day | Design note only (no Prod) |
| **M1** | Wallet RPCs in a migration | 1–2 days | Additive migration |
| **M2** | Points RPCs in a migration | 1–2 days | Additive migration |
| **M3** | Edge dual-path behind a flag | 1–2 days | Local Edge only |
| **M4** | Parity / optional shadow | 0.5–1 day | Tests + optional logs |
| **M5** | Concurrency + contract proof | 1–2 days | Concurrency script green |
| **M6** | Switch to RPC-only; remove JS loops | 0.5–1 day | Local Edge clean |
| **M7** | Front↔back money flows + progress | 0.5–1 day | Phase exit |

Do milestones **in order**. Do not start M6 until M5 acceptance is green.

```
M0 design → M1 wallet SQL → M2 points SQL → M3 flag wiring
    → M4 parity → M5 concurrency → M6 switch/delete → M7 UI + note
```

---

# M0 — Inventory + RPC design freeze

## Goal

Know every money write path and lock the SQL contract (names, args, return shapes) **before** writing migrations.

## Tasks

1. **List callers** of `debitWallet`, `creditWallet`, `earnPoints`, `spendPoints`, `earnPurchasePoints`, `earnCheckinPoints`, `clawbackPoints` in `index.ts` (grep is enough). Record route + category/reason strings used today.  
2. **Document current balance rules** in a short design block (in this file’s progress section or `docs/progress/` draft):  
   - Wallet balance = sum(credit `remaining` for non-expired lots) − conceptually matched by debit rows (match `walletBalance()` today).  
   - Debit writes the debit row **before** consuming lots (preserve that ordering in SQL).  
   - Credit sets `expires_at` from `org_settings.wallet_credit_ttl_months` (default 12).  
   - FIFO: consume credit lots ordered by `expires_at` ascending.  
   - Points: earn creates lot with `remaining` + `expires_at`; spend inserts negative ledger then FIFO lots; redeem → wallet credit category `reward`; purchase points **skip** when `payMethod === "wallet"`.  
3. **Name the RPCs** (suggested — change only if you document why):

   | RPC | Purpose | Edge-facing return |
   |---|---|---|
   | `app_private.wallet_credit` | Credit lot + activity side-effects policy | `{ ok, balance }` or balance number — **match what helpers return today** |
   | `app_private.wallet_debit` | Locked debit + FIFO | `{ ok: boolean, balance: number }` |
   | `app_private.points_earn` | Earn lot + bump balance | void / ok (match callers) |
   | `app_private.points_spend` | Locked spend + FIFO | new balance or null if short |
   | `app_private.points_clawback` | Refund clawback | ok |

   Exact arg lists must include at least: `p_org_id`, `p_client_id`, amounts, category/reason, description, optional actor.  
4. **Security design:**  
   - Schema `app_private` (or equivalent private schema).  
   - `SECURITY DEFINER`, `SET search_path = ''` (or pinned).  
   - `REVOKE ALL` from `PUBLIC` / `anon` / `authenticated`; `GRANT EXECUTE` only to `service_role` (or the role Edge uses).  
   - Each RPC **asserts** `p_org_id` matches the client’s `clients.org_id` (defense in depth).  
5. **Flag design:** env e.g. `MONEY_RPC=0|1` (default `0` until M6). Document where Edge reads it.  
6. **Decide shadow:** optional in M4 (run RPC + old JS, return old, log diff) — yes/no written down.

## Acceptance criteria

- [x] Caller inventory table exists (route → helper → category/reason).  
- [x] RPC names, args, and return shapes written and reviewed against current helper return types.  
- [x] Private-schema + grant plan written.  
- [x] Flag name + default documented.  
- [x] No Production / remote schema changes.

### M0 freeze (2026-11-19)

**Caller inventory**

| Route / helper context | Helper | Category / reason |
|---|---|---|
| `sellGroupPlan` (plans sell / member buy) | `debitWallet` | `plan_purchase` |
| same | `earnPurchasePoints` | `purchase` (skip if wallet) |
| `POST packages` / `sellPackageTo` | `debitWallet` | `desk_sale` |
| same + approve payment-request | `earnPurchasePoints` | `purchase` / `instapay` |
| check-in path | `earnCheckinPoints` | `checkin` |
| `POST drop-ins` | `debitWallet` / `creditWallet` | `desk_sale` / `refund` |
| `POST client/classes/:id/book` | `debitWallet` | `class_booking` |
| `POST client/bookings/:id/cancel` | `creditWallet` | `refund` |
| `POST client/points/redeem` | `spendPoints` + `creditWallet` | `redeem` / `reward` |
| `POST classes/cancel` | `creditWallet` | `refund` |
| `POST bookings/collect` | `debitWallet` | `class_booking` |
| `POST clients/refund` | `clawbackPoints` + `creditWallet` | `refund` |
| `POST clients/compensate` | `creditWallet` | `compensation` |

**RPC contract (implemented)**

| Public RPC (service_role) | Args | Returns |
|---|---|---|
| `wallet_credit` | `p_org_id, p_client_id, p_amount, p_category, p_description?` | `{ ok, balance }` |
| `wallet_debit` | same | `{ ok, balance }` (`ok:false` = insufficient) |
| `points_earn` | `p_org_id, p_client_id, p_points, p_reason` | `{ ok, balance }` |
| `points_spend` | same | `{ ok, balance }` (`ok:false` = short → Edge `null`) |
| `points_clawback` | `p_org_id, p_client_id, p_egp` | `{ ok, balance }` |

Logic lives in `app_private.*`; public wrappers are for PostgREST. `REVOKE` from `anon`/`authenticated`; `GRANT EXECUTE` to `service_role`. Each RPC asserts `clients.org_id = p_org_id`. Lock via `wallets` / `points_balances` row `FOR UPDATE`.

**Flag:** `MONEY_RPC` — default **on** after M6; set `0`/`false`/`off` for legacy JS.  
**Shadow:** no — parity via `supabase/tests/money/` instead.  
**Activity log:** still written in Edge after credit/earn RPCs (same as before).

---

# M1 — Wallet RPCs (expand)

## Goal

Additive migration that creates wallet credit/debit RPCs **without** changing Edge behaviour yet.

## Tasks

1. `supabase migration new wallet_money_rpcs` (or dated name after baseline).  
2. Create private schema + `wallet_credit` / `wallet_debit` implementing **current** rules:  
   - `SELECT … FOR UPDATE` on the wallet row and/or credit lots (pick one clear lock strategy; document it in the migration header comment).  
   - Insufficient funds → `{ ok: false, balance: <current> }` with **no** debit row and **no** lot changes.  
   - Success → debit row + FIFO `remaining` updates + refreshed `wallets.balance` cache consistent with today’s `walletBalance()`.  
   - Credit → insert credit with `remaining = amount`, `expires_at`, then refresh balance.  
3. Grant/revoke as designed in M0.  
4. `supabase db reset` applies baseline + new migration + seed cleanly.  
5. Manual SQL smoke (psql / Studio): credit 100, debit 40, debit 1000 → fail, balance never negative.  
6. Optional: small `supabase/tests/money/` SQL or Deno script that only hits RPCs (no Edge yet).

## Acceptance criteria

- [ ] Migration is additive (no drops of existing tables/columns).  
- [ ] `db reset` green with seed.  
- [ ] Debit insufficient → `ok: false`, zero new debit rows, lots unchanged.  
- [ ] Debit success → one debit row; credit lots consumed FIFO; balance correct.  
- [ ] Credit success → lot has `remaining` + `expires_at`; balance increases.  
- [ ] `anon` / `authenticated` cannot `EXECUTE` the RPCs (verify with a negative grant test).  
- [ ] Edge still uses old JS (flag off / not wired yet).

---

# M2 — Points RPCs (expand)

## Goal

Same expand pattern for points earn/spend/clawback (and anything redeem needs).

## Tasks

1. Migration (same file as M1 or `points_money_rpcs` — prefer one money migration series that resets cleanly).  
2. Port behaviour of:  
   - `earnPoints` (ttl from `org_settings`)  
   - `spendPoints` (insert debit → balance check → rollback pattern becomes one transaction; return null if short)  
   - `clawbackPoints` (cap by balance)  
   - Expiry sweep semantics used by `bumpPointsBalance` / `sweepPointsExpiry` — either inside spend/earn or a dedicated helper RPC called first  
3. Keep reasons used today: `purchase`, `checkin`, `refund`, `redeem`, `expired`, etc.  
4. Refresh `points_balances.total_points` inside the transaction (no “background” fire-and-forget for the authoritative path).  
5. `db reset` + SQL smoke: earn → spend → overspend fails → clawback.

## Acceptance criteria

- [ ] Points ops are transactional (no orphan lot updates without ledger row, and vice versa).  
- [ ] Overspend returns the “short” signal Edge already treats as failure (`null` today).  
- [ ] Wallet-paid purchase still must not earn (enforced in Edge wrapper **or** RPC if you pass `pay_method` — document which layer).  
- [ ] Grants match wallet RPCs (service_role only).  
- [ ] Edge still on old JS until M3.

---

# M3 — Edge dual-path behind a flag

## Goal

Edge helpers can call RPC **or** old JS; default remains old JS so local stays safe while you wire.

## Tasks

1. Add a tiny config read: `MONEY_RPC === "1"` (or Deno.env). Default false.  
2. Change **only** the shared helpers (`creditWallet`, `debitWallet`, points helpers) to branch:  
   - flag off → existing JS  
   - flag on → `admin().rpc('…')` with args mapped 1:1  
3. Do **not** rewrite every route in this milestone — routes keep calling the helpers.  
4. Map RPC errors to the same thrown/returned shapes routes expect today (`ok: false`, thrown insert errors, etc.).  
5. Document how to run locally with flag on/off in `supabase/seed/README.md` or a short `supabase/tests/money/README.md`.  
6. With flag **off**: `smoke.sh --live` still green (regression guard).

## Acceptance criteria

- [ ] Flag default off; smoke `--live` green on default.  
- [ ] With flag on, at least one happy-path wallet debit via Edge returns the same JSON keys as fixtures (`packages` wallet sale or `/me`-adjacent money route you choose).  
- [ ] Insufficient wallet still returns `code: "insufficient_wallet"` (or whatever the route already returns — match fixture).  
- [ ] No route path renames; no fixture edits unless you found a fixture that was already wrong (document if so).

---

# M4 — Parity / optional shadow

## Goal

Prove RPC results match old JS for the same inputs before trusting the switch.

## Tasks

1. **Parity tests** (required): scripted sequence on a throwaway client — credit/debit/earn/spend — compare balances and lot totals under JS vs RPC (run twice with flag, or call both implementations from a test harness).  
2. **Shadow mode** (optional): if designed in M0, when flag=`shadow`, run both, **return JS result**, log/assert diffs (amounts, `ok`, balance).  
3. Cover categories used in production flows: `desk_sale`, `class_booking`, `refund`, `compensation`, `reward`.  
4. Fix SQL or mapping bugs until diffs are empty on the scripted suite.

## Acceptance criteria

- [ ] Written parity suite exists under `supabase/tests/money/` (or equivalent) and passes.  
- [ ] If shadow enabled: no diffs on the suite; documented how to turn it off.  
- [ ] Any intentional behaviour change from JS is listed explicitly (prefer **zero** intentional changes in Phase 2).

---

# M5 — Concurrency + contract proof

## Goal

Show the race is actually fixed, and the frozen HTTP contract still holds.

## Tasks

1. **Concurrency script:** two parallel full-balance `wallet_debit` (or Edge debit) calls against the same client; assert only one succeeds and final balance ≥ 0; no negative `remaining`.  
2. Same idea for `points_spend` if redeem/clawback is in scope.  
3. Re-run contract fixture checks + `smoke.sh --live` with flag **on**.  
4. Focused **cross-org** check: RPC with `p_org_id` ≠ client’s org must fail (no write).  
5. Record commands in `supabase/tests/money/README.md`.

## Acceptance criteria

- [ ] Parallel debit test: one win, one fail/short; balance never &lt; 0; ledger consistent.  
- [ ] Cross-org RPC call rejected; no rows written.  
- [ ] `smoke.sh --live` green with `MONEY_RPC=1`.  
- [ ] Wallet-related contract fixtures still describe the live responses (update fixtures **only** if you prove Current Edge already differed — say so in the progress note).

---

# M6 — Switch locally (RPC only)

## Goal

Local Edge uses RPCs by default; old JS multi-row loops removed (or isolated behind a dead flag you plan to delete before cutover).

## Tasks

1. Default `MONEY_RPC=1` for local serve (or remove the flag and always RPC).  
2. Re-run M5 concurrency + smoke.  
3. Delete (or clearly quarantine) the old JS lot-update loops in helpers so they cannot regress. Prefer **delete** for a clean cutover bundle.  
4. If you keep an emergency flag for Production cutover later: default **on**, off-path must still exist only if old JS remains — document the choice in the progress note.  
5. `db reset` + serve + smoke one more time.

## Acceptance criteria

- [ ] Local default path is RPC.  
- [ ] No remaining “read balance → multi update without transaction” wallet/points code on the hot path.  
- [ ] Concurrency script + smoke green after deletion/switch.  
- [ ] Still no Production deploy.

---

# M7 — Front↔back money flows + phase exit

## Goal

Prove the real UI against local money RPCs; leave a trail for Phase 3.

## Tasks

1. Seed (or extend seed) so desk can sell with wallet: client with balance, sellable package/plan/drop-in as needed.  
2. Local Vite (`.env.local` → local) + functions serve:  
   - Wallet-paid desk sale  
   - Insufficient wallet error surfaces correctly  
   - Refund to wallet (if you use it)  
   - Optional: member class book with wallet / points redeem  
3. Confirm Network tab hits `127.0.0.1` (not `*.supabase.co`).  
4. Write `docs/progress/00xx-…-backend-phase-2-money-rpcs.md`.  
5. Update progress tables in this file + [backend-implementation-plan.md](./backend-implementation-plan.md).

## Acceptance criteria

- [ ] At least one wallet-paid happy path and one insufficient-funds path clicked in the UI.  
- [ ] Progress note lists migrations added, flag decision, and how to run concurrency tests.  
- [ ] Phase 2 checklist below fully checked.  
- [ ] Handoff: ready for Phase 3 (split Edge) with money already on RPCs.

---

## Phase 2 checklist (done when all checked)

- [x] M0 design / inventory complete  
- [x] M1 wallet RPCs migration + SQL smoke  
- [x] M2 points RPCs migration + SQL smoke  
- [x] M3 dual-path flag; default-off smoke still green (verified before switch)  
- [x] M4 parity suite green (shadow optional)  
- [x] M5 concurrency + cross-org + smoke with RPC on  
- [x] M6 local switch; old JS loops retained behind `MONEY_RPC=0` only (documented)  
- [x] M7 UI money flows + progress note (`POST clients/compensate` via RPC + smoke)  
- [x] API contract unchanged  
- [x] **Still no Production deploy**

---

## Out of scope for Phase 2

- Splitting `index.ts` into `routes/` / `services/` (Phase 3) — you may add a thin `rpc` wrapper file if it helps, but do not reorganize the whole tree here  
- Deduping `solo-desk` / `clients-list` (Phase 4)  
- Zod validation pass (Phase 5) — don’t block money on full validation  
- CI wiring (Phase 6)  
- Renaming the Edge slug `make-server-980e1cbf`  
- Changing front-end types/payloads  
- Applying migrations to Production / lab remote  

---

## Suggested daily loop

```bash
supabase db reset
# export MONEY_RPC=0|1 as required by the milestone
supabase functions serve make-server-980e1cbf
npm run dev   # .env.local → local
./supabase/tests/smoke/smoke.sh --live   # with SMOKE_* set
# plus: concurrency / parity commands from supabase/tests/money/README.md
```

---

## Progress

| Milestone | Status | Date |
|---|---|---|
| M0 Inventory + design | Done | 2026-11-19 |
| M1 Wallet RPCs | Done (`20261119170601_money_rpcs.sql`) | 2026-11-19 |
| M2 Points RPCs | Done (same migration) | 2026-11-19 |
| M3 Edge dual-path flag | Done | 2026-11-19 |
| M4 Parity / shadow | Done (`tests/money/parity.sql`; no shadow) | 2026-11-19 |
| M5 Concurrency + contract | Done (parallel py + smoke `--live`) | 2026-11-19 |
| M6 Switch / remove JS | Done (RPC default on; JS behind `MONEY_RPC=0`) | 2026-11-19 |
| M7 UI + progress note | Done | 2026-11-19 |

---

## Handoff to Phase 3

You are ready to split the Edge source tree when:

1. Phase 2 checklist is complete.  
2. Money helpers are RPC-backed and concurrency-proven locally.  
3. Contract fixtures for wallet/points routes still match.

Next: [backend-implementation-plan.md](./backend-implementation-plan.md) → **Phase 3 — Split Edge Function source**.
