# Issue #102: The source badge on the party page shows an invented abbreviation and no background

**Based on:** main

## Summary

The party page's source badge ("Partiets egna kanaler", "Från partiet", "Partiets egen webbplats") shows the first two letters of the party name when the registry has no `forkortning`, and draws its background only from `accentfarg`, so a party without one gets loose letters. The badge is replaced by the party symbol, rendered with the existing `PartySymbol` component from the `symbolSrc`/`symbolFrame` the page already receives, in a neutral bordered box; a party without a symbol falls back to the registry abbreviation, and a party with neither gets no mark. The three inline copies become one `SourceBrand` component in `shared.tsx`, the badge stops reading `accentfarg`, and the HTTP smoke test asserts that a profiled party's badge shows its symbol and no letters. One PR.

## Triage Status

| Field | Value |
|-------|-------|
| **Ready to work** | Yes |
| **Risk** | Low |
| **Safe for junior** | Yes |

## Plan Review

**Status:** Pending
**Reviewed:** Not yet
**Feedback:** Two codex passes on 2026-09-07 applied: a non-circular symbol width in the badge (width only, so `aspect-ratio` keeps the measured ratio), per-badge smoke assertions split on the container class token, a `.ts` helper for the fallback chain with a unit test, `aria-hidden` on the text fallback, and corrected claims about abbreviation collisions and which parties render which badges. A third pass on the revised plan did not complete, so the content is not yet recorded as reviewed.

## Related Files

- [plan.md](plan.md) - Full implementation plan
- [progress.md](progress.md) - Implementation progress (if exists)
- [research.md](research.md) - Research findings (if exists)

## Related Issues

- #77 - Decides whether `accentfarg` and `symbolvisning` stay; this plan removes the badge's dependence on `accentfarg` and leaves the field alone
- #68 (#70, #71, #73) - Fill the profile modules the badge sits on
