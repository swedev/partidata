# Implementation Progress: Issue #37

**Started:** 2026-08-23
**Last updated:** 2026-08-23
**Status:** Completed

## Completed Steps

- [x] Phase 1, Step 1: `tidigare_filnamn` in `PARTY_KEY_ORDER`, `loadParties()` and `upsertParties()`
- [x] Phase 1, Step 2: single-pass `allocateFilnamn(claims, parties)`
- [x] Phase 1, Step 3: rename on `beteckning` change in `buildParties()`
- [x] Phase 1, Step 4: `_assertUnique()` across old slugs, `validateRenames()`
- [x] Phase 1, Step 5: `applyRenames()` between `validate()` and `writeFiles()`
- [x] Phase 2, Step 1: `import-val.js` applies renames and logs slug changes
- [x] Phase 3: tests and fixtures (40 `node:test` cases pass)
- [x] Phase 4: site types, `getStaticPaths`/`getStaticProps`, `RedirectPage`
- [x] Phase 5: `README.md` and `CLAUDE.md`
- [x] Phase 6: data migration of the 27 renamed parties

**Completed:** 2026-08-23

## Verification

- [x] `npm test`: 40 pass, 0 fail
- [x] `node scripts/parti.js` twice in a row leaves no diff between the runs
- [x] `git diff --stat -M main` shows 27 renames under `data/parti/`, `data/parti/index.json` modified, nothing under `data/val/`
- [x] `npm run lint && npm run typecheck && npm run build` green
- [x] `out/` has 700 party pages: 673 party pages plus 27 redirect stubs. `out/parti/enad-rost/index.html` is the party page; `out/parti/feministiskt-initiativ/index.html` carries the meta refresh, canonical link, `noindex` and a text link to `/parti/enad-rost/`
- [x] Serving `out/` and opening `/parti/feministiskt-initiativ/` in a browser lands on `/parti/enad-rost/`; the home page links Enad Röst to `/parti/enad-rost`
- [ ] Re-import with the archived 2026 CSV: the archived file is not on this machine, and the live URL changes hourly. The rebuild from the committed year files is the offline equivalent and is clean.
- [x] README and CLAUDE.md describe `filnamn`/`tidigare_filnamn` and the narrowed order-independence
- [ ] After merge: tag a release so the redirects deploy

## Notes

Deviations from the plan, all open to review:

- **Phase 3 step 7, preflight test.** The plan asked for a test that pre-creates
  `data/parti/nya-testpartiet/` and expects `validateRenames()` to stop the
  import. That path is unreachable: `loadParties()` rejects any directory under
  `data/parti/` without a matching party file, so it throws first, and a
  directory that *does* hold a valid party file simply makes the slug taken and
  the allocator suffixes instead. The preflight is tested through the reachable
  collision instead — a rename whose `data/val/<år>/kandidatlistor/<to>.json`
  already exists — which asserts the same contract: exit 1, nothing written,
  nothing moved. The directory check stays in `validateRenames()` as a guard.
- **`_assertUniqueUuid()`.** Moving slug allocation into `buildParties()` meant a
  registry with a duplicated uuid hit the allocator before `_assertUnique()`, and
  reported a slug collision instead of the duplicate. The uuid check is a
  property of the loaded registry rather than of the build, so it runs first, on
  `parties`, and `_assertUnique()` keeps filnamn and kod.
- **README field table.** The plan asked for a `tidigare_filnamn` row; `filnamn`
  had no row either, so both were added rather than leaving the table with the
  history field but not the field it is history of.
- **Redirect page `<title>`.** `<title>{beteckning} - …</title>` renders empty in
  the export, so the redirect page interpolates a single string instead. The same
  bug is on the party page (`out/parti/*/index.html` all ship an empty title) and
  predates this branch — left alone here, worth its own issue.
