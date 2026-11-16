# Backend implementation plan (Current → Target)

**Status:** living roadmap  
**Goal:** reach the **Target** architecture in [backend.md](./backend.md) without breaking live gyms.  
**Rules while executing:** [backend-guidelines.md](./backend-guidelines.md)

---

## How we work (agreed workflow)

**Everything in this plan is done and proven locally first.** Production keeps running the current backend until the whole plan is finished and a final local gate passes.

```
┌────────────────────────────────────────────────────────────┐
│  WHILE IMPLEMENTING (Phases 0–6)                           │
│                                                            │
│  Local Supabase (DB + Edge Functions)                      │
│       ↕ same API contract                                  │
│  Local Vite front end (.env → local URL / anon key)        │
│                                                            │
│  • Write migrations / Edge code / tests here               │
│  • Run tests here                                          │
│  • Click through the app here to prove front ↔ back        │
│  • Production is NOT updated phase-by-phase                │
└────────────────────────────────────────────────────────────┘
                            │
                            ▼  only when ALL phases are done
┌────────────────────────────────────────────────────────────┐
│  FINAL LOCAL GATE                                          │
│  Full smoke + money + tenant + front↔back checklist        │
└────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────┐
│  ONE PRODUCTION CUTOVER                                    │
│  Apply new migrations → deploy Edge Functions              │
│  → deploy front end only if something actually changed     │
│  → smoke Production → rollback plan ready                  │
└────────────────────────────────────────────────────────────┘
```

### Why this is safe for live users

| During the plan | At cutover |
|---|---|
| Production stays on **Current** code and schema | You ship a **finished** Target stack that already worked end-to-end on your machine |
| You can break local freely | Migrations should be **additive**; Edge keeps the **same** paths/JSON the live app already uses |
| Front end locally points at local Supabase | Live Vercel app only changes if we deliberately deploy it |

**Critical:** keep the **API contract frozen** the whole time (same slugs, paths, JSON, status, `code`). Then the Production front end that is already live can keep talking to the new backend after cutover **without** needing a same-day front-end rewrite. Only deploy the front end at cutover if you actually changed `backend.ts` / types / env behaviour.

### If something is wrong after cutover

| Symptom | Immediate action |
|---|---|
| Edge 5xx / app broken | Redeploy previous Edge Function bundle (tag `edge-known-good` before cutover) |
| Money wrong | Prefer flag-off back to old JS **if** you still shipped dual-path; else redeploy previous Edge + plan a forward-fix migration |
| Bad migration | Forward-fix migration; do not panic-`DROP` on Production; Supabase backup only as last resort with ops decision |

You cannot casually “git revert” a migration already applied on Production. That is why cutover migrations stay additive and why local gate must be thorough.

---

## 0. Safety rules for every phase (local)

1. **Do not deploy** Edge, migrations, or app releases to Production during Phases 0–6.  
2. Preserve the **API contract** (see [backend.md](./backend.md) §3). Local front end must keep working against local back end the same way Production does today.  
3. Prefer **expand → switch → contract** locally (e.g. money: RPC behind a flag, prove it, then remove old JS) so the final cutover bundle is clean.  
4. Each phase is **done** only when its local checklist passes (including a front↔back click-through when that phase touches a route the UI uses).

### Definition of done (every phase)

- [ ] Scope of this phase only (no drive-by API renames)  
- [ ] Works on **local** Supabase + **local** front end where relevant  
- [ ] Tests for this phase run **locally** and pass  
- [ ] API contract unchanged (or expand-only, documented)  
- [ ] Progress note under `docs/progress/`  
- [ ] Tracker at the bottom updated  

---

## Phase overview

| Phase | Name | Breaks API? | Est. effort | Where it runs |
|---|---|---|---|---|
| **0** | Safety net + contract freeze | No | 2–3 days | Local |
| **1** | Local Supabase + baseline schema | No | 2–4 days | Local |
| **2** | Money RPCs (local shadow → switch) | No | 1–1.5 weeks | Local |
| **3** | Split Edge Function source tree | No | 1.5–2 weeks | Local |
| **4** | Shared `_shared` + dedupe solo/clients-list | No | 1–2 days | Local |
| **5** | Validation + org helper hardening | No* | ~1 week | Local |
| **6** | Local automation / CI config | No | 1–2 days | Local (CI runs later on PRs) |
| **GATE** | Full local acceptance | — | 1–2 days | Local |
| **CUTOVER** | Migrations + Edge (+ app if needed) | No if contract held | half day + watch | Production |

\* Validation must accept every payload the current app already sends.

**Solid Target locally:** Phases 0–6 (~5–7 weeks one person).  
**Then** GATE + CUTOVER.

---

## Phase 0 — Safety net + freeze the contract

**Detailed playbook:** [backend-phase-0-1.md](./backend-phase-0-1.md) (Phase 0 section).

Capture what the front end expects (route list + JSON fixtures), add a local smoke script, fix Playwright on your Mac. **No Production deploy.**

---

## Phase 1 — Local Supabase + baseline schema

**Detailed playbook:** [backend-phase-0-1.md](./backend-phase-0-1.md) (Phase 1 section).

`config.toml`, baseline schema, seed users, local Edge + local Vite login. **No Production deploy.** Do not re-apply baseline onto Production at cutover later — only **new** migrations from Phase 2+.

---

## Phase 2 — Money RPCs (all local)

### Purpose

Fix wallet/points races with transactional Postgres RPCs. Same JSON out of Edge as today.

### 2.A Design

RPCs (names illustrative) matching current JS behaviour:

- `wallet_credit` / `wallet_debit` → `{ ok, balance }`  
- expiry / FIFO lots inside the transaction  
- points earn/redeem if they multi-write  

Use row locks so two debits cannot overdraw. Private schema + restricted `EXECUTE`.

### 2.B Expand locally

1. Migration adds RPCs.  
2. Edge can call RPC **or** old JS via a local flag (env or config), default off.  
3. Optional **shadow**: run both, return old result, log diffs.

### 2.C Verify locally

- [ ] Insufficient funds → `ok: false`, no partial rows  
- [ ] Two parallel full-balance debits → only one wins; balance ≥ 0  
- [ ] Desk sale / booking / refund via **local front end** with wallet  
- [ ] Shadow diffs clean (if used)  
- [ ] Tenant-isolation (or a focused cross-org check) on **local**  

### 2.D Switch locally

1. Flag on.  
2. Re-run concurrency + UI money flows.  
3. Remove or schedule removal of old JS loops once you trust local (before or as part of final cutover bundle — prefer removed so Production never ships dual paths unless you want a Prod flag for belt-and-braces).

**Recommendation for your workflow:** finish Phase 2 fully on local (RPC only, old JS deleted) so cutover is one clear backend. If you want an emergency switch on Production, keep a flag in the cutover build defaulting to RPC-on, with off = old JS **only if** old JS is still in the bundle.

### Production

**No deploy in this phase.**

---

## Phase 3 — Split Edge Function source (local)

### Purpose

Target folder layout; **identical** routes and responses.

### Work

1. Create `routes/`, `services/`, `_shared/` as in [backend.md](./backend.md).  
2. Move by vertical slice (`me`/health → desk → accounting → …).  
3. `index.ts` only mounts routers.  
4. After each slice: local functions serve + local UI smoke for that area.

### Local verification

- [ ] Contract fixtures still pass  
- [ ] Manual click-through: desk, members, money, ops, account as applicable  
- [ ] No path/JSON renames in the diff  

### Production

**No deploy.**

---

## Phase 4 — Deduplicate `solo-desk` / `clients-list` (local)

### Work

Import `_shared` only; delete copied helpers. Smoke both slugs locally + any UI that uses them.

### Production

**No deploy.**

---

## Phase 5 — Validation + org helper (local)

### Work

1. Validate money/desk POSTs (must allow today’s real bodies).  
2. Shared org scoping helper.  
3. Prove with local UI + contract fixtures + tenant check.

### Production

**No deploy.**

---

## Phase 6 — Local automation / CI config

### Work

1. Scripts you already run locally (smoke, contract, money concurrency) documented and one-command where possible.  
2. Optional: GitHub Action that runs the same on PRs using local Supabase in CI — still not a Production deploy.  
3. Do not put Production secrets in the plan’s day-to-day loop.

### Production

**No deploy.**

---

## GATE — Full local acceptance (required before cutover)

Run this only when Phases 0–6 are complete. **Do not cut over if any box fails.**

### Backend

- [ ] `supabase db reset` applies all migrations cleanly  
- [ ] Edge functions serve without boot errors  
- [ ] Contract fixtures / smoke script all green  
- [ ] Money concurrency script green  
- [ ] Tenant-isolation (or equivalent) green on local  

### Front ↔ back (local Vite → local Supabase)

Walk the real UI (seeded users/roles as needed):

- [ ] Login / logout  
- [ ] Desk: members list, check-in, drop-in  
- [ ] Wallet-paid path (sale or booking) + refund if you use it  
- [ ] Accounting / money screens for dept_head or accountant  
- [ ] Ops path if you use `/bizqwik`  
- [ ] No console/network storms of 4xx/5xx on happy paths  
- [ ] Error cases you care about still show the same `code` / messaging  

### Front-end package

- [ ] `npm run build`  
- [ ] Note whether Production needs an **app** deploy at all (only if `backend.ts` / types / env guard / UI changed). Pure backend Target with frozen contract → **Edge + migrations only** is enough.

### Cutover prep

- [ ] Tag git commit `backend-target-local-green`  
- [ ] Tag or save current Production Edge as `edge-known-good` (for rollback)  
- [ ] List **new** migrations to apply on Production (not baseline re-apply)  
- [ ] Written rollback owner + steps  
- [ ] Prefer a low-traffic window  

---

## CUTOVER — Production (once)

### Order

1. **Backup / confirm** Supabase Production backup / PITR is available.  
2. Apply **new** migrations only (Phases 2+), in order.  
3. Deploy Edge Functions from the green commit (`make-server-980e1cbf`, `solo-desk`, `clients-list`).  
4. Deploy front end **only if** GATE said you need it; set Production env vars correctly (no silent Test fallback).  
5. Smoke Production: login, desk read, one money action, glance at error monitoring.  
6. Watch for a few hours. If bad → rollback Edge immediately; flag-off if you kept dual-path; forward-fix migration if needed.

### What “success” looks like

Live app behaves like your local GATE session; balances and tenant boundaries hold; no spike in 5xx.

---

## Local testing playbook (daily during the plan)

```bash
supabase start
supabase db reset          # when migrations changed
# seed (documented in migrations README)
supabase functions serve   # check current CLI help for exact flags
npm run dev                # .env.local → local Supabase
```

Then: run the phase’s tests + click the screens that use the routes you touched.

| Tool | Use |
|---|---|
| Local UI | Front↔back connection, real flows |
| Contract / smoke scripts | API shape did not drift |
| Money concurrency script | Wallet races fixed |
| Tenant-isolation | Cross-gym leaks |
| Playwright (mocked) | UI only — **not** a substitute for local Edge+DB money/tenant tests |

---

## Suggested calendar (one person, local-only until the end)

| Week | Focus |
|---|---|
| 1 | Phase 0 + Phase 1 (local stack + seed + UI login) |
| 2–3 | Phase 2 money RPCs fully proven locally |
| 4–5 | Phase 3 split + Phase 4 dedupe |
| 6 | Phase 5 + Phase 6 |
| +1–2 days | **GATE** |
| half day | **CUTOVER** + watch |

---

## Progress tracker

| Phase | Status | Local verified | Front↔back checked | Date |
|---|---|---|---|---|
| 0 Contract + smoke | Done (dry-run; live smoke → Phase 1) | yes | n/a | 2026-11-17 |
| 1 Local + baseline + seed | Not started | | | |
| 2 Money RPCs | Not started | | | |
| 3 Split Edge source | Not started | | | |
| 4 Dedupe functions | Not started | | | |
| 5 Validation + org helper | Not started | | | |
| 6 Automation / CI config | Not started | | | |
| GATE full local acceptance | Not started | | | |
| CUTOVER Production | Not started | | | |

---

## Explicit non-goals

- Updating Production after every phase  
- Renaming `make-server-980e1cbf` during this plan  
- Direct PostgREST business writes from the browser  
- Using mocked Playwright alone as proof that money/tenant logic is safe  

---

## Related

- [backend.md](./backend.md) — Current vs Target  
- [backend-guidelines.md](./backend-guidelines.md) — day-to-day rules (local-first)  
- [backend-phase-0-1.md](./backend-phase-0-1.md) — detailed Phase 0 & 1 playbook  
- `docs/audit/frontend-issues.md` — separate front-end track  
