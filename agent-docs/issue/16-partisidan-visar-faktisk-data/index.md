# Issue #16: Partisidan visar platshållardata istället för partiets faktiska data

**Based on:** main

## Summary

The party page renders a hard-coded "Om partiet" table with placeholder rows instead of the fields in `data/parti/<filnamn>/index.json`, and has no navigation back to the home page. Plan: add a shared `Parti` type in `src/types.ts`, type `getStaticPaths`/`getStaticProps` and the home page's grouped list with it, render `kod`, `forkortning` and a Swedish-formatted `valmyndigheten_registreringsdatum` (hiding rows whose field is missing), and add a `next/link` back to `/`.

## Triage Status

| Field | Value |
|-------|-------|
| **Ready to work** | Yes |
| **Risk** | Low |
| **Safe for junior** | Yes |

## Plan Review

**Status:** Reviewed
**Reviewed:** 2026-08-22
**Feedback:** Codex review caught that the date formatter must pin `timeZone: 'UTC'` to avoid a hydration mismatch for visitors in western timezones, corrected the manual test matrix to the combinations that actually exist in the data (no party has only `forkortning`), toned down the claim that the build validates JSON shape, and added a `params?`/`notFound` guard plus a narrow-viewport check.

## Related Files

- [plan.md](plan.md) - Full implementation plan
- [progress.md](progress.md) - Implementation progress (if exists)
- [research.md](research.md) - Research findings (if exists)

## Related Issues

- #21 - Show party participation per election year on the party page; will use the empty right-hand column and the `Parti` type
- #17 - Functional search on the home page; benefits from the typed party list
- #27 - Remove the "OBS! Work In Progress" notice; waits on this issue
