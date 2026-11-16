# Backend guidelines

**Status:** living — follow on every backend task (bugfix, feature, refactor).  
**Applies to:** `supabase/**`, and any change to `src/lib/backend.ts` / `src/lib/types.ts` that talks to the API.  
**Architecture:** [backend.md](./backend.md) (Current vs Target)  
**Roadmap:** [backend-implementation-plan.md](./backend-implementation-plan.md)

These rules exist so we do not re-grow a 5k-line god file, reintroduce non-atomic money writes, or ship a breaking change to live gyms.

---

## 0. Local-first, protect Production

This backend serves **real users** in Production. During the implementation plan we assume:

- **All building and testing happens locally** (local Supabase DB + Edge Functions + local Vite front end).
- **Production is not updated phase-by-phase.** It stays on Current until the whole plan is done, the local GATE passes, then one cutover (see [backend-implementation-plan.md](./backend-implementation-plan.md)).
- A bad cutover can still lose/double money or brick the PWA — so the local GATE and rollback plan matter.
- Keep the **API contract frozen** so the live front end can keep talking to the new backend after cutover.

If a change would break the contract or cannot be rolled back safely at cutover → **stop and redesign** (expand/contract). Do not “fix it on Production”.

---

## 1. Before you write code

Checklist:

1. Read the relevant section of [backend.md](./backend.md) (Current vs Target).
2. Name the **API contract** you touch: path, method, request body, response, status, `code`.
3. Decide: does this **preserve** the contract, **extend** it (optional new fields), or **break** it? Breaking needs an explicit plan — see §3.
4. Plan how you will prove it **locally** (API script and/or local UI click-through).
5. If the change touches wallet, points, settlements, sales, refunds, or bookings paid by wallet → treat as **money** (§5).

---

## 2. Structure (maintain Target shape)

### While still on Current (fat `index.ts`)

- Prefer extracting a **new** helper into `supabase/functions/_shared/` rather than pasting another copy into `solo-desk` / `clients-list`.
- Do not add new domains as another thousand lines of unstructured code at the bottom of `index.ts` if the split phase has started — put them in the new `routes/` / `services/` files.
- Do not invent a second API style (e.g. app talking to PostgREST for business writes).

### After the split (Target)

| Put here | Do not put here |
|---|---|
| `routes/*.ts` — HTTP, authz, validate, map response | Multi-row money loops |
| `services/*.ts` — domain rules, RPC calls | Hono `Context` / raw `c.req` |
| `_shared/*` — db, auth, org, errors, mappers, validate | Org-specific business one-offs |
| `migrations/` — schema + RPCs | Dashboard-only schema edits that never hit git |

**One shared helper, one place.** If `solo-desk` needs `requireUser`, import from `_shared`. Never fork.

---

## 3. API contract integrity

### Do

- Keep path strings identical.
- Keep success JSON field names and types identical for existing fields.
- Keep error `code` strings the UI already handles.
- Add **optional** fields only when needed (`newField?: …`).
- Update `src/lib/types.ts` / `backend.ts` in the **same PR** when the API adds a field the app will use.

### Do not

- Rename or remove JSON fields in the same deploy as a “cleanup”.
- Change HTTP status for an existing business case without a front-end change ready.
- Change which roles can call a route without product sign-off + front-end guards.
- “Fix” the front end by silently changing the back end shape.

### Expand / contract pattern

1. **Expand:** deploy API that supports old + new.  
2. **Migrate:** deploy front end that uses new (if any).  
3. **Contract:** only later remove old (separate PR, after traffic has moved).

---

## 4. Auth, roles, tenants

- Resolve the caller once (`requireUser` / profile / client / ops).
- Every query and mutation must be scoped to the caller’s **`org_id`** (or be an explicit ops cross-org action).
- Never trust `org_id` (or role) from the request body alone — derive from the authenticated identity, then compare.
- Do not authorize from user-editable JWT `user_metadata` (Supabase rule). Use server-side profile / `app_metadata` / DB rows.
- Service role is powerful: treat every new `admin().from(...)` as “this bypasses RLS”.

If you add a route that takes an id from another gym: add or extend a **tenant-isolation** case.

---

## 5. Money and ledgers (highest care)

Applies to: wallet credit/debit/expiry, points, desk sales, refunds, compensation, class booking paid by wallet, settlements / pay.

### Current (until Phase 2 is done)

- Prefer calling the existing `debitWallet` / `creditWallet` helpers — do **not** open-code a new multi-step balance write in a route.
- Do not “optimize” by skipping a ledger row.
- Any intentional change to wallet/points behaviour needs a **local** concurrency proof and a cutover rollback note.

### Target (after Phase 2)

- All multi-row money writes go through **Postgres RPCs** (one transaction).
- Edge `services/wallet.ts` (etc.) only calls those RPCs.
- Prefer idempotency keys on client-retried POSTs.

### Never

- Check balance in JS, then write several rows without a transaction / lock (that is the race we are removing).
- Delete ledger history to “fix” a balance.
- Run experimental money SQL on Production (only after GATE, via reviewed migrations).

---

## 6. Database and migrations

- **Every** schema change is a file under `supabase/migrations/` (use `supabase migration new <name>` when CLI is set up).
- Do not change Production schema only in the dashboard.
- Prefer additive migrations (new columns nullable / new functions) over destructive ones.
- Destructive changes (drop column/table) only after expand/contract and a backup/rollback plan.
- Put `SECURITY DEFINER` money functions in a **private** schema; grant execute only as intended — do not leave them open to `anon` via the Data API.
- After schema work: reset/apply locally and smoke the app before you consider that migration part of the cutover set.

---

## 7. Validation and types

- Validate request bodies/queries at the Edge boundary (Target: Zod or equivalent in `_shared/validate.ts`).
- Money routes get schemas first.
- Avoid new `any`. If you must, leave a one-line why and a follow-up.
- Keep `src/lib/types.ts` aligned with API responses. Prefer generated DB types for table shapes once Phase 1 lands.

---

## 8. Errors and responses

- Return the same JSON error shape the app already parses (`error` message + optional `code` + optional data).
- Use the correct HTTP status the front end already expects for that case.
- Do not log JWTs, service role keys, or Vault secrets.
- Prefer machine `code` for branching; human `error` for display.

---

## 9. Testing expectations (every backend change)

All of this is **local** during the implementation plan:

| You touched | You must |
|---|---|
| Any Edge route | Hit it on local functions with a real JWT; confirm status + JSON keys |
| UI-facing route | Also click the flow in **local** Vite → local API |
| Money | Local concurrency script / SQL proof |
| `org_id` / ids across gyms | Tenant-isolation or a focused cross-tenant check on local |
| Migration | `supabase db reset` (or apply) locally; app smoke still works |
| `backend.ts` / types | `npm run build`; local UI still talks to local API |

Playwright mocked e2e does **not** replace local Edge+DB tests for money or tenant bugs.

Record what you ran in the PR / progress entry (**Verification** section).

---

## 10. Deploy and rollback discipline

**During Phases 0–6:** do not deploy migrations/Edge/app to Production.

**At cutover only** (after GATE in the implementation plan):

1. Know the rollback **before** you deploy (previous Edge artifact tagged; additive migrations; optional money flag).  
2. Apply **new** migrations → deploy Edge → deploy app only if GATE said you need it.  
3. Smoke Production immediately.  
4. Prefer a low-traffic window and a second pair of eyes for money-related cutovers.

---

## 11. Front-end coupling

- If the app would break without a front-end change, **ship front-end first or together**, never API-breaking-only.
- Do not “fix” a screen by changing the API shape when a screen bugfix would do.
- Lazy-load / bundle issues are front-end (`docs/audit/frontend-issues.md`) — do not change API slugs to paper over them.

---

## 12. PR hygiene

- One concern per PR when possible (migration alone, or function refactor alone, or flag flip alone).
- Title/body: what contract stayed the same, what was verified, how to roll back.
- No drive-by renames of public paths or JSON keys.
- Update progress log under `docs/progress/` for meaningful pushes (see that folder’s README).
- If the change advances Current → Target, tick the relevant checkbox in the implementation plan.

---

## 13. Quick “stop” list

Stop and redesign if you are about to:

- Edit Production DB by hand with no migration file  
- Paste a helper into a second Edge Function  
- Add a new wallet write loop in JS  
- Rename a response field “while you’re there”  
- Deploy to Production before the full local GATE  
- Deploy money logic to Production without a cutover checklist / rollback  
 
- Bypass org checks “just for this ops tool” without isolation tests  
- Commit service role keys or `.env` secrets  

---

## 14. Glossary (plain terms)

| Term | Meaning here |
|---|---|
| **API contract** | Path + request + response + status + `code` the app relies on |
| **Expand/contract** | Add new, move callers, only then remove old |
| **Race condition** | Two requests interleave and both “win” incorrectly |
| **Atomic / transaction** | All steps succeed or none do |
| **Service role** | DB key that bypasses RLS |
| **RPC** | Postgres function called from Edge (`admin().rpc`) |
| **Shadow mode** | Run new + old, return old result, compare for diffs |
| **God file** | One huge module that does everything |
