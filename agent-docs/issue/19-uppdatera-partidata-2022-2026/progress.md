# Implementation Progress: Issue #19

**Started:** 2026-08-23
**Last updated:** 2026-08-23
**Completed:** 2026-08-23
**Status:** Completed

## Completed Steps

- [x] Phase 1, Step 1: `scripts/utils.js` — add `fetchText`/`parseCsv`, remove `loadXML`
- [x] Phase 1, Step 2: `scripts/import-val.js` CLI with header/row validation
- [x] Phase 1, Step 3: Build `partier`/`riksdag`/`region`/`kommun` in memory
- [x] Phase 1, Step 4: Build-validate-write sequence with invariant assertions
- [x] Phase 1, Step 5: Import summary log
- [x] Phase 2, Step 6: Rewrite `scripts/parti.js` as registry module
- [x] Phase 2, Step 7: `upsertParties` identity reconciliation
- [x] Phase 2, Step 8: `buildParties` derived fields and `deltagande`
- [x] Phase 2, Step 9: `kodbyten.json`, `package.json`, `ci.yml`
- [x] Phase 3, Step 10: `node:test` suites and fixtures
- [x] Phase 4, Step 11: Run both imports from downloaded CSVs
- [x] Phase 4, Step 12: Review generated diff
- [x] Phase 4, Step 13: Re-run in reverse order, confirm clean tree
- [x] Phase 4, Step 14: Delete `collect.js` and `helpers.js`
- [x] Phase 4, Step 15: `src/types.ts` new optional `Parti` fields
- [x] Phase 4, Step 16: `src/components/Footer.tsx` source link
- [x] Phase 4, Step 17: README data/scripts sections, CLAUDE.md
- [x] Phase 4, Step 18: lint/typecheck/build/test + spot-checks
- [x] Phase 4, Step 19: Follow-up issue for the post-deadline 2026 re-import

## Current Work

All phases complete. Steps 10–12 of the skill (commit, push, PR) were not run —
`/work-issue` was invoked without `--commit`/`--PR`, so the work stays on
`issue/19-uppdatera-partidata-2022-2026` for review.

## Notes

Snapshot downloaded 2026-08-22T22:42:05Z:

- 2022 `56882d794a390469618a557e3fef1229b60ea562548871f674f6d9de2204bb77`
- 2026 `fa87dd90e0184b9d166cbed75f674d32a312ac7e2628d79df852ce0735a3346e`

Two facts in the CSVs force small deviations from the plan text:

1. The 2022 file has CRLF endings and a trailing `;` on every data row (17 fields
   against a 16-column header). `parseCsv` therefore accepts one trailing empty
   field; any other width mismatch is still an error.
2. `REGISTRERADPARTIBETECKNING` is per anmälan, not per party: five codes in the
   2026 file carry both `J` and `N` rows. `registrerad_partibeteckning` is
   derived as "any `J` row" instead of asserting a single value per code.

Import results (both years, from the snapshot above):

- 2022: 46 115 rows, 340 parties, 103 in riksdagsvalet, 20 regions, 290 kommuner;
  150 new parties, 14 merged on name, 8 renamed.
- 2026: 57 266 rows, 416 parties, 169 in riksdagsvalet, 20 regions, 290 kommuner;
  190 new parties, 7 merged on name, 24 renamed.
- Registry grows from 333 to 673 parties. No pre-existing `uuid` or `filnamn`
  changed. Re-running both imports in either order, and `node scripts/parti.js`
  on top, leaves `data/` byte-identical.

`data/parti/kodbyten.json` is `{}`: no import hit an ambiguous name.

One further deviation from the plan text: the name fallback rules out a
candidate whose codes appear in the year being imported, not in every year from
2022 onwards. The stricter reading blocks exactly the re-codes the fallback
exists for (Kalle Ankapartiet `1579`→`1825` participates in 2022 under the old
code), and would leave a stale page beside a new one.

Follow-up issue for re-importing 2026 once Valmyndigheten's file is final:
swedev/partidata#35.
