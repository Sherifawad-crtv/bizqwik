# Working in this repo (Bizqwik business app)

## UI: the design system comes first
- **Before building or changing any screen, read `DESIGN_SYSTEM.md`** and use the
  component it names for what you need. Don't hand-build cards, rows, buttons,
  tags, pills, chips or big numbers.
- Code lives in `src/app/` (frame), `src/design-system/` (tokens + library),
  `src/shared/` (cross-feature code and business components) and
  `src/features/<area>/`. A feature never imports another feature or `app/`.
- Each feature has three layers: `data/` (its server calls, `<area>Repository.ts`),
  `domain/` (pure rules and form checks: no React, no server calls) and
  `presentation/` (screens, CSS and `hooks/`), plus `index.ts` for what the app
  uses and `routes/` for lazy-loaded screens. Screens get data and actions only
  from their feature's `presentation/hooks/`, never from `data/` or `shared/api`
  directly; a rule (what's valid, what's shown, what's allowed) goes in `domain/`.
  `npm run ds` enforces the direction.
- Data types belong to the architecture too: a type only one feature uses lives
  in that feature's `domain/types.ts` (its models; `data/` and `presentation/`
  import them from there). `src/shared/types/` (one file per topic) holds only types several
  features or `shared/` itself use. A new type starts in its feature and moves
  to shared only when a second feature needs it.
- If the library doesn't have what you need: likely reused → build it in
  `src/design-system/components/` (generic) or `src/shared/components/`
  (business), using only tokens, and **add it to the directory in
  `DESIGN_SYSTEM.md` in the same change**. Used by one feature only → keep it in
  that feature's folder.
- Design values are edited only in `src/design-system/tokens/tokens.json`, then
  `npm run tokens` (commit the generated `tokens.css` / `tokens.ts`). Colour
  names follow `color-[element]-[priority]-[state]`; never type a raw colour.
- `npm run check` must pass: tokens up to date, build, lint, first-download size,
  motion (≤350ms, tokens only) and `npm run ds` (every component documented, no
  local copies, import rules, no new hand-built UI).

## Workflow
- Commits are authored as the owner: `Sherifawad-crtv <sherif.awaadd@gmail.com>`
  (`git config user.name/user.email`). Never add `Co-Authored-By: Claude`,
  `Claude-Session:` or any other AI attribution to commits, pull requests,
  branch names or anything pushed.
- Backend functions are deployed only from a commit on `main`, after merging,
  never from a feature branch.
- Front-end work goes to the `dev` branch first, never straight to `main`. The
  owner checks the dev preview and says "ship it" before `dev` is merged to `main`.
- Dev and production share **one database and backend**: local and dev work is
  linked to **production**. **Database changes are completely forbidden** — no
  migrations, schema changes, SQL, data edits, seeding or deletes, from scripts,
  the CLI or the Supabase dashboard. There is no exception for this.
- Never change edge functions, Supabase/Vercel settings, secrets, or anything that
  sends to or charges real people without the owner's explicit confirmation.
- Test saves on the dev preview only in the Demo Fitness Club org.
- Tests: `npm run test:e2e` (Playwright, mocked backend). `e2e/visual.spec.ts`
  compares every main screen's computed styles with `e2e/visual-baseline/`;
  refresh it (`UPDATE_VISUAL=1`) only when a change is meant to look different. Use `npm run build`
  (runs `tsc -b`), not `tsc --noEmit`.
