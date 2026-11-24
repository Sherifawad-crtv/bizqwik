# Bizqwik design system

**Read this before building or changing any screen.** Every piece of UI comes
from the library below, every value from a token. `npm run check` enforces it.

The app follows Apple's Human Interface Guidelines for behaviour and motion
(not for looks): iOS-style transitions, press feedback, sheets and tab bar.

---

## 0. Where things live

```
src/
  app/            the frame: routes (App), Home, Shell, BottomNav, Sidebar,
                  RouteTransition, PullToRefresh, Splash, Fab, guards
  design-system/
    tokens/       tokens.json  ← the ONLY place design values are edited
                  tokens.css / tokens.ts  ← generated (npm run tokens), never edit
    components/   the library: brand-agnostic building blocks (Card, Button, Sheet…)
    motion/       motion scale (motion.ts), useTween, useReducedMotion
    hooks/        device hooks (useIsMobile, useKeyboardInset, useSticky)
    theme.ts      setBrandColor(): recolour the app from one hex
    styles.css    all design-system CSS in cascade order: base, interaction,
                  typography, layout, then one Name.css per component
  shared/
    components/   business pieces used by two or more features (PlanPill, ClassSheet…)
    api/          backend client, useAsync, Supabase client
    screen/       screen plumbing: useSetHeader, floating actions, Back, nav
    …             types, auth, format, months, locations, other cross-feature code
  features/       one folder per business area: auth, account, coaches, clients,
                  frontdesk, catalog, classes, money, accounting, manage, ops
```

**Import rules** (`npm run ds` fails otherwise):
- A feature uses `design-system/` and `shared/`, and its own folder. Never another
  feature, never `app/`.
- `shared/` never uses `features/` or `app/`.
- `design-system/` never uses `features/`, `app/` or `shared/components/`.
- `app/` may use anything (it puts the screens together).

**Where a new piece goes:**
- Likely to be used on more than one screen or by more than one feature → the
  library (`design-system/components/`) if it's a generic building block, or
  `shared/components/` if it's a business piece. Add it to the directory below in
  the same change.
- Otherwise it stays in its feature folder. When a second feature needs it, it's
  audited and moved up (never imported across features).

---

## 1. Foundations (tokens)

All values come from `src/design-system/tokens/tokens.json` (W3C Design Tokens
format). Style Dictionary generates `tokens.css` (CSS variables) and `tokens.ts`
(constants for code). **Never type a raw value that a token covers**: no hex, no
rgba, no hand-picked shadow.

Two layers:
- **Primitives** (`--primitive-color-brand-500`, `--primitive-color-neutral-100`…):
  raw values with no meaning. **Screens never use them.**
- **Semantic tokens**: say what a value is for and point at primitives. This is
  what screens use.

### Colour: `color-[ui element]-[priority]-[state]`

| Part | Values |
|---|---|
| UI element | `bg-canvas` (page), `bg-surface` (cards, sheets), `bg-fill` (buttons, controls, tints), `bg-overlay` (scrims), `bg-media` (camera), `bg-qr`, `text`, `icon`, `border`, `mask` |
| Priority | `primary` · `secondary` · `tertiary` · `accent` (brand) · `on-fill` / `on-media` (on top of a fill / the camera) · `success` `warning` `danger` `info` · `status-paid` `status-logging` `status-settled` `status-frozen` `status-danger` |
| State | `default` · `active` (pressed) · `selected` · `hover` · `disabled` (+ a few variants: `strong`, `translucent`, `glass`) |

The state is always written, even when it's `default`.

| Token | Use |
|---|---|
| `--color-bg-canvas-default` | page background |
| `--color-bg-canvas-translucent` / `-translucent-strong` | title bar / sticky header over scrolling content |
| `--color-bg-surface-primary-default` | cards, sheets, floating containers |
| `--color-bg-surface-secondary-default` | inner fills: segmented tracks, search fields, neutral tags |
| `--color-bg-surface-glass-default` | frosted tab bar |
| `--color-bg-fill-primary-default` / `-active` | primary button, active control, chart bars / pressed |
| `--color-bg-fill-accent-default` / `-selected` / `-active` / `-strong` | soft brand tints / selected item / highlighted band / decorative light brand |
| `--color-bg-overlay-default` / `-dim` / `-photo` | sheet scrim / screen underneath a push / fade over a photo |
| `--color-text-primary-default` / `secondary` / `tertiary` | text: primary, secondary, tertiary (icons: `--color-icon-*`) |
| `--color-text-on-fill-default` | text on a primary fill |
| `--color-text-accent-default` / `-strong` | brand-coloured text / text on the light brand fill |
| `--color-border-primary-default` | dividers and field outlines (cards have **no** stroke) |

**Status colours, both ways:** general names (`success`, `warning`, `info`,
`danger`, `accent`) and business names that point at them (`status-paid` →
success, `status-logging` → warning, `status-frozen` → info, `status-settled` →
accent, `status-danger` → danger). Use the business name where the screen means
that business state.

**Tones** (`bq-tone-<name>` sets `--tone-fg` / `--tone-bg`): `neutral`, `primary`,
`logging`, `settled`, `paid`, `danger`, `frozen`. Tag and StatusBadge take a tone.

**Brand theme:** every brand colour points at `--primitive-color-brand-*`.
`setBrandColor("#hex")` (`design-system/theme.ts`) recolours the whole app;
`setBrandColor(null)` restores Bizqwik violet. (Not wired to gym data yet.)

### Text styles: Apple's role names, Bizqwik's sizes

Screens pick a role, never a pixel size. Each role has `--text-<role>-size` and
`--text-<role>-weight`, and a class `bq-text-<role>`.

| Role | Size / weight | Class | Typical use |
|---|---|---|---|
| Large Title | 30 / 800 | `bq-text-large-title` | the biggest heading |
| Title 1 | 26 / 800 | `bq-text-title-1`, `bq-title` (page title with spacing) | page titles |
| Title 2 | 20 / 700 | `bq-text-title-2`, `bq-h2` | section titles, names on sheets |
| Title 3 | 18 / 700 | `--text-title-3-*` | small titles (title pill, payment cards, plan names) |
| Headline | 16 / 700 | `bq-text-headline`, `bq-h3` | row titles |
| Callout | 16 / 500 | `bq-text-callout` | larger body text |
| Body | 15 / 500 | `bq-text-body` | body text |
| Subheadline | 14 / 500 | `bq-text-subheadline` | secondary lines |
| Footnote | 13 / 500 | `bq-text-footnote` | small print |
| Caption 1 / 2 | 12 / 11, 500 | `bq-text-caption-1` / `-2` | captions |
| Label | 11 / 700 mono, uppercase | `bq-label` | MONTH TOTAL · EGP |
| Meta | 13 / 400 mono | `bq-meta` | secondary mono text |
| Stat XL / Hero / LG / MD / SM | 56 / 48 / 30 / 24 / 20, 800 | `bq-stat-xl / lg / md / sm`, `--text-stat-hero-*` | big numbers (Hero: a screen's main money figure) |

Fonts: `--font-family-body` (Urbanist) for words, `--font-family-mono` (Space
Mono) for labels, meta and figures. `tabular` for figures that must not change
width.

### Spacing

A 4px grid. Every gap, padding and margin uses one of these:

| Step | px | For |
|---|---|---|
| `--space-px` | 1 | hairline: a 1px gap that shows a grid line |
| `--space-0-5` / `--space-1-5` | 2 / 6 | half-steps for tight gaps inside small parts (pills, labels) |
| `--space-1` · `-2` · `-3` · `-4` · `-5` · `-6` · `-8` | 4 · 8 · 12 · 16 · 20 · 24 · 32 | everyday spacing |
| `--space-10` · `-12` · `-16` · `-24` | 40 · 48 · 64 · 96 | page-level layout (desktop margins, big hero padding) |

A value between two steps goes to the nearest one; a tie goes to the multiple of 8. Page side gutter is 16; cards pad 20 (`md`) or
14×16 (`sm`).

### Corner radius: one value per kind; nested shapes follow outer = inner + padding

| Token | px | Kind |
|---|---|---|
| `--radius-card` | 28 | every surface on a page: cards, tiles, charts, hero, list cards |
| `--radius-sheet` | 40 | bottom sheets (20 padding inside) |
| `--radius-item` | 20 | fields, notices, thumbnails inside a sheet or standing alone (40 − 20) |
| `--radius-chip` | 8 | small tags, icon boxes inside cards, calendar blocks (28 − 20) |
| `--radius-bar` | 4 | the rounded end of a bar in a bar chart |
| `--radius-button` | 24 | buttons (a 48px button is a full pill) |
| `--radius-float` | 32 | floating action container (button 24 + padding 8) |
| `--radius-full` | 999 | pills, circles, avatars, switches, the tab bar |

### Motion (`--duration-*`, `--ease-*`; in code `design-system/motion/motion.ts`)

Nothing moves for more than **350ms** (`npm run motion` fails otherwise). One
curve (`--ease-standard`, the iOS standard) and one gentle `--ease-spring` for
confirmations.

| Token / constant | ms | For |
|---|---|---|
| `--duration-quick` / `QUICK_MS` | 150 | fades, colour changes, presses, tooltips, titles |
| `--duration-standard` / `STANDARD_MS` | 250 | things appearing: banners, rows, content |
| `--duration-control` / `CONTROL_MS` | 300 | controls that travel: switches, sliding pills, reveals |
| `--duration-screen` / `SCREEN_MS` | 340 | pushing into / backing out of a screen, sheets opening |
| `--duration-sheet-out` / `SHEET_OUT_MS` | 280 | sheets closing |

Build transitions with `tr(props, ms)`. Under Reduce Motion, movement becomes a
fade (`useReducedMotion`), never nothing.

### Lines

| Token | For |
|---|---|
| `--border-divider` | the line between rows, grid cells and under sticky headers (`border-bottom: var(--border-divider)`) |
| `--border-outline` | the outline of fields and outlined controls |

### Elevation

| Token | For |
|---|---|
| `--shadow-float` | things that float over the page: sheets, tab bar, floating actions |
| `--shadow-push` | the edge of a screen sliding in |
| `--shadow-raised` | small floating control (pull-to-refresh) |
| `--shadow-lifted` | a card picked up / floating while scrolling |
| `--shadow-thumb` | switch knob |
| `--shadow-fab` / `--shadow-cta` | brand glow under the FAB / a big call to action |
| `--shadow-glass-highlight` | inner top highlight of the frosted tab bar |

Cards don't have shadows.

---

## 2. Library: "I need… → use…" (`src/design-system/components/`)

### Surfaces and layout

| I need | Use | Notes |
|---|---|---|
| A card / any surface on a page | `Card` (`pad="sm"/"md"/"lg"/"none"`, `clip`) or `cardClass()` for a non-div | no stroke, radius 28 |
| A card with a small label and sub-line on top | `SectionCard` | Overview / Accounting sections |
| A list of rows | `<Card pad="none" clip>` + `ListRow` (`divider`, `density="compact"`) or `listRowClass()` | last row: `divider={false}` |
| A list whose rows are added / removed | wrap rows in `MotionList` | rows grow in and fold away |
| A section heading (title · count · action) | `SectionHeader` | |
| A screen's title and Back | `useSetHeader({ kicker, title })` (+ `useBackAction(fn)` on sub-pages) | `shared/screen/`; the Shell draws the bar |
| A sub-page's main buttons | `useFloatingActions(<Button…/>)` | `shared/screen/`; they float in the tab bar's place |
| A collapsible section | `Reveal` | |
| Loading: whole screen / part of one | `Spinner` (skeleton) / `InlineSpinner` | content fades in automatically |
| Nothing to show yet | `EmptyState` | |
| A form or action error | `ErrorBanner` (or class `bq-error`) | |

### Controls

| I need | Use | Notes |
|---|---|---|
| A button | `Button` (`variant` primary / secondary / quiet / danger, `size`, `fullWidth`) | never style a `<button>` by hand |
| An icon-only round button | `IconButton` (`icon`, `label`, `tone`) | `label` is required |
| A selectable filter / choice | `Chip` (+ `ChipGroup`) | `size="sm"` for dense rows |
| 2–4 mutually exclusive views | `Segmented` | sliding pill |
| Months to pick from | `YearMonthStrip` | |
| On / off | `SwitchVisual` inside a row button | |
| A stepper (− 1 +) | `Stepper` | |
| A text / number field | `TextField` | from `FormField.tsx` |
| A choice from a list | `SelectField` | from `FormField.tsx` |
| A date | `DateField` · a time: `TimeWheelField` | |
| A QR scan | `QrScanner` | |

### Sheets and confirmation

| I need | Use | Notes |
|---|---|---|
| A bottom sheet (dialog on desktop) | `Sheet` | drag to dismiss, "Discard changes?" built in |
| "Are you sure?" | `ConfirmSheet` | |
| A sheet's heading (kicker over title) | `SheetHeading` | |
| A done tick at the end of a save | `SheetSuccessIcon` + `useSheetSuccess` (`quiet` for routine edits) | |

### Data display

| I need | Use | Notes |
|---|---|---|
| A big money figure that changes | `Num` (inside a `bq-stat-*`) | glides to new values |
| The main figure + stats of a screen | `MoneyHero` | |
| A KPI tile (icon · label · number · change) | `KpiTile` + `Delta` | |
| A bar chart | `BarChart`; money over months: `RevenueChart` | `RevenueChart` / `ShareBars` in `MoneyCharts.tsx` |
| Share of a total as bars | `ShareBars` | |
| A chart's "no data yet" | `Empty` | in `KpiTile.tsx` |
| A small square label | `Tag` (`tone`) | Kids, location, OFF SALE |
| A state with a dot | `StatusBadge` (`tone`) | ready-made ones in shared (below) |
| A person | `Avatar` | |
| An icon | `Icon` | Solar icons, `name` from `IconName` |

---

## 3. Shared business components (`src/shared/components/`)

Used by two or more features. Not generic enough for the library.

| I need | Use |
|---|---|
| A coach month's state | `StatePill` |
| A PT package's state | `PackageStatusPill` |
| A client's plan status (front desk / clients) | `PlanPill` |
| The home greeting with avatar | `HomeAvatar` |
| A payment method choice | `PaymentSelect` / `PaymentCards` |
| A class photo picker | `ClassPhotoField` |
| Create / edit a class | `ClassSheet` (form helpers in `shared/classForm.ts`) |
| Create / edit a weekly class series | `SeriesSheet` |
| A class roster | `ClassRosterSheet` |
| Add a session / a day's sessions | `AddSessionSheet`, `DaySessionsSheet`, `DayList` |
| Invite a team member | `InviteFlow`, `InviteSheet` |
| Scan a member's QR (coach) | `ScanFlow` |
| The activity feed / logs | `ActivityPanel`, `Feed` |

Feature-only pieces (e.g. `LockedBanner`, `RollupTable` in `features/coaches/`)
stay in their feature until a second feature needs them.

### App frame (used by `app/`, not by screens)

`Shell`, `BottomNav`, `Sidebar`, `RouteTransition`, `PullToRefresh`, `Fab`
(`fab/`), `Splash` / `LaunchGate`.

### Classes (for elements that must stay a plain element)

`bq-card(--sm/md/lg/clip)`, `bq-listrow(--compact/--divider)`, `bq-plain`,
`bq-tag`, `bq-badge`, `bq-tone-*`, `bq-iconbtn(--danger/neutral/plain)`,
`bq-chip`, `bq-stat-xl/lg/md/sm`, `bq-text-*`, `bq-label`, `bq-meta`, `bq-title`,
`bq-h2`, `bq-h3`, `bq-grow`, `bq-stack`, `bq-panel`, `bq-error`, `bq-btn*`,
press: `bq-scale`, `bq-still`, `bq-hit`, `bq-row`.

### Utilities (`src/design-system/utilities.css`)

Single-purpose classes for layout that repeats everywhere. Combine them instead
of writing a new class for a flex row with a gap.

| Kind | Classes |
|---|---|
| Layout | `bq-flex`, `bq-inline-flex`, `bq-grid`, `bq-block`, `bq-col`, `bq-wrap`, `bq-flex-1`, `bq-flex-none`, `bq-min-w-0`, `bq-relative`, `bq-w-full` |
| Alignment | `bq-items-center / baseline / start / end`, `bq-justify-center / between / end`, `bq-ml-auto` |
| Spacing | `bq-gap-N`, `bq-mt-N`, `bq-mb-N` where N is the token step (`bq-gap-2` = `--space-2` = 8px; `bq-gap-px`, `bq-mt-0-5`, `bq-gap-1-5` for the small steps) |
| Text | `bq-fg-primary / secondary / tertiary` (text colour), `bq-text-left / center / right`, `bq-nowrap`, `bq-ellipsis`, `bq-overflow-hidden`, `bq-pointer` |

### Feature and component CSS

Anything more than a few utilities gets a named class in a CSS file next to the
component (`Bookings.tsx` → `Bookings.css`, imported at the top of the TSX):
`bq-<feature>-<file>-<part>`, e.g. `bq-frontdesk-bookings-row`. Values come from
tokens. Inline `style={{}}` is only for values computed at runtime (a chart bar's
height, a width that animates, a colour from data).

---

## 4. Screen patterns

- **Tab screens** have the tab bar (+ FAB). **Sub-pages** (anything opened from a
  tab) have no tab bar: a sticky **Back** on the title's line, and their main
  actions float at the bottom (`useFloatingActions`).
- Tabs switch with a fade; going deeper slides in; Back slides out.
- One primary action per screen; destructive actions go through `ConfirmSheet`.
- Money figures are `tabular`; changing figures use `Num`.

---

## Adding a component

1. **Check again**: can an existing component take a prop instead? Prefer that.
2. **Decide where it lives** (section 0): library, shared, or its feature.
3. **Build it as its own file** using only tokens and existing primitives. Its
   CSS goes in a file next to it (`Name.css`, `bq-*` classes). For a library
   component, add an `@import` for it to `src/design-system/styles.css` (so its
   classes work everywhere); a feature's own CSS uses a `bq-<feature>-` prefix.
4. **Library or shared? Add a row to the directory above** (what it's for, the
   name, its key props).
5. Use it from the screen; never build the same thing inline "just this once".
6. Add or extend an e2e test if it has behaviour.
7. Run `npm run check`. It fails if a library/shared component is missing from
   this file, an import crosses the rules in section 0, or any of these goes up
   (in TSX or CSS; leftovers are counted in `scripts/ds-baseline.json` and can
   only go down):
   - a row divider typed by hand, a styled `<button>`, or an extra-bold number at a raw pixel size
   - a raw colour, font size or corner radius (use the tokens)
   - off-scale spacing (use `--space-*`)
   - a static inline style (use a class)

Changing a design value: edit `tokens.json`, run `npm run tokens`, commit the
generated files too. Removing or renaming a component: update this file in the
same change.
