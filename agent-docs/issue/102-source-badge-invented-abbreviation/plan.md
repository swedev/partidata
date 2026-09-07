# Implementation Plan: The source badge on the party page shows an invented abbreviation and no background

## Summary

The party page marks content that comes from the party itself with a small badge next to "Partiets egna kanaler", "Från partiet" and "Partiets egen webbplats". Today the badge is a `<span>` inside `.profile-source-brand`, rendered three times in `src/components/party-profile/overview.tsx`, that shows `abbreviation ?? profile.namn.slice(0, 2).toUpperCase()` on an inline `background: profile.accentfarg`. Two things follow from that: a party without `forkortning` in the registry (381 of 670) gets two letters that are not an abbreviation and can collide with a real one, and a party without `accentfarg` in `profil.json` (two of the three parties that have a profile, CIVIS among them) gets loose letters with no box, because the stylesheet gives the badge size, radius and text colour but no default background.

The badge is replaced by the party symbol, rendered with the existing `PartySymbol` component from the `symbolSrc`/`symbolFrame` the page already receives, inside a neutral box. A party without a symbol falls back to the registry abbreviation on the same neutral box; a party with neither gets no box at all, only the heading. The three copies of the markup collapse into one `SourceBrand` component in `src/components/party-profile/shared.tsx`, the badge stops reading `accentfarg` entirely, and the HTTP smoke test asserts that a party with a profile shows the symbol in the badge rather than letters.

## Triage Info

> Decision-support metadata for this issue.

| Field | Value |
|-------|-------|
| **Blocked by** | None |
| **Blocks** | None |
| **Related issues** | #77 (open; decides whether `accentfarg` and `symbolvisning` stay — this plan removes the badge's only dependence on `accentfarg` and leaves the field, its validation and `--profile-accent` alone), #68/#70/#71/#73 (open; fill the profile modules the badge sits on, so more parties will render it) |
| **Scope** | 7 files across `src/components/party-profile/`, `src/pages/parti/`, `src/styles/` and `scripts/` |
| **Risk** | Low |
| **Complexity** | Low |
| **Safe for junior** | Yes |
| **Conflict risk** | Low — no open plan in `agent-docs/issue/` touches `overview.tsx`, `shared.tsx`, `[filnamn].tsx` or `_party-profile.scss` (#105 did, and is merged) |

### Triage Notes

- No blockers. GitHub's dependency field is empty and the issue body names none. The repo has no `agent-docs/github/` configuration, so no project board was consulted.
- Work starts from `main` (`c392df9`). There is no `release/*` branch and no release field, so no branch switch.
- The badge only renders inside sections gated on `profile.kanaler`, `profile.dokument` and `profile.foretradare`, so today it appears on the three parties with a `profil.json`: CIVIS (no `forkortning`, no `accentfarg`, symbol present), Liberalerna (`L`, no `accentfarg`, `symbolvisning: 'mark'`, symbol present) and Miljöpartiet (`MP`, `#53a045`, symbol present). All three have a measured symbol, so the fallback branches are not exercised by committed data; they exist for the 419 registry parties without a symbol should they get a profile.
- The issue states that every party has a symbol from Valmyndigheten. That holds for the parties that stand in riksdag elections, not for the registry as a whole (251 of 670 carry `partisymbol`), which is why the plan keeps a text fallback rather than assuming the symbol.
- `src/components/party-profile/elections.tsx` line 177 uses `profile-source-brand profile-source-brand--small` for a text-only source line with no badge. It is not changed, and the selector changes in step 4 must keep it rendering as today.

## Analysis

**Where the data already is.** `getServerSideProps` in `src/pages/parti/[filnamn].tsx` receives `symbolSrc` (`/partisymbol/<slug>/<file>`) and `symbolFrame` (the measured drawing box) from `readCurrentParty` in `src/server/party-data.ts`, and passes both to `ProfileHero` for the hero logotype. `DocumentsSection` and `RepresentativesSection` only receive `profile` and `abbreviation`. No server change is needed: the page hands the two extra props down.

**How a symbol is drawn small.** `src/components/PartySymbol.tsx` renders `<span class="party-symbol party-symbol--beskuren" style="--party-symbol-ratio: …"><img …></span>` when a frame exists, and `party-symbol--hel` with `<Image fill>` otherwise. The caller sizes the outer span; `src/styles/_party-card.scss` shows the pattern for a fixed-height box: `width: min(<cap>, <height> * var(--party-symbol-ratio))`. The badge is a fixed-height box (2.75rem, 2.125rem in the small variant), so a wordmark such as Liberalerna's (1002×150 drawing, ratio 6.7) gets the full width cap and a mark such as CIVIS's (251×152) is nearly square. Without `alt`, `PartySymbol` sets `aria-hidden`, which is the right thing for a badge whose heading already says whose content it is.

**Why the selectors have to change.** `_party-profile.scss` styles the badge through `.profile-source-brand > span`. `PartySymbol` itself renders a `<span>`, so putting it directly under `.profile-source-brand` would inherit the 2.75rem square, the text colour and the flex centring intended for letters. The badge gets its own class, `profile-source-brand__mark`, and the letter variant a modifier; the `> span` selectors go.

**What can be tested where.** `scripts/` tests load `.ts` modules straight from `src/` through Node's type stripping (`scripts/home-filtering.test.js` requires `src/components/home/filtering.ts`), but not `.tsx`, so the badge's fallback chain is put in a plain `.ts` function next to the component and the component only renders what it returns. The committed profiles (all with a symbol) exercise the symbol branch through the smoke test; the abbreviation and no-mark branches are covered by the unit test.

**What stays.** `accentfarg` remains in `src/types.ts`, `scripts/validate.js` and `--profile-accent` in `[filnamn].tsx` (used by `_party-profile.scss` line 416 for a different element). Whether it survives is #77's question; after this change nothing about the badge depends on it. `symbolvisning` is likewise untouched.

## Implementation Steps

### Phase 1: One badge component

1. Add `SourceBrand` to `src/components/party-profile/shared.tsx`
   - Props: `symbolSrc?: string`, `symbolFrame?: SymbolFrame`, `abbreviation?: string`, `small?: boolean`, `children: ReactNode` (the heading or the `<div><strong>…</strong><small>…</small></div>` text block)
   - Renders `<div className="profile-source-brand[ profile-source-brand--small]">` with the mark first and `children` after
   - The choice of mark lives in `src/components/party-profile/source-mark.ts`: `sourceMark({ symbolSrc, abbreviation })` returns `{ kind: 'symbol', src }` when `symbolSrc` is set, `{ kind: 'text', text }` when only a non-empty `abbreviation` is set, and `undefined` otherwise; the component never looks at the party name
   - Rendering per kind, from the returned object so the type narrows (`symbolSrc` itself stays optional and would not typecheck as `PartySymbol`'s required `src`): `mark.kind === 'symbol'` → `<span className="profile-source-brand__mark"><PartySymbol src={mark.src} frame={symbolFrame} sizes="96px" /></span>`; `mark.kind === 'text'` → `<span className="profile-source-brand__mark profile-source-brand__mark--text" aria-hidden="true">{mark.text}</span>` (decorative in both branches, decision 4); `undefined` → no mark element at all
   - Imports `PartySymbol` from `src/components/PartySymbol` and `SymbolFrame` type from `src/server/party-data` (type-only import, as `overview.tsx` does today)
   - `scripts/source-brand.test.js` (node:test, requiring the `.ts` file like `home-filtering.test.js` does): symbol wins over abbreviation; abbreviation alone gives `text`; empty-string abbreviation and nothing at all give `undefined`; the party name is not an input
   - Files to create: `src/components/party-profile/source-mark.ts`, `scripts/source-brand.test.js`; files to modify: `src/components/party-profile/shared.tsx`

2. Replace the three inline badges in `src/components/party-profile/overview.tsx`
   - `OfficialChannels`: `<SourceBrand symbolSrc symbolFrame abbreviation><h2 id="channels-heading">Partiets egna kanaler</h2></SourceBrand>`; the component takes `symbolSrc`/`symbolFrame` as new props, passed from `ProfileHero`, which already has them
   - `DocumentsSection`: the aside's badge becomes `<SourceBrand small …><div><strong>Från partiet</strong><small>Dokument hos utgivaren</small></div></SourceBrand>`; the section gains `symbolSrc`/`symbolFrame` props
   - `RepresentativesSection`: the `aside` passed to `SectionHeader` becomes the same `SourceBrand small` with `<div><strong>Partiets egen webbplats</strong>{sourceHost && <small>{sourceHost}</small>}</div>`; the section gains `symbolSrc`/`symbolFrame` props
   - Remove every `profile.namn.slice(0, 2)` and every `style={{ background: profile.accentfarg }}`; after this step `accentfarg` does not appear in `overview.tsx`
   - Files to modify: `src/components/party-profile/overview.tsx`

3. Pass the symbol to the two sections from the page
   - `src/pages/parti/[filnamn].tsx`: `<DocumentsSection … symbolSrc={symbolSrc} symbolFrame={symbolFrame} />` and the same on `RepresentativesSection`
   - Files to modify: `src/pages/parti/[filnamn].tsx`

### Phase 2: Styling

4. Restyle the badge in `src/styles/_party-profile.scss`
   - Replace `.profile-source-brand > span` with `.profile-source-brand__mark`, sized through three custom properties so the small variant overrides values rather than rules: `--profile-mark-height: 2.75rem; --profile-mark-inset: 0.3rem; --profile-mark-max: 6.5rem`, then `display: flex; box-sizing: border-box; height: var(--profile-mark-height); min-width: var(--profile-mark-height); padding: var(--profile-mark-inset); border: 1px solid var(--profile-line); border-radius: 0.5625rem; background: var(--profile-paper); align-items: center; justify-content: center; flex: none`
   - The paper background with a line border reads on both the card-coloured channels block and the paper-coloured document aside and section header; a background alone would vanish on one of them
   - The symbol gets a definite width of its own, so the wrapper's width follows the child and nothing is circular, and only the width is set so `aspect-ratio` in `_party-symbol.scss` keeps the measured ratio (setting both width and height would squeeze a capped wordmark): `--profile-mark-inner: calc(var(--profile-mark-height) - 2 * var(--profile-mark-inset) - 2px)` (padding and border subtracted), then `.profile-source-brand__mark .party-symbol--beskuren { width: min(calc(var(--profile-mark-max) - 2 * var(--profile-mark-inset) - 2px), calc(var(--profile-mark-inner) * var(--party-symbol-ratio))) }` — a mark fills the inner height, a wordmark wider than the cap gets the cap and a proportionally smaller height, as in `_party-card.scss`; `.profile-source-brand__mark .party-symbol--hel { width: var(--profile-mark-inner); height: var(--profile-mark-inner) }` (a symbol without a measured frame is fitted to a square by `object-fit: contain`, which does not distort)
   - Text fallback: `.profile-source-brand__mark--text { color: var(--profile-ink); font-size: 0.875rem; font-weight: 700 }` (the hard-coded `#102e12` goes)
   - Small variant: replace `.profile-source-brand--small > span` with `.profile-source-brand--small .profile-source-brand__mark { --profile-mark-height: 2.125rem; --profile-mark-inset: 0.25rem; --profile-mark-max: 5rem; border-radius: 0.4375rem; font-size: 0.75rem }`
   - Leave `.profile-source-brand`, `.profile-source-brand h2`, `.profile-source-brand--small`, `--small div`, `--small strong` and `--small small` as they are, so the text-only use in `elections.tsx` is unaffected
   - Files to modify: `src/styles/_party-profile.scss`

### Phase 3: Verification in the smoke test

5. Assert the badges in `scripts/http-smoke.js`
   - The smoke test already fetches `current` (line 187: Miljöpartiet when present, otherwise the first party) as `profileBody`. Read `data/parti/<current.filnamn>/profil.json` if it exists and count the badge-bearing sections: `kanaler`, `dokument` and `foretradare` with length > 0. Skip the block with a clear message when the profile is missing or the count is 0, or when `current.partisymbol` is missing — today Miljöpartiet has all three and a symbol, so the block runs
   - Split `profileBody` on the container class token only, `/class="profile-source-brand(?=[ "])/` (a bare `profile-source-brand` prefix would also split at `profile-source-brand__mark` and lose the very substring the next filter looks for), drop the leading piece, and keep the pieces that contain `profile-source-brand__mark` (the turnout section's text-only line has no mark and is not counted); assert their number equals the counted sections: "partisidan har ett källmärke per partisektion"
   - For every piece, assert it contains `class="party-symbol` and `/partisymbol/<current.filnamn>/<current.partisymbol.filnamn>` within the badge markup, bounded so the hero logotype (`profile-logo__frame`) cannot satisfy it: "varje källmärke visar partisymbolen"
   - Assert `doesNotMatch(profileBody, /profile-source-brand__mark--text/)`: "källmärket visar inga bokstäver när symbolen finns"
   - Keep the assertions inside the existing `try` block, with the same Swedish message style as the surrounding checks
   - Files to modify: `scripts/http-smoke.js`

6. Run `npm run precommit` (lint, typecheck, data validation, tests, standalone build, HTTP smoke) and look at the three profiled parties in a browser, at desktop and at a narrow viewport (the channels block collapses its grid): `/parti/miljopartiet-de-grona/` renders all three badges (channels, documents, representatives), `/parti/civis/` two (channels, documents) and `/parti/liberalerna-tidigare-folkpartiet/` one (documents). Each shows the symbol at the badge height in a bordered box; the Liberalerna wordmark stops at `--profile-mark-max` instead of overflowing the aside

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/components/party-profile/source-mark.ts` | Create | Pure choice of mark: symbol, else registry abbreviation, else none |
| `src/components/party-profile/shared.tsx` | Modify | New `SourceBrand` component rendering that choice |
| `scripts/source-brand.test.js` | Create | node:test for the fallback chain |
| `src/components/party-profile/overview.tsx` | Modify | Three inline badges replaced by `SourceBrand`; `symbolSrc`/`symbolFrame` threaded to `OfficialChannels`, `DocumentsSection`, `RepresentativesSection`; `accentfarg` and `namn.slice` removed |
| `src/pages/parti/[filnamn].tsx` | Modify | Pass `symbolSrc`/`symbolFrame` to `DocumentsSection` and `RepresentativesSection` |
| `src/styles/_party-profile.scss` | Modify | `.profile-source-brand__mark` with neutral background and border; symbol sizing; `> span` selectors removed |
| `scripts/http-smoke.js` | Modify | Assert every badge on the profiled party shows its symbol and none shows letters |

## Codebase Areas

List the primary directories/areas this plan touches (for conflict detection):
- `src/components/party-profile/`
- `src/pages/parti/`
- `src/styles/`
- `scripts/` (`http-smoke.js`, new `source-brand.test.js`)

## Design Decisions

> Non-trivial choices made during planning. Each is either settled here, with its provenance, or explicitly marked as needing the user because a wrong choice would do unrecoverable damage. Feedback welcome; otherwise implementation proceeds with these, and agent-judgment decisions are listed in the PR for review.

### 1. The badge shows the party symbol
**Options:** A) party symbol via `PartySymbol`; B) keep a text badge with the registry abbreviation only
**Decision:** A
**Provenance:** user decision (issue #102, "Direction the maintainer prefers (2026-09-07): show the party symbol in the badge instead of letters")
**If wrong:** bounded — a component swap in one file
**Rationale:** the symbol is what the page already uses for identification and cannot be confused with another party.

### 2. Fallback chain: symbol, then registry abbreviation, then no mark
**Options:** A) symbol → abbreviation → nothing; B) symbol → nothing
**Decision:** A
**Provenance:** agent judgment, within the issue's allowance ("If a text badge is kept for some case, it shows the registry abbreviation or nothing, never a truncated name")
**If wrong:** bounded — deleting one branch and one CSS rule
**Rationale:** 419 registry parties have no symbol; if one of them gets a profile (#68), a marker with the abbreviation Valmyndigheten records is still a fact about the party, where two letters of the name are not (registry abbreviations are not unique either — `NR`, `VF` and `HP` each belong to more than one party — but they are the registry's, not ours). B would be right if the maintainer would rather no party page ever carry a letter badge.

### 3. Neutral box: paper background with a line border, no `accentfarg`
**Options:** A) `var(--profile-paper)` + `1px solid var(--profile-line)`; B) `var(--profile-card)` only; C) keep `accentfarg` when present, neutral otherwise
**Decision:** A
**Provenance:** agent judgment; the issue requires "a neutral default background that does not depend on `accentfarg`", and #77 still owns the accent colour
**If wrong:** bounded — two CSS declarations
**Rationale:** the badge sits on both card-coloured (channels block) and paper-coloured (document aside, section header) surfaces, so a background alone disappears on one of them; the border makes the box visible on both. C would reintroduce the dependence the issue removes and pre-empt #77.

### 4. Symbol is decorative in the badge
**Options:** A) decorative — no `alt` on the symbol (PartySymbol sets `aria-hidden`) and `aria-hidden` on the text fallback; B) `alt="Partisymbol för <namn>"` and a spoken abbreviation
**Decision:** A
**Provenance:** agent judgment
**If wrong:** bounded — two attributes
**Rationale:** the adjacent heading or label already states the source ("Partiets egna kanaler", "Från partiet"); a second announcement per section is noise for screen-reader users. B would be right if the heading text is ever made generic.

### 5. One `SourceBrand` component instead of three copies
**Options:** A) component in `shared.tsx`; B) edit the three inline blocks in place
**Decision:** A
**Provenance:** existing convention (`shared.tsx` already holds `SectionHeader`, `SourceLine`, `ExternalLink` for the same reason)
**If wrong:** bounded
**Rationale:** the bug existed three times because the markup did; one component means the fallback chain is defined once.

### 6. Verification lives in the HTTP smoke test
**Options:** A) assertion in `scripts/http-smoke.js`; B) a React render test
**Decision:** A
**Provenance:** existing convention (the repo has no component-render tests; party-page rendering is checked in `http-smoke.js`, e.g. lines 357–406)
**If wrong:** bounded
**Rationale:** matches how every other party-page rendering rule is verified here.

## Verification Checklist

- [ ] `/parti/civis/` shows the CIVIS symbol in a bordered box next to "Partiets egna kanaler" and "Från partiet" — no "CI" — at desktop and narrow widths
- [ ] `/parti/liberalerna-tidigare-folkpartiet/` shows the wordmark capped by the mark's `max-width`, not overflowing the heading row
- [ ] `/parti/miljopartiet-de-grona/` shows the symbol in all three badges (channels, documents, representatives) with no green background
- [ ] `grep -n accentfarg src/components/party-profile/overview.tsx` returns nothing; `--profile-accent` in `[filnamn].tsx` is unchanged
- [ ] The turnout section's text-only `profile-source-brand--small` line in `elections.tsx` renders as before
- [ ] `scripts/source-brand.test.js` covers symbol-over-abbreviation, abbreviation only, empty abbreviation and nothing
- [ ] `npm run precommit` is green, including the new smoke assertions
- [ ] No change under `data/`, `src/types.ts` or `scripts/validate.js`
