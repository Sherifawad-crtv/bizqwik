# Client app integration — architecture (v1 spec)

**Status:** v1 scope agreed and frozen. Platform/back-end phases start now; the
client-app front-end is built against the incoming Figma-Make prototype repo
(`bizqwik-client-app`), which is UI-only (no auth/backend/data — pure mock).

Bizqwik sells a white-labeled **member (client) app**: a gym buys Bizqwik and
gets its own branded PWA at `<slug>.bizqwik.co` that its members use. It runs on
our **existing Supabase project + `make-server-980e1cbf`** — the same backend as
the business app and ops dashboard. `app_role` already includes `client`.

## Locked decisions

| Area | Decision |
|---|---|
| Backend | Shared. New `/client/*` group gated to `role=client`, like `/ops/*` for `bizqwik_team`. |
| Auth | Existing invite → branded signup, keyed to the member's **real email** (admin registers name+phone+email → invitation → member signs up, sets own password). Self-serve email reset, desk as fallback. |
| Domains | One PWA, `<slug>.bizqwik.co` per brand, branding resolved at runtime by hostname. |
| Payments | **None.** No top-ups, no gateway. Cash/card at desk = recorded label only. (Online later.) |
| Wallet | **EGP store credit.** Credit: refund-to-wallet + dept_head **compensation**. Debit: desk sale paid by wallet + **in-app class booking** paid by wallet. Credit **expires 12 months** (FIFO). No top-ups, no points→wallet. |
| Points | Symmetric rate **(B)**: one per-org `points_per_egp` (5/10/15/20), set by ops at onboarding, editable later. **Earn:** flat **1 pt per check-in** (fixed) + `EGP × rate` on **desk purchases** (membership/package/drop-in). **Not** earned on class bookings. **Redeem:** desk-side **discount** on a renewal/new package, value `points ÷ rate` EGP; front desk applies at sale. No in-app redemption. |
| Classes | Dept_head creates dated **classes** (title, description, date, time, **price**); uncapped; no staff/slot management. Members book in-app. |
| Booking pay | **Wallet now** (in-app debit) **or pay-at-desk** (cash/card on arrival). Cancel → refund to wallet or at desk. |
| Staff view | An **activity feed** ("Karim booked the 6 PM class") for dept_head + front_desk, and a **Logs tab** = every event (booking / payment / check-in / arrived / no-show / refund / compensation / wallet & points movement). |
| Loyalty extras | Tiers, streaks, achievements — **cut** for v1. |
| Language | **English only** (no i18n yet). |
| Check-in | In-app "Check in" button opens the camera to scan the **desk QR** (encodes the org); QR is **not** a login. |

## System topology
Three front-ends (business app, ops `/bizqwik/*`, client PWA), one backend, one
DB. Identity per caller row: `profiles` (staff), `bizqwik_team` (ops), or a
`clients` row linked to an auth user (member).

## Data model (Phase 1, additive)

**Auth / identity**
- `clients.auth_user_id uuid null → auth.users(id)` — filled at activation (a
  client exists before it has a login).
- `client_invitations` (`id, org_id, client_id, email, invited_by→profiles, created_at`, unique `email`). Mirrors `staff_invitations`.

**Org config / branding**
- `org_branding` (1:1 org): `app_name, logo_url, icon_url, primary_color,
  onboarding_assets jsonb` (3 intro images), … Public-readable by slug.
- `org_settings` (1:1 org): `points_per_egp int` (5/10/15/20),
  `wallet_credit_ttl_months int default 12`. Ops-managed; editable later.

**Wallet (extend existing `wallets` + `wallet_transactions`)**
- Reuse `wallets(client_id, org_id, balance)` as the cached balance.
- Reuse `wallet_transactions(type credit|debit, amount, category, description)`.
  Add `expires_at timestamptz null` (set on **credit** rows) and
  `remaining numeric` for **FIFO consumption**; debits draw from oldest
  non-expired credit lots. A nightly/lazy sweep expires leftover `remaining`.
  Categories: `refund, compensation` (credit); `desk_sale, class_booking`
  (debit); `expiry` (system debit).

**Points (extend existing `points_ledger` + `points_balances`)**
- Reuse `points_ledger(points, reason)` (+/- entries) and
  `points_balances(total_points)`. `tier` stays but is unused in v1.
  Reasons: `checkin, purchase` (earn); `redeem_discount` (spend).

**Classes & bookings (new)**
- `classes` (`id, org_id, title, description, starts_at (date+time), price_egp, created_by→profiles, status active|cancelled, created_at`). Uncapped.
- `class_bookings` (`id, org_id, class_id, client_id, pay_method wallet|desk,
  pay_status paid|pending, attendance booked|arrived|no_show|cancelled,
  price_egp, booked_at`). Wallet bookings debit immediately (`paid`); desk
  bookings are `pending` until the front desk collects on arrival.

**Activity log (new)**
- `activity_log` (`id, org_id, actor_id null, subject_client_id null, type,
  amount numeric null, meta jsonb, created_at`) — append-only; every money /
  points / booking / attendance event writes one. Powers the feed + Logs tab.

RLS (defense-in-depth; edge function uses service role): a `client` reads/writes
only their own rows within their `org_id`; `org_branding` read is public.

## Client endpoints (`/client/*`)
- `GET /client/branding?slug=` — **public** pre-auth theming.
- `GET /me` — extended to return `client`.
- `GET /client/home` — membership status, wallet + points summary, upcoming classes.
- `GET /client/classes`, `GET /client/classes/:id`.
- `POST /client/classes/:id/book` — `{ payMethod: wallet|desk }`; wallet debits (popup if short).
- `GET /client/bookings`, `POST /client/bookings/:id/cancel` — refund to wallet (or flag desk refund).
- `POST /client/check-in` — `{ token }` from the desk QR → +1 point.
- `GET /client/wallet`, `GET /client/points` — balance + history.
- Profile via shared `/me/update`.

## Business-app / backend additions (this repo)
Most of the money/ops logic lives here, not the client app:
- **Ops:** `org_settings` (points rate) + branding fields/asset upload on org create/detail.
- **Front desk / dept_head:** payment selector (cash/card/wallet) on every sale;
  **refund → wallet or desk**; **compensation** (dept_head); collect **pay-at-desk**
  bookings; mark **arrived/no-show**; **class** CRUD (dept_head); activity **feed** + **Logs** tab.
- **Points/wallet accrual** wired into existing sale endpoints (`/clients`,
  `/memberships/sell`, `/drop-ins`) and check-in.

## Client app v1 screens (from `bizqwik-client-app`)
Keep/reshape: Intro (3 screens + Skip + per-brand assets), Login (email+password,
branded), Home (classes + membership + wallet/points + Check-in), Classes
(list/detail/book: wallet or pay-at-desk/success), MyBookings (+ cancel),
Membership, Wallet (balance + ledger), Points (balance + earn history + "≈X EGP
off next renewal"), QR check-in, Profile/Personal info, Notifications feed.
Cut: Preferences, Linked Gyms, Payment methods (→ wallet only), instructors/
reviews/slots, tiers/streaks/achievements.

## White-label / PWA
Runtime theming by host; **dynamic `/manifest.webmanifest`** per host; per-host
`apple-touch-icon`/head injection (needs host-aware serving — the prototype is
Vite/Vercel-friendly); wildcard `*.bizqwik.co` DNS+TLS makes new brands
zero-touch; Supabase redirect allowlist `https://*.bizqwik.co/**`.

## Phasing
1. **Schema** (this repo + DB) — everything in *Data model* above; advisors clean.
2. **Backend** — signup `client` branch; `/me` client; `/client/*`; wallet/points
   engines (accrual, FIFO expiry, redemption, symmetric rate); classes/bookings;
   activity log; RLS.
3. **Business app** — payment selector, refunds, compensation, class CRUD,
   pay-at-desk collection, arrived/no-show, feed + Logs; ops points rate + branding.
4. **Client app** — integrate the repo: auth, branded signup/login, host branding
   + dynamic manifest/head, the v1 screens wired to `/client/*`.
5. **Verification** — pg_net + mocked Playwright per phase.

## Parked (revisit before building)
Rewards **perks catalog** (free passes / upgrades). Online payments. Native app.

## v1 default awaiting only correction
**Arrived/no-show:** front desk marks a booking arrived/no-show; a member's
check-in on the class date may auto-mark arrived. (Assumed, easily changed.)
