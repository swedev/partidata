# Issue #15: Ta bort create-next-app-boilerplate och lorem ipsum från startsida och sidfot

**Based on:** main

## Summary

The live home page still renders the four `create-next-app` cards (Documentation/Learn/Examples/Deploy) and the site-wide footer shows three "Header" + lorem ipsum columns. Plan: delete the cards block from `src/pages/index.tsx` together with the orphaned `.grid`/`.card` (and `.code`/`.logo`) rules in `src/styles/app.scss`, and rewrite `src/components/Footer.tsx` with real Swedish content — project blurb, GitHub link, data sources (Valmyndigheten, SCB), CC0 licence and hello@swedev.org — inside the existing column structure, leaving layout/responsiveness to #23.

## Triage Status

| Field | Value |
|-------|-------|
| **Ready to work** | Yes |
| **Risk** | Low |
| **Safe for junior** | Yes |

## Plan Review

**Status:** Reviewed
**Reviewed:** 2026-08-22
**Feedback:** Codex review fixed the card block's line range (67–95, not 67–99, which would have removed `</main>`/`<Footer />`), raised conflict risk to Medium because #23 edits the same footer JSX/CSS, made the link-colour fix deterministic (`text-yellow-200 underline` on anchors), tightened the copy ("partiers deltagande i val", SCB = region codes only) with precise source URLs, and extended verification to several viewport widths.

## Related Files

- [plan.md](plan.md) - Full implementation plan
- [progress.md](progress.md) - Implementation progress (if exists)
- [research.md](research.md) - Research findings (if exists)

## Related Issues

- #27 - Remove "OBS! Work In Progress" from the home page; waits on this issue and #16, kept out of scope here
- #23 - Home page and footer not responsive; touches `Footer.tsx` and the same `app.scss` rules
- #25 - README rewrite; overlapping copy about licence and data sources
- #16 - Party page shows placeholder data; together with this issue it gates #27
