# Issue #19: Uppdatera partidata för valen 2022 och 2026 (nuvarande data är från 2018/2020)

**Based on:** main

## Summary

All election data is from 2018 and the party register from ~2020. A new `scripts/import-val.js <år>` downloads (or reads via `--file`) Valmyndigheten's `deltagande-partier.csv` for 2022 and 2026, validates it, reconciles `data/parti/` on `PARTIKOD` (preserving every existing `uuid` and `filnamn`, with a committed alias file plus a single-candidate name fallback for re-coded parties, and `-<kod>` suffixes for slug collisions), and writes `data/val/<år>/partideltagande/{partier,riksdag,region,kommun}.json` with all 290 kommuner. Party fields (current code, name, abbreviation, registration flag, per-year `deltagande`) are derived from the year files so rebuilds are order-independent. The XML collector is removed and `node:test` tests are added. Rendering the new data on the party page is left to #21.

## Triage Status

| Field | Value |
|-------|-------|
| **Ready to work** | Yes — the import script asserts its own invariants (unique `filnamn`, unique `uuid`, every party referenced from val data exists in the index, all 290 kommuner present) and exits non-zero on violation; #24 generalises this into CI later |
| **Risk** | High |
| **Safe for junior** | No |

## Plan Review

**Status:** Reviewed
**Reviewed:** 2026-08-23
**Feedback:** Two codex passes. Applied: identity reconciliation made order-independent (code set per party, current code/name derived from the newest year file, alias file + fail-on-ambiguity), build-everything-then-write sequence, per-year `partier.json`, `node:test` suite wired into CI, snapshot policy for the mutable 2026 file, UI work moved to #21, triage corrected (#24 sequencing, #25 README overlap, risk High).

## Related Files

- [plan.md](plan.md) - Full implementation plan
- [progress.md](progress.md) - Implementation progress (if exists)
- [research.md](research.md) - Research findings (if exists)

## Related Issues

- #24 - Validate data/ in CI — not a blocker; the import asserts the invariants it depends on, #24 later generalises them into a CI check
- #18 - Scripts broken (closed, merged in `ba9c1c9`) — prerequisite, done
- #29 - collect.js error handling (closed) — superseded by this import
- #20 - kommun.json 208/290 (closed) — 2022/2026 kommun files cover all 290; 2018 file unchanged
- #21 - Show participation on the party page — consumes the `deltagande` data produced here
- #25 - README rewrite — overlaps `README.md`; this plan edits only the data/scripts sections
- #33 - Candidate lists from kandidaturer.csv — builds on the CSV helper and registry from this plan
