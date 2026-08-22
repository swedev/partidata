# Implementation Plan: Partisidan visar platshållardata istället för partiets faktiska data

## Summary

The party page (`src/pages/parti/[filnamn].tsx`) renders a hard-coded "Om partiet" table ("Grundat: 12 Juni, 19XX" plus four "Key / Value" rows) while the real fields in `data/parti/<filnamn>/index.json` (`kod`, `forkortning`, `valmyndigheten_registreringsdatum`) are ignored. Replace the placeholder rows with the real fields (hiding rows whose field is missing), format the registration date in Swedish, add a link back to the home page, and introduce a shared `Parti` type in `src/types.ts` so both the home page and the party page stop using `any`.

## Triage Info

> Decision-support metadata for this issue.

| Field | Value |
|-------|-------|
| **Blocked by** | None |
| **Blocks** | #27 Ta bort "OBS! Work In Progress" från startsidan (soft: #27 waits until placeholder data is gone; #15 is already merged via PR #30) |
| **Related issues** | #21 (party participation per election year on the party page — will fill the empty right-hand column and reuse the `Parti` type), #17 (client-side search on the home page — will benefit from the typed party list), #27 (WIP notice, gated by this issue), #26 (downloadable JSON — only relevant if `uuid` should be exposed). All open as of 2026-08-22 per `gh issue list`. |
| **Scope** | 3 files across `src/pages/`, `src/pages/parti/`, `src/` (new `types.ts`) |
| **Risk** | Low |
| **Complexity** | Low |
| **Safe for junior** | Yes |
| **Conflict risk** | Low–Medium — the only other plan in `agent-docs/issue/` (#15) is already merged (PR #30, touches `index.tsx`/`Footer.tsx`/`app.scss` only). Unplanned #21 and #17 edit the same two page files; merge this first so they rebase onto the typed props. |

### Triage Notes
No explicit blockers. There is no `agent-docs/github/project.json`, so no GitHub Project board fields were queried. Issue metadata (label `bug`, no assignee, no comments, related issues open) was read via `gh` on 2026-08-22. Data checked locally: all 333 index entries have a matching detail file, all required fields are present, `kod` is always a string. Branch alignment skipped (no `release` field). Sequencing: merge this before #21, since #21 builds on the typed props and the same page layout.

## Analysis

- **Data shape.** All 333 files in `data/parti/*/index.json` have `beteckning`, `filnamn`, `kod` (string, zero-padded, e.g. `"0139"`), `uuid`. Optional: `forkortning` (193 of 333) and `valmyndigheten_registreringsdatum` (226 of 333, ISO `YYYY-MM-DD`). `data/parti/index.json` entries have only `uuid`, `beteckning`, `filnamn`. The type must therefore have two optional fields, and the index list is a subset of `Parti`.
- **Current page.** `PartyPageProps` declares only `beteckning`/`forkortning`. `getStaticProps` is untyped and does `(await import(\`data/parti/${filnamn}/index.json\`)).default`, returning the whole JSON object as props. `getStaticPaths` is untyped. The table body is pure placeholder markup. The right-hand `flex-1` column is empty (reserved; #21 will use it).
- **Home page.** `src/pages/index.tsx` uses `Map<string, Array<any>>` for the grouped list; `parties` is already inferred from JSON via `resolveJsonModule`, so annotating the map with the shared type is enough.
- **Navigation.** The party page has no link back to `/`. `eslint-config-next` (`core-web-vitals`) includes `@next/next/no-html-link-for-pages`, which flags `<a href="/">` to an existing page — so the home link should use `next/link`. `trailingSlash: true` is fine with `href="/"`.
- **Date formatting.** `Intl.DateTimeFormat('sv-SE', { dateStyle: 'long', timeZone: 'UTC' })` renders `2017-12-01` as "1 december 2017". `new Date('YYYY-MM-DD')` is midnight UTC, so `timeZone: 'UTC'` is mandatory — without it a visitor in a western timezone would hydrate "30 november 2017" against the build's "1 december 2017" (and a console check done in Sweden would never show it). The site is statically exported; the component renders at build time (Node 24, full ICU) and hydrates in the browser; with the fixed timezone both produce the same string. See Design Decision 2 for the alternative.
- **Field combinations in the data** (for manual testing): both `forkortning` and date: 193 parties (e.g. `ale-demokraterna`); date only: 33 (e.g. `asyl-nupartiet`); `forkortning` only: 0; neither: 107 (e.g. `20--skattepartiet`).
- **Copy** is Swedish (CLAUDE.md). Row labels: "Partikod hos Valmyndigheten", "Förkortning", "Registrerad hos Valmyndigheten".
- **Styling** is Bootstrap `table table-striped` + Tailwind utilities; no CSS changes needed.

## Implementation Steps

### Phase 1: Shared type
1. Create `src/types.ts` exporting the party interfaces.
   - `export interface Parti { uuid: string; beteckning: string; filnamn: string; kod: string; forkortning?: string; valmyndigheten_registreringsdatum?: string; }`
   - `export type PartiIndexEntry = Pick<Parti, 'uuid' | 'beteckning' | 'filnamn'>;` for entries in `data/parti/index.json`.
   - Files to create: `src/types.ts`

### Phase 2: Type the pages
2. Type the home page's grouping in `src/pages/index.tsx`.
   - Import `PartiIndexEntry` from `src/types` and change `Map<string, Array<any>>` to `Map<string, PartiIndexEntry[]>`; remove both `as Array<any>` casts (use `groupedParties.get(char) ?? []` or keep the non-null assertion pattern — the `has` check above guarantees presence).
   - No markup changes on the home page.
   - Files to modify: `src/pages/index.tsx`
3. Type `getStaticPaths`/`getStaticProps` in `src/pages/parti/[filnamn].tsx`.
   - `import type { GetStaticPaths, GetStaticProps, NextPage } from 'next'`; `import type { Parti } from 'src/types'`.
   - `export const getStaticPaths: GetStaticPaths<{ filnamn: string }> = async () => ({ paths: parties.map(p => ({ params: { filnamn: p.filnamn } })), fallback: false })`.
   - `export const getStaticProps: GetStaticProps<Parti, { filnamn: string }> = async ({ params }) => { const filnamn = params?.filnamn; if (!filnamn) return { notFound: true }; const party = (await import(\`data/parti/${filnamn}/index.json\`)).default as Parti; return { props: party }; }`. The dynamic `import()` of a template path cannot be typed by TS, hence the explicit `as Parti` cast (it is a cast, not validation — see step 6). Returning the whole file as props is the existing behaviour and keeps the prop shape identical to the `Parti` type.
   - Replace `PartyPageProps` with `Parti`: `const PartyPage: NextPage<Parti> = ({ beteckning, forkortning, kod, valmyndigheten_registreringsdatum }) => …`.
   - Files to modify: `src/pages/parti/[filnamn].tsx`

### Phase 3: Render real data and add navigation
4. Replace the placeholder table body in `src/pages/parti/[filnamn].tsx`.
   - Build the rows from the props and render only those that have a value, e.g. an array `[{ label: 'Partikod hos Valmyndigheten', value: kod }, { label: 'Förkortning', value: forkortning }, { label: 'Registrerad hos Valmyndigheten', value: formatDate(valmyndigheten_registreringsdatum) }].filter(row => row.value)` mapped to `<tr><td>{label}</td><td>{value}</td></tr>` with `key={label}`. Keep the `<thead>` "Om partiet" row and the `table table-striped` classes.
   - Add a small `formatSwedishDate(iso?: string)` helper in the same file: returns `undefined` when input is missing, otherwise `new Intl.DateTimeFormat('sv-SE', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(iso))`. If `Number.isNaN(date.getTime())` (malformed string), return the raw string rather than crashing the build; this does not catch normalised-but-impossible dates like `2023-02-30`, which is acceptable since all 226 dates in the dataset are valid calendar dates.
   - Do not render `uuid` (internal identifier, see Design Decision 3). Keep the empty right-hand column untouched for #21.
   - Files to modify: `src/pages/parti/[filnamn].tsx`
5. Add a link back to the home page.
   - Above the `<h1>`, render `<p className="mt-6"><Link href="/">← Alla partier</Link></p>` using `import Link from 'next/link'`. Plain anchor styling from `app.scss` (`a { color: #0070f3 }`) applies; no new CSS.
   - Files to modify: `src/pages/parti/[filnamn].tsx`

### Phase 4: Verify
6. Run `npm run lint && npm run typecheck && npm run build` (the CI `Integrate` job). The build pre-renders all 333 party pages, so a missing party file or a rendering exception fails here. It does not catch schema drift: `as Parti` suppresses static checking and a missing field simply hides its row. Data validation in CI is #24's scope.
7. `npm run dev`; check `/parti/ale-demokraterna/` (both optional fields: "ADK", "1 december 2017"), `/parti/asyl-nupartiet/` (date only), `/parti/20--skattepartiet/` (neither — only the "Partikod" row should show). Confirm: no "Key / Value" or "19XX" text; the home link navigates to `/`; no hydration warning in the browser console on a page with a formatted date — also with the browser/OS timezone set to e.g. America/Los_Angeles (DevTools > Sensors); `out/parti/ale-demokraterna/index.html` after `npm run build` contains "1 december 2017". Glance at 375 px: the two-column `flex flex-row` layout gives half the width to the empty column; if the longer labels wrap badly, add `flex-col md:flex-row` on the wrapper (otherwise leave responsiveness to #23/#21).
8. Open a PR against `main` (branch + PR flow, squash-merged). End the body with `Closes #16`. Mention that a `v*` tag is needed to deploy (`deploy/README.md`).

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/types.ts` | Create | Shared `Parti` and `PartiIndexEntry` types |
| `src/pages/parti/[filnamn].tsx` | Modify | Typed `getStaticPaths`/`getStaticProps`, real data rows with empty-row hiding, Swedish date formatting, home link |
| `src/pages/index.tsx` | Modify | Replace `Array<any>` with `PartiIndexEntry[]` |

## Codebase Areas

List the primary directories/areas this plan touches (for conflict detection):
- `src/pages/parti/` (`[filnamn].tsx`)
- `src/pages/` (`index.tsx`, types only)
- `src/` (new `types.ts`)

## Design Decisions

> Non-trivial choices made during planning. Feedback welcome; otherwise implementation proceeds with these.

### 1. Home link via `next/link`, not a plain `<a>`
**Options:** A) `<a href="/">` like the party links on the home page; B) `<Link href="/">`.
**Decision:** B
**Rationale:** `eslint-config-next/core-web-vitals` ships `@next/next/no-html-link-for-pages`, which rejects `<a href="/">` pointing at an existing page, so A would fail `npm run lint`. The home page's `<a href={\`/parti/…\`}>` survives only because the dynamic href is not checked. Agent judgment on placement/wording ("← Alla partier"); open to change.

### 2. Format the date in the component with `Intl.DateTimeFormat('sv-SE')`
**Options:** A) Format in the component (runs at build and during hydration); B) pre-format in `getStaticProps` and pass a string prop; C) show the raw ISO date.
**Decision:** A
**Rationale:** The issue asks for a Swedish-formatted date (user decision, issue #16). A keeps the props identical to the `Parti` type (useful for #21 and for reuse). The formatter must pin `timeZone: 'UTC'`; otherwise client and build output differ by timezone and React reports a hydration mismatch. With that pinned, `sv-SE` + `dateStyle: 'long'` is stable across Node 24 and modern browsers; verification step 7 checks it. If a mismatch ever shows up, switch to B (add a `registreringsdatumText` prop) — a five-line change. Agent judgment.

### 3. Do not display `uuid`
**Options:** A) Show all JSON fields including `uuid`; B) show only fields meaningful to readers (`kod`, `forkortning`, registration date).
**Decision:** B
**Rationale:** The issue lists `uuid` among the fields "not shown" but proposes rendering the partikod, abbreviation and date; the uuid is a repo-internal identifier (generated in `src/utils.js`/`scripts/`) with no meaning to visitors. Agent judgment — trivially added as a fourth row if the user wants it exposed (e.g. for #26's downloadable data).

### 4. Hide rows with missing values rather than rendering "–"
**Options:** A) Always render all rows, with a dash when empty; B) omit the row.
**Decision:** B
**Rationale:** Explicitly requested in the issue ("dölj rader vars fält saknas"). User decision.

### 5. Keep the empty right-hand column
**Options:** A) Remove the empty `flex-1` column and the flex wrapper; B) leave the layout as is.
**Decision:** B
**Rationale:** #21 plans to put election participation there; removing and re-adding the wrapper would only create churn between two PRs. Agent judgment.

## Verification Checklist

- [ ] No "Grundat", "19XX" or "Key"/"Value" placeholder strings left in `src/pages/parti/[filnamn].tsx`
- [ ] `/parti/ale-demokraterna/` shows Partikod `0139`, Förkortning `ADK`, Registrerad `1 december 2017`
- [ ] `/parti/asyl-nupartiet/` shows Partikod and Registrerad but no Förkortning row
- [ ] `/parti/20--skattepartiet/` shows only the Partikod row (`1365`)
- [ ] Party page has a working link back to `/`
- [ ] `rg -n 'Array<any>|\bas any\b' src/pages` finds nothing; `getStaticProps`/`getStaticPaths` are typed with `GetStaticProps`/`GetStaticPaths`
- [ ] `src/types.ts` exports `Parti` and `PartiIndexEntry`; both pages import from it
- [ ] No React hydration warning on a party page with a date, including with the browser timezone set to a western zone (formatter uses `timeZone: 'UTC'`)
- [ ] `npm run lint && npm run typecheck && npm run build` green (all 333 party pages pre-render)
- [ ] PR body ends with `Closes #16`
