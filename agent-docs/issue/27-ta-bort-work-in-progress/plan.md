# Implementation Plan: Ta bort "OBS! Work In Progress" från startsidan när sajten är presentabel

## Summary

The home page tagline still ends with `<strong>OBS! Work In Progress</strong>`. The two placeholder issues it was waiting on (#15 boilerplate/footer, #16 party page data) are merged on `main`, so the notice can go. Replace it with a short, honest one-line description of what the site actually offers, keeping the existing "Öppen data om politiska partier i Sverige" headline sentence.

## Triage Info

> Decision-support metadata for this issue.

| Field | Value |
|-------|-------|
| **Blocked by** | None — #15 (PR #30) and #16 (PR #31) are both merged on `main` |
| **Blocks** | None |
| **Related issues** | #15, #16 (closed; the prerequisites named in the issue), #17 (non-functional search field on the same page — the one remaining placeholder), #23 (responsive home page, touches `index.tsx` layout), #25 (README still carries a "Working on first draft" badge — the README-side of the same cleanup), #21 (will make election participation visible on party pages, relevant to the wording chosen here) |
| **Scope** | 1 file in `src/pages/` |
| **Risk** | Low |
| **Complexity** | Low |
| **Safe for junior** | Yes |
| **Conflict risk** | Medium (file-level) — #23 (open, unplanned) will restructure the same `<div className="text-left my-24">` block in `src/pages/index.tsx`. No plan for it exists in `agent-docs/issue/` yet. Before starting, check for an open #23 branch/PR (`gh pr list --search 23`); if none, merge #27 first so #23 rebases onto the final copy. |

### Triage Notes
The issue comment says this could ride in the same PR as #15 and #16; both shipped without it, so this is now its own small PR. No `agent-docs/github/project.json` exists, so project board fields were not queried. No `release` field, so no branch switch; plan is based on `main`.

## Analysis

- `src/pages/index.tsx` lines 41–44 render the tagline:
  ```tsx
  <p className="description">
    Öppen data om politiska partier i Sverige<br/>
    <strong>OBS! Work In Progress</strong>
  </p>
  ```
  This is the only occurrence of the string in `src/` (`grep -rn "Work In Progress" src`). `.description` in `src/styles/app.scss` is `font-size: 1.5rem; line-height: 1.5`, so a second line of copy fits the existing style.
- What the site actually shows today: an A–Ö index of all registered party designations (`data/parti/index.json`) and, per party, code, abbreviation and registration date from Valmyndigheten (#16). Election participation data exists in `data/val/` but is **not rendered anywhere yet** (#21). The issue's suggested wording ("Registrerade partibeteckningar och valdeltagande per kommun/region, från Valmyndigheten") therefore slightly overstates what a visitor can see — see Design Decision 1.
- The footer (`src/components/Footer.tsx`) already carries the longer "Om Partidata" blurb and the source attribution, so the tagline only needs to be a single short line; it should not duplicate the footer.
- The search input directly below the tagline is still non-functional (#17). It is arguably a placeholder too, but the issue scopes the prerequisite to "boilerplate och platshållare (se relaterade issues)", i.e. #15/#16. See Design Decision 2.
- README.md still has a "Status: Working on first draft" badge — out of scope here, covered by #25.

## Implementation Steps

### Phase 1: Replace the notice
1. Edit the tagline paragraph in `src/pages/index.tsx`.
   - Remove the `<strong>OBS! Work In Progress</strong>` line.
   - Replace it with one plain line after the existing `<br/>`: `Registrerade partibeteckningar från Valmyndigheten, med uppgifter om varje parti` (wording per Design Decision 1; one sentence on its own line after the `<br/>`, no `<strong>`; it may wrap on narrow viewports).
   - Leave the `<h1>`, the `<meta name="description">` and the search block untouched.
   - Files to modify: `src/pages/index.tsx`

### Phase 2: Verify
2. Run `npm run lint && npm run typecheck && npm run build`, then `npm run dev` and open `/` at desktop and narrow (≈375 px) widths to check the new sentence reads well when it wraps; confirm nothing else still says "Work In Progress" (`grep -rni "work in progress" src`).

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/pages/index.tsx` | Modify | Replace the WIP notice with a one-line description of the site's content |

## Codebase Areas

- `src/pages/`

## Design Decisions

> Non-trivial choices made during planning. Feedback welcome; otherwise implementation proceeds with these.

### 1. Wording: describe only what is visible today
**Options:** A) Use the issue's suggested text verbatim ("Registrerade partibeteckningar och valdeltagande per kommun/region, från Valmyndigheten"); B) Drop the notice and leave only "Öppen data om politiska partier i Sverige"; C) A shorter sentence limited to what is rendered: "Registrerade partibeteckningar från Valmyndigheten, med uppgifter om varje parti".
**Decision:** C
**Rationale:** The issue asks for an "ärlig beskrivning av vad som finns" (user decision, issue #27). Election participation per kommun/region is in `data/val/` but is not shown anywhere on the site until #21 lands, so A would promise something a visitor cannot find. B is acceptable but loses the concrete hint the issue asks for. When #21 ships, the line can be extended to mention "deltagande i val". The sentence must not mention search either, since the search field is still non-functional (#17). The exact phrasing in C is agent judgment — open to change; any short Swedish sentence that claims neither participation data nor search is fine.

### 2. Leave the non-functional search field alone
**Options:** A) Also remove or hide the search input until #17 makes it work; B) leave it as is.
**Decision:** B
**Rationale:** The issue names boilerplate (#15) and placeholder data (#16) as the prerequisites and calls this "ren uppstädning"; removing the search field changes page layout and pre-empts #17/#23. Agent judgment — if the user considers a dead search box to be a "placeholder" in the sense of this issue, add a step that removes the `<div className="w-3/5 mt-8">…</div>` block and mention it in #17.

### 3. Do not touch `<meta name="description">`
**Options:** A) Align the meta description with the new tagline; B) keep "Öppen data om politiska partier i Sverige".
**Decision:** B
**Rationale:** The meta description is already honest and matches the `<h1>` sentence; #22 covers SEO/head cleanups (lang, canonical) and is the better home for any head changes. Agent judgment.

## Verification Checklist

- [ ] `grep -rni "work in progress" src` returns nothing
- [ ] Home page tagline shows "Öppen data om politiska partier i Sverige" followed by the new sentence on its own line, no bold "OBS" text; reads well at desktop and ≈375 px widths
- [ ] Tagline claims neither data that is not rendered (no "valdeltagande per kommun/region" until #21) nor search (not functional until #17)
- [ ] `npm run lint && npm run typecheck && npm run build` green
- [ ] PR body ends with `Closes #27`
