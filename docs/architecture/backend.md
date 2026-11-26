# Backend architecture

**Status:** living  
**Stack:** Supabase (Auth + Postgres + Edge Functions) · Hono · Deno  
**Companions:** [backend-guidelines.md](./backend-guidelines.md) · [backend-implementation-plan.md](./backend-implementation-plan.md)

This document has two layers on purpose:

| Layer | Meaning |
|---|---|
| **Current (as of `dev` / production)** | How the system actually works today. Do not pretend otherwise when debugging. |
| **Target (after the implementation plan)** | The shape we are moving to and must keep forever after. |

Until a phase in the implementation plan is **done and verified**, production behaviour follows **Current**. New work must move us toward **Target** without breaking the frozen API contract (see §3).

---

## 1. What the backend is (both layers)

Bizqwik’s backend **is Supabase**. There is no separate Node/Express API server.

| Piece | Role |
|---|---|
| **Supabase Auth** | Sign-up, login, JWTs |
| **Postgres** | Source of truth for all business data |
| **Edge Functions (Deno + Hono)** | HTTP API the React app calls |
| **Vault + RPCs** | Secrets; (target) privileged multi-step money work |
| **RLS** | Defense in depth on tables; Edge Functions use the **service role**, so RLS does **not** run for those queries |

The React app talks only through `src/lib/backend.ts` → `supabase.functions.invoke(...)`. Screens do not write to tables directly.

```
┌─────────────┐     JWT + HTTPS      ┌──────────────────────────────┐
│  React PWA  │ ───────────────────► │  Edge Function(s)            │
│  backend.ts │                      │  (see Current vs Target)     │
└─────────────┘                      │         │                    │
                                     │         ▼                    │
                                     │  Postgres (migrations)       │
                                     └──────────────────────────────┘
```

---

## 2. Current vs Target (summary)

| Area | Current | Target |
|---|---|---|
| Edge Function source | Mostly one file: `make-server-980e1cbf/index.ts` (~5,074 lines, ~134 routes) | Same **slug** and **URLs**, but source split into `routes/` + `services/` + `_shared/` |
| Money (wallet / points) | Multi-step JS writes (read → insert → update lots) — **not one DB transaction** | Postgres RPCs that run as **one transaction** with locking |
| Helpers | Duplicated into `solo-desk` / `clients-list` / `_shared/clientsCore.ts` | One `_shared/` module; no copies |
| Schema history | Partial migrations in git; early tables applied by hand; no `config.toml` | Full baseline + `config.toml`; every change is a migration |
| Validation | Ad-hoc checks; many `any`s | Schema validation (e.g. Zod) on inputs, money routes first |
| Tenant safety | Enforced in JS (`org_id` / role helpers) + a tenant-isolation test | Same + money RPCs enforce `org_id` in SQL; shared org helper everywhere |
| CI | None in repo | PR pipeline: typecheck, lint, build, tests |
| Front-end contract | Paths + JSON + status/`code` as today | **Unchanged** unless expand/contract (add optional fields first) |

### Current request path

```
App → backend.ts → Edge Function (fat index.ts)
                 → many separate admin().from(...) calls
                 → Postgres
```

### Target request path

```
App → backend.ts → Edge Function (thin route)
                 → service (domain)
                 → admin().rpc("wallet_debit", ...)   // money
                 →   or scoped queries via _shared     // non-money
                 → Postgres (transaction for money)
```

---

## 3. Frozen API contract (must not break live users)

These stay stable across the whole migration. Breaking them breaks production gyms.

1. **Function slugs:** `make-server-980e1cbf`, `solo-desk`, `clients-list` until an explicit dual-serve cutover is planned.
2. **URL paths** under those slugs (`me`, `clients`, `drop-ins`, `accounting/…`, `ops/…`, `client/…`, …).
3. **JSON response shapes** (camelCase) expected by `src/lib/types.ts` / `backend.ts`.
4. **HTTP status codes** and machine-readable error **`code`** values (UI branches on them).
5. **Auth:** `Authorization: Bearer <user JWT>`; anon routes stay anon.

**Allowed without a front-end change:** add optional JSON fields, add new routes, fix bugs that preserve status/body for success paths.

**Not allowed mid-flight:** rename fields, remove fields, change status for the same case, change `code` strings, change path strings, change which role can call a route — unless a versioned plan + front-end PR + rollback is written first.

Technical name: **backward-compatible / expand–contract** API evolution.

---

## 4. Current layout (as of today)

```
supabase/
  migrations/          # incomplete history (see README there)
  functions/
    make-server-980e1cbf/
      index.ts         # ~all routes + wallet/points + mappers + auth
    solo-desk/
      index.ts         # copies helpers
    clients-list/
      index.ts
    _shared/
      clientsCore.ts   # partial share; main function largely ignores it
  tests/
    tenant-isolation.ts
```

No `supabase/config.toml` yet → no reliable local stack from this repo alone.

---

## 5. Target layout (after implementation plan)

```
supabase/
  config.toml
  migrations/                 # includes baseline + every later change
  functions/
    _shared/
      db.ts                   # admin client, clock-skew fetch
      auth.ts                 # requireUser, roles
      org.ts                  # always scope by org_id
      errors.ts               # consistent { error, code } JSON
      mappers.ts              # snake_case → camelCase
      validate.ts             # request schemas
    make-server-980e1cbf/
      index.ts                # app + CORS + mount routers + /health only
      routes/                 # HTTP only
        me.ts
        clients.ts
        desk.ts
        accounting.ts
        ops.ts
        client-app.ts
        …
      services/               # domain; money calls RPCs
        wallet.ts
        points.ts
        sales.ts
        …
    solo-desk/index.ts        # imports _shared only
    clients-list/index.ts
  tests/
    tenant-isolation.ts
    contract/                 # frozen request/response fixtures
```

**Rules for Target:**

- `routes/` = parse, authz, validate, call service, return JSON.
- `services/` = domain rules; no raw Hono `c` objects.
- **Multi-row money** = Postgres function in a **private** schema (`SECURITY DEFINER`), not a JS loop.

---

## 6. Multi-tenancy (current + target)

- Business rows are scoped by **`org_id`** (or a parent that has one).
- Edge uses **service role** → RLS does not filter Edge queries.
- **Current:** callers must remember `org_id` / role checks in each route.
- **Target:** shared `org.ts` helpers; money RPCs also assert `org_id` inside SQL.
- Identities: staff (`profiles`), ops (`bizqwik_team`), members (`clients` + auth). Do not mix.

`supabase/tests/tenant-isolation.ts` is part of the architecture — not optional polish.

Technical terms: **multi-tenant isolation**, **defense in depth**.

---

## 7. Money and ledgers

| | Current | Target |
|---|---|---|
| Wallet debit/credit/expiry | JS multi-step (`debitWallet` / `creditWallet` in `index.ts`) | Single transactional RPC + row lock |
| Points | Same pattern | Transactional RPC |
| Desk sale / booking paid by wallet | Route calls JS debit | Route calls wallet RPC |
| Failure mid-way | Possible partial writes / races | All-or-nothing |

Technical terms for the current hazard: **race condition**, **non-atomic write**, **TOCTOU** (time-of-check time-of-use).

---

## 8. Environments

| Env | Purpose |
|---|---|
| **Local** (`supabase start` + local Edge + local Vite) | **Where all implementation-plan work and tests happen.** Front end pointed at local URL/anon key. |
| **Production** | Live gyms. **Untouched until** the implementation plan is finished, the full local GATE passes, then one cutover (migrations + Edge, and app only if needed). |

Optional remote “Test” Supabase project is not required by the plan. If you use one later, it is extra — not a substitute for the local GATE.

Front-end env: `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Production builds must **not** silently fall back to another project if env is missing.

---

## 9. Decision log

| Decision | Choice |
|---|---|
| Backend host | Supabase (stay) |
| Business writes | Edge Functions, not direct PostgREST from the app |
| Service role in Edge | Yes; tenant rules in code (+ SQL for money) |
| Break API for cleanup | No — expand/contract only |
| Where we build/fix | **Local only** until the plan is complete |
| When Production changes | **Once**, after full local GATE + cutover checklist |

---

## 10. Related docs

- [backend-guidelines.md](./backend-guidelines.md) — rules for every PR / change  
- [backend-implementation-plan.md](./backend-implementation-plan.md) — phased path Current → Target without breaking production  
- [client-app-integration.md](./client-app-integration.md) — member-app product architecture  
- `docs/audit/frontend-issues.md` — front-end cleanup (separate track)
