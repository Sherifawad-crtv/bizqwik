# Frontend issues — audit

**Branch:** `dev` at `f701a79` (12 Nov 2026) · **Scope:** `src/`, `index.html`, `public/`, frontend tooling.
Backend (`supabase/`) is out of scope here.

Build and type-check pass. `npm run lint` (oxlint) reports **77 warnings**: 75 in `src/` and 2 outside it.

## Summary

| # | Issue | Severity | Where (main hotspots) |
|---|---|---|---|
| 1 | Lazy-loaded screens are pulled back into the main bundle | High | `Fab.tsx`, `FrontDeskHome.tsx`, `CheckIn.tsx`, `Members.tsx`, `Catalog.tsx`, `Manage.tsx` |
| 2 | Styling is ~all inline; no type, spacing or radius scale | High | Every screen; worst in `ops/OrgDetail.tsx`, `Oversight.tsx`, `PayeeDetail.tsx` |
| 3 | Data layer refetches every open screen after any save | Medium (High at scale) | `lib/useAsync.ts`, `lib/bus.ts`, `lib/backend.ts:155` |
| 4 | Hook correctness: missing deps, setState in effects, impure render | Medium | 6 + 19 + 9 + 6 locations (listed below) |
| 5 | 16 hook-dependency warnings silenced with disable comments | Medium | 16 files |
| 6 | Remaining oversized components | Medium | `ops/OrgDetail.tsx`, `frontdesk/ClassCalendar.tsx`, `Oversight.tsx` |
| 7 | Hand-written API types, one big API client | Medium | `lib/types.ts`, `lib/backend.ts` |
| 8 | Files mixing components with helpers (breaks fast refresh) | Low | 16 files, 32 exports |
| 9 | Dead code | Low | `frontdesk/Bookings.tsx:125` |
| 10 | Config / tooling | Low–Medium | `lib/supabaseClient.ts`, `playwright.config.ts`, `package.json`, `.oxlintrc.json` |

Already fixed on `dev` (no action needed): the five 700–950-line screens were split into feature folders
(`routes/accounting/`, `catalog/`, `clients/`, `manage/`, `frontdesk/members/`), there's now a shared
`.bq-btn` button class, and a first-download size budget (`npm run size`).

---

## 1. Lazy loading is defeated by re-exports — High

`App.tsx` loads every screen with `lazy()`, but several screen files also **re-export** sheets and hooks
from their feature folders. Other files import those through the screen file, so the whole screen
lands in the main bundle anyway. The build prints `INEFFECTIVE_DYNAMIC_IMPORT` for five screens. The main chunk
is **481 KB (147 KB gzip)**.

| Screen pulled into the main bundle | Re-exported from | Imported by |
|---|---|---|
| `routes/Manage.tsx` | lines 7–9 (`TierSheet`, `BundleSheet`, `BundlesPanel`, `InviteFlow`) | `components/Fab.tsx:7`, `routes/Catalog.tsx:6`, `routes/CoachesOverview.tsx:13` |
| `routes/Catalog.tsx` | lines 11–12 (`SeriesSheet`, `PlanTypeSheet`) | `components/Fab.tsx:6`, `routes/ClassesManage.tsx:20`, `routes/frontdesk/Bookings.tsx:10` |
| `routes/frontdesk/Members.tsx` | lines 20–22 (`useFrontDeskCatalog`, `useSellableCoaches`, `CreateClientSheet`, `ClientSheet`) | `CheckIn.tsx:14`, `CheckInList.tsx:10`, `DropIn.tsx:18`, `FrontDeskHome.tsx:19`, `Invitations.tsx:12`, `NewClientModal.tsx:4` |
| `routes/frontdesk/CheckIn.tsx` | exports `CheckIn`, `ConfirmCheckInSheet` | `FrontDeskHome.tsx:15,18`, `Members.tsx:15` |
| `routes/frontdesk/DropIn.tsx` | exports `DropIn` | `FrontDeskHome.tsx:16`, `Members.tsx:16`, `CheckIn.tsx:16` |

`FrontDeskHome.tsx:17` also imports `Invitations` statically.

**Fix:** import from the feature file directly (e.g. `routes/catalog/Classes`, `routes/frontdesk/members/offers`),
remove the re-exports from the screen files, and move the shared sheets (`ConfirmCheckInSheet`, the `DropIn` sheet)
out of the screen files.

---

## 2. Styling — High

`src` has **1,482 inline `style={{…}}` blocks** and only **137 `className` uses**. The colour, radius and motion
tokens in `src/index.css` are good, and the new `.bq-btn` / `.bq-row` / `.bq-hit` classes are a good start.
Everything else is retyped by hand.

### 2a. Inline styles per file (≥ 20)

| File | Inline styles |
|---|---|
| `routes/ops/OrgDetail.tsx` | 71 |
| `routes/Oversight.tsx` | 56 |
| `routes/PayeeDetail.tsx` | 44 |
| `routes/catalog/Solo.tsx` | 43 |
| `routes/clients/Sheets.tsx` | 40 |
| `routes/frontdesk/ClassCalendar.tsx` | 35 |
| `routes/ClassesManage.tsx` | 34 |
| `components/Fab.tsx` | 34 |
| `routes/frontdesk/FrontDeskHome.tsx` | 32 |
| `routes/catalog/Classes.tsx` | 29 |
| `routes/manage/TiersPanel.tsx` | 28 |
| `routes/frontdesk/Bookings.tsx` | 27 |
| `routes/accounting/PnlPanel.tsx`, `routes/accounting/ExpenseSheet.tsx`, `routes/Activity.tsx` | 26 each |
| `routes/frontdesk/members/ClientSheet.tsx`, `routes/frontdesk/PaymentRequests.tsx` | 25 each |
| `routes/ops/OpsShell.tsx` | 24 |
| `routes/frontdesk/SoloDropIn.tsx`, `routes/Money.tsx` | 23 each |
| `routes/ops/Team.tsx`, `routes/clients/Roster.tsx`, `components/RollupTable.tsx` | 22 each |
| `routes/accounting/Expenses.tsx` | 21 |
| `routes/frontdesk/DropIn.tsx` | 20 |

### 2b. The same style object copy-pasted

| Copies | Style | Should become |
|---|---|---|
| 75 | `font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)"` — most in `clients/Sheets.tsx` (6), `PayeeDetail.tsx` (5), `Money.tsx` (5), `Fab.tsx` (5), `ClassesManage.tsx` (4), `MoneyHero.tsx` (4) | `.bq-label` / `<Label>` |
| 34 | `font: "400 13px var(--font-mono)", color: "var(--ink-faint)"` | `.bq-meta` |
| 34 | `display: "flex", flexDirection: "column", gap: 10` | `<Stack gap={…}>` |
| 31 + 18 | `minWidth: 0, flex: 1` (same thing, keys in either order) | `.bq-grow` |
| 20 | Error box: `color: var(--danger-fg); background: var(--danger-bg); borderRadius: 14; padding: 10px 14px` — `clients/Sheets.tsx` (3), `catalog/Solo.tsx`, `ClassesManage.tsx`, `Activity.tsx`, `AccountProfile.tsx`, `Fab.tsx` (2 each), more | `<ErrorBox>` |
| 20 | Page title: `font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px"` | `.bq-title` / `<H1>` |
| 11 | `font: "700 20px var(--font-body)", letterSpacing: "-.01em"` | `.bq-h2` |
| 11 | `font: "700 16px var(--font-body)"` | `.bq-h3` |

### 2c. No type scale

There are **92 distinct inline `font:` declarations** across **23 font sizes**: 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22,
24, 26, 28, 30, 32, 34, 40, 44, 48, 52 and 56 px. Most usage sits at 11, 12, 13, 15, 16, 20, 26 and 30, so a 7–8 step scale
in `index.css` would cover nearly everything.

### 2d. No radius or spacing scale

- **Radius:** 164 raw numeric `borderRadius` values sit next to the `--r-*` tokens. `14` appears ~50 times with no token.
  Worst files: `Oversight.tsx` (8), `ClassCalendar.tsx` (6), `QrScanner.tsx` (6), `FrontDeskHome.tsx`, `Bookings.tsx`,
  `AccountProfile.tsx`, `Fab.tsx` (5 each).
- **Spacing:** `gap` values in use are 1, 2, 4, 5, 6, 8, 10, 12, 14, 16, 20, 22 and 40, plus a few computed ones. There's no `--space-*` token.

### 2e. Primary buttons rebuilt inline instead of `.bq-btn--primary`

- `routes/Welcome.tsx:55`
- `routes/frontdesk/FrontDeskHome.tsx:133`
- `routes/frontdesk/CheckInList.tsx:68`
- `components/QuickAction.tsx:8`
- `routes/clients/Filters.tsx:118` (badge, same pattern)

### 2f. Hard-coded colours

`#fff` / `#000` / custom hex in TSX:
- `components/QrScanner.tsx:143, 153, 160, 174` (dark camera overlay — could be `--overlay-*` tokens)
- `components/DateField.tsx:71`
- `components/ClassPhotoField.tsx:55`
- `components/TimeWheelField.tsx:65–66` (mask gradient, fine as-is)
- `routes/frontdesk/SoloDropIn.tsx:115`, `routes/catalog/Solo.tsx:150` (white QR background)
- `routes/ops/OrgQr.tsx:75–81` — printable HTML template with its own palette (`#16130f`, `#6b6459`, `#9a9186`) that doesn't match the app tokens

Raw `rgba()` in TSX (should be tokens): `components/Shell.tsx` (2), `RouteTransition.tsx` (3), `QrScanner.tsx` (3),
`BottomNav.tsx` (3), `Sheet.tsx` (3), and one each in `PullToRefresh.tsx`, `Switch.tsx`, `Fab.tsx`, `QuickAction.tsx`,
`ClassPhotoField.tsx`, `Welcome.tsx`, `FrontDeskHome.tsx`, `Bookings.tsx`.

### 2g. `index.css` housekeeping

- Two identical spin animations: `@keyframes bqSpin` (line 275, used by `components/Spinner.tsx:14`) and
  `@keyframes bq-ptr-spin` (lines 323–324, used by `components/PullToRefresh.tsx:120`). `components/Splash.tsx:18` builds a third spinner inline.
- Naming is mixed: camelCase keyframes (`bqSheetIn`, `bqFade`) next to kebab-case ones (`bq-ptr-spin`), and BEM classes (`.bq-btn--primary`) next to flat ones (`.bq-qa`, `.tabular`, `.no-select`).
- 6 `!important` remain (reduced-motion block and `.bq-qr-region video`). Those are acceptable, but don't add more.

---

## 3. Data layer refetches everything — Medium (High at scale)

- `lib/useAsync.ts` has no cache by design (comment at the top of the file).
- `lib/backend.ts:155` calls `bump()` after **every** POST, and `lib/bus.ts` also bumps on every `visibilitychange`.
- Every mounted `useAsync` subscribes to that version (`useSyncExternalStore`), so one save refetches every open query on every open screen.
  The recent `screenActive` change stops hidden screens refetching, which helps, but visible ones still refetch everything.
- `useAsync` builds its request key from `fn.toString()` plus `JSON.stringify(deps)`, which is fragile and its deps line is suppressed (`useAsync.ts:100`).

**Fix when scaling:** TanStack Query (or similar) with per-entity query keys and targeted invalidation.

---

## 4. Hook correctness — Medium

All of these come from `npm run lint`.

**Missing dependencies (6) — likely stale-value bugs:**
- `lib/auth.tsx:75` — missing `profile`
- `lib/auth.tsx:80` — missing `profile.role`, `org`, `profile`, `bizqwikTeam`
- `routes/catalog/Classes.tsx:174` — missing `current.id`
- `routes/catalog/Plans.tsx:142` — missing `current.id`
- `routes/frontdesk/members/ClientSheet.tsx:94` — missing `client`
- `routes/frontdesk/SoloHome.tsx:81` — `useMemo` depends on `bundleTypes`, which is a new array every render

**setState called synchronously inside an effect (19)** — causes an extra render; usually derive the value or set it in the event instead:
`lib/useLatch.ts:27`, `lib/useKeyboardInset.ts:13`, `lib/useSheetSuccess.ts:18`, `components/Segmented.tsx:70`,
`components/Splash.tsx:36`, `components/TimeWheelField.tsx:101`, `components/QrScanner.tsx:81`, `routes/Account.tsx:70`,
`routes/ops/OrgQr.tsx:33`, `routes/manage/Invites.tsx:97`, `routes/catalog/Classes.tsx:166`, `routes/catalog/Plans.tsx:135`,
`routes/clients/Sheets.tsx:230`, `routes/accounting/Expenses.tsx:48`, `routes/frontdesk/CheckIn.tsx:87`,
`routes/frontdesk/ClassCalendar.tsx:101`, `routes/frontdesk/DropIn.tsx:66`,
`routes/frontdesk/members/CreateClientSheet.tsx:61, 71`

**Impure calls during render (9)** — `Date.now()` / `new Date()` in render gives different results per render:
`routes/frontdesk/Bookings.tsx:59, 94`, `routes/frontdesk/CheckIn.tsx:110`, `routes/frontdesk/DropIn.tsx:58`,
`routes/frontdesk/FrontDeskHome.tsx:76`, `routes/frontdesk/SoloHome.tsx:99`, `routes/ClassesManage.tsx:72`,
`routes/clients/Overview.tsx:6`, `routes/clients/Filters.tsx:88`

**Refs read during render (6):** `lib/useLatch.ts:9, 10, 17, 18`, `components/QrScanner.tsx:53, 62`

---

## 5. Silenced hook-dependency warnings — Medium

oxlint applies `react-hooks/exhaustive-deps` by default, and 16 places switch it off with
`// eslint-disable-next-line react-hooks/exhaustive-deps`. Some are deliberate (run-once effects), but none says why,
so a real missing-dependency bug looks the same as an intentional one:

`lib/useAsync.ts:100`, `lib/header.tsx:36`, `lib/useSticky.ts:27`, `components/Sheet.tsx:148`,
`components/AddSessionSheet.tsx:55`, `components/RouteTransition.tsx:185`, `components/YearMonthStrip.tsx:14`,
`routes/PayeeDetail.tsx:44`, `routes/manage/People.tsx:86`, `routes/manage/TiersPanel.tsx:132`,
`routes/manage/BundlesPanel.tsx:120`, `routes/accounting/ExpenseSheet.tsx:69`, `routes/accounting/Recurring.tsx:104`,
`routes/clients/Sheets.tsx:45`, `routes/frontdesk/ClassCalendar.tsx:211`, `routes/frontdesk/members/ClientSheet.tsx:90`

**Fix:** review each one. Fix the real gaps (often with a ref or `useEffectEvent`-style callback), and add a one-line
reason to the ones that stay.

---

## 6. Remaining oversized components — Medium

| File | Lines | Inline styles | useState | Note |
|---|---|---|---|---|
| `routes/ops/OrgDetail.tsx` | 547 | 71 | 20 | Largest file in `src` now; the same split treatment as Members/Catalog would help |
| `routes/frontdesk/ClassCalendar.tsx` | 399 | 35 | 3 | |
| `routes/frontdesk/members/ClientSheet.tsx` | 365 | 25 | — | |
| `routes/Oversight.tsx` | 359 | 56 | 1 | Also exports 4 non-component helpers (lines 31, 45, 174, 201) |
| `components/Sheet.tsx` | 344 | — | — | Core primitive; fine but keep an eye on it |
| `routes/ClassesManage.tsx` | 334 | 34 | — | |
| `components/Fab.tsx` | 310 | 34 | — | Also the main source of the lazy-load leak (section 1) |

Multi-step forms still use many separate `useState`s: `ops/OrgDetail.tsx` (20) and `accounting/ExpenseSheet.tsx` (11).
A `useReducer` or a small form hook would be cleaner.

---

## 7. Types and API client — Medium

- `lib/types.ts` (545 lines, 58 exported types) is hand-written. Nothing checks it against the database or the edge
  function, so it can drift silently. Generate DB types with `supabase gen types` and derive API types from them.
- `lib/backend.ts` (431 lines, ~95 methods) is one `api` object covering every domain. Split it per domain
  (`api/clients.ts`, `api/accounting.ts`, …) to mirror the new feature folders.
- `lib/backend.ts:52` declares `PaymentRequest` inline on one line instead of in `types.ts`.
- `lib/native.ts:30` — the only `as any` in `src`.

---

## 8. Files mixing components and helpers (fast refresh) — Low

When a `.tsx` file exports both components and non-components, Vite reloads the whole page instead of hot-swapping.
There are 32 such exports across 16 files:

`routes/frontdesk/shared.tsx` (17, 45, 66, 74, 89, 218), `lib/locations.tsx` (19, 53, 60, 67, 113),
`routes/Oversight.tsx` (31, 45, 174, 201), `lib/header.tsx` (27, 32), `routes/catalog/shared.tsx` (4, 36),
`routes/ClassesManage.tsx` (40, 44), `routes/frontdesk/Members.tsx` (20 ×2), `lib/ownMonth.tsx:18`, `lib/auth.tsx:118`,
`lib/category.tsx:5`, `routes/ops/shared.tsx:60`, `components/Segmented.tsx:9`, `components/RouteTransition.tsx:30`,
`routes/frontdesk/NewClientModal.tsx:19`, `routes/accounting/Expenses.tsx:147`, `routes/frontdesk/members/partners.tsx:15`

**Fix:** move the hooks and helpers into sibling `.ts` files.

---

## 9. Dead code — Low

- `routes/frontdesk/Bookings.tsx:125` — `{false && solo && !muted && (…)}`, an edit button switched off permanently. Delete it or put it behind a real flag.

---

## 10. Config and tooling — Low–Medium

- `lib/supabaseClient.ts:6–9` — if `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing, it silently falls back to the
  **Test** project. A misconfigured production deploy would talk to test data without any error. Fail loudly instead, or only fall back in dev.
- `playwright.config.ts:6` — defaults to `/opt/pw-browsers/chromium` (a cloud-agent path). E2E tests won't run on a
  normal Mac unless `PLAYWRIGHT_CHROMIUM_PATH` is set; fall back to Playwright's bundled browser.
- `package.json` — no `engines` field and no `.nvmrc`; Vite 8 needs Node ≥ 20.19. The package is still named `"app"`, version `0.0.0`.
- `.oxlintrc.json` — every warning is non-blocking, so the 77 warnings never fail a build. Once they're cleared, promote
  the hook rules to `"error"` so they stay at zero.
- No CI runs `build`, `lint`, `size` or `test:e2e` on push.
- `README.md` still describes an internal calisthenics payout portal, not the current multi-tenant gym app.

---

## Suggested order

1. **Section 1** — fix the re-exports; quick, and a measurable bundle win.
2. **Section 10** — fail-loud Supabase config, local Playwright, add CI.
3. **Sections 4–5** — fix the 6 missing-dependency warnings first, review the 16 suppressions, then work through the rest.
4. **Section 2** — add type, spacing and radius tokens to `index.css`, then `Label`, `ErrorBox`, `Stack`, `Title` primitives.
   Those four alone replace ~250 inline blocks. Migrate file by file, starting with the table in 2a.
5. **Sections 6–8** — split `OrgDetail.tsx`, generate types, split `backend.ts`, separate helpers from components.
6. **Section 3** — replace the data layer when real traffic makes the refetching noticeable.
