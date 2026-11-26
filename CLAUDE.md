# Working in this repo (Bizqwik business app)

## UI: the design system comes first
- **Before building or changing any screen, read `DESIGN_SYSTEM.md`** and use the
  component it names for what you need. Don't hand-build cards, rows, buttons,
  tags, pills, chips or big numbers.
- Code lives in `src/app/` (frame), `src/design-system/` (tokens + library),
  `src/shared/` (cross-feature code and business components) and
  `src/features/<area>/`. A feature never imports another feature or `app/`.
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
  linked to **production**. **Production database changes go only through
  migrations**: a migration file merged to `main` and tested on the local stack
  (`supabase/`, GATE checklist) may be applied to production from `main` with a
  co-founder's explicit go-ahead, after the live edge functions are backed up and
  the rollback steps are written down. Apply only the new migration files, never
  the baseline.
- **Direct SQL on production is allowed only with the owner's permission, asked
  every time.** This covers ad-hoc SQL, data edits, imports, seeding and deletes,
  whether run from scripts, the CLI, the Supabase tools or the dashboard. Before
  running any, say exactly what it will change (tables, row counts, amounts) and
  what the undo is, then wait for an explicit yes for that statement. Approval
  for one statement does not carry over to the next. Schema changes still go
  only through migrations as described above.
- Never change edge functions, Supabase/Vercel settings, secrets, or anything that
  sends to or charges real people without the owner's explicit confirmation.
- Test saves on the dev preview only in the Demo Fitness Club org.
- Tests: `npm run test:e2e` (Playwright, mocked backend). `e2e/visual.spec.ts`
  compares every main screen's computed styles with `e2e/visual-baseline/`;
  refresh it (`UPDATE_VISUAL=1`) only when a change is meant to look different. Use `npm run build`
  (runs `tsc -b`), not `tsc --noEmit`.
