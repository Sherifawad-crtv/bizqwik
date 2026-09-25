# 0012 — Org branding: upload instead of paste-a-URL

**Date:** 2026-09-25

## What changed
The ops dashboard's member-app branding form (`/bizqwik/orgs/:id`) only ever
took a raw URL for the logo, icon, and 3 onboarding-art images — ops had to
host the image somewhere else first and paste the link in. Replaced each of
those 5 fields with a real upload control (preview tile + Upload/Replace
button), backed by a new Supabase Storage bucket. The URL field is kept
underneath as a fallback for pasting an already-hosted asset — both paths
write to the same value.

- New public bucket **`org-branding`** (2MB limit, jpeg/png/webp), objects at
  `{orgId}/{logo|icon|art-0|art-1|art-2}.jpg`. RLS: public read; insert/
  update/delete gated by `is_bizqwik_team()` — mirrors the existing `avatars`
  bucket pattern (owner-scoped there; team-scoped here since these assets
  belong to the org, not an uploader).
- Extracted `squareCrop()` (center-crop to square, downscale, JPEG blob) out
  of `AccountProfile.tsx` into `src/lib/image.ts` so `OrgDetail.tsx` reuses
  the same client-side processing instead of duplicating it.
- `ImageUploadField` in `OrgDetail.tsx`: picks a file → `squareCrop` → upload
  to `org-branding` (`upsert: true`, cache-busted public URL) → same
  `onChange` the URL field already used. No backend change needed —
  `POST /ops/orgs/:id/branding` already just stores whatever URL string it's
  given.

## Verified
- `get_advisors` (security) after the migration: no new findings — everything
  reported is pre-existing and unrelated to this bucket.
- `tsc -b` + `npm run build` clean; existing e2e suite still green (3/3).
- Not covered by e2e (no file-upload exercise in the current specs) — worth a
  follow-up mocked-storage test if this area gets touched again.
