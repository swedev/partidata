# Implementation Progress: Issue #102

**Started:** 2026-09-07
**Last updated:** 2026-09-07
**Completed:** 2026-09-07
**Status:** Completed

## Completed Steps

- [x] Phase 1, Step 1: `sourceMark` in `source-mark.ts`, `SourceBrand` in `shared.tsx`, unit test
- [x] Phase 1, Step 2: Replace the three inline badges in `overview.tsx`
- [x] Phase 1, Step 3: Pass `symbolSrc`/`symbolFrame` from `[filnamn].tsx`
- [x] Phase 2, Step 4: Restyle the badge in `_party-profile.scss`
- [x] Phase 3, Step 5: Badge assertions in `scripts/http-smoke.js`
- [x] Phase 3, Step 6: `npm run precommit` and rendering check

## Current Work

None — all phases done.

## Notes

Branch `issue/102-source-badge-invented-abbreviation`, created from `main`.

Verification against the checklist:

- `npm run precommit` green (lint, typecheck, derived-data check, data validation, `node --test`, standalone build, HTTP smoke), including the new smoke assertions, which ran rather than skipped.
- The release build served locally renders the symbol in every badge: three on `/parti/miljopartiet-de-grona/`, two on `/parti/civis/`, one on `/parti/liberalerna-tidigare-folkpartiet/`. No `profile-source-brand__mark--text` and no inline `background` anywhere on those pages.
- The turnout section's text-only `profile-source-brand--small` line still renders with no mark, so `elections.tsx` is unaffected.
- `grep -n accentfarg src/components/party-profile/overview.tsx` returns nothing; `--profile-accent` in `[filnamn].tsx` is unchanged.
- Symbol sizing from the compiled CSS: the small badge caps the drawing at 70px wide inside an 80px box (Liberalerna's 6.68 wordmark lands on the cap at 10.5px tall), and the large badge caps at 92.4px inside 104px; CIVIS's near-square mark fills the 32.4px inner height at 53.5px wide. No badge exceeds `--profile-mark-max`.
- No change under `data/`, `src/types.ts` or `scripts/validate.js`.
