# Edge route inventory (frozen — Current)

Source: `supabase/functions/make-server-980e1cbf/index.ts` + `src/lib/backend.ts`.
Auth column is approximate (what the handler checks first); see the route body for exact roles.

**Function slugs:** `make-server-980e1cbf` (main), `solo-desk`, `clients-list`.

Client form: `supabase.functions.invoke("<slug>/<path>")` — path below is what goes after the slug.

## make-server-980e1cbf

| Method | Path | Auth (approx.) | This PWA (`backend.ts`) |
|---|---|---|---|
| GET | `health` | none | not in this PWA backend.ts |
| POST | `signup` | anon / public | yes |
| GET | `me` | JWT · staff (role-gated in handler) | yes |
| POST | `me/update` | JWT · staff (role-gated in handler) | yes |
| GET | `push/vapid-public-key` | JWT · staff (role-gated in handler) | yes |
| POST | `push/subscribe` | JWT · staff (role-gated in handler) | yes |
| POST | `push/unsubscribe` | JWT · staff (role-gated in handler) | yes |
| POST | `push/test-admin` | JWT · staff (role-gated in handler) | not in this PWA backend.ts |
| POST | `push/daily-reminder` | JWT · staff (role-gated in handler) | not in this PWA backend.ts |
| GET | `tiers` | JWT · staff (role-gated in handler) | yes |
| POST | `tiers` | JWT · staff (role-gated in handler) | yes |
| POST | `tiers/update` | JWT · staff (role-gated in handler) | yes |
| POST | `tiers/delete` | JWT · staff (role-gated in handler) | yes |
| GET | `locations` | JWT · staff (role-gated in handler) | yes |
| POST | `locations` | JWT · staff (role-gated in handler) | yes |
| POST | `locations/update` | JWT · staff (role-gated in handler) | yes |
| POST | `clients/location` | JWT · desk staff | yes |
| GET | `bundle-types` | JWT · staff (role-gated in handler) | yes |
| POST | `bundle-types` | JWT · staff (role-gated in handler) | yes |
| POST | `bundle-types/update` | JWT · staff (role-gated in handler) | yes |
| POST | `bundle-types/delete` | JWT · staff (role-gated in handler) | yes |
| GET | `coaches` | JWT · desk staff | yes |
| GET | `invites` | JWT · staff (role-gated in handler) | yes |
| POST | `invites` | JWT · staff (role-gated in handler) | yes |
| POST | `invites/delete` | JWT · staff (role-gated in handler) | yes |
| GET | `profiles` | JWT · staff (role-gated in handler) | yes |
| POST | `profiles/assign-tier` | JWT · staff (role-gated in handler) | yes |
| POST | `profiles/remove` | JWT · staff (role-gated in handler) | yes |
| GET | `clients` | JWT · desk staff | yes |
| POST | `clients` | JWT · desk staff | yes |
| POST | `clients/update` | JWT · staff (role-gated in handler) | yes |
| POST | `clients/delete` | JWT · staff (role-gated in handler) | yes |
| POST | `packages` | JWT · desk staff | yes |
| POST | `clients/assign-coach` | JWT · desk staff | yes |
| GET | `front-desk/client-status/:id` | JWT · desk staff | not in this PWA backend.ts |
| POST | `check-ins` | JWT · desk staff | yes |
| POST | `drop-ins` | JWT · desk staff | yes |
| POST | `invitations` | JWT · desk staff | yes |
| GET | `front-desk/summary` | JWT · desk staff | yes |
| POST | `scan` | JWT · staff (role-gated in handler) | yes |
| POST | `packages/deliver` | JWT · staff (role-gated in handler) | yes |
| GET | `packages/by-coach/:coachId/:month` | JWT · staff (role-gated in handler) | yes |
| GET | `month/:month` | JWT · desk staff | yes |
| GET | `sessions/:coachId/:month` | JWT · desk staff | yes |
| POST | `sessions/add` | JWT · staff (role-gated in handler) | yes |
| POST | `sessions/edit` | JWT · staff (role-gated in handler) | yes |
| POST | `sessions/remove` | JWT · staff (role-gated in handler) | yes |
| POST | `settle` | JWT · staff (role-gated in handler) | yes |
| POST | `reopen` | JWT · staff (role-gated in handler) | yes |
| POST | `pay` | JWT · staff (role-gated in handler) | yes |
| GET | `pay/payments` | JWT · staff (role-gated in handler) | yes |
| GET | `ops/summary` | JWT · bizqwik_team | yes |
| GET | `ops/orgs` | JWT · bizqwik_team | yes |
| POST | `ops/orgs` | JWT · bizqwik_team | yes |
| GET | `ops/orgs/:id` | JWT · bizqwik_team | yes |
| POST | `ops/orgs/:id/status` | JWT · bizqwik_team | yes |
| POST | `ops/orgs/:id/mode` | JWT · bizqwik_team | yes |
| POST | `ops/orgs/:id/plan` | JWT · bizqwik_team | yes |
| POST | `ops/orgs/:id/delete` | JWT · bizqwik_team | yes |
| GET | `ops/team` | JWT · bizqwik_team | yes |
| POST | `ops/team/invite` | JWT · bizqwik_team | yes |
| POST | `ops/team/cancel-invite` | JWT · bizqwik_team | yes |
| GET | `ops/plans` | JWT · bizqwik_team | yes |
| POST | `ops/plans` | JWT · bizqwik_team | yes |
| POST | `ops/plans/update` | JWT · bizqwik_team | yes |
| POST | `ops/plans/delete` | JWT · bizqwik_team | yes |
| GET | `client/branding` | anon / public | member app |
| POST | `client/location` | JWT · client | member app |
| GET | `client/home` | JWT · client | member app |
| GET | `client/classes` | JWT · client | member app |
| POST | `client/classes/:id/rsvp` | JWT · client | member app |
| POST | `client/classes/:id/book` | JWT · client | member app |
| GET | `client/plans` | JWT · client | member app |
| POST | `client/plans/freeze` | JWT · client | member app |
| POST | `client/plans/buy` | JWT · client | member app |
| GET | `client/prices` | JWT · client | member app |
| POST | `client/payment-requests` | JWT · client | member app |
| POST | `client/payment-requests/:id/cancel` | JWT · client | member app |
| GET | `payment-requests` | JWT · desk staff | yes |
| POST | `payment-requests/:id/approve` | JWT · desk staff | yes |
| POST | `payment-requests/:id/reject` | JWT · desk staff | yes |
| GET | `client/bookings` | JWT · client | member app |
| POST | `client/bookings/:id/cancel` | JWT · client | member app |
| POST | `client/check-in` | JWT · client | member app |
| GET | `client/pt` | JWT · client | member app |
| GET | `client/wallet` | JWT · client | member app |
| GET | `client/points` | JWT · client | member app |
| POST | `client/points/redeem` | JWT · client | member app |
| GET | `client/notifications` | JWT · client | member app |
| POST | `client/notifications/read` | JWT · client | member app |
| POST | `client/push/subscribe` | JWT · client | member app |
| POST | `client/push/unsubscribe` | JWT · client | member app |
| POST | `push/client-reminders` | JWT · staff (role-gated in handler) | not in this PWA backend.ts |
| GET | `classes` | JWT · staff (role-gated in handler) | yes |
| POST | `classes` | JWT · staff (role-gated in handler) | yes |
| POST | `classes/update` | JWT · staff (role-gated in handler) | yes |
| POST | `classes/cancel` | JWT · staff (role-gated in handler) | yes |
| GET | `class-series` | JWT · desk staff | yes |
| POST | `class-series` | JWT · staff (role-gated in handler) | yes |
| POST | `class-series/update` | JWT · staff (role-gated in handler) | yes |
| POST | `class-series/end` | JWT · staff (role-gated in handler) | yes |
| GET | `plan-types` | JWT · desk staff | yes |
| POST | `plan-types` | JWT · staff (role-gated in handler) | yes |
| POST | `plan-types/update` | JWT · staff (role-gated in handler) | yes |
| POST | `plan-types/delete` | JWT · staff (role-gated in handler) | yes |
| POST | `group-plans/sell` | JWT · desk staff | yes |
| GET | `group-plans/client/:id` | JWT · desk staff | yes |
| GET | `payments/summary` | JWT · staff (role-gated in handler) | not in this PWA backend.ts |
| POST | `clients/import` | JWT · desk staff | yes |
| GET | `revenue` | JWT · staff (role-gated in handler) | not in this PWA backend.ts |
| GET | `accounting/categories` | JWT · dept_head / accountant | yes |
| POST | `accounting/categories` | JWT · dept_head / accountant | yes |
| POST | `accounting/categories/update` | JWT · dept_head / accountant | yes |
| GET | `accounting/expenses` | JWT · dept_head / accountant | yes |
| POST | `accounting/expenses` | JWT · dept_head / accountant | yes |
| POST | `accounting/expenses/update` | JWT · dept_head / accountant | yes |
| POST | `accounting/expenses/delete` | JWT · dept_head / accountant | yes |
| GET | `accounting/recurring` | JWT · dept_head / accountant | yes |
| POST | `accounting/recurring` | JWT · dept_head / accountant | yes |
| POST | `accounting/recurring/update` | JWT · dept_head / accountant | yes |
| POST | `accounting/recurring/delete` | JWT · dept_head / accountant | yes |
| POST | `accounting/run-recurring` | JWT · dept_head / accountant | not in this PWA backend.ts |
| GET | `accounting/pnl` | JWT · dept_head / accountant | not in this PWA backend.ts |
| GET | `classes/:id/bookings` | JWT · desk staff | yes |
| POST | `bookings/attendance` | JWT · desk staff | yes |
| POST | `bookings/collect` | JWT · desk staff | yes |
| POST | `clients/refund` | JWT · desk staff | yes |
| GET | `clients/refundable/:id` | JWT · desk staff | yes |
| POST | `clients/compensate` | JWT · staff (role-gated in handler) | yes |
| GET | `activity` | JWT · desk staff | not in this PWA backend.ts |
| POST | `client-invites` | JWT · desk staff | yes |
| GET | `ops/orgs/:id/config` | JWT · bizqwik_team | yes |
| POST | `ops/orgs/:id/branding` | JWT · bizqwik_team | yes |
| POST | `ops/orgs/:id/settings` | JWT · bizqwik_team | yes |

## solo-desk

| Method | Path | Auth | This PWA |
|---|---|---|---|
| GET | `org-settings` | JWT · staff | yes |
| POST | `org-settings` | JWT · staff | yes |
| POST | `drop-ins` | JWT · staff | yes (`soloDropIn`) |

## clients-list

| Method | Path | Auth | This PWA |
|---|---|---|---|
| GET | `clients` | JWT · staff | yes (fast path; falls back to main) |

## Contract rule

Do not rename these paths or their JSON keys without an expand/contract plan. See `docs/architecture/backend-guidelines.md`.
