# Backend Phases 0 & 1 — detailed breakdown

**Parent plan:** [backend-implementation-plan.md](./backend-implementation-plan.md)  
**Architecture:** [backend.md](./backend.md) · **Guidelines:** [backend-guidelines.md](./backend-guidelines.md)

**Where this runs:** your machine only (local Supabase + local Vite).  
**Production:** do **not** deploy anything in these two phases.

| Phase | Outcome in one sentence |
|---|---|
| **0** | We freeze what the API looks like and can smoke-test it; Playwright works on your Mac. |
| **1** | We can start/reset a full local DB from git, seed users, and run the real front end against local Edge. |

Phase 1 depends on Phase 0’s contract folder existing (even if smoke against full local stack waits until Phase 1 finishes).

**Rough time:** Phase 0 ≈ 2–3 days · Phase 1 ≈ 2–4 days (first time through CLI/link/pull is the slow part).

---

## Shared setup (do once before or during Phase 0)

### Tools

- Node **≥ 20.19** (Vite 8 needs it; pin later with `.nvmrc` if you want).
- Supabase CLI (you already have ~3.1.0; updating is fine — always check `supabase <cmd> --help` for current flags).
- Docker Desktop running (required for `supabase start`).
- Git access to this repo; GitHub auth for the remote project when pulling schema.

### Repo paths you will touch

```
supabase/
  tests/
    contract/          # Phase 0 — create
    smoke/             # Phase 0 — create (script)
  migrations/          # Phase 1 — baseline + README update
  config.toml          # Phase 1 — create
  seed.sql             # Phase 1 — create (or seed via script)
playwright.config.ts   # Phase 0 — browser path
.env.local             # Phase 1 — local app → local Supabase (gitignored)
```

### Rule for both phases

Do **not** rename Edge paths, JSON fields, status codes, or error `code` values. You are **recording** Current behaviour, not improving it yet.

---

# Phase 0 — Safety net + freeze the contract

## 0.1 Goal

Make it impossible to “accidentally clean up” an API shape the live front end depends on.

When Phase 0 is done you have:

1. A written list of routes.  
2. Golden JSON examples for the riskiest routes.  
3. A smoke script you can run later against local functions.  
4. Playwright runnable on your Mac.  
5. Notes for how the Vite app will point at local Supabase (full wiring in Phase 1).

## 0.2 Why this phase exists

Later we will move money into RPCs and split the 5k-line Edge file. Without a frozen contract, a “harmless” rename breaks Production at cutover. Phase 0 is the seatbelt.

## 0.3 Step-by-step

### Step A — Create the contract folder

```bash
mkdir -p supabase/tests/contract
```

Suggested layout:

```
supabase/tests/contract/
  README.md                 # what “frozen” means; how to update fixtures
  routes.md                 # full path list
  me.success.json
  me.unauthorized.json      # or .error.json with status in filename / sidecar
  health.success.json
  check-in.success.json     # pick the real path name from routes.md
  drop-in.success.json
  desk-sale-wallet.success.json
  refund.success.json
  accounting-pnl.success.json   # or whatever the accounting read path is
```

In `supabase/tests/contract/README.md` state:

- Fixtures are the **Current** API the front end expects (`src/lib/backend.ts` / `types.ts`).
- Changing a fixture means you changed the contract — that needs an explicit expand/contract plan, not a drive-by edit.
- How you captured samples (browser Network tab, curl, or temporary logging).

### Step B — Build `routes.md` (full route inventory)

From `supabase/functions/make-server-980e1cbf/index.ts`, list every `app.get` / `app.post` (and put/patch/delete if any).

Include for each line:

| Method | Path (after slug) | Auth (anon / user / role notes) | Notes |
|---|---|---|---|
| GET | `/health` | none | liveness |
| GET | `/me` | JWT | profile / org / role |
| … | … | … | … |

Also list the other function slugs the app uses:

- `make-server-980e1cbf` (main) — `FN_SLUG` in `src/lib/supabaseClient.ts`
- `solo-desk`
- `clients-list`

Path prefix in code is often `${P}` where `P = "/make-server-980e1cbf"`. The client invokes as `functions.invoke("make-server-980e1cbf/<path>")` — fixtures should use the **path the client uses** (e.g. `me`, not the full URL).

Optional one-liner to help generate a draft list (then clean by hand):

```bash
rg -o 'app\.(get|post|put|patch|delete)\(`\$\{P\}/[^`]+' \
  supabase/functions/make-server-980e1cbf/index.ts
```

Also skim `src/lib/backend.ts` for every `callFn("...")` / `callFn(\`...\`)` string so the inventory matches what the **front end actually calls** (that is the contract that matters).

### Step C — Capture critical fixtures

**Minimum set** (from the parent plan):

| Fixture | Why |
|---|---|
| `health` success | Smoke / deploy sanity |
| `me` success | Every logged-in screen |
| `me` error (no/invalid token) | Auth failure shape |
| Check-in success | Desk core |
| Drop-in success | Desk money-ish |
| Wallet-paid sale success | Money path |
| Refund success | Money path |
| Accounting read success | Heavy read / P&L |

**How to capture (pick one):**

1. **Best for accuracy:** open the **live** or current Test-backed app, DevTools → Network, perform the action, copy response JSON (and note HTTP status). Redact names/phones/emails in fixtures if you commit them (replace with fake strings; keep **keys and types**).
2. **From code:** read the route’s `c.json({...})` in `index.ts` and hand-write an example — then **verify once** against a real response before marking frozen.
3. For errors: trigger the same failure the UI handles (e.g. missing auth → 401; business `code` like `active_plan_confirm` if you rely on it).

Each fixture file should make clear:

- HTTP status  
- JSON body  
- Optional: request method/path/body summary in a sibling `.meta.md` if useful  

Example `me.success.json` shape (illustrative — replace with a real capture):

```json
{
  "_meta": {
    "method": "GET",
    "path": "me",
    "status": 200,
    "capturedFrom": "production-or-test",
    "notes": "Redacted PII; keys must match backend.ts"
  },
  "profile": {},
  "orgMode": "team",
  "org": {},
  "tier": null,
  "bizqwikTeam": null
}
```

If you prefer pure JSON without `_meta`, put meta in `me.success.meta.md` instead. Be consistent.

### Step D — Smoke script (local-ready)

Create something like:

```
supabase/tests/smoke/smoke.sh
```

or a small Deno script under `supabase/tests/smoke/`.

**Behaviour:**

1. Read base URL from env, e.g. `SMOKE_BASE_URL` (local functions URL later; for Phase 0 you can skip live calls until Phase 1 if functions are not up yet).  
2. `GET .../health` → expect `{ "status": "ok" }` (or whatever fixture says).  
3. `GET .../me` with `Authorization: Bearer <token>` → expect 200 and required keys from fixture.  
4. Exit non-zero on mismatch.

Document in `supabase/tests/smoke/README.md`:

- Required env vars (`SMOKE_BASE_URL`, `SMOKE_JWT`, anon key if needed).  
- How to get a JWT once Phase 1 seed users exist (sign in via app or Auth API).  

**Phase 0 exit criteria for the script:** file exists, is documented, and either (a) runs against an available environment, or (b) is marked “run after Phase 1 `supabase functions serve`” with a dry-run that validates fixture files parse as JSON.

### Step E — Fix Playwright on your Mac

Today `playwright.config.ts` defaults to:

`/opt/pw-browsers/chromium` (cloud agent path).

Change to: use `PLAYWRIGHT_CHROMIUM_PATH` **if set**, otherwise Playwright’s normal bundled browser (omit hard-coded `executablePath`, or only set it when the env var is present).

Then:

```bash
npx playwright install chromium
npm run test:e2e
```

Note: these e2e tests are **mocked network** — they do not prove local Edge+DB. They only need to *run* so you have a UI safety net later.

### Step F — Document local env (preview)

Add a short section to `README.md` or `supabase/tests/contract/README.md`:

```bash
# .env.local (Phase 1 will fill real local values)
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local anon key from supabase status>
```

Do not commit secrets. Ensure `.env.local` is gitignored (it should be via `*.local` in `.gitignore`).

## 0.4 Phase 0 checklist (done when all checked)

- [ ] `supabase/tests/contract/` exists with README  
- [ ] `routes.md` lists main function routes + notes `solo-desk` / `clients-list`  
- [ ] Front-end `callFn` paths cross-checked against `routes.md`  
- [ ] Critical fixtures captured (health, me ± error, check-in, drop-in, wallet sale, refund, accounting read)  
- [ ] PII redacted in committed fixtures  
- [ ] Smoke script + README present  
- [ ] Playwright runs on this Mac (`npm run test:e2e` gets past browser launch)  
- [ ] `npm run build` still passes  
- [ ] Progress note under `docs/progress/`  

## 0.5 Out of scope for Phase 0

- `config.toml`, baseline migration, seed users (Phase 1)  
- Money RPCs, splitting `index.ts`  
- Any Production deploy  

## 0.6 If you get stuck

| Problem | What to do |
|---|---|
| Don’t know the exact JSON for a route | Capture from Network tab once; don’t invent keys |
| Route exists in Edge but not in `backend.ts` | Still list it in `routes.md`; mark “no front-end caller yet” |
| Playwright still can’t find Chrome | Install browsers via `npx playwright install`; remove forced `executablePath` |

---

# Phase 1 — Local Supabase + baseline schema

## 1.1 Goal

Any engineer (including you next month) can:

```text
clone → supabase start → db reset → seed → functions serve → npm run dev
→ log into the real UI against local API
```

without clicking around the Supabase dashboard to recreate tables.

## 1.2 Why this phase exists

Migrations in git today are **incomplete** (early tables were applied by hand). Without a baseline + `config.toml`, Phases 2+ (money RPCs, etc.) have nowhere safe to develop.

## 1.3 Important warnings

1. **Pull schema for a baseline into git** — that does **not** mean you will re-apply that baseline onto Production at cutover. Production already has the tables. Cutover later only applies **new** migrations from Phase 2 onward.  
2. Prefer linking / pulling from the project that matches Production most closely (this repo’s migrations README cites `aylhnxniqrihpvrllpgz` — confirm in dashboard which env that is before you pull).  
3. Never put `service_role` keys in the Vite app or commit them.

## 1.4 Step-by-step

### Step A — Docker + CLI sanity

```bash
docker info          # must work
supabase --version
supabase --help
```

Update CLI if you want; then re-check help for `init`, `start`, `db`, `functions`.

### Step B — `config.toml`

If the project was never fully CLI-initialized:

```bash
# Check current help — flags change between CLI versions
supabase init --help
```

You want a `supabase/config.toml` committed. If `init` would overwrite things, use a careful init or copy from Supabase’s current default template and keep existing `migrations/` / `functions/`.

Confirm `config.toml` points at the right functions directory and local ports (default API often `54321`).

### Step C — Link remote (read-only style usage for pull)

```bash
supabase login
supabase link --help
supabase projects list   # if available
```

Link to the correct project ref (the one you will baseline from).  
**Do not** run destructive remote commands. Goal is `db pull` / dump for baseline.

### Step D — Create the baseline migration

Goal: one (or a clear set of) migration file(s) that recreate the **full** schema on a empty local DB.

Typical approach (verify with current CLI help):

```bash
supabase db pull --help
# often something like: supabase db pull
```

That should create a new migration under `supabase/migrations/` with the remote schema.

Then:

1. Open the file; skim for sanity (tables you know: `profiles`, `clients`, `wallet_transactions`, `organizations`, etc.).  
2. Commit it with a clear name/message, e.g. baseline / schema snapshot.  
3. Update `supabase/migrations/README.md`:
   - What the baseline is  
   - That older hand-applied history is now represented by this snapshot for **local**  
   - That Production must **not** re-run baseline at cutover  
   - How naming works for **new** migrations after this  

**Existing dated migrations** already in the folder: decide one strategy and document it:

| Strategy | When to use |
|---|---|
| **A.** Keep old files + add baseline only if pull is empty-diff aware | If CLI history already aligns |
| **B.** Treat pull as the new source of truth for local reset; keep old files as historical archive (e.g. move to `migrations_archive/`) **only if** `db reset` is confusing | If reset applies duplicates / fails |
| **C.** Squash story: baseline is what `db reset` applies; document that remote Prod migration history differs | Common for “partial git history” repos |

Pick the smallest change that makes **`supabase db reset` succeed locally**. Document the choice in the migrations README so nobody “fixes” it twice.

### Step E — Start local stack and reset

```bash
supabase start
supabase status          # copy API URL + anon key + service role (local only)
supabase db reset        # applies migrations from scratch
```

Fix any migration errors before continuing (baseline must apply clean).

### Step F — Seed data (so the UI can log in)

Create `supabase/seed.sql` and/or enable seed in `config.toml` (per CLI docs), **or** a script `supabase/seed.mjs` that uses the local service role.

**Minimum seed (adjust to real table/column names from baseline):**

1. One **organization**  
2. One **dept_head** (or solo owner) profile linked to an Auth user  
3. Optional: one front_desk user, one client row  
4. Password you will use only on local (document in seed README, not Production passwords)

Ways to create Auth users locally:

- Supabase local Auth admin API with service role  
- Dashboard for local (Studio URL from `supabase status`)  
- SQL + auth schema only if you know what you are doing  

Document the exact steps in `supabase/migrations/README.md` or `supabase/seed/README.md`:

```text
After db reset:
1. … create users …
2. … seed.sql runs automatically / run npm run seed:local …
3. Log in at http://localhost:5173 with …
```

### Step G — Point the front end at local

Create `.env.local` (gitignored):

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from supabase status>
```

Restart Vite after changing env.

Confirm `src/lib/supabaseClient.ts` reads these vars (it already does). For local you **want** the env set so you do not accidentally hit the hardcoded Test/Production fallback URL.

### Step H — Serve Edge Functions locally

```bash
supabase functions serve --help
```

Serve at least:

- `make-server-980e1cbf`  
- `solo-desk` / `clients-list` if the screens you smoke use them  

Pass local env (CLI usually injects `SUPABASE_URL` + service role for local). If Vault/secrets RPCs fail locally (`get_secret`), note it: some features (push) may not work until you stub secrets — that is OK for Phase 1 as long as login + desk reads work. Document any stubs.

### Step I — Front ↔ back smoke (manual)

With `npm run dev` + functions serving + DB seeded:

1. Open the app → log in as seed user.  
2. Land on home / desk.  
3. Network tab: calls go to **local** host, not `*.supabase.co`.  
4. Hit one Edge-backed list (members / me / locations).  
5. Run Phase 0 smoke script against local base URL + a JWT from that login (copy access token from session/storage or Auth response).

### Step J — Generate DB types

```bash
supabase gen types --help
# typically: supabase gen types typescript --local > ...
```

Write to e.g. `src/lib/database.types.ts` or `supabase/database.types.ts`.  
**Do not delete** `src/lib/types.ts` in this phase — only add generated types for later use.

### Step K — Prove reset is repeatable

```bash
supabase db reset
# re-seed if not automatic
# functions still serving
# log in again
```

If this fails, Phase 1 is not done.

## 1.5 Phase 1 checklist (done when all checked)

- [x] `supabase/config.toml` committed  
- [x] Baseline (or documented reset strategy) applies with `supabase db reset`  
- [x] `supabase/migrations/README.md` updated (local workflow + “don’t re-apply baseline on Prod”)  
- [x] Seed path documented; can log into local UI  
- [x] `.env.local` documented (not committed) → local URL/anon  
- [x] Edge functions serve locally; app calls local API  
- [x] Manual front↔back: login + one desk/home screen + one Edge read  
- [x] Phase 0 smoke script runs successfully against local  
- [x] DB types generated (`src/lib/database.types.ts`)  
- [x] Second `db reset` + login still works  
- [x] Progress note under `docs/progress/`  
- [x] **Still no Production deploy**  

## 1.6 Out of scope for Phase 1

- Wallet RPCs (Phase 2)  
- Splitting `index.ts` (Phase 3)  
- CI (Phase 6)  
- Changing Production schema or Edge  

## 1.7 If you get stuck

| Problem | What to do |
|---|---|
| `db reset` fails on old migration files | Document strategy B/C above; make reset green before anything else |
| Functions crash on missing Vault secrets | Stub `get_secret` locally or seed Vault-like secrets; defer push tests |
| App still hits cloud URL | Check `.env.local` loaded; restart Vite; confirm Network host |
| Login works but API 401 | JWT not sent; or functions using wrong JWT secret — compare local anon/JWT settings from `supabase status` |
| Pull wants to change Production | Stop; `db pull` should only create local migration files. Do not `db push` in this phase |

---

## Handoff to Phase 2

You are ready for money RPCs when:

1. Phase 0 + 1 checklists are complete.  
2. You can reset local DB and click desk flows daily without dashboard archaeology.  
3. Contract fixtures exist so Phase 2 must keep the same JSON for wallet-related routes.

Next: [backend-implementation-plan.md](./backend-implementation-plan.md) → **Phase 2 — Money RPCs**.

---

## Progress (copy into a progress entry)

| Item | Status | Date |
|---|---|---|
| Phase 0 contract folder + routes.md | Done | 2026-11-17 |
| Phase 0 critical fixtures | Done (edge-source+types; local-verify in Phase 1) | 2026-11-17 |
| Phase 0 smoke script | Done (dry-run green; `--live` waits on Phase 1) | 2026-11-17 |
| Phase 0 Playwright on Mac | Done (bundled Chromium; no `/opt/pw-browsers` default) | 2026-11-17 |
| Phase 1 config.toml + baseline / reset green | Done (baseline dump + archive strategy) | 2026-11-19 |
| Phase 1 seed + local login | Done (`seed.sql`; Auth password grant OK) | 2026-11-19 |
| Phase 1 functions serve + UI against local | Done (serve + `/me` + smoke `--live`) | 2026-11-19 |
| Phase 1 generated DB types | Done (`src/lib/database.types.ts`) | 2026-11-19 |
| Phase 1 repeatable db reset | Done (second reset + login) | 2026-11-19 |
