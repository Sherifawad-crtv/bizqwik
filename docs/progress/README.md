# Progress log

One markdown entry per push, newest number highest. Each entry records **what
that push changed and why**, plus how it was verified — so the history reads as
a narrative, not just a git diff.

Convention:

- File name: `NNNN-YYYY-MM-DD-short-slug.md` (zero-padded, monotonic).
- Sections: **What changed**, **Why**, **Verification**, **Follow-ups** (if any).
- Keep it to what a reviewer needs to understand the push; link to the living
  design docs under `docs/architecture/` rather than repeating them.

Living design docs (the "why the system is shaped this way") live in
`docs/architecture/` and are updated in place as decisions evolve; progress
entries are point-in-time and never edited after their push.
