# 0013 — Services model: schema + backend (edge function v46)

## What changed

Group training is now sold as **one active group plan per member**:

| Plan | What it covers | Duration |
|---|---|---|
| All-access membership (`group_plan_types.kind = membership`) | every class | N calendar months from purchase (founder sets N) |
| Class monthly (`group_plans.kind = class_monthly`) | every session of one class series | 1 month, price = the series' monthly price |
| Class bundle (`kind = bundle`) | N class credits, usable on any class | N months from purchase (founder sets both) |

- A member can't buy, renew or switch while a plan is active. The API enforces this, and so does a partial unique index (`group_plans_one_active_per_client`).
- A plan finishes lazily when it expires or when a bundle's last credit is used.
- Private training (packages) is unchanged and can run alongside a group plan.
- Anything a plan doesn't cover is a **drop-in** at the class's drop-in price. If a plan is still active, the API returns `409 active_plan_confirm` (with `activePlan` and `coveredByPlan`) until the caller re-sends with `confirmActivePlan: true`. This drives the "you still have X going on" popup, in the member app and at the desk alike.

### Recurring classes
- The `class_series` table stores weekdays, a local start time, a drop-in price and a monthly price.
- Sessions are generated 6 weeks ahead in the org's timezone (DST-correct) and topped up lazily whenever a schedule is read. The effect is "month to month until someone changes it".
- Editing a series regenerates only future sessions without seats. Sessions that already have seats keep their time and price, but take the new name.
- Ending a series removes its future sessions that have no seats.

## Endpoints (v46)
- **dept_head:**
  - `GET/POST /class-series`, `/class-series/update`, `/class-series/end`
  - `GET/POST /plan-types`, `/plan-types/update` (incl. `active` on/off sale), `/plan-types/delete` (blocked once sold)
  - `GET /revenue?months=N`: revenue by month, service, type and coach; coach payouts and profit (revenue − payouts); active subscribers; outstanding wallet credit.
- **front_desk:**
  - `POST /group-plans/sell`: existing or new member, cash / card / wallet.
  - `POST /drop-ins` now also takes `classId` (a seat in that session at its drop-in price) as well as a generic walk-in.
- **both:** `GET /group-plans/client/:id`.
- **member app:**
  - `GET /client/plans`: active plan, history, offers, wallet, `canBuy`.
  - `POST /client/plans/buy`: wallet only.
  - `/client/classes` and `/client/home` now return `coverage` per session.
  - `/client/classes/:id/book` resolves plan vs drop-in; a bundle spends one credit.
  - Cancelling a plan-covered seat returns the credit.
- **Rewired:**
  - Check-in eligibility = active group plan OR active PT package.
  - Invitations draw from the active plan.
  - `/clients` rows carry `groupPlan`.
  - `/classes` is windowed (last 14 days onward) and carries seat counts by coverage.

## Revenue rules
- Revenue is counted at the moment of sale, whatever the tender. Wallet top-ups are not revenue, because the sale they're later spent on is. Sources:
  - PT package `price_at_sale`
  - group plan `price_at_sale`
  - `drop_ins.price`
  - paid app drop-in bookings that aren't linked to a `drop_ins` row
- A desk class drop-in writes both a sale and a roster seat, linked by `class_bookings.drop_in_id` (migration 02), so it's never counted twice.

## Verified live (disposable dept_head / front desk / member in the `test` org, all removed after)
- Series generation:
  - 20:00 Cairo local on every chosen weekday.
  - Tonight's already-past slot was skipped.
  - Validation and role gates held.
- **Money flow:**
  - A 1000 wallet top-up.
  - A wallet drop-in with no plan (200).
  - A bundle bought with the wallet (350).
  - A second buy was blocked in both the member app and at the desk.
  - A bundle seat on Yoga and one on Boxing (credits 2→0, across different classes). The plan then showed as finished.
  - Cancelling returned the credit and re-activated the bundle.
  - A forced drop-in returned 409 until confirmed, then 200.
  - The desk class drop-in was flagged, then succeeded with confirm, and showed on the roster as `drop_in`.
  - Walk-in, check-in eligibility, and the invitation allowance all checked out.
- **Revenue reconciled by hand:** class drop-ins 620, bundle 350, walk-in 150, total 1,120. Wallet liability 250. Front desk is forbidden from `/revenue`.
- Series edit and end behaved as described above.

## Pending
- **Next deploy:** a desk class drop-in now rolls back its sale (and refunds a wallet payment) if the roster seat can't be written. Found when a series edit removed the session mid-request. It's in the source but not deployed yet. It ships with the Phase 3 backend deploy.
- Legacy `membership_types` / `membership_instances` / `/memberships/sell` stay until the business app switches to plans (Phase 3), then get removed.

## Phase 3 — business app (branch `claude/services-model`)
- **dept_head, now the founder view:**
  - Overview is a money dashboard. It shows this month's revenue, profit and payouts, a 3/6/12-month revenue vs coach payouts chart, and breakdowns by service, by type and by coach. It also shows active subscribers and unspent wallet credit.
  - Nav is Overview · Coaches · Clients · Catalog · History.
  - Team & tiers moved under Coaches, and Activity moved under History.
- **Catalog:**
  - Group classes: a weekday picker, start time, length, drop-in price and monthly price. Classes can be edited or ended.
  - Memberships and class bundles: priced in months and credits, with an on-sale/off-sale toggle.
  - PT bundles.
  - Sessions & rosters live under it.
- **FAB:** a "Create" menu (group class, class bundle, membership, PT bundle). The dept_head's client wizard is removed, and Clients is read-only apart from edit, delete and compensation.
- **Front desk:**
  - Sells group plans: catalog plans plus each class's monthly.
  - Drop-In has a CLASS SESSION mode (the member lands on the roster) alongside WALK-IN, with the "plan still running, charge anyway?" confirm.
  - Rosters show plan vs drop-in seats.
- e2e: 9/9 (services spec, 6 tests).

## Phase 4 — member app (branch `claude/services-model`)
- **Home:** a current-plan card and a 7-day schedule with "On your plan" coverage.
- **Booking sheet:** book on the plan (a bundle spends a credit) or pay as a drop-in. The server's `active_plan_confirm` becomes the "You still have a plan running" dialog.
- **My plan:** the active plan, any PT package, and a shop. Purchases are paid from the wallet, and the shop is locked while a plan runs.
- **Bookings:** show plan vs drop-in. Cancelling returns bundle credits.
- e2e: 10/10 (plans spec, 4 tests).

## Release plan
Merge both branches together. After that, one backend deploy ships the drop-in rollback hardening and removes the legacy `membership_types` / `/memberships/sell` endpoints. The old production front desk still calls those until the merge.
