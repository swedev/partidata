# Implementation Progress: Issue #18

**Started:** 2026-08-23
**Last updated:** 2026-08-23
**Completed:** 2026-08-23
**Status:** Completed

## Completed Steps

- [x] Phase 1, Step 1: `git mv src/utils.js scripts/utils.js`
- [x] Phase 1, Step 2: Drop `lodash`/`uuid` in `scripts/utils.js` (NFD normalisation, `crypto.randomUUID()`)
- [x] Phase 1, Step 3: Drop `lodash` in `scripts/parti.js` (destructuring instead of `_.pick`)
- [x] Phase 2, Step 4: Add `ROOT`/`dataPath` and root-anchored `loadJSONFile` in `scripts/utils.js`
- [x] Phase 2, Step 5: Use the helper in `scripts/helpers.js`, `scripts/collect.js`, `scripts/parti.js`
- [x] Phase 3, Step 6: Add `"collect"` npm script in `package.json`
- [x] Phase 3, Step 7: `README.md` — "Köra skripten" section, fix `./utils.js` reference
- [x] Phase 3, Step 8: `CLAUDE.md` — accurate description of how the scripts run
- [x] Phase 4, Steps 9–12: Verification

## Verification Checklist

- [x] `npm run collect` from the repo root logs `Starting at index: 208`, writes the file, and `git diff --exit-code -- data/val/2018/partideltagande/kommun.json` passes
- [x] Same run from another working directory (absolute path to the script) behaves identically
- [x] `node scripts/parti.js` from another directory leaves `data/parti/index.json` byte-identical
- [x] `npm run collect` exists and runs `scripts/collect.js`
- [x] `src/utils.js` is gone; `scripts/utils.js` exports `toFileName`, `newUuid`, `loadXML`, `loadJSONFile`, `dataPath` (and `ROOT`)
- [x] `grep -rn "lodash\|require('uuid')" scripts src` finds nothing; no new dependencies
- [x] `parseULFile`/`parseKommunXMLFile` unchanged; no unused `path` require in `collect.js`/`parti.js`; `Buffer` require kept in `utils.js`
- [x] `toFileName('Östra vägen (C)') === 'ostra-vagen-c'`; `newUuid()` matches the v4 pattern
- [x] `README.md` has "Köra skripten" and no longer references `./utils.js`; `CLAUDE.md` describes `npm run collect`
- [x] `npm run precommit` (lint + typecheck + build) green
- [ ] PR body ends with `Closes #18` — not done: `/work-issue` was invoked without `--commit`/`--PR`, so the work stays on the feature branch

## Notes

Branch `issue/18-datainsamlingsskripten-trasiga` created from `main`. Changes are uncommitted on that branch.

Slug check over all 333 entries in `data/parti/index.json`: NFD normalisation reproduces the committed `filnamn` for 325 entries; the 8 differences are exactly the hand-adjusted ones the plan predicted — `framstegspartiet-1223/1224/1226` (disambiguated by partikod), and `igov-direct-`, `ip-idrottspartiet-radda-stadshagens-ip-`, `kommunens-rost-`, `oppna-goteborg-` (trailing `-` from an older version of the function) plus `langen-amp-co` (from an `&amp;` entity). No `beteckning` contains a character that `_.deburr` transliterates but NFD does not (ø æ ß đ þ œ), so no slug changes for the current dataset.

`scripts/helpers.js` keeps its `fs` and `path` requires — both are still used by `parseULFile`/`parseKommunXMLFile`, which the plan leaves untouched.

The smoke test makes no HTTP request (all 208 kommuner already have `partier`), so it proves startup and path resolution only, not that collection from `data.val.se` still works — that is #19's concern.
