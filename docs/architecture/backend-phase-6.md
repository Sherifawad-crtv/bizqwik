# Backend Phase 6 — Local automation / CI config (detailed)

**Parent plan:** [backend-implementation-plan.md](./backend-implementation-plan.md)  
**Architecture:** [backend.md](./backend.md) · **Guidelines:** [backend-guidelines.md](./backend-guidelines.md) §9  
**Depends on:** Phase 5 validation — [backend-phase-5.md](./backend-phase-5.md)

**Where this runs:** your machine + optional GitHub Actions (ephemeral **local** Supabase in CI).  
**Production:** do **not** deploy Edge, migrations, or app in this phase.  
**Secrets:** never put Production keys in scripts, workflow env, or committed `.env*`.

| | |
|---|---|
| **Outcome** | One command runs the backend checks you already use locally; docs list how; optional PR workflow runs the same against local Supabase in CI — still zero Production touch. |
| **Rough time** | 1–2 days |
| **API break?** | No |

---

## Why this phase exists

Phases 0–5 left working scripts, but they are scattered:

| Today | Problem |
|---|---|
| `smoke.sh` | Needs manual env + JWT for `--live` |
| `concurrency_parallel.py` / SQL | Separate invocations; easy to skip |
| Docs | Per-folder READMEs; no single “verify backend” entry |
| CI | None — regressions only caught when someone remembers to run locally |

Phase 6 packages the **local** proof loop and optionally mirrors it on PRs.

---

## Prerequisites (must already be true)

- [x] Phase 5 checklist complete  
- [x] `./supabase/tests/smoke/smoke.sh` dry-run green  
- [x] Local stack can run smoke `--live` + `concurrency_parallel.py`  
- [x] Seed users documented (`depthead@local.test` / `local-dev-password`)  
- [x] No Production secrets in the repo  

---

## Hard rules

1. **No Production deploy** and no Production secrets in workflows.  
2. CI must use **local** `supabase start` / `db reset` only.  
3. One-command script must work **offline dry** without Docker (fixture smoke).  
4. Live / CI modes may require Docker + Supabase CLI.  
5. Do not change API contract or Edge behaviour — automation only.

---

## Current vs target (this phase)

### Current

```
supabase/tests/
  smoke/smoke.sh          # dry + --live (manual env)
  money/*.sql + concurrency_parallel.py
  contract/               # fixtures
  tenant-isolation.ts     # heavy; not required in default verify
package.json              # no backend:verify script
.github/workflows/        # missing
```

### Target

```
scripts/backend-verify.sh     # --dry | --live | --ci
package.json                  # "backend:verify": "…"
supabase/tests/*/README.md    # point at one-command
.github/workflows/backend-verify.yml   # PR: dry always; live stack on supabase/** paths
docs/progress/00xx-…-phase-6.md
```

---

## Milestone map

| # | Milestone | Est. | Ships |
|---|---|---|---|
| **M0** | Inventory scripts + freeze verify modes | 0.25 day | Doc only |
| **M1** | `scripts/backend-verify.sh` one-command | 0.5–1 day | Dry + live automation |
| **M2** | npm script + README pointers | 0.25 day | Discoverable |
| **M3** | GitHub Action (local Supabase) | 0.5–1 day | PR checks |
| **M4** | Run verify + progress note | 0.5 day | Phase exit |

```
M0 inventory → M1 verify.sh → M2 npm/docs → M3 GH Action → M4 prove + note
```

---

# M0 — Inventory + mode freeze

## Goal

List every check that belongs in the default loop vs optional.

## Tasks

1. Inventory: smoke dry, smoke live, money parity SQL, concurrency SQL, concurrency_parallel, tenant-isolation.  
2. Freeze modes for `backend-verify.sh`:  
   - `--dry` — fixtures only (no Docker)  
   - `--live` — assumes `supabase start` + functions serving; signs in seed dept_head; smoke live + money parallel  
   - `--ci` — start/reset stack, serve functions, then same as `--live`  
3. Decide: tenant-isolation **out of default** (too heavy / phased Edge deploy); document as GATE optional.  
4. Confirm seed credentials used only for local/CI ephemeral DBs.

## Acceptance criteria

- [x] Inventory table filled.  
- [x] Modes frozen.  
- [x] No behaviour change yet.

### M0 inventory

| Check | Default dry | Default live/CI | Notes |
|---|---|---|---|
| `smoke.sh` (fixtures) | yes | yes | Always |
| `smoke.sh --live` | no | yes | health + me |
| `concurrency_parallel.py` | no | yes | Needs DB |
| `parity.sql` / `concurrency.sql` | no | optional flag | Keep available |
| `tenant-isolation.ts` | no | no | GATE / manual |

---

# M1 — One-command `scripts/backend-verify.sh`

## Goal

A single script developers and CI can run.

## Tasks

1. Add `scripts/backend-verify.sh` (bash, `set -euo pipefail`).  
2. Implement `--dry` (default): run `./supabase/tests/smoke/smoke.sh`.  
3. Implement `--live`:  
   - Read `API_URL` / `ANON_KEY` / `DB_URL` from `supabase status -o env` (or env overrides).  
   - Obtain JWT via Auth password grant for `depthead@local.test` / `local-dev-password`.  
   - `SMOKE_*` + `smoke.sh --live`.  
   - `python3 supabase/tests/money/concurrency_parallel.py` (pass `DB_URL` if needed).  
4. Implement `--ci`:  
   - Ensure `MONEY_RPC=1` for serve (write/use a temp env file under `/tmp` or repo gitignored path — do not commit secrets).  
   - `supabase db reset` (migrations + seed) when needed; `functions serve --no-verify-jwt` in background; wait for `/health`.  
   - Then run `--live` suite.  
5. Clear usage text on `-h` / bad args.  
6. Mark executable (`chmod +x`).

## Acceptance criteria

- [x] `--dry` exits 0 on a clean tree without Docker.  
- [x] `--live` exits 0 when local stack + serve are up with seed.  
- [x] Script prints which steps ran.  
- [x] No Production URLs/keys hardcoded.

---

# M2 — npm script + README pointers

## Goal

Make the command discoverable from the repo root and existing test READMEs.

## Tasks

1. Add to `package.json`:  
   - `"backend:verify": "bash scripts/backend-verify.sh"`  
   - `"backend:verify:live": "bash scripts/backend-verify.sh --live"`  
2. Update `supabase/tests/smoke/README.md` and `money/README.md` with a “One command” section pointing at the script.  
3. Link Phase 6 from [backend-implementation-plan.md](./backend-implementation-plan.md) and Phase 5 handoff.

## Acceptance criteria

- [x] `npm run backend:verify` runs dry mode.  
- [x] READMEs mention the one-command entry.

---

# M3 — GitHub Action (local Supabase only)

## Goal

PRs get automated dry checks; changes under `supabase/` (and the verify script) also get a live local-stack job.

## Tasks

1. Add `.github/workflows/backend-verify.yml`.  
2. Job **dry** (always on PR / push to `dev-mahmoud`): checkout → `bash scripts/backend-verify.sh --dry`.  
3. Job **live** (path filter: `supabase/**`, `scripts/backend-verify.sh`, workflow itself):  
   - `supabase/setup-cli`  
   - `supabase start`  
   - `supabase db reset`  
   - background `functions serve --no-verify-jwt` with `MONEY_RPC=1`  
   - `bash scripts/backend-verify.sh --live`  
   - stop stack on completion  
4. No Production project ref, no Production secrets.  
5. Document that fork PRs without Docker privileges still get the dry job.

## Acceptance criteria

- [x] Workflow file committed.  
- [x] Dry job has no Docker dependency.  
- [x] Live job uses only local Supabase.  
- [x] Workflow does not deploy anything.

---

# M4 — Prove + progress note

## Goal

Show the automation works and leave a trail for GATE.

## Tasks

1. Run `bash scripts/backend-verify.sh --dry` → green.  
2. With local stack: `bash scripts/backend-verify.sh --live` → green.  
3. Write `docs/progress/00xx-…-backend-phase-6-automation.md`.  
4. Update this file’s progress table + [backend-implementation-plan.md](./backend-implementation-plan.md) tracker.  
5. Note: pushing the workflow is enough to exercise CI on the next PR; do not require a green Actions run to close the phase if live was proven locally.

## Acceptance criteria

- [x] Dry + live verify green locally.  
- [x] Progress note lists script modes, workflow, leave-behinds.  
- [x] Phase 6 checklist below complete.  
- [x] **Still no Production deploy.**

---

## Phase 6 checklist (done when all checked)

- [x] M0 inventory + modes frozen  
- [x] M1 `scripts/backend-verify.sh`  
- [x] M2 npm + README pointers  
- [x] M3 GitHub Action (local only)  
- [x] M4 verify + progress note  
- [x] No Production secrets in automation  
- [x] **Still no Production deploy**

---

## Out of scope for Phase 6

- GATE full acceptance walkthrough (next section of parent plan)  
- CUTOVER / Production deploy  
- Making tenant-isolation the default CI job  
- Renaming Edge slugs  
- Playwright as a substitute for Edge+DB money tests  

---

## Suggested daily loop (after this phase)

```bash
npm run backend:verify              # always, no Docker
# with local stack + functions serve:
npm run backend:verify:live
```

---

## Progress

| Milestone | Status | Date |
|---|---|---|
| M0 Inventory + freeze | Done | 2026-11-25 |
| M1 backend-verify.sh | Done | 2026-11-25 |
| M2 npm + READMEs | Done | 2026-11-25 |
| M3 GitHub Action | Done | 2026-11-25 |
| M4 Verify + progress note | Done | 2026-11-25 |

---

## Handoff to GATE

You are ready for **GATE — Full local acceptance** when:

1. Phase 6 checklist is complete.  
2. `backend-verify` dry + live are green.  
3. Optional: CI dry (and live on supabase paths) configured.

Next: [backend-implementation-plan.md](./backend-implementation-plan.md) → **GATE — Full local acceptance**.
