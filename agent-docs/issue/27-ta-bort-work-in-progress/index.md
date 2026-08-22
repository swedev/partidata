# Issue #27: Ta bort "OBS! Work In Progress" från startsidan när sajten är presentabel

**Based on:** main

## Summary

The home page tagline still ends with a bold "OBS! Work In Progress" line. Its prerequisites (#15 boilerplate/footer, #16 party page data) are merged, so the plan replaces the notice in `src/pages/index.tsx` with a single honest line describing what the site shows today (registered party designations from Valmyndigheten), without claiming election participation data that is not rendered until #21.

## Triage Status

| Field | Value |
|-------|-------|
| **Ready to work** | Yes |
| **Risk** | Low |
| **Safe for junior** | Yes |

## Plan Review

**Status:** Reviewed
**Reviewed:** 2026-08-22
**Feedback:** Codex review caught that the proposed wording "sökbara per parti" promised a search that does not work yet (#17); replaced with "med uppgifter om varje parti". Also raised conflict risk to Medium for #23's overlap on the same JSX block, swapped `npx serve` for `npm run dev` in verification, and clarified that the new sentence may wrap on narrow viewports.

## Related Files

- [plan.md](plan.md) - Full implementation plan
- [progress.md](progress.md) - Implementation progress (if exists)
- [research.md](research.md) - Research findings (if exists)

## Related Issues

- #15 - Boilerplate/lorem ipsum removal (closed, prerequisite)
- #16 - Party page real data (closed, prerequisite)
- #17 - Functional search field; the remaining placeholder on the home page
- #21 - Election participation on party pages; wording can be extended when it ships
- #23 - Responsive home page; touches the same block in `index.tsx`
- #25 - README rewrite; owns the README "first draft" badge
