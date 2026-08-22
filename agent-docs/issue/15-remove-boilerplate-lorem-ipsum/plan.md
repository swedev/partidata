# Implementation Plan: Ta bort create-next-app-boilerplate och lorem ipsum från startsida och sidfot

## Summary

The live site (www.partidata.se) still ships two pieces of scaffolding: four `create-next-app` cards on the home page linking to nextjs.org/vercel.com, and a footer with three "Header" + lorem ipsum columns. Remove the cards (and their now-unused CSS) and replace the footer placeholders with real content: a short project blurb, GitHub repo link, data sources (val.se, SCB), licence (CC0) and contact (hello@swedev.org).

## Triage Info

> Decision-support metadata for this issue.

| Field | Value |
|-------|-------|
| **Blocked by** | None |
| **Blocks** | #27 Ta bort "OBS! Work In Progress" från startsidan (soft: #27 waits for boilerplate/placeholders to be gone) |
| **Related issues** | #27 (WIP notice, same area), #23 (responsive home page/footer, touches the same files), #25 (README rewrite — overlapping copy about licence/data sources), #16 (party page placeholder data — the reason #27 stays out of scope). All open as of 2026-08-22. |
| **Scope** | 3 files across `src/pages/`, `src/components/`, `src/styles/` |
| **Risk** | Low |
| **Complexity** | Low |
| **Safe for junior** | Yes |
| **Conflict risk** | Medium — no other plans exist in `agent-docs/issue/`, but #23 (unplanned, open) will edit the same `Footer.tsx` JSX and the `footer` rule in `app.scss`. Keep this PR to content changes and merge it first so #23 rebases onto the real content. |

### Triage Notes
No explicit blockers. There is no `agent-docs/github/project.json`, so GitHub Project board fields were not queried (not verified). Issue has label `bug`, no assignee, no comments. Issue #27 suggests removing the WIP notice "in the same PR as the boilerplate issue", but #27 explicitly waits for *all* placeholders to be gone, including the party page placeholder data (#16), so it stays out of scope here (see Design Decision 1).

## Analysis

- `src/pages/index.tsx` (lines 67–95, from `<div className="grid">` to its closing `</div>`, immediately before `</main>`) renders a `<div className="grid">` with four `<a className="card">` elements — verbatim `create-next-app` output. Nothing else on the site uses `.grid` or `.card`; `src/pages/parti/[filnamn].tsx` uses Bootstrap tables and Tailwind utilities only.
- `src/styles/app.scss` carries the matching `.grid`, `.card`, `.card:hover/...`, `.card h2`, `.card p` rules plus the `@media (max-width: 600px) { .grid { ... } }` block. It also still contains `.code` and `.logo` from the same template; neither class is referenced anywhere in `src/`.
- `src/components/Footer.tsx` is used by both the home page and the party page, so new footer content appears site-wide. It currently has four `flex-1` columns: the `SweDevLogo` and three placeholder columns. The footer has a fixed `height: 250px` in `app.scss` (`footer { height: 250px; ... }`), which is #23's concern — the new content must simply fit inside it at `text-sm`.
- Real content already exists in the repo to draw on: README.md (purpose, val.se and SCB sources, contact mail), `package.json` (`"license": "CC0-1.0"`, repo URL `github.com/swedev/partidata`), and `LICENSE` (CC0 1.0 Universal).
- Site copy is Swedish (CLAUDE.md), so all new footer text must be Swedish.
- Links: `a` in `app.scss` is styled `color: #0070f3`, which will be hard to read on the dark green `bg-swe-gradient` footer. Footer links need an explicit light colour (e.g. Tailwind `text-yellow-200` inherited via `text-inherit`/`text-current` or a `footer a` rule).

## Implementation Steps

### Phase 1: Remove the Next.js cards
1. Delete the `<div className="grid">…</div>` block from the home page.
   - Remove the `<div className="grid">…</div>` element (lines 67–95 as of `main`, the four `<a className="card">` links) in `src/pages/index.tsx`. Match on the markup, not on line numbers; `</main>` and `<Footer />` directly below must stay.
   - Leave the `<ul className="party-index">` and everything above it untouched.
   - Files to modify: `src/pages/index.tsx`
2. Remove the orphaned template CSS from `src/styles/app.scss`.
   - Delete `.grid`, `.card`, `.card:hover, .card:focus, .card:active`, `.card h2`, `.card p` and the trailing `@media (max-width: 600px) { .grid … }` block.
   - Also delete `.code` and `.logo` (template leftovers, unreferenced — see Design Decision 3).
   - Keep `.bg-swe-gradient`, `.main-index`, `.container`, `.description`, `.party-index`, `main`, `footer`, `h1`, `a`.
   - Files to modify: `src/styles/app.scss`

### Phase 2: Real footer content
3. Rewrite the three placeholder columns in `src/components/Footer.tsx`, keeping the logo column and the existing `flex flex-row` / `flex-1 p-3` structure.
   - Column 2 — `<h4>Om Partidata</h4>`: one or two short sentences, e.g. "Öppen data om politiska partier i Sverige: registrerade partibeteckningar och partiers anmälda deltagande i val." plus a link to the GitHub repo `https://github.com/swedev/partidata`. Avoid "valdeltagande" (reads as voter turnout) and do not promise data the site lacks.
   - Column 3 — `<h4>Datakällor</h4>`: list with links to Valmyndigheten — registered party designations (`https://www.val.se/for-partier/partibeteckning/registrerade-partibeteckningar.html`, the URL README cites; check it still resolves, otherwise link `https://www.val.se/`) and SCB — county/municipality codes (`https://www.scb.se/hitta-statistik/regional-statistik-och-kartor/regionala-indelningar/lan-och-kommuner/lan-och-kommuner-i-kodnummerordning/`), labelled so it is clear SCB only supplies region codes. Add a licence line "Datan är fri att använda (CC0 1.0)" linking to `https://creativecommons.org/publicdomain/zero/1.0/`.
   - Column 4 — `<h4>Kontakt</h4>`: `mailto:hello@swedev.org` and a link to GitHub issues (`https://github.com/swedev/partidata/issues`) for contributions/bug reports.
   - Give footer links a readable colour on the green gradient: put `className="text-yellow-200 underline"` on every footer `<a>`. The parent's `text-yellow-200` is not enough because the global `a { color: #0070f3; }` rule in `app.scss` wins over inheritance.
   - External links: plain `<a href>`; no `target="_blank"` needed (agent judgment, keep consistent with the rest of the site which uses plain anchors).
   - Files to modify: `src/components/Footer.tsx`

### Phase 3: Verify
4. Run `npm run lint && npm run typecheck && npm run build` (the CI `Integrate` job).
5. `npm run dev`, open `/` and a real party page (e.g. `/parti/centerpartiet/`, any `filnamn` from `data/parti/index.json`). Check at 1280, 1024 and 768 px: no cards; footer shows real content in four columns; links readable, focus visible, `href`/`mailto:` values correct; footer content fits within the fixed 250px height (`scrollHeight <= clientHeight`) and long URLs/e-mail wrap without horizontal overflow. Also look at 375 px: the four `flex-row` columns are already cramped there before this change (that is #23); confirm the new text keeps the footer no worse than before — keep copy short, and add `break-words` on the columns if an e-mail/URL overflows.
6. Open a PR against `main` (branch + PR flow, squash-merged). End the body with `Closes #15`. Merging is not releasing — deploy requires a `v*` tag (`deploy/README.md`); mention in the PR that a tag is needed to get this live.

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/pages/index.tsx` | Modify | Remove the `.grid`/`.card` Next.js cards block |
| `src/styles/app.scss` | Modify | Remove `.grid`, `.card*`, `.code`, `.logo` and the `.grid` media query |
| `src/components/Footer.tsx` | Modify | Replace "Header"/lorem ipsum columns with about, data sources/licence and contact content |

## Codebase Areas

List the primary directories/areas this plan touches (for conflict detection):
- `src/pages/` (home page only)
- `src/components/` (`Footer.tsx`)
- `src/styles/` (`app.scss`)

## Design Decisions

> Non-trivial choices made during planning. Feedback welcome; otherwise implementation proceeds with these.

### 1. Keep #27 (WIP notice) out of this PR
**Options:** A) Also remove "OBS! Work In Progress" here, as #27 suggests; B) leave it for #27.
**Decision:** B
**Rationale:** #27 conditions the removal on *all* placeholders being gone, including the party page placeholder data (#16), which is still open. Removing the notice now would misrepresent the site's state. (Agent judgment — if the user prefers to fold #27 in, it is a two-line change in `index.tsx` and the PR should then also `Closes #27`.)

### 2. Content-only footer change; leave layout to #23
**Options:** A) Restructure the footer (responsive columns, drop fixed height) while editing it; B) swap content inside the existing four-column structure.
**Decision:** B
**Rationale:** #23 owns responsiveness and the fixed `footer { height: 250px }`. Keeping this PR to content keeps the diff reviewable and avoids two PRs rewriting the same JSX. Text must be brief enough to fit the existing height at ≥768 px. Accepted trade-off (agent judgment): narrow viewports stay as broken as today until #23; if the reviewer would rather fix it here, the minimal change is `flex-col md:flex-row` on the inner container and dropping `footer { height }` in favour of `min-height` — then coordinate with #23.

### 3. Also remove `.code` and `.logo` from `app.scss`
**Options:** A) Remove only `.grid`/`.card` as the issue says; B) also remove the other unused create-next-app rules (`.code`, `.logo`).
**Decision:** B
**Rationale:** They come from the same template, are referenced nowhere in `src/`, and the issue's intent is "remove boilerplate". Agent judgment; trivially reversible.

### 4. Footer copy is Swedish and sourced from existing repo text
**Options:** A) Invent marketing copy; B) reuse README/package.json facts (purpose, val.se, SCB, CC0, hello@swedev.org, GitHub URL).
**Decision:** B
**Rationale:** Issue #15 lists exactly these items; README is the established source. Exact wording is the implementer's call; it must stay in Swedish per CLAUDE.md and must not promise features that do not exist (cf. #25's critique of the README).

## Verification Checklist

- [ ] No "Documentation/Learn/Examples/Deploy" cards on `/`; no links to nextjs.org or vercel.com anywhere in `src/`
- [ ] `grep -rn "grid\|card\|\.code\|\.logo" src/styles/app.scss` returns nothing for the removed selectors
- [ ] Footer on `/` and on a party page shows: about text + GitHub link, Valmyndigheten/SCB links, CC0 licence line, hello@swedev.org
- [ ] Footer links are readable on the green gradient (not default blue `#0070f3`) and `mailto:` works
- [ ] No lorem ipsum or "Header" strings left (`grep -rni "lorem\|>Header<" src`)
- [ ] Footer content does not overflow the fixed 250px height at 768/1024/1280 px; no horizontal overflow at 375 px
- [ ] Copy says "partiers deltagande i val" (not "valdeltagande") and SCB is labelled as source of region codes only
- [ ] `npm run lint && npm run typecheck && npm run build` green
- [ ] PR body ends with `Closes #15`
