# Implementation Progress: Issue #16

**Started:** 2026-08-22
**Last updated:** 2026-08-22
**Completed:** 2026-08-22
**Status:** Completed

## Completed Steps

- [x] Phase 1, Step 1: Created `src/types.ts` with `Parti` and `PartiIndexEntry`
- [x] Phase 2, Step 2: Typed the grouped party list in `src/pages/index.tsx` as `Map<string, PartiIndexEntry[]>`
- [x] Phase 2, Step 3: Typed `getStaticPaths`/`getStaticProps` in `src/pages/parti/[filnamn].tsx` with `GetStaticPaths`/`GetStaticProps` and a `params?`/`notFound` guard
- [x] Phase 3, Step 4: Replaced the placeholder table body with `kod`, `forkortning` and the formatted registration date, hiding rows without a value
- [x] Phase 3, Step 5: Added `<Link href="/">← Alla partier</Link>` above the `<h1>`
- [x] Phase 4, Step 6: `npm run lint && npm run typecheck && npm run build` green (336 pages, 333 party pages)
- [x] Phase 4, Step 7: Checked the three field combinations, the home link, hydration and the 375 px layout in the browser

## Current Work

Implementation complete on branch `issue/16-partisidan-visar-faktisk-data`. Plan step 8 (open a PR) is out of scope for this run — `/work-issue` was invoked without `--commit`/`--PR`, so nothing is committed or pushed.

## Verification Checklist

- [x] No "Grundat", "19XX" or "Key"/"Value" placeholder strings left in `src/pages/parti/[filnamn].tsx` (`grep` over `out/` after build is empty)
- [x] `/parti/ale-demokraterna/` shows Partikod `0139`, Förkortning `ADK`, Registrerad `1 december 2017`
- [x] `/parti/asyl-nupartiet/` shows Partikod `1420` and Registrerad `6 mars 2018` but no Förkortning row
- [x] `/parti/20--skattepartiet/` shows only the Partikod row (`1365`)
- [x] Party page has a working link back to `/` (clicked in the browser, lands on `http://localhost:3001/`)
- [x] `grep -rnE 'Array<any>|\bas any\b' src/` finds nothing; `getStaticProps`/`getStaticPaths` are typed
- [x] `src/types.ts` exports `Parti` and `PartiIndexEntry`; both pages import from it
- [x] No React hydration warning on a party page with a date; `timeZone: 'UTC'` makes the formatter emit "1 december 2017" under `Europe/Stockholm`, `America/Los_Angeles` and `Pacific/Kiritimati`
- [x] `npm run lint && npm run typecheck && npm run build` green (all 333 party pages pre-render)
- [ ] PR body ends with `Closes #16` — pending, no PR opened in this run

## Notes

The two-column wrapper is `flex flex-col md:flex-row` rather than `flex flex-row`. At 375 px the original always-row layout gave the table half the viewport, wrapping every label onto two lines and the date onto three, with the reserved right-hand column sitting empty beside it. Plan step 7 anticipated this and authorised the change; the empty `flex-1` column is kept for #21 and the desktop layout is unchanged.
