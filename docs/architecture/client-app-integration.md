# Client app integration — architecture

**Status:** design agreed; platform/back-end phases can start now, client-app
front-end phases finalize against the client repo (incoming).

Bizqwik sells a white-labeled **member (client) app**: a gym buys Bizqwik and
gets its own branded PWA (e.g. `revolt.bizqwik.co`) that its members use to see
their membership, check in, and manage their account. The app lives in a
separate repo but runs on **our existing backend and database** — the same
multi-tenant Supabase project and `make-server-980e1cbf` edge function that the
business app and ops dashboard already use.

## Locked decisions

| # | Decision |
|---|----------|
| Backend | Shared. New `/client/*` endpoint group, gated to `role = client`, same pattern as `/ops/*` for `bizqwik_team`. |
| Auth | The existing staff/coach **invite → branded signup** flow, keyed to the client's **real email**. Admin registers the client (name, phone, email) → invitation → client signs up in the branded app and sets their own password. |
| Reset | Standard email-based self-serve reset (the existing `Forgot password` → `/reset-password` flow), branded per org. The **front desk is the human fallback** for members who can't. No SMS/email integration added. |
| Domains | One PWA codebase, **`<slug>.bizqwik.co`** per brand (`.co` = all tech/ops; `.com` is the internal team workspace and is unrelated). Subdomains created on GoDaddy per brand. |
| Branding | Resolved at runtime by hostname; set per org in the **ops dashboard** when a gym is onboarded. |
| Check-in | The desk's static QR **encodes the org** (a per-org check-in token); the signed-in member's scan posts a check-in to that org. |
| Native | Deferred — decided after reviewing the client app UI. |

## System topology

Three front-ends, one backend, one database:

- **Business app** (this repo) — staff: dept_head / head_coach / coach / accountant / front_desk.
- **Ops dashboard** (`/bizqwik/*` in this repo) — `bizqwik_team`.
- **Client app** (separate repo) — members, one branded origin per org.

All three call `make-server-980e1cbf`. Identity is decided by the caller's row:
a `profiles` row (staff), a `bizqwik_team` row (ops), or — new — a `clients`
row linked to an auth user (member). `app_role` already includes `client`.

## Data model additions (Phase 1)

Additive only; nothing existing changes.

- **`clients.auth_user_id uuid null references auth.users(id)`** — a client is
  created by staff *before* they have a login (and may never get the app), so
  the link is nullable and filled in at activation. A member sees exactly the
  `clients` row where `auth_user_id = auth.uid()`.
- **`client_invitations`** (`id`, `org_id`, `client_id`, `email`, `invited_by`,
  `created_at`, unique on `email` per the signup lookup). Mirrors
  `staff_invitations`. `invited_by` references `profiles(id)` (the admin who
  registered them).
- **`org_branding`** (1:1 with `organizations`): `app_name`, `logo_url`,
  `icon_url` (PWA/apple-touch source), `primary_color`, plus room to grow.
  Publicly readable by slug (the app themes *before* login).
- **`organizations.checkin_token`** (opaque, rotatable) — encoded in the desk
  QR so a scan can't be forged.

RLS (defense-in-depth; the edge function uses the service role and is the real
gate): a `client` may read/write only rows where the client is themselves and
`org_id` matches their client's org. `org_branding` read is public.

## Auth & lifecycle

1. **Register** — a front-desk/dept_head admin creates a client with name +
   phone + **real email**. This also creates a `client_invitation`.
2. **Activate** — the member opens the branded app and signs up with that email,
   setting their own password. Signup matches the invite, creates the auth user,
   sets `clients.auth_user_id`, deletes the invite. (Same shape as staff signup;
   the signup handler already branches invite → identity.)
3. **Use** — `/me` returns the `client` identity (no `profile`); the client app
   reads memberships, packages, check-in, wallet/points, profile.
4. **Reset** — self-serve email reset, branded; desk fallback.

Signup stays multi-identity: it already routes `bizqwik_team_invitations` →
team and `staff_invitations` → profile; we add `client_invitations` → client.

## Client endpoints (`/client/*`, sketch — finalized against the app)

- `GET /client/branding?slug=` — **public**, pre-auth theming (name, logo, icon, color).
- `GET /me` — extended to also return `client`.
- `GET /client/summary` — active membership/package, invitations left, wallet/points.
- `POST /client/check-in` — `{ token }` from the desk QR → resolve org → record.
- `GET /client/history` — check-ins / visits.
- Profile + password handled by the shared `/me/update` + Supabase auth.

Wallet/points already have tables (`wallets`, `wallet_transactions`,
`points_ledger`, `points_balances`) — surfaced read-only first.

## White-label / PWA strategy

Goal: **one deployed app, many domains, branding at runtime by hostname** — no
per-brand build.

- **Theming** — `host → GET /client/branding` → CSS variables + assets. Trivial.
- **Installable identity** — a **dynamic `/manifest.webmanifest`** keyed on host
  returns that brand's name/icons/theme (covers Android/Chrome).
- **iOS** reads `apple-touch-icon` from the served **HTML `<head>`**, which must
  vary per host — so the client app needs **host-aware serving** (an edge
  rewrite / function), not a dumb static bucket. The business app is on Vercel;
  if the client app is too, a Vercel edge/middleware handles per-host head +
  manifest cleanly. **This is the main technical constraint to confirm against
  the repo.**
- **DNS/TLS** — per-brand CNAME on GoDaddy → host with auto per-hostname TLS. A
  wildcard `*.bizqwik.co` (DNS + cert) would make new brands zero-touch; either
  works.
- **Supabase redirect allowlist** — email links redirect to the app origin; one
  wildcard entry `https://*.bizqwik.co/**` covers every brand.
- Service workers/caches are per-origin, so brands never collide.

## Provisioning (via the ops dashboard)

Onboarding a gym in `/bizqwik` sets its app identity in one place: subdomain
(= `organizations.slug`), `app_name`, logo/icon upload, primary color. DNS is
the only out-of-band step (manual GoDaddy CNAME, or covered by a wildcard).

## Phasing

1. **Schema** — `clients.auth_user_id`, `client_invitations`, `org_branding`, `checkin_token`; advisors clean.
2. **Backend** — signup `client_invitations` branch; `/me` returns `client`; `/client/*`; RLS; plan client-limit already enforced on client creation.
3. **Ops branding** — branding fields + logo upload on org create/detail.
4. **Client app integration** — against the repo: auth wiring, branded signup/login, host-based branding + dynamic manifest/head, screens.
5. **Verification** — pg_net backend suite + mocked Playwright, per phase.

## Open items (need the client repo)

- Client app **stack + hosting** (decides how per-host manifest/head injection is done).
- Its current **login/signup UI** (to match the branded flow) and any auth assumptions.
- **Native** app decision.
