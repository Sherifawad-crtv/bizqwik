# Working in this repo (Bizqwik business app)

## UI: the design system comes first
- **Before building or changing any screen, read `DESIGN_SYSTEM.md`** and use the
  component it names for what you need. Don't hand-build cards, rows, buttons,
  tags, pills, chips or big numbers.
- If the library doesn't have what you need, build it as a new component in
  `src/components/`, using only the tokens, and **add it to the directory in
  `DESIGN_SYSTEM.md` in the same change**. Then use it from the screen.
- `npm run check` must pass: build, lint, first-download size, motion (≤350ms,
  tokens only) and `npm run ds` (every component documented, no local copies of
  library components, no new hand-built UI).

## Workflow
- Front-end work goes to the `dev` branch first, never straight to `main`. The
  owner checks the dev preview and says "ship it" before `dev` is merged to `main`.
- Dev and production share **one database and backend**. Never change the
  database, edge functions, Supabase/Vercel settings, secrets, or anything that
  sends to or charges real people without the owner's explicit confirmation.
- Test saves on the dev preview only in the Demo Fitness Club org.
- Tests: `npm run test:e2e` (Playwright, mocked backend). Use `npm run build`
  (runs `tsc -b`), not `tsc --noEmit`.
