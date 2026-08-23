# Issue #37: Partier som bytt namn ska ligga på sitt nya filnamn, med redirect från det gamla

**Based on:** main

## Summary

After #36, renamed parties keep their original `filnamn`, so e.g. Enad Röst is served at `/parti/feministiskt-initiativ/` and `/parti/enad-rost/` is a 404. The registry will allocate a new `filnamn` whenever `beteckning` changes, keep the old slugs in `tidigare_filnamn`, move the party directory, and the static site will emit a meta-refresh redirect page for every old slug. The 27 parties currently on a stale slug are migrated in the same PR.

## Triage Status

| Field | Value |
|-------|-------|
| **Ready to work** | Yes |
| **Risk** | High |
| **Safe for junior** | No |

## Plan Review

**Status:** Reviewed
**Reviewed:** 2026-08-23
**Feedback:** Codex caught that the migration set is 27 parties (not 23), that new and renamed parties must share one slug-allocation pass, and that directory moves need a preflight before any write. Also applied: narrowed import-order promise for `tidigare_filnamn`, migration moved to the last phase, #35 listed as blocked, verification against the archived CSV instead of the live URL.

## Related Files

- [plan.md](plan.md) - Full implementation plan
- [progress.md](progress.md) - Implementation progress (if exists)
- [research.md](research.md) - Research findings (if exists)

## Related Issues

- #19 - Uppdatera partidata för valen 2022 och 2026 (closed; the import that surfaced the renames)
- #36 - PR that implemented #19 (merged)
- #35 - Re-import of 2026 data after the election; should run after this change so new renames get redirects
