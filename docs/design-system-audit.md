# Design system audit (before the consolidation)

Measured on `dev` at `39067e6`, 16 Nov 2026, from the code (`src/`). This is the
"before" picture; `DESIGN_SYSTEM.md` at the repo root is the rulebook that
replaces it.

## Foundations

| Foundation | State | Gap |
|---|---|---|
| Colour | Tokens in `index.css` (`--paper`, `--surface`, `--sunken`, `--ink*`, `--primary*`, status pairs) | ~25 raw `rgba()` / hex left in TSX (overlays, QR whites) |
| Type | `--font-body`, `--font-mono`, 9-step size scale `--fs-*`, classes `bq-label/meta/title/h2/h3` | Big numbers (800 weight) styled inline 88 times, 6 sizes |
| Radius | One rule per kind: card 28, sheet 40, item 20, chip 8, button 24, float 32 | Done |
| Motion | One scale (`motion.ts`, `--dur-*`), ≤350ms, guard `npm run motion` | Done |
| Spacing | **No tokens.** Gaps 1–40px, paddings in ~30 combinations | Needs a scale |
| Elevation | `--shadow-float`, `--shadow-card` | OK |

## Components: shared vs hand-built

Shared and used everywhere (keep): Button (149 uses / 57 files), Icon, TextField
(76), Sheet (46), EmptyState (43), loading placeholder (34), SheetSuccessIcon,
ConfirmSheet, SelectField, DateField, Avatar, StatePill, PackageStatusPill,
Segmented, YearMonthStrip, MoneyHero, KpiTile, BarChart, MotionList, Num.

Hand-built per page (to consolidate):

| Pattern | Copies | Variants found | Becomes |
|---|---|---|---|
| Card (surface + 28 corners) | 37 inline in 28 files, plus **3 different components named `Card`** (overview, frontdesk, ops) | 16 paddings (14/16, 16/18, 20, 20/20/18, 14/18, 30…) | `Card` with `pad` none / sm (14 16) / md (20) / lg (30) |
| Titled card (label + sub + body) | overview `Card` | 1 | `SectionCard` |
| List row with divider | 39 in 31 files | 18 paddings (12/18, 16/20, 14/20, 13/18…) | `ListRow` (compact 12 18 / regular 16 20), inside `Card pad="none"` |
| Section header (title + count + action) | 3 components (`SectionTitle` ×2, `PanelHeader`) | spacing differs | `SectionHeader` |
| Round icon button (edit / delete / remove) | 15 inline + `iconBtn()` helper | 32–44px, primary / danger | `IconButton` (36, tone primary / danger / neutral) |
| Selectable chip | 2 (`Chip` in Clients, `CategoryChip` in Accounting) | colours differ | `Chip` |
| Small uppercase tag | 9 files inline + `CategoryPill`, `LocationPill`, ops `StatusPill`, `PlanPill` | 10px mono, r-chip | `Tag` (tone neutral / primary / paid / danger / logging / frozen) |
| Big number | 88 inline | 56, 30, 26, 24, 22, 20, 18… | `bq-stat-xl / lg / md / sm` classes |
| Error banner | `ErrorBanner` ×2 + `bq-error` class | — | `bq-error` (keep class, one component) |

Unused: `QuickAction` (0 uses), `Switch` wrapper (only `SwitchVisual` is used).

Inline style blocks: 1,212 vs 390 class uses.
