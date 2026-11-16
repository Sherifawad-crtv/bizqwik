# Bizqwik design system

**Read this before building or changing any screen.** Every piece of UI comes
from the library below. If what you need isn't here, you build it as a library
component and add it to this file in the same change (see
[Adding a component](#adding-a-component)). `npm run check` enforces this.

The app follows Apple's Human Interface Guidelines for behaviour and motion
(not for looks): iOS-style transitions, press feedback, sheets and tab bar.

---

## 1. Foundations

All values are tokens in `src/index.css` (`:root`). Never type a raw value that a
token covers.

### Colour

| Token | Use |
|---|---|
| `--paper` | page background |
| `--surface` | cards, sheets, the floating containers |
| `--sunken` | inner fills: segmented tracks, search fields, neutral tags |
| `--line` | dividers and field outlines (cards have **no** stroke) |
| `--ink`, `--ink-muted`, `--ink-faint` | text: primary, secondary, tertiary |
| `--primary`, `--primary-pressed`, `--primary-tint`, `--primary-light` | brand violet: buttons, active states, chart bars |
| `--paid-*`, `--logging-*`, `--settled-*`, `--danger-*`, `--frozen-*` (`-fg` / `-bg`) | status pairs, used through **tones** (below) |

**Tones** (`bq-tone-<name>` sets `--tone-fg` / `--tone-bg`): `neutral`, `primary`,
`logging`, `settled`, `paid`, `danger`, `frozen`. Tag and StatusBadge take a tone.

### Type

Fonts: `--font-body` (Urbanist) for words, `--font-mono` (Space Mono) for labels,
meta and figures.

Sizes: `--fs-caption` 11 · `--fs-small` 12 · `--fs-note` 13 · `--fs-body-sm` 14 ·
`--fs-body` 15 · `--fs-base` 16 · `--fs-title-sm` 20 · `--fs-title` 26 ·
`--fs-display` 30.

| Class | Use |
|---|---|
| `bq-label` | small uppercase mono labels (MONTH TOTAL · EGP) |
| `bq-meta` | secondary mono text (13) |
| `bq-h3` | row titles (16 bold) |
| `bq-h2` | section titles (20 bold) |
| `bq-title` | page titles (26 extra-bold) |
| `bq-stat-xl / lg / md / sm` | big numbers: 56 / 30 / 24 / 20 |
| `tabular` | figures that must not change width |

### Spacing

`--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-5` 20 ·
`--space-6` 24 · `--space-8` 32. Page side gutter is 16; cards pad 20 (`md`) or
14×16 (`sm`).

### Corner radius: one value per kind, nested shapes follow outer = inner + padding

| Token | px | Kind |
|---|---|---|
| `--r-card` | 28 | every surface on a page: cards, tiles, charts, hero, list cards |
| `--r-sheet` | 40 | bottom sheets (20 padding inside) |
| `--r-item` | 20 | what sits in a sheet or stands alone as an item: fields, notices, thumbnails (40 − 20) |
| `--r-chip` | 8 | small tags, icon boxes inside cards, calendar blocks (28 − 20) |
| `--r-button` | 24 | buttons (a 48px button is a full pill) |
| `--r-float` | 32 | floating action container (button 24 + padding 8) |
| `999` | | pills, circles, avatars, switches, the tab bar (circle radius + gap) |

### Motion (`src/lib/motion.ts`, `--dur-*`, `--ease-*`)

Nothing moves for more than **350ms** (`npm run motion` fails otherwise). One
curve (`EASE`, the iOS standard) and one gentle `SPRING` for confirmations.

| Name | ms | For |
|---|---|---|
| `QUICK_MS` / `--dur-quick` | 150 | fades, colour changes, presses, tooltips, titles |
| `STANDARD_MS` / `--dur-standard` | 250 | things appearing: banners, rows, content |
| `CONTROL_MS` / `--dur-control` | 300 | controls that travel: switches, sliding pills, reveals |
| `SCREEN_MS` / `--dur-screen` | 340 | pushing into / backing out of a screen, sheets opening |
| `SHEET_OUT_MS` | 280 | sheets closing |

Build transitions with `tr(props, ms)`. Under Reduce Motion, movement becomes a
fade (`useReducedMotion`), never nothing.

### Elevation

`--shadow-float` for things that float over the page (sheets, tab bar, floating
actions, FAB). Cards don't have shadows.

---

## 2. Component directory: "I need… → use…"

All in `src/components/` unless noted.

### Surfaces and layout

| I need | Use | Notes |
|---|---|---|
| A card / any surface on a page | `Card` (`pad="sm"/"md"/"lg"/"none"`, `clip`) or `cardClass()` for a non-div | no stroke, radius 28 |
| A card with a small label and sub-line on top | `SectionCard` | Overview / Accounting sections |
| A list of rows | `<Card pad="none" clip>` + `ListRow` (`divider`, `density="compact"`) or `listRowClass()` | last row: `divider={false}` |
| A list whose rows are added / removed | wrap rows in `MotionList` | rows grow in and fold away |
| A section heading (title · count · action) | `SectionHeader` | |
| A screen's title and Back | `useSetHeader({ kicker, title })` (+ `useBackAction(fn)` on sub-pages) | the Shell draws the bar |
| A sub-page's main buttons | `useFloatingActions(<Button…/>)` | they float in the tab bar's place |
| A collapsible section | `Reveal` | |
| Loading: whole screen / part of one | `Spinner` (skeleton) / `InlineSpinner` | content fades in automatically |
| Nothing to show yet | `EmptyState` | |
| A form or action error | `ErrorBanner` (or class `bq-error`) | |
| A locked-month notice | `LockedBanner` | |

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
| A payment method | `PaymentSelect` / `PaymentCards` | |
| A photo for a class | `ClassPhotoField` | |
| A QR scan | `QrScanner` | |

### Sheets and confirmation

| I need | Use | Notes |
|---|---|---|
| A bottom sheet (dialog on desktop) | `Sheet` | drag to dismiss, "Discard changes?" built in |
| "Are you sure?" | `ConfirmSheet` | |
| A done tick at the end of a save | `SheetSuccessIcon` + `useSheetSuccess` (`quiet` for routine edits) | |

### Data display

| I need | Use | Notes |
|---|---|---|
| A big money figure that changes | `Num` (inside a `bq-stat-*`) | glides to new values |
| The main figure + stats of a screen | `MoneyHero` | |
| A KPI tile (icon · label · number · change) | `KpiTile` + `Delta` | `src/components/KpiTile.tsx` |
| A bar chart | `BarChart`; money over months: `RevenueChart` | `RevenueChart` / `ShareBars` in `MoneyCharts.tsx` |
| Share of a total as bars | `ShareBars` | |
| A chart's "no data yet" | `Empty` | in `KpiTile.tsx` |
| A desktop data table | `RollupTable` | |
| A small square label | `Tag` (`tone`) | Kids, location, OFF SALE |
| A state with a dot | `StatusBadge` (`tone`); ready-made: `StatePill`, `PackageStatusPill`, `PlanPill`, ops `StatusPill` | |
| A person | `Avatar` (`HomeAvatar` for the home greeting) | |
| An icon | `Icon` | Solar icons, `name` from `IconName` |

### App frame (used by the Shell, not by screens)

`Shell`, `BottomNav`, `Sidebar`, `RouteTransition`, `PullToRefresh`, `Fab`
(`fab/`), `Splash` / `LaunchGate`, `DesktopAuth`. Screen-specific pieces that are
still shared live here too: `AddSessionSheet`, `DaySessionsSheet`, `DayList`,
`ClassRosterSheet`.

### Classes (for elements that must stay a plain element)

`bq-card(--sm/md/lg/clip)`, `bq-listrow(--compact/--divider)`, `bq-plain`,
`bq-tag`, `bq-badge`, `bq-tone-*`, `bq-iconbtn(--danger/neutral/plain)`,
`bq-chip`, `bq-stat-xl/lg/md/sm`, `bq-label`, `bq-meta`, `bq-title`, `bq-h2`,
`bq-h3`, `bq-grow`, `bq-stack`, `bq-panel`, `bq-error`, `bq-btn*`, press:
`bq-scale`, `bq-still`, `bq-hit`, `bq-row`.

---

## 3. Screen patterns

- **Tab screens** have the tab bar (+ FAB). **Sub-pages** (anything opened from a
  tab) have no tab bar: a sticky **Back** on the title's line, and their main
  actions float at the bottom (`useFloatingActions`).
- Tabs switch with a fade; going deeper slides in; Back slides out.
- One primary action per screen; destructive actions go through `ConfirmSheet`.
- Money figures are `tabular`; changing figures use `Num`.

---

## Adding a component

When a screen needs something the directory doesn't have:

1. **Check again**: can an existing component take a prop instead? Prefer that.
2. **Build it in `src/components/`** as its own file, using only tokens (colour,
   type, spacing, radius, motion) and existing primitives. Put any CSS in the
   "Library components" section of `src/index.css` as `bq-*` classes.
3. **Add a row to the directory above** (what it's for, the name, its key props).
4. Use it from the screen; never build the same thing inline "just this once".
5. Add or extend an e2e test if it has behaviour.
6. Run `npm run check`. It fails if a component in `src/components/` is missing
   from this file, or if a screen hand-builds something the library covers
   (`npm run ds` lists exactly what and where).

Removing or renaming a component: update this file in the same change.
