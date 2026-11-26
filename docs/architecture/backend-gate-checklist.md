# GATE — Full local acceptance checklist

**Parent:** [backend-implementation-plan.md](./backend-implementation-plan.md)  
**Rule:** Do **not** cut over to Production if any box fails.  
**Stack:** local Supabase + local Edge + local Vite (`.env.local` → `http://127.0.0.1:54321`).

---

## Instructions for Claude / coding agent (run GATE with visible browser)

Paste this (or point the agent at this file) on the laptop where you will **watch** the browser:

> Run the GATE checklist in `docs/architecture/backend-gate-checklist.md`.  
> 1. Start local backend + frontend per **Bring-up** below (Docker must be running).  
> 2. Open the app in the **IDE browser** and keep it **visible** (`position: "active"` / side panel) so I can watch you click through.  
> 3. Work sections **B → M** in order using seed logins; tick pass/fail in the Pass/fail table as you go.  
> 4. Prefer real UI clicks over API-only checks for desk/money flows.  
> 5. Do **not** deploy to Production. Do **not** point `.env.local` at Production.  
> 6. After each section, take a screenshot so I can see the result.  
> 7. When stuck, note the failure in the Pass/fail table and continue to the next section.

### Agent browser rules

- Use Cursor’s browser tools (`browser_navigate`, `browser_snapshot`, `browser_click`, `browser_fill`, screenshots).  
- Always show the tab to the user: navigate with **visible** browser (`position: "active"` or `"side"`).  
- Lock the browser while automating; unlock when done or when the user wants control.  
- Base URL: `http://localhost:5173/` (Vite). API: `http://127.0.0.1:54321`.  
- Confirm Network never hits Production host `aylhnxniqrihpvrllpgz`.

---

## Seed logins (local only)

| Email | Password | Role | Expected home after login |
|---|---|---|---|
| `depthead@local.test` | `local-dev-password` | dept_head (+ founder/ops) | `/oversight` (or `/`) |
| `frontdesk@local.test` | `local-dev-password` | front_desk | `/` desk home |
| `client@local.test` | `local-dev-password` | member (seed client row only) | **See §K note** — staff Login expects a `profiles` row; pure members may hang on Sign in |

Org: **Local Dev Gym** · mode: **team** · location: **Main Floor**.

---

## Bring-up (local frontend + backend)

Do this in three terminals from the **repo root**. Requires **Docker Desktop** running.

### 0. Env files (once)

Frontend `.env.local` (gitignored; must exist):

```bash
# .env.local
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from `supabase status` — local demo key is fine>
```

Edge env (gitignored under `supabase/`):

```bash
# supabase/functions/.env.local
MONEY_RPC=1
```

If anon key is missing, after `supabase start` run `supabase status -o env` and copy `ANON_KEY`.

### 1. Database + API

```bash
supabase start
supabase db reset          # applies baseline + money RPCs + seed.sql
```

Expect: migrations `20261119_00_baseline_from_remote.sql` and `20261119170601_money_rpcs.sql` apply; seed users created.

### 2. Edge Functions

```bash
MONEY_RPC=1 supabase functions serve --no-verify-jwt --env-file supabase/functions/.env.local
```

Expect log lines serving:

- `make-server-980e1cbf`
- `clients-list`
- `solo-desk`

Quick check:

```bash
curl -sS -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  http://127.0.0.1:54321/functions/v1/make-server-980e1cbf/health
# → {"status":"ok",...}
```

### 3. Frontend

```bash
npm install   # if needed
npm run dev
```

Open **http://localhost:5173/** (agent: open this URL in the visible browser).

### 4. Automated backend suite (section A)

```bash
npm run backend:verify          # dry fixtures
npm run backend:verify:live     # smoke health+me + money concurrency (needs serve up)
# or full reset+serve+live:
npm run backend:verify:ci
```

---

## A. Backend (automated)

- [x] `supabase db reset` finishes with no migration errors  
- [x] `functions serve` boots all three: `make-server-980e1cbf`, `solo-desk`, `clients-list`  
- [x] `npm run backend:verify` (dry) green  
- [x] `npm run backend:verify:live` green (health + me + money concurrency)  
- [x] Focused tenant check: compensate/check-in with a random UUID → **404** “No such client” (not 200)  
- [x] Optional / GATE-heavy: full `tenant-isolation.ts` phased run if you have time  

---

## B. Auth & session

Sign in as **dept_head**, then **front_desk**. Test **client** under §K (different outcome).

Start at `http://localhost:5173/welcome` → **Login**, or go straight to `/login`.

- [x] Login as `depthead@local.test` → lands on oversight / staff home  
- [x] Login as `frontdesk@local.test` → lands on front-desk home (`/`)  
- [x] Wrong password shows a clear error (e.g. “Invalid login credentials”) — no blank screen  
- [x] Logout (Account → Sign out) clears session; protected routes bounce to login  
- [x] Refresh while logged in still works (session persists)  
- [x] DevTools Network: `/me` returns 200 with `profile`, `orgMode`, `org`, `tier`, `bizqwikTeam`, `client`  

**Note:** The `/login` screen is the **staff** “Attendance & payout portal”. Seed `client@local.test` has a `clients` row + auth user but **no** `profiles` row, so after Auth succeeds the app may stay on Sign in with no redirect (Login only navigates when `profile` or `bizqwikTeam` is set). That is expected for this seed — document under §K; do not fail staff GATE solely for that.

---

## C. Desk — members / clients list

As **front_desk** (or dept_head in solo — seed is team, so prefer front_desk).

- [x] Members / clients list loads (prefer `clients-list` slug; fallback to main `/clients` OK)  
- [x] Seed client **Local Client** appears  
- [x] Opening a client shows package / membership / group plan fields without crash  
- [x] Network: no repeated 401/403/500 storms while idle on the list  

---

## D. Desk — check-in

As **front_desk**.

- [x] Manual check-in for a client **with** an active plan/package succeeds (or clear domain message)  
- [x] Check-in for client **without** plan returns familiar error (`no_plan` or equivalent UI copy)  
- [x] Invalid / other-org-looking id does not succeed  
- [x] After success, activity / status reflects the check-in  

---

## E. Desk — drop-in

As **front_desk**.

- [x] Cash/card drop-in for existing client succeeds; receipt/list updates  
- [x] Wallet drop-in with enough balance succeeds  
- [x] Wallet drop-in with empty wallet → `insufficient_wallet` / UI message unchanged  
- [x] If client has active group plan, drop-in asks confirm → `active_plan_confirm` path still works  
- [x] Creating drop-in via **newClient** (name/phone/email) works when used  

---

## F. Money — package / plan sale + wallet

As **front_desk** / **dept_head** as roles allow.

- [x] Sell PT package with **cash/card**  
- [x] Sell PT package with **wallet** when balance covers it  
- [x] Wallet sale when balance too low → `insufficient_wallet` (do not rename code)  
- [x] Sell group plan (catalog type) cash path  
- [ ] Member (`client@local.test`): book/buy path if UI exposes it; wallet insufficient still same code  

---

## G. Money — refund / compensate

As **dept_head** (compensate); front_desk for refund if allowed.

- [x] Compensate credits wallet; balance increases  
- [x] Refund to **wallet** succeeds within refundable amount  
- [x] Refund above refundable → `refund_too_large`  
- [x] Refund to **desk** logs without crashing  
- [x] Unknown client id → 404 “No such client”  

---

## H. Accounting / money screens

As **dept_head** (seed has no separate accountant — use dept_head).

- [x] Revenue / accounting overview loads  
- [x] P&L or month view returns data shape UI expects (no blank error)  
- [x] Expenses list / add expense (if used) works for a small amount  
- [x] No 5xx on first load of money screens  

---

## I. Catalog / locations / settings (smoke)

As **dept_head**.

- [x] Bundle types / membership or plan catalog lists load  
- [x] Locations list shows **Main Floor**  
- [x] Org settings / branding screens open without 500  

---

## J. Ops (`/bizqwik`) — if you use it

Seed dept_head is also in `bizqwik_team`.

- [x] Ops route loads for founder/team user  
- [x] Org list / invite staff screens do not 500  
- [x] Non-ops user cannot access ops (403 / redirect)  

---

## K. Member app (client)

As `client@local.test` / `local-dev-password`.

**Known local limitation (record Pass/Fail honestly):**

This Vite app’s `/login` is staff-oriented. A pure member (auth user linked only via `clients.auth_user_id`, no `profiles` row) often **does not** enter a separate member UI after Sign in — you may see a stuck “Signing in…” or remain on the login card with no staff home. That is **not** the same surface as dept_head / front_desk.

- [x] Attempt member login; record what happens (redirect vs hang vs error)  
- [ ] If a member surface appears: wallet / points / plan status visible  
- [ ] If a member surface appears: book/buy path does not 500  
- [ ] If a member surface appears: notifications load  
- [x] If no member UI: mark section **Blocked / N/A for staff GATE** and note “member portal not entered via `/login` with current seed” — still finish staff sections  

Do **not** invent a Production deploy to “fix” this; note the gap for a follow-up if GATE otherwise passes.

---

## L. Error contract (must not drift)

Confirm UI still branches on these **codes** (trigger once each if easy):

- [x] `insufficient_wallet`  
- [x] `active_plan_confirm` (409)  
- [x] `refund_too_large`  
- [x] Unauthorized → 401 `{ error }` on `/me` without JWT  

---

## M. Console / network hygiene

On happy paths above:

- [x] No continuous polling 4xx/5xx  
- [x] No CORS failures against `127.0.0.1:54321`  
- [x] No accidental calls to Production URL (`aylhnxniqrihpvrllpgz`)  

---

## N. Front-end package

- [x] `npm run build` succeeds  
- [ ] Decide: Production cutover needs **app** deploy?  
  - If only Edge + money migration changed and contract held → **Edge + migrations only**  
  - If `backend.ts` / types / env guard / UI changed → note app deploy too  

---

## O. Cutover prep (after all above green)

- [ ] Tag commit `backend-target-local-green`  
- [ ] Save / tag current Production Edge as `edge-known-good`  
- [ ] List **new** migrations for Production:  
  - `20261119170601_money_rpcs.sql` (functions — not baseline re-apply)  
- [ ] Written rollback owner + steps (rollback Edge first)  
- [ ] Prefer low-traffic window  

---

## Pass / fail

Agent: fill this table as you finish each section. Use `Pass` / `Fail` / `N/A` + a short note.

| Section | Pass? | Notes |
|---|---|---|
| A Backend automated | Pass | Fresh DB via `supabase start` (baseline + money RPCs + seed, no errors); 3 functions serve; verify dry + live green; random UUID → 404 on compensate + check-in. Full `tenant-isolation.ts` run locally (all phases): 122 attacks + 190 table reads, 0 failures, gym B unchanged. |
| B Auth (staff) | Pass | depthead → `/oversight`, frontdesk → `/`; wrong password → "Invalid login credentials"; sign out bounces `/oversight` → `/login`; refresh keeps session; `/me` 200 with all 6 keys. |
| C Members list | Pass | Loads via `clients-list` (all 200); Local Client listed; client sheet opens. |
| D Check-in | Pass | Check-in with active plan recorded; no plan → 400 `no_plan` (UI offers plan/PT/drop-in sale); random id → 404. |
| E Drop-in | Pass | Cash, wallet and newClient drop-ins recorded; empty wallet → `insufficient_wallet`; active plan → 409 `active_plan_confirm` popup → charge anyway works. newClient needs an email. |
| F Wallet sales | Pass | PT cash + wallet, group plan cash + wallet; low balance → "Wallet balance doesn't cover…". PT needed a coach: seed now adds `coach@local.test`. Member buy path N/A (see K). |
| G Refund / compensate | Pass | Compensate +1000; refund to wallet and desk OK; over refundable → `refund_too_large`; unknown client → 404. |
| H Accounting | Pass | P&L, Money, Overview load; 50 EGP expense added. |
| I Catalog / settings | Pass | PT bundle + membership created; `/locations` → Main Floor; org/branding page opens. UX: new PT bundle "Expires after" shows 45 as placeholder only, so first save fails. |
| J Ops | Pass | `/bizqwik` overview, org page, team load for founder; front_desk redirected from `/bizqwik`, `/ops/orgs` → 403. |
| K Member app | Pass | Login behaves as documented: `client@local.test` sign-in stays on the Sign in card with no error (no `profiles` row). Member wallet, booking and notifications not reachable with the current seed, so not tested. |
| L Error codes | Pass | `insufficient_wallet`, `active_plan_confirm` (409), `refund_too_large`, `/me` without JWT → 401 `{error}`. |
| M Network hygiene | Pass | No production host calls, no CORS errors, no console errors; only 4xx were intentional tests. |
| N `npm run build` | Pass | Build succeeds (dynamic-import warnings only). Cutover deploy decision not made. |
| O Cutover prep | | |

**GATE green** when every **required** staff/backend row is Pass. §K may be N/A with a written note. Then proceed to CUTOVER in the parent plan.

### Suggested paste to Claude on the other laptop

```
Open docs/architecture/backend-gate-checklist.md and execute GATE.

Start Docker, then bring up supabase + Edge (MONEY_RPC=1) + npm run dev per the Bring-up section.
Open http://localhost:5173/ in the Cursor browser where I can see it (visible/active tab).
Walk sections A–O, clicking through the UI for staff flows (depthead + frontdesk).
Fill the Pass/fail table. Do not deploy Production. Screenshot as you go.
```
