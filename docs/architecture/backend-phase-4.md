# Backend Phase 4 — Deduplicate `solo-desk` / `clients-list` (detailed)

**Parent plan:** [backend-implementation-plan.md](./backend-implementation-plan.md)  
**Architecture:** [backend.md](./backend.md) §5 · **Guidelines:** [backend-guidelines.md](./backend-guidelines.md)  
**Depends on:** Phase 3 Edge split — [backend-phase-3.md](./backend-phase-3.md)

**Where this runs:** your machine only (local Supabase + local Vite + local Edge).  
**Production:** do **not** deploy Edge in this phase.

| | |
|---|---|
| **Outcome** | `solo-desk` and `clients-list` import real `_shared/` modules (no copied `createClient` / `requireUser`); slugs, paths, and JSON stay identical. |
| **Rough time** | 1–2 days |
| **API break?** | No |

---

## Why this phase exists

After Phase 3, the main function mounts `routes/` and has `_shared/db.ts`, but:

| Today | Problem |
|---|---|
| `_shared/auth.ts` / `mappers.ts` | Facades that import **from** `make-server-980e1cbf/context.ts` (wrong direction) |
| `solo-desk/index.ts` | Own `createClient` + copied `requireUser` + solo-only helpers |
| `clients-list/index.ts` | Own `createClient` + copied `requireUser`; already uses `_shared/clientsCore.ts` |
| `clientsCore.ts` | Own mappers (`toClient`, `toPackageInstance`, …) that may drift from main |

Phase 4 makes `_shared` the **source of truth** for cross-function helpers, then deletes the copies.

---

## Prerequisites (must already be true)

- [x] Phase 3 checklist complete (thin `index.ts`, routes mounted, smoke green)  
- [x] `supabase functions serve` serves all three: `make-server-980e1cbf`, `solo-desk`, `clients-list`  
- [x] Contract `routes.md` lists solo-desk + clients-list paths  
- [x] Front end still uses slugs `solo-desk` / `clients-list` (`src/lib/backend.ts`) — **do not rename**  
- [x] No Production deploy  

---

## Hard rules

1. **Same slugs and paths** — `solo-desk/org-settings`, `solo-desk/drop-ins`, `clients-list/clients`.  
2. **Same JSON** — including error messages/status the UI already handles.  
3. **`_shared` must not import** `make-server-980e1cbf/*` (break the Phase 3 facade cycle).  
4. Main function may keep importing `_shared` + its own `context.ts` for domain-only helpers.  
5. After each milestone: serve boots; smoke main; plus a targeted hit on the slug you touched.

---

## Current vs target (this phase)

### Current (post–Phase 3)

```
functions/
  _shared/
    db.ts              # real
    auth.ts            # facade → context  ❌
    mappers.ts         # facade → context  ❌
    errors.ts          # stub
    clientsCore.ts     # used by clients-list (+ duplicated mappers)
  make-server-980e1cbf/
    context.ts         # requireUser, toClient, …
    routes/ services/
  solo-desk/index.ts   # local admin + requireUser copy
  clients-list/index.ts
```

### Target (end of Phase 4)

```
functions/
  _shared/
    db.ts              # admin(), clock-skew fetch, background, env
    auth.ts            # requireUser(admin|deps) — real implementation
    mappers.ts         # shared toClient / toPackageInstance / … used by clientsCore + main where easy
    clientsCore.ts     # loadClients — imports db/auth/mappers as needed
    errors.ts          # optional small helpers (still thin OK)
  solo-desk/index.ts   # import admin/requireUser from _shared; keep soloOwner + routes only
  clients-list/index.ts# import admin/requireUser + loadClients from _shared
  make-server-980e1cbf/
    context.ts         # imports requireUser (etc.) from _shared OR thin re-exports — no cycle
```

---

## Milestone map

| # | Milestone | Est. | Ships |
|---|---|---|---|
| **M0** | Inventory duplicates + import graph freeze | 0.5 day | Doc only |
| **M1** | Make `_shared/auth` (+ db usage) real; break facade cycle | 0.5–1 day | `_shared` no longer imports context |
| **M2** | Point `clients-list` at shared auth/db | 0.5 day | Slimmer clients-list |
| **M3** | Point `solo-desk` at shared auth/db | 0.5 day | Slimmer solo-desk |
| **M4** | Align `clientsCore` mappers with `_shared/mappers` | 0.5–1 day | One mapper source |
| **M5** | Main `context` consumes `_shared` (no reverse deps) | 0.5 day | Cycle gone both ways |
| **M6** | Smoke both slugs + UI paths + progress note | 0.5 day | Phase exit |

```
M0 inventory → M1 real _shared/auth → M2 clients-list → M3 solo-desk
    → M4 clientsCore/mappers → M5 context uses _shared → M6 verify + note
```

---

# M0 — Inventory + import graph freeze

## Goal

List every duplicated helper and decide the shared API shape before editing.

## Tasks

1. Diff / list copies of: `createClient` setup, `requireUser`, any `profileOf`-like helpers in `solo-desk` and `clients-list`.  
2. List exports of `_shared/clientsCore.ts` and which mappers it defines locally.  
3. Decide `requireUser` signature for shared use:  
   - **Preferred:** `requireUser(c, admin)` or `requireUser(c)` using `admin` from `_shared/db.ts`  
   - Document choice here when implementing.  
4. Confirm UI call sites in `src/lib/backend.ts` (`SOLO_DESK`, `CLIENTS_LIST`, fallback to main `/clients`).  
5. Note: solo-only `soloOwner()` stays in `solo-desk` (not general `_shared` unless reused later).

## Acceptance criteria

- [x] Duplicate inventory written (table below filled).  
- [x] Shared `requireUser` / `admin` API chosen.  
- [x] No code behaviour change yet (or only comments).

### M0 inventory (frozen)

| Location | Duplicated piece | Target home |
|---|---|---|
| `solo-desk` | `createClient` admin | `_shared/db.ts` |
| `solo-desk` | `requireUser` | `_shared/auth.ts` |
| `solo-desk` | `soloOwner` | stay in `solo-desk` |
| `clients-list` | `createClient` admin | `_shared/db.ts` |
| `clients-list` | `requireUser` | `_shared/auth.ts` |
| `clientsCore` | `toClient` / package / membership mappers | `_shared/mappers.ts` |
| `_shared/auth.ts` | re-export from context | **replace** with real impl |

**API choice:** `requireUser(c)` uses `admin()` from `_shared/db.ts` (no second arg).

---

# M1 — Real `_shared/auth` (break the facade)

## Goal

`_shared/auth.ts` implements `requireUser` (and any tiny helpers solo/clients need) using `_shared/db.ts` only — **zero** imports from `make-server-980e1cbf/`.

## Tasks

1. Implement `requireUser` in `_shared/auth.ts` matching current behaviour (getClaims → getUser fallback).  
2. Ensure `_shared/db.ts` exports what auth needs (`admin` or a getter).  
3. Remove facade re-exports from context in `auth.ts`.  
4. Temporarily keep main function working: either  
   - `context.ts` imports `requireUser` from `_shared/auth.ts` and re-exports, **or**  
   - leave context’s copy until M5 (prefer switch in M1 if smoke stays green).  
5. `functions serve` + main `smoke.sh --live` green.

## Acceptance criteria

- [x] `rg "make-server-980e1cbf" supabase/functions/_shared` → no matches (except comments).  
- [x] `_shared/auth.ts` has a real `requireUser` body.  
- [x] Main smoke still green.

---

# M2 — Wire `clients-list` to `_shared`

## Goal

`clients-list` deletes its local admin/`requireUser` copies.

## Tasks

1. Import `admin` (or createClient wrapper) from `_shared/db.ts`.  
2. Import `requireUser` from `_shared/auth.ts`.  
3. Keep `loadClients` from `_shared/clientsCore.ts`.  
4. Preserve path `GET /clients-list/clients` and authz (401 / accountant 403).  
5. Curl/smoke: with staff JWT, `GET .../functions/v1/clients-list/clients` returns `{ clients: [...] }` same shape as main `/clients` for seed org.  
6. Confirm UI fast path still works (or falls back cleanly).

## Acceptance criteria

- [x] No local `createClient` / `requireUser` function body in `clients-list/index.ts`.  
- [x] Response shape unchanged vs main list for seed dept_head.  
- [x] Main smoke still green.

---

# M3 — Wire `solo-desk` to `_shared`

## Goal

Same for `solo-desk`; keep `soloOwner` and route logic local.

## Tasks

1. Import admin + `requireUser` from `_shared`.  
2. Rewrite `soloOwner` to use shared `requireUser` + shared `admin`.  
3. Do not move drop-in / InstaPay business rules into `_shared`.  
4. Verify:  
   - `GET solo-desk/org-settings` (403 for team-mode dept_head seed is OK — seed org is `team`; document how you tested, e.g. temporarily set `mode=solo` on local org **or** unit-level import check + 403 assertion).  
   - Prefer: local SQL `update organizations set mode='solo' where id=...` for a smoke, then set back to `team`, **or** add a note that live solo path was verified via 403-on-team + code review if changing mode is risky for other tests.  
5. Best practice: one local test that with `mode=solo`, GET org-settings returns 200 and JSON keys `dropInPrice`, `instapayQr`, `instapayAddress` (and price maps).

## Acceptance criteria

- [x] No local `createClient` / duplicated `requireUser` in `solo-desk`.  
- [x] Slug paths unchanged.  
- [x] Documented verification of solo path (200 with solo mode **or** agreed alternative).  
- [x] Main smoke green.

---

# M4 — Align `clientsCore` mappers with `_shared/mappers`

## Goal

One mapper implementation for client-list shaping; `clientsCore` imports it instead of defining copies.

## Tasks

1. Move or copy canonical `toClient`, `toPackageInstance`, `toMembershipInstance`, `toGroupPlan` (as used by `loadClients`) into `_shared/mappers.ts` as **real** code (not a facade).  
2. Update `clientsCore.ts` to import those mappers.  
3. If main `context.ts` has identical mappers, switch context to import from `_shared/mappers` **or** leave a thin re-export — avoid two divergent bodies.  
4. Diff JSON of `clients-list/clients` vs main `GET clients` for seed org (same client ids/fields that both return).

## Acceptance criteria

- [x] Mapper logic for the list lives in one module under `_shared`.  
- [x] `clientsCore` has no duplicate `function toClient` (etc.).  
- [x] List responses still match (spot-check seed).  
- [x] Main smoke green.

---

# M5 — Main `context` consumes `_shared` (no reverse deps)

## Goal

Finish the dependency arrow: `_shared` ← `make-server` ← routes; never `_shared` → `make-server`.

## Tasks

1. `context.ts` imports `requireUser` (and shared mappers if applicable) from `_shared`.  
2. Delete any remaining reverse imports.  
3. Grep gate:  
   ```bash
   rg "make-server-980e1cbf" supabase/functions/_shared
   # expect: no code imports
   ```  
4. Full smoke + money concurrency still green (auth path unchanged).

## Acceptance criteria

- [x] No `_shared` → `make-server-980e1cbf` imports.  
- [x] `context` uses shared auth (and mappers if in scope).  
- [x] Smoke + money parallel test green.

---

# M6 — Cross-slug verify + progress note

## Goal

Prove all three functions and leave a trail for Phase 5.

## Tasks

1. With `functions serve`, hit:  
   - main `health` + `me`  
   - `clients-list/clients`  
   - `solo-desk/org-settings` (per M3 verification method)  
2. UI: members list (clients-list path) loads; if you have a solo workspace, desk settings still save.  
3. Write `docs/progress/00xx-…-backend-phase-4-dedupe.md`.  
4. Update this file’s progress table + [backend-implementation-plan.md](./backend-implementation-plan.md).

## Acceptance criteria

- [x] All three slugs respond correctly in local serve.  
- [x] Progress note lists what moved and any intentional leave-behinds.  
- [x] Phase 4 checklist below complete.  
- [x] **Still no Production deploy.**

---

## Phase 4 checklist (done when all checked)

- [x] M0 inventory + API shape frozen  
- [x] M1 real `_shared/auth` (no import from context)  
- [x] M2 `clients-list` on `_shared`  
- [x] M3 `solo-desk` on `_shared`  
- [x] M4 `clientsCore` / mappers deduped  
- [x] M5 context → `_shared` only; grep clean  
- [x] M6 verify + progress note  
- [x] Contract / slugs unchanged  
- [x] **Still no Production deploy**

---

## Out of scope for Phase 4

- Zod / request validation (**Phase 5**)  
- Full `org.ts` hardening (**Phase 5**)  
- Moving wallet/points bodies out of `context.ts` into `services/` (nice follow-up; not required)  
- Renaming or merging the three function slugs  
- CI (**Phase 6**)  
- Production deploy  

---

## Suggested daily loop

```bash
supabase functions serve --no-verify-jwt --env-file supabase/functions/.env.local
./supabase/tests/smoke/smoke.sh --live   # main
# then curl clients-list + solo-desk with a staff JWT
python3 supabase/tests/money/concurrency_parallel.py   # after auth/db shared edits
```

---

## Progress

| Milestone | Status | Date |
|---|---|---|
| M0 Inventory + freeze | Done | 2026-11-19 |
| M1 Real `_shared/auth` | Done | 2026-11-19 |
| M2 Wire `clients-list` | Done | 2026-11-19 |
| M3 Wire `solo-desk` | Done | 2026-11-19 |
| M4 clientsCore / mappers | Done | 2026-11-19 |
| M5 context → `_shared` | Done | 2026-11-19 |
| M6 Verify + progress note | Done | 2026-11-19 |

---

## Handoff to Phase 5

You are ready for validation + org helper when:

1. Phase 4 checklist is complete.  
2. All three Edge slugs use shared db/auth without copied helpers.  
3. Smoke (main) + clients-list + solo-desk checks are green locally.

Next: [backend-implementation-plan.md](./backend-implementation-plan.md) → **Phase 5 — Validation + org helper**.
