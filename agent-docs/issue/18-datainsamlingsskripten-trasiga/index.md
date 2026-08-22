# Issue #18: Datainsamlingsskripten i scripts/ är trasiga (fel sökväg till utils, saknade beroenden)

**Based on:** main

## Summary

`node scripts/collect.js` fails immediately: the scripts `require('./utils.js')` but the file is at `src/utils.js`, the file needs `lodash` and `uuid` which are not in `package.json`, and data paths mix `process.cwd()` and `__dirname`. Plan: `git mv src/utils.js scripts/utils.js`, replace `_.deburr`/`_.pick`/`uuid` with `String.prototype.normalize`, destructuring and `crypto.randomUUID()` (no new dependencies), resolve all committed data paths from a repo-root constant, add `npm run collect`, and document the scripts in `README.md`/`CLAUDE.md`. Deliberately minimal — #19 replaces `collect.js`/`helpers.js`/`parti.js` with a CSV import.

## Triage Status

| Field | Value |
|-------|-------|
| **Ready to work** | Yes |
| **Risk** | Low |
| **Safe for junior** | Yes |

## Plan Review

**Status:** Reviewed
**Reviewed:** 2026-08-23
**Feedback:** Codex review caught that `Buffer` is in fact used by `loadXML` (do not drop it), that the ad-hoc XML/HTML parsers should be left alone to keep scope minimal, that the cwd-independence test needs absolute paths and `git diff --exit-code` on the two rewritten data files, and that the smoke test proves startup only (no network). Also added #25 (README rewrite) as a related issue, the #18 → #24 → #19 sequencing, and pushed slug-collision checks for new names to #19.

## Related Files

- [plan.md](plan.md) - Full implementation plan
- [progress.md](progress.md) - Implementation progress (if exists)
- [research.md](research.md) - Research findings (if exists)

## Related Issues

- #19 - Update party data for the 2022 and 2026 elections; depends on this issue and will remove most of `scripts/` afterwards
- #24 - Validate `data/` in CI; proposes a pure-Node `scripts/validate.js` in the same no-dependencies spirit; should land before #19
- #25 - README update to current state; overlaps on the `./utils.js` reference and local-running docs
- #20 - kommun.json has 208 of 290 kommuner (closed, superseded by #19)
- #29 - collect.js error handling (closed, superseded by #19)
