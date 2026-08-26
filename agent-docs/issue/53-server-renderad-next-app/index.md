# Issue #53: Kör Partidata som server-renderad Next.js-app

**Based on:** main (`732fd64`)

## Summary

Ersätt den statiska Next.js-exporten med en körande Next.js-app som renderar
partiprofiler från JSON-data vid request. Behåll Pages Router och den befintliga
sidkompositionen, men flytta dataläsning och route-upplösning till serverkod.
Deployen ska använda en fristående Next-artefakt, atomiska releaser, en hanterad
systemprocess och nginx som reverse proxy.

## Triage Status

| Field | Value |
|-------|-------|
| **Ready to work** | Yes |
| **Risk** | High |
| **Safe for junior** | No |

Risken ligger främst i deploymigreringen och rollback, inte i React-layouten.
Nuvarande produktion ska fortsätta fungera tills den nya appen har startats och
verifierats separat.

## Related Files

- [plan.md](plan.md) – implementation plan and verification matrix
- [progress.md](progress.md) – implementation progress

## Related Issues

- #50 – partiprofilens layout och modulstruktur
- #53 – server-renderad Next.js-app

