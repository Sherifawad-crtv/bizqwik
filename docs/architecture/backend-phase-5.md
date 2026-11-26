# Backend Phase 5 — Validation + org helper (detailed)

**Parent plan:** [backend-implementation-plan.md](./backend-implementation-plan.md)  
**Architecture:** [backend.md](./backend.md) §5–6 · **Guidelines:** [backend-guidelines.md](./backend-guidelines.md) §4, §7–8  
**Depends on:** Phase 4 dedupe — [backend-phase-4.md](./backend-phase-4.md)

**Where this runs:** your machine only (local Supabase + local Vite + local Edge).  
**Production:** do **not** deploy Edge or migrations in this phase.

| | |
|---|---|
| **Outcome** | Money/desk POSTs validate at the Edge boundary; shared `org.ts` scopes id lookups by `org_id`; contract codes/JSON stay frozen; tenant check proves cross-gym ids fail. |
| **Rough time** | ~1 week (can land in 2–3 focused days) |
| **API break?** | No — same paths, statuses, and UI-handled `code`s |

---

## Why this phase exists

After Phase 4, `_shared` owns auth/db/mappers, but:

| Today | Problem |
|---|---|
| Money/desk POSTs | Ad-hoc `c.req.json()` + manual field checks; easy to accept garbage or drift from fixtures |
| `org_id` scoping | Repeated `.eq("org_id", me.org_id)` in every route; easy to miss on a new path |
| `_shared/errors.ts` | Stub unused; routes inline `c.json({ error, code }, status)` |
| Target layout | `validate.ts` + `org.ts` still missing ([backend.md](./backend.md) §5) |
| Tenant proof | `tests/tenant-isolation.ts` exists but Phase 5 must actually run (or a focused equivalent) |

Phase 5 hardens the **boundary** (validate + org scope) without changing product behaviour.

---

## Prerequisites (must already be true)

- [x] Phase 4 checklist complete (real `_shared/auth` + `mappers`; solo-desk / clients-list wired)  
- [x] `functions serve` boots all three slugs; main smoke green  
- [x] Contract fixtures under `supabase/tests/contract/` present (money codes frozen)  
- [x] Seed login works (`depthead@local.test` / `local-dev-password`)  
- [x] No Production deploy  

---

## Hard rules

1. **Same JSON / codes** — especially `insufficient_wallet`, `active_plan_confirm`, `refund_too_large`, `shared_wallet`, `active_plan`. Do not rename.  
2. **Schemas must allow today’s real bodies** — match contract `_meta.requestBody` + live UI payloads (extra keys OK via passthrough).  
3. **Never trust `org_id` / role from the body** — derive from authenticated profile/client, then scope lookups.  
4. **`_shared` must not import** `make-server-980e1cbf/*`.  
5. Money routes get schemas **first**; non-money routes can stay ad-hoc until a later pass.  
6. After each milestone: serve boots; smoke main; hit at least one validated money path.

---

## Current vs target (this phase)

### Current (post–Phase 4)

```
functions/
  _shared/
    db.ts auth.ts mappers.ts clientsCore.ts
    errors.ts          # stub, unused
    # no validate.ts / org.ts
  make-server-980e1cbf/
    context.ts         # locationField, staffInMyOrg, …
    routes/desk.ts     # ad-hoc body parse + inline org filters
```

### Target (end of Phase 5)

```
functions/
  _shared/
    db.ts auth.ts mappers.ts clientsCore.ts
    errors.ts          # jsonError / hono helpers used by routes
    org.ts             # clientInOrg / staffInOrg / rowInOrg (service-role safe)
    validate.ts        # Zod schemas + parseBody for money/desk POSTs
  make-server-980e1cbf/
    context.ts         # may re-export org helpers; domain stays here
    routes/desk.ts …   # parseBody → schema; id lookups via org helpers
  tests/
    tenant-isolation.ts   # run (or focused cross-tenant curl documented)
    contract/             # fixtures still green via smoke dry-run + live hits
```

---

## Milestone map

| # | Milestone | Est. | Ships |
|---|---|---|---|
| **M0** | Inventory money POSTs + freeze org/validate API | 0.5 day | Doc only |
| **M1** | Real `_shared/org.ts` | 0.5–1 day | Shared scoping helpers |
| **M2** | Expand `_shared/errors.ts` | 0.25 day | Consistent error helpers |
| **M3** | `_shared/validate.ts` + Zod money schemas | 1 day | Schemas + parseBody |
| **M4** | Wire validation into money/desk POSTs | 1 day | Routes use parseBody |
| **M5** | Wire org helpers into those same routes | 0.5–1 day | No raw unscoped id fetch |
| **M6** | Smoke + tenant proof + progress note | 0.5–1 day | Phase exit |

```
M0 inventory → M1 org.ts → M2 errors → M3 validate/Zod
  → M4 wire money POSTs → M5 org on those routes → M6 verify + note
```

---

# M0 — Inventory + API freeze

## Goal

List every money/desk POST in scope and freeze helper signatures before coding.

## Tasks

1. List money/desk POSTs (minimum set below) with key body fields from contract fixtures + route source.  
2. Decide Zod import style for Edge (`npm:zod@…` inline, same as hono).  
3. Freeze org helper API (preferred shapes below).  
4. Confirm frozen error `code`s that UI branches on.  
5. Note: full Zod on every route is **out of scope** — money/desk first.

## Acceptance criteria

- [x] Inventory table filled.  
- [x] `requireUser`-style org API chosen and written here.  
- [x] No behaviour change yet (or comments only).

### M0 inventory (money / desk first)

| Path | Key body fields | Contract / code notes |
|---|---|---|
| `POST packages` | `clientId`, `bundleTypeId`, `coachId`, `payMethod` | `insufficient_wallet` |
| `POST check-ins` | `clientId`, `source`, `locationId` | |
| `POST drop-ins` | `clientId` \| `newClient`, `classId` \| `category`+`price`, `payMethod`, `confirmActivePlan?` | `active_plan_confirm` 409 |
| `POST group-plans/sell` | `clientId` \| name fields, `planTypeId` \| `seriesId`, `payMethod`, `partners?` | `active_plan`, `shared_wallet` |
| `POST bookings/collect` | `bookingId`, `payMethod` | `insufficient_wallet` |
| `POST clients/refund` | `clientId`, `amount`, `destination`, `note?` | `refund_too_large` |
| `POST clients/compensate` | `clientId`, `amount`, `note?` | dept_head only |

### Frozen APIs

**Org (`_shared/org.ts`):**

```ts
clientInOrg(orgId: string, clientId: string): Promise<ClientRow | null>
staffInOrg(orgId: string, profileId: string): Promise<ProfileRow | null>
rowInOrg<T>(table: string, orgId: string, id: string, select?: string): Promise<T | null>
```

All use `admin()` from `_shared/db.ts`. Never take `orgId` from the request body — callers pass `me.org_id`.

**Validate (`_shared/validate.ts`):**

```ts
parseBody<T>(c, schema): Promise<{ ok: true; data: T } | { ok: false; response: Response }>
```

On failure return **400** `{ error: string }` (human message). Do not invent new machine `code`s for schema failures unless the UI already handles them.

**Errors (`_shared/errors.ts`):** helpers that produce the same `{ error, code? }` shape routes already return via Hono `c.json`.

---

# M1 — `_shared/org.ts`

## Goal

One place for “does this id belong to this gym?” lookups used by Edge (service role).

## Tasks

1. Add `supabase/functions/_shared/org.ts` with `clientInOrg`, `staffInOrg`, `rowInOrg` (and thin typed wrappers if useful).  
2. Implement with `.eq("org_id", orgId).eq("id", id)` (or equivalent).  
3. Optionally re-export from `context.ts` for routes that already import context — **or** import `_shared/org` from routes directly. Prefer direct `_shared` import when touching a route.  
4. Keep `staffInMyOrg(me, id)` in context as a thin wrapper calling `staffInOrg(me.org_id, id)` if you touch it — avoid two divergent bodies.  
5. Smoke still green (no route wiring required yet).

## Acceptance criteria

- [x] `_shared/org.ts` exists and does not import make-server.  
- [x] Helpers return `null` when row missing or wrong org (callers map to 404).  
- [x] Main smoke green.

---

# M2 — Expand `_shared/errors.ts`

## Goal

Shared helpers for `{ error, code? }` responses without changing status/body contracts.

## Tasks

1. Keep `jsonError` for raw `Response` use.  
2. Add Hono-friendly helpers, e.g. `errBody(error, code?)` returning the object routes pass to `c.json`.  
3. Do **not** mass-rewrite every route — use on routes you touch in M4–M5.  
4. Document that HTTP status stays at the call site (`c.json(errBody(...), 400)`).

## Acceptance criteria

- [x] Helpers match existing JSON shape.  
- [x] No accidental status/code changes on untouched routes.

---

# M3 — `_shared/validate.ts` + Zod money schemas

## Goal

Schemas for the M0 money/desk POSTs that accept today’s bodies.

## Tasks

1. Add Zod via `npm:zod@3` (pin a 3.x that Deno Edge resolves).  
2. Implement `parseBody(c, schema)`.  
3. Define schemas: `PackageSaleBody`, `CheckInBody`, `DropInBody`, `GroupPlanSellBody`, `BookingCollectBody`, `ClientRefundBody`, `ClientCompensateBody`.  
4. Use `.passthrough()` (or equivalent) so unknown extra keys from the UI do not 400.  
5. UUID fields: accept string UUIDs; keep optional/nullable fields as routes already treat them (`locationId: null`, optional `note`).  
6. `payMethod`: string (normalization stays in `normPayMethod` after parse).  
7. Fixture dry-run still green; optionally unit-check schemas against contract `_meta.requestBody` objects.

## Acceptance criteria

- [x] `validate.ts` has no make-server imports.  
- [x] Every M0 `requestBody` from contract fixtures parses successfully.  
- [x] Intentionally bad bodies (missing `clientId` where required, wrong types) fail closed with 400-shaped result from `parseBody`.

---

# M4 — Wire validation into money/desk POSTs

## Goal

Those POSTs go through `parseBody` before business logic.

## Tasks

1. Update `routes/desk.ts` handlers for the M0 set to `parseBody` + use `data`.  
2. Preserve existing human error messages for domain failures (wallet, active plan, etc.).  
3. Schema failures: short clear `error` string; **no new required UI `code`**.  
4. Live smoke: health/me; then at least one real money path (e.g. compensate or check-in) with seed JWT.  
5. Confirm insufficient-wallet / active_plan_confirm paths still return the same `code` when triggered (manual or existing money test).

## Acceptance criteria

- [x] M0 POSTs use `parseBody`.  
- [x] Contract codes unchanged when domain conditions hit.  
- [x] Main smoke green.

---

# M5 — Wire org helpers into validated routes

## Goal

Id lookups on those routes go through `_shared/org` (or thin context wrappers backed by it).

## Tasks

1. Replace raw `admin().from("clients").select…eq("id").eq("org_id")` on M0 routes with `clientInOrg` / `rowInOrg` where straightforward.  
2. Coach / booking / plan-type lookups: use `staffInOrg` / `rowInOrg` as applicable.  
3. Cross-tenant sanity: with seed JWT, request using a random UUID → 404 “No such client” (or existing message), never 200.  
4. Do not refactor unrelated catalog/ops routes in this phase.

## Acceptance criteria

- [x] M0 money routes no longer fetch clients/bookings without an org filter (helper enforces it).  
- [x] Wrong-org / unknown id still 404 with familiar copy.  
- [x] Smoke green.

---

# M6 — Prove + progress note

## Goal

Show validation + org scoping hold; leave a trail for Phase 6.

## Tasks

1. `smoke.sh --live` (health + me).  
2. Hit each validated path at least once (happy path or expected 4xx) with seed JWT.  
3. Tenant proof — pick one:  
   - **Preferred:** run `supabase/tests/tenant-isolation.ts` per its header (phased POSTs with `x-cron-secret`), **or**  
   - **Focused:** SQL insert a second-org client id; call `POST clients/compensate` / `POST check-ins` with that id as seed dept_head → must 404; document exact steps.  
4. `concurrency_parallel.py` still green (auth/org shared edits).  
5. Write `docs/progress/00xx-…-backend-phase-5-validation.md`.  
6. Update this file’s progress table + [backend-implementation-plan.md](./backend-implementation-plan.md).

## Acceptance criteria

- [x] Smoke + money concurrency green.  
- [x] Tenant proof documented and passing.  
- [x] Progress note lists schemas added, org helpers, leave-behinds.  
- [x] Phase 5 checklist below complete.  
- [x] **Still no Production deploy.**

---

## Phase 5 checklist (done when all checked)

- [x] M0 inventory + API freeze  
- [x] M1 `_shared/org.ts`  
- [x] M2 `_shared/errors.ts` expanded  
- [x] M3 `_shared/validate.ts` + Zod money schemas  
- [x] M4 money/desk POSTs validated  
- [x] M5 org helpers on those routes  
- [x] M6 verify + progress note  
- [x] Contract codes / slugs unchanged  
- [x] **Still no Production deploy**

---

## Out of scope for Phase 5

- Zod on every non-money route (follow-up)  
- Moving all domain helpers out of `context.ts` into `services/`  
- Changing money RPC SQL (already Phase 2)  
- CI / one-command automation (**Phase 6**)  
- Production deploy / CUTOVER  

---

## Suggested daily loop

```bash
supabase functions serve --no-verify-jwt --env-file supabase/functions/.env.local
./supabase/tests/smoke/smoke.sh --live
# curl validated money POSTs with depthead JWT
python3 supabase/tests/money/concurrency_parallel.py
# tenant: focused cross-org id check OR full tenant-isolation phases
```

---

## Progress

| Milestone | Status | Date |
|---|---|---|
| M0 Inventory + freeze | Done | 2026-11-25 |
| M1 `_shared/org.ts` | Done | 2026-11-25 |
| M2 Expand errors | Done | 2026-11-25 |
| M3 validate + Zod schemas | Done | 2026-11-25 |
| M4 Wire money POSTs | Done | 2026-11-25 |
| M5 Wire org helpers | Done | 2026-11-25 |
| M6 Verify + progress note | Done | 2026-11-25 |

---

## Handoff to Phase 6

You are ready for local automation / CI config when:

1. Phase 5 checklist is complete.  
2. Money/desk POSTs validate; org helpers used on those paths.  
3. Smoke + tenant proof + money concurrency are green locally.

Next: [backend-phase-6.md](./backend-phase-6.md) → **Phase 6 — Local automation / CI config** (milestones M0–M4).
