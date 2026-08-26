# Issue #53: Kör Partidata som server-renderad Next.js-app

**Based on:** main (`732fd64` vid planstart, granskad mot `3bf4139`)

## Summary

Ersätt den statiska Next.js-exporten med en körande Next.js-app som renderar
partiprofiler från JSON-data vid request. Behåll Pages Router och den befintliga
sidkompositionen, men flytta dataläsning och route-upplösning till serverkod.
Deployen ska använda en fristående Next-artefakt, en hanterad systemprocess och
nginx som reverse proxy.

## Triage Status

| Field | Value |
|-------|-------|
| **Ready to work** | Yes |
| **Risk** | Medium |
| **Safe for junior** | No |

Risken ligger främst i bytet från statisk nginx-root till en Node-process, inte i
React-layouten. En kort driftstörning är acceptabel; nollavbrott, automatisk
rollback och parallell drift av den gamla statiska sajten är inte mål.

## Related Files

- [plan.md](plan.md) – implementation plan and verification matrix
- [progress.md](progress.md) – implementation progress

## Related Issues

- #50 – partiprofilens layout och modulstruktur
- #53 – server-renderad Next.js-app
