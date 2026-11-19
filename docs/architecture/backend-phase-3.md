# Backend Phase 3 — Split Edge Function source (detailed)

**Parent plan:** [backend-implementation-plan.md](./backend-implementation-plan.md)  
**Architecture:** [backend.md](./backend.md) §5 · **Guidelines:** [backend-guidelines.md](./backend-guidelines.md)  
**Depends on:** Phase 2 money RPCs — [backend-phase-2.md](./backend-phase-2.md)

**Where this runs:** your machine only (local Supabase + local Vite + local Edge).  
**Production:** do **not** deploy Edge or migrations for this phase.

| | |
|---|---|
| **Outcome** | `make-server-980e1cbf` source matches Target layout (`routes/` + `services/` + `_shared/`); **same** slug, paths, JSON, status, `code`. |
| **Rough time** | 1.5–2 weeks (one person) |
| **API break?** | No — mechanical move only |

---

## Why this phase exists

`make-server-980e1cbf/index.ts` is a ~5k-line god file (~130+ routes). Phase 2 already moved **money writes** into RPCs; the helpers still live in that file. Without a split:

- Every change risks unrelated regressions.  
- Phase 4 cannot dedupe `solo-desk` / `clients-list` onto a real `_shared/`.  
- Phase 5 validation has nowhere clean to hang.

**This phase does not change behaviour.** If a test or UI breaks, you moved a wire wrong — fix the move, do not “improve” the API.

---

## Prerequisites (must already be true)

- [x] Phase 2 checklist complete (`MONEY_RPC` default on; money tests green)  
- [x] `supabase db reset` + seed + `functions serve` work locally  
- [x] `./supabase/tests/smoke/smoke.sh --live` green against local  
- [x] Contract fixtures + `routes.md` exist under `supabase/tests/contract/`  
- [x] You will **not** rename the function slug `make-server-980e1cbf`  
- [x] You will **not** deploy to Production  

---

## Hard rules (every milestone)

1. **Contract freeze:** no path, method, status, JSON key, or `code` changes. Fixtures stay the source of truth.  
2. **One vertical slice at a time** — finish smoke for that slice before opening the next.  
3. **`routes/`** = HTTP only: parse body/params, authz, call service/helper, return JSON. Prefer no multi-row money loops here (call `services/` / existing helpers).  
4. **`services/`** = domain; **no** Hono `Context` / `c.req`. Money goes through existing RPC-backed helpers.  
5. **`_shared/`** = db client, auth, mappers, errors — reusable by Phase 4. Do not put route-specific business rules here.  
6. **Deno imports:** use relative paths that work under `supabase functions serve` (same patterns as today). Avoid inventing a bundler.  
7. After each slice: `functions serve` still boots; smoke `--live` still green; touch the UI for that area when it has a screen.

---

## Target tree (end state)

```
supabase/functions/
  _shared/
    db.ts              # admin client, clock-skew fetch, background()
    auth.ts            # requireUser / role helpers currently in index
    errors.ts          # consistent { error, code } helpers (thin; expand in Phase 5)
    mappers.ts         # toProfile / toClient / snake→camel already used by routes
    # org.ts / validate.ts may be stubs or thin re-exports — full hardening is Phase 5
  make-server-980e1cbf/
    index.ts           # Hono app, CORS, logger, mount routers, /health only (or health in routes/health.ts)
    routes/
      me.ts            # signup, me, me/update, staff push*
      desk.ts          # clients, packages, check-ins, drop-ins, front-desk, scan, bookings*, refunds*
      catalog.ts       # tiers, locations, bundle-types, plan-types, class-series, coaches, invites, profiles
      classes.ts       # staff classes CRUD + related
      settlements.ts   # month, sessions, settle, reopen, pay
      accounting.ts    # accounting/*
      client-app.ts    # client/* (+ payment-requests desk side if cleaner here)
      ops.ts           # ops/*
      push.ts          # remaining push/cron-ish routes if not in me.ts
    services/
      wallet.ts        # creditWallet / debitWallet / walletBalance / sweep (RPC-aware)
      points.ts        # earn/spend/clawback wrappers
      sales.ts         # sellPackageTo / sellGroupPlan / shared sale helpers
      activity.ts      # logActivity / notify helpers if pulled out
  solo-desk/           # unchanged this phase (Phase 4)
  clients-list/        # unchanged this phase (Phase 4)
```

File names above are the **preferred** map. If a route clearly belongs elsewhere, document the deviation in the progress note — do not leave it in `index.ts`.

---

## Milestone map

| # | Milestone | Est. | Ships |
|---|---|---|---|
| **M0** | Slice map + move rules freeze | 0.5 day | Doc only |
| **M1** | Scaffold + extract `_shared` kernel | 1–2 days | Folders + imports; behaviour unchanged |
| **M2** | Slice: health / me / signup / staff push | 1 day | `routes/me.ts` (+ health) |
| **M3** | Slice: catalog + team profiles | 1–2 days | `routes/catalog.ts` |
| **M4** | Slice: desk + money desk paths | 2–3 days | `routes/desk.ts` + `services/sales|wallet|points` as needed |
| **M5** | Slice: settlements / sessions / pay | 1 day | `routes/settlements.ts` |
| **M6** | Slice: accounting | 1 day | `routes/accounting.ts` |
| **M7** | Slice: client-app | 1–2 days | `routes/client-app.ts` |
| **M8** | Slice: ops + staff classes | 1–2 days | `routes/ops.ts`, `routes/classes.ts` |
| **M9** | Thin `index.ts` + full local gate for Phase 3 | 0.5–1 day | Mount-only index |
| **M10** | Progress note + handoff | 0.5 day | Docs |

Do milestones **in order**. Do not start M9 until every route has left the god file (or is explicitly listed as a temporary exception with owner/date).

```
M0 map → M1 shared kernel → M2…M8 slices → M9 thin index → M10 note
```

---

# M0 — Slice map + move rules freeze

## Goal

Agree which routes land in which file, and how imports will work, **before** moving code.

## Tasks

1. From `supabase/tests/contract/routes.md`, assign every `make-server-980e1cbf` path to a `routes/*.ts` file (use the Target tree above).  
2. List **shared helpers** still in `index.ts` that become `_shared` or `services` (auth, admin client, mappers, wallet/points, sell*, logActivity, orgSettingsOf, …).  
3. Write Deno import conventions in this file’s freeze block (examples):  
   - Routes import `../../_shared/db.ts`, `../services/wallet.ts`  
   - Services import `_shared` only — never `routes/`  
4. Decide: keep `/health` in `index.ts` vs `routes/health.ts` (either OK; prefer routes for consistency).  
5. Confirm Phase 4 boundary: **do not** rewrite `solo-desk` / `clients-list` in this phase beyond optional import of new `_shared` if zero-risk (default: leave them alone).

## Acceptance criteria

- [ ] Route → file assignment table exists (below or in progress note).  
- [ ] Helper → `_shared` / `services` assignment listed.  
- [ ] Import rules written.  
- [ ] No code moved yet (or only empty scaffold files with no behaviour change).

### M0 freeze template (fill during M0)

| `routes/` file | Paths (prefix) |
|---|---|
| `me.ts` | `signup`, `me`, `me/update`, staff `push/*` (non-client) |
| `catalog.ts` | `tiers`, `locations`, `bundle-types`, `coaches`, `invites`, `profiles`, `plan-types`, `class-series` |
| `desk.ts` | `clients*`, `packages*`, `check-ins`, `drop-ins`, `front-desk/*`, `scan`, `invitations`, `bookings/*`, `clients/refund*`, `clients/compensate`, `activity`, `client-invites`, `payment-requests*` (desk), `group-plans*`, `clients/import`, `payments/summary`, `revenue` |
| `settlements.ts` | `month/*`, `sessions*`, `settle`, `reopen`, `pay*` |
| `accounting.ts` | `accounting/*` |
| `client-app.ts` | `client/*`, `push/client-reminders` |
| `ops.ts` | `ops/*` |
| `classes.ts` | `classes`, `classes/*` (staff) |

| Module | Contents |
|---|---|
| `_shared/db.ts` | `admin`, fetch retry, `background` |
| `_shared/auth.ts` | JWT/user/role guards used by routes |
| `_shared/mappers.ts` | `toProfile`, `toClient`, … |
| `_shared/errors.ts` | small helpers returning `{ error, code }` |
| `services/wallet.ts` | RPC-aware wallet helpers |
| `services/points.ts` | RPC-aware points helpers |
| `services/sales.ts` | `sellPackageTo`, `sellGroupPlan`, … |

---

# M1 — Scaffold + extract `_shared` kernel

## Goal

Create folders and move **non-route** infrastructure so slices can import it. God file still mounts all routes.

## Tasks

1. Create empty/ stub `routes/` and `services/` directories under `make-server-980e1cbf/`.  
2. Extract to `functions/_shared/`: at least `db.ts` + `auth.ts` (+ `mappers.ts` if low-risk).  
3. Update `index.ts` to import from `_shared` instead of inlining those pieces.  
4. Leave `solo-desk` / `clients-list` on their old copies for now.  
5. `supabase functions serve` boots; `smoke.sh --live` green; `GET /me` still works.

## Acceptance criteria

- [ ] `_shared/db.ts` (and auth at minimum) exist and are used by main function.  
- [ ] No route path changes.  
- [ ] Smoke `--live` green.  
- [ ] `index.ts` line count dropped only by extracted helpers (routes still present).

---

# M2 — Slice: health / me / signup / staff push

## Goal

First route module proves the mount pattern.

## Tasks

1. Create `routes/me.ts` (and optional `routes/health.ts`) exporting a Hono sub-app or `register(app)` function — pick **one** pattern and reuse for all later slices.  
2. Move `health`, `signup`, `me`, `me/update`, staff push routes into it.  
3. `index.ts` mounts the module; delete moved handlers from god file.  
4. Smoke `--live` (health + me).  
5. Local UI: login as seed dept_head still lands on home.

## Acceptance criteria

- [ ] Those routes exist only in the new module (not duplicated in `index.ts`).  
- [ ] Smoke `--live` green.  
- [ ] Login + `/me` via UI or curl OK.  
- [ ] Mount pattern documented in a one-line comment in `index.ts`.

---

# M3 — Slice: catalog + team profiles

## Goal

Move catalog/config routes used by Manage / staff setup screens.

## Tasks

1. Create `routes/catalog.ts` for tiers, locations, bundle-types, coaches, invites, profiles, plan-types, class-series (per M0 map).  
2. Move helpers those routes need only if exclusive; otherwise import from `_shared` / `services`.  
3. Smoke + UI: open locations / profiles / bundle types if present for seed org.

## Acceptance criteria

- [ ] Catalog paths only in `catalog.ts`.  
- [ ] Smoke green.  
- [ ] At least one catalog GET and one POST verified (curl or UI).

---

# M4 — Slice: desk + sales/money wiring

## Goal

Largest behaviour surface: desk clients, packages, check-ins, drop-ins, refunds, compensation, bookings collect/attendance.

## Tasks

1. Create `routes/desk.ts` and move desk paths per M0.  
2. Extract `services/wallet.ts`, `services/points.ts`, `services/sales.ts` **if not already** — routes must call services, not re-implement FIFO.  
3. Keep `MONEY_RPC` behaviour identical (default on).  
4. Run `supabase/tests/money/parity.sql` + `concurrency_parallel.py` still green (RPCs unchanged).  
5. Smoke + UI: members list, compensate or wallet-related desk action if seed allows; insufficient-wallet path still returns same `code` when exercised.

## Acceptance criteria

- [ ] Desk routes only in `desk.ts`.  
- [ ] Money still goes through Phase 2 RPC helpers in `services/`.  
- [ ] Money tests + smoke green.  
- [ ] Contract fixtures for packages / refund still match live responses.

---

# M5 — Slice: settlements / sessions / pay

## Goal

Move coach month / session / settle / pay routes.

## Tasks

1. `routes/settlements.ts` — `month`, `sessions`, `settle`, `reopen`, `pay`, `pay/payments`.  
2. Smoke + UI smoke for settlements screen if seed has data (read-only GET is enough if POST needs richer seed).

## Acceptance criteria

- [ ] Settlement paths only in `settlements.ts`.  
- [ ] Smoke green; at least one GET (`month` or `sessions`) returns 200 for seed user.

---

# M6 — Slice: accounting

## Goal

Move `accounting/*` intact.

## Tasks

1. `routes/accounting.ts`.  
2. Verify `GET accounting/pnl` (or categories) against fixture shape.  
3. Smoke green.

## Acceptance criteria

- [ ] All `accounting/*` paths only in `accounting.ts`.  
- [ ] PnL/categories response keys still match contract fixture.  
- [ ] Smoke green.

---

# M7 — Slice: client-app

## Goal

Move member-app `client/*` routes (and desk `payment-requests` if mapped here in M0).

## Tasks

1. `routes/client-app.ts`.  
2. Ensure client wallet/points/redeem still call `services/*`.  
3. Optional: seed client login `client@local.test` — `GET client/home` or `client/wallet` 200.  
4. Smoke green (staff smoke still required).

## Acceptance criteria

- [ ] `client/*` paths only in `client-app.ts` (per M0).  
- [ ] Client wallet/points redeem still RPC-backed.  
- [ ] Smoke green; one client GET verified.

---

# M8 — Slice: ops + staff classes

## Goal

Move remaining `ops/*` and staff `classes*` routes.

## Tasks

1. `routes/ops.ts`, `routes/classes.ts` (or combined if tiny — prefer split as in Target).  
2. Ops routes need bizqwik_team user — if seed lacks one, curl with a temporary local team user **or** verify compile/mount + skip live ops UI with a note in progress (prefer adding minimal seed team row if cheap).  
3. Smoke green.

## Acceptance criteria

- [ ] Ops + staff class paths no longer in `index.ts`.  
- [ ] Smoke green.  
- [ ] Either live ops GET verified **or** explicit progress note: “ops live verify deferred; mount-only checked” with follow-up before GATE.

---

# M9 — Thin `index.ts` + Phase 3 local gate

## Goal

`index.ts` only creates the app, applies middleware, mounts routers, and exports the handler.

## Tasks

1. Confirm **zero** domain `app.get/post` handlers remain in `index.ts` except intentional health mount.  
2. Grep for leftover dead helpers; delete or move.  
3. Full local gate:  
   - `db reset`  
   - `functions serve`  
   - smoke `--live`  
   - money parallel concurrency  
   - contract fixture dry-run  
4. Spot-check UI: login, desk clients list, one money action, one accounting or catalog screen.  
5. Diff review: **no** intentional JSON/path renames.

## Acceptance criteria

- [ ] `index.ts` is mount/bootstrap only (roughly &lt; ~150–200 lines unless CORS/bootstrap needs more).  
- [ ] All Phase 3 gate commands green.  
- [ ] UI spot-check done (list what you clicked in progress note).  
- [ ] `solo-desk` / `clients-list` still work if the PWA calls them (unchanged code OK).

---

# M10 — Progress note + handoff

## Goal

Leave a trail for Phase 4.

## Tasks

1. Write `docs/progress/00xx-…-backend-phase-3-split-edge.md` (tree, mount pattern, any map deviations, gate commands).  
2. Update progress tables in this file + [backend-implementation-plan.md](./backend-implementation-plan.md).  
3. List known leftovers for Phase 4 (duplicate helpers in solo/clients-list) and Phase 5 (validate.ts / org.ts hardening).

## Acceptance criteria

- [ ] Progress note merged/ready on branch.  
- [ ] Implementation plan Phase 3 row updated.  
- [ ] Phase 3 checklist below fully checked.

---

## Phase 3 checklist (done when all checked)

- [x] M0 slice map + import rules frozen  
- [x] M1 `_shared` kernel extracted; smoke green  
- [x] M2 me/health/signup/push slice  
- [x] M3 catalog slice  
- [x] M4 desk + services (wallet/points/sales)  
- [x] M5 settlements slice  
- [x] M6 accounting slice  
- [x] M7 client-app slice  
- [x] M8 ops + classes slice  
- [x] M9 thin index + full local gate  
- [x] M10 progress note  
- [x] API contract unchanged (fixtures still valid)  
- [x] **Still no Production deploy**

---

## Out of scope for Phase 3

- Deduping `solo-desk` / `clients-list` onto `_shared` (**Phase 4**)  
- Zod / full `validate.ts` and org helper hardening (**Phase 5**)  
- CI workflows (**Phase 6**)  
- Deleting legacy `MONEY_RPC=0` JS paths (optional cleanup; not required here)  
- Renaming slug `make-server-980e1cbf`  
- Any Production deploy  

---

## Suggested daily loop

```bash
supabase db reset                    # if migrations unchanged, skip
supabase functions serve --no-verify-jwt --env-file supabase/functions/.env.local
npm run dev                          # .env.local → local
./supabase/tests/smoke/smoke.sh --live
python3 supabase/tests/money/concurrency_parallel.py   # after desk/money touches
```

After **each** slice merge to your working tree: smoke `--live` before starting the next slice.

---

## Progress

| Milestone | Status | Date |
|---|---|---|
| M0 Slice map + rules | Done | 2026-11-19 |
| M1 Shared kernel | Done (`_shared/db.ts` + facades) | 2026-11-19 |
| M2 me / health / push | Done | 2026-11-19 |
| M3 catalog | Done | 2026-11-19 |
| M4 desk + money services | Done (routes + service facades) | 2026-11-19 |
| M5 settlements | Done | 2026-11-19 |
| M6 accounting | Done | 2026-11-19 |
| M7 client-app | Done | 2026-11-19 |
| M8 ops + classes | Done | 2026-11-19 |
| M9 thin index + gate | Done (`index.ts` ~37 lines; smoke green) | 2026-11-19 |
| M10 progress note | Done (`0017-…-phase-3-split-edge.md`) | 2026-11-19 |

---

## Handoff to Phase 4

You are ready to dedupe `solo-desk` / `clients-list` when:

1. Phase 3 checklist is complete.  
2. `_shared/` contains the real db/auth/mapper modules the main function uses.  
3. Smoke + money tests still green on the thin `index.ts`.

Next: [backend-implementation-plan.md](./backend-implementation-plan.md) → **Phase 4 — Deduplicate solo-desk / clients-list**.
