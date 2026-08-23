# Implementation Plan: Partier som bytt namn ska ligga på sitt nya filnamn, med redirect från det gamla

## Summary

A party that changes its `beteckning` keeps the `filnamn` it was first given, so Enad Röst (formerly Feministiskt initiativ) lives at `/parti/feministiskt-initiativ/` and `/parti/enad-rost/` is a 404. Change the registry so that a rename also allocates a new `filnamn` (same slug rules as today), keep the old slugs in `tidigare_filnamn`, move the affected `data/parti/<filnamn>/` directories, and have `next build` emit a static redirect page for every old slug. Migrate the 27 parties currently on a stale slug in the same PR.

## Triage Info

> Decision-support metadata for this issue.

| Field | Value |
|-------|-------|
| **Blocked by** | None (#36, which introduced the renames, is merged) |
| **Blocks** | #35 (re-import of 2026 data after the election should run through the new rename path so it gets redirects) |
| **Related issues** | #19 (closed, data refresh that surfaced the renames), #36 (merged PR) |
| **Scope** | 8 code/doc files (`scripts/`, `src/`, `README.md`, `CLAUDE.md`) plus a data migration: 27 `data/parti/<filnamn>/` directories moved and edited, `data/parti/index.json` regenerated |
| **Risk** | High |
| **Complexity** | Medium |
| **Safe for junior** | No |
| **Conflict risk** | Low: no other open plan touches `scripts/parti.js`, `src/pages/parti/[filnamn].tsx` or `data/parti/`. Plans #16 (party page) and #19 (registry) are merged. Re-check open PRs before starting. |

### Triage Notes

- No blockers. The issue is a follow-up to #36 and can start immediately.
- Risk is High because the change moves 27 public URLs, renames 27 directories and adds filesystem moves to the import. It is mitigated by the preflight in Phase 1 step 5 and by the migration being the last step, after the tests pass.
- The data migration is a large but mechanical diff. Review it with `git diff --stat -M` so renames show as renames.
- Release note: deploys happen on `v*` tags, not on merge (`.github/workflows/deploy.yaml`). The redirects go live only when `main` is tagged after the merge.

## Analysis

### Current state

- `scripts/parti.js` `loadParties()` reads every `data/parti/<filnamn>/index.json` and asserts `data.filnamn === <dirname>`. `upsertParties()` allocates `filnamn` only for parties that are new to the registry: `toFileName(beteckning)`, with a `-<kod>` suffix when the base slug is taken or shared by two new parties. `buildParties()` derives `beteckning` from the newest year file but copies `party.filnamn` unchanged, so a rename never touches the slug. `_assertUnique()` checks `filnamn`, `uuid` and `kod` uniqueness.
- `scripts/import-val.js` `main()` already computes a `renamed` list (parties whose `beteckning` changed) and logs it as `Omdöpta partier`.
- `src/pages/parti/[filnamn].tsx` builds `getStaticPaths` from `data/parti/index.json` (`{ uuid, beteckning, filnamn }`) and `getStaticProps` dynamically imports `data/parti/<filnamn>/index.json`. `src/pages/index.tsx` links to `/parti/${party.filnamn}`.
- `next.config.ts` uses `output: 'export'` with `trailingSlash: true`. Next's `redirects()` config is not honoured by static export, so redirects must be real HTML files produced through `getStaticPaths`.
- `README.md` documents `filnamn` as set once and never changed, promises that validation errors write nothing, and that import order does not matter. All three paragraphs are affected.
- `data/val/<år>/kandidatlistor/<filnamn>.json` is keyed by `filnamn` (one draft file exists, `2018/kandidatlistor/gotenes-framtid.json`, for a party that has not been renamed). `data/val/<år>/partideltagande/` is keyed by `uuid` and is unaffected.

### Data facts (checked against the working tree)

- 32 parties have `filnamn !== toFileName(beteckning)` (and not `toFileName(beteckning)-<kod>`). 27 of them carry `tidigare_beteckningar`: these are the migration set (manifest below). The other 5 (`igov-direct-`, `ip-idrottspartiet-radda-stadshagens-ip-`, `kommunens-rost-`, `langen-amp-co`, `oppna-goteborg-`) were never renamed; their slugs differ only because `toFileName()` changed since they were created (trailing hyphen, `&`). They stay (Design Decision 2).
- 5 parties with `tidigare_beteckningar` already sit on the slug of their current name and need nothing.
- None of the 27 target slugs collides with an existing `filnamn` or with another target, so the migration allocates no `-<kod>` suffix.
- Some new slugs are ugly because `toFileName()` keeps double hyphens around punctuation (`folk---natur`, `sport--och-kommunpartiet`). Changing `toFileName()` would move many more parties and is out of scope.

Migration manifest (old `filnamn` → new `filnamn`):

| Old | New |
|-----|-----|
| `ahuspartiet` | `sakpolitikerna` |
| `andrings-partiet-revolution` | `revolutionspartiet` |
| `bevara-akutsjukhusen` | `varddemokraterna` |
| `feministiskt-initiativ` | `enad-rost` |
| `fokus-bjarred` | `fokus` |
| `folkets-rost-vox-humana` | `vox-humana-folkets-rost` |
| `halmstads-lokala-parti` | `halmstadpartiet` |
| `kommunpartiet` | `sport--och-kommunpartiet` |
| `lokala-partier-i-uppsala-lan` | `sjukvardspartiet-i-uppsala-lan` |
| `medborgarnas-politiska-parti-i-sverige` | `nyframtid` |
| `medborgarpartiet-i-gislaved` | `medborgarpartiet-i-gislaved-mig` |
| `mod` | `mod-manskliga-rattigheter-och-demokrati` |
| `naturens-parti-sanning-rattvisa-karlek` | `naturens-parti` |
| `odeshogs-partiet` | `folk---natur` |
| `opartiet` | `malaropartiet` |
| `partiet-for-rattvisa-och-jamstalldhet` | `prj--partiet-for-rattvisa-och-jamstalldhet` |
| `rattvisepartiet-socialisterna` | `socialistiskt-alternativ-tidigare-rattvisepartiet-socialisterna` |
| `soderslattspartiet` | `vart-soderslatt` |
| `solidaritet--arbete--fred--ekologi--safe` | `safe-solidaritet-arbete-fred-ekologi` |
| `spi-valfarden` | `solidaritetspartiet` |
| `strangnaspartiet` | `lokalpartiet` |
| `sveriges-pensionarers-intresseparti` | `horbys-framtid` |
| `tingsrydsalternativet` | `tingsrydsalternativet-tia` |
| `var-framtid-klippan` | `var-framtid` |
| `vaxholmsdemokraterna` | `livbojen-vaxholmsdemokraterna` |
| `vingakerspartiet-vtl` | `vingakerspartiet-vip` |
| `volt-sverige` | `volt` |

### Rename semantics

- `filnamn` stays sticky: it changes only when `beteckning` changes **and** the new name produces a different slug. A name change whose slug is unchanged (casing, punctuation) moves nothing and adds nothing to `tidigare_filnamn`.
- Slug allocation happens in one pass over every party that needs a slug in this build (new parties and renamed parties together), with the rules: base slug if free, else `base-<kod>`; when two or more claimants in the same pass share a base, all of them get `-<kod>` (as two new parties do today). "Free" means not an active `filnamn` of any party and not a `tidigare_filnamn` of any other party.
- A party may reclaim a slug from its own `tidigare_filnamn` (A → B → A gives `filnamn: a`, `tidigare_filnamn: ['b']`). Reclaiming a suffixed old slug (`foo-1234`) is allowed the same way; the suffix is literal history, not recomputed from the current code.
- `tidigare_filnamn` is the list of slugs the registry has actually carried, oldest first, deduplicated, never containing the active slug. It is history, so it depends on the order imports were run in when a party has had three or more names (A → B → C imported chronologically gives `[a, b]`; importing C first gives `[a]`). The README's order-independence promise is narrowed to exclude `tidigare_filnamn` (Design Decision 7).
- `uuid` remains the identity. `data/val/<år>/partideltagande/` is untouched by a rename; `data/val/<år>/kandidatlistor/<filnamn>.json` moves with the party.

## Implementation Steps

### Phase 1: Registry (`scripts/parti.js`)

1. Read and write `tidigare_filnamn`.
   - Add `'tidigare_filnamn'` to `PARTY_KEY_ORDER` directly after `'filnamn'`.
   - `loadParties()`: carry `tidigare_filnamn: data.tidigare_filnamn || []` on each party. `upsertParties()` initialises `tidigare_filnamn: []` on created parties.
   - Files to modify: `scripts/parti.js`
2. One allocation pass: `allocateFilnamn(claims, parties)`.
   - `claims` is `[{ party, beteckning, kod }]` for every party that needs a slug: new parties (from `upsertParties`) and renamed parties (from `buildParties`). `taken` is built from every party's `filnamn` and `tidigare_filnamn`, minus the claimant's own `tidigare_filnamn`. Base counts are computed across all claims so two claimants with the same base both get `-<kod>`. Throws on empty base or when the suffixed slug is also taken (same messages as today).
   - Move the allocation out of `upsertParties()`: it still creates parties (uuid, koder, beteckning) but leaves `filnamn` unset; `buildParties()` runs the single pass. `import-val.js` logs created parties after the build, so it gets the final slug.
3. Rename on `beteckning` change in `buildParties()`.
   - After deriving `beteckning`: if it differs from `party.beteckning` (the stored value) and `toFileName(beteckning)` differs from the current `filnamn` (ignoring a `-<kod>` suffix the party already has), add a claim. After allocation, for each renamed party set `tidigare_filnamn = [...party.tidigare_filnamn, party.filnamn].filter(f => f !== nytt)` deduplicated.
   - Return `renamed: [{ uuid, from, to }]` alongside `writeSet`, `index`, `parties`, and include `tidigare_filnamn` in each party's `data` and in the `index` entries (only when non-empty; `_orderKeys` already drops empty arrays, do the same for index entries).
4. Validate.
   - `_assertUnique()`: also register every `tidigare_filnamn` in the `filnamn` map, so an old slug that equals another party's active slug or another party's old slug fails with `Duplicate filnamn`. Within one party, `tidigare_filnamn` must not contain its own `filnamn`.
   - `validateRenames(renamed)`, called from `validate()` before anything is written: every `from` directory exists; every `to` directory is absent; `from !== to`; all `from` and all `to` are unique; for every `data/val/<år>/kandidatlistor/<from>.json` that exists, `<to>.json` is absent. Any failure throws before the first move, which keeps the README promise that validation errors write nothing.
5. Apply renames on disk.
   - Add `applyRenames(renamed)`: for each entry, `fs.renameSync(dataPath('parti', from), dataPath('parti', to))` and rename each existing `data/val/<år>/kandidatlistor/<from>.json` to `<to>.json`. Must run after `validate()` and before `writeFiles()` so the party file lands in the new directory. Returns the moved paths for logging.
   - The rebuild entry (`require.main === module`) and `import-val.js` both call `applyRenames(build.renamed)` between `validate()` and `writeFiles(...)`.
   - Export `allocateFilnamn`, `validateRenames`, `applyRenames`.

### Phase 2: Import script (`scripts/import-val.js`)

1. Call `applyRenames(build.renamed)` after `validate()` and before `writeFiles`. Log each move under the existing `Omdöpta partier` block as `  * <kod> <gammalt namn> → <nytt namn> (<gammalt filnamn> → <nytt filnamn>)`; a rename whose slug did not change is logged as today. Log created parties with their final `filnamn` (taken after the build).
   - Files to modify: `scripts/import-val.js`

### Phase 3: Tests (`scripts/parti.test.js`, `scripts/fixtures/`)

1. Replace `a renamed party keeps its filnamn and lists the old name` with `a renamed party moves to a new filnamn and keeps the old one as tidigare_filnamn`: after importing 2022 then 2026, `data/parti/nya-testpartiet/index.json` exists with `tidigare_filnamn: ['testpartiet']`, `data/parti/testpartiet/` is gone, and `index.json` lists `nya-testpartiet` with `tidigare_filnamn`.
2. Add `a name change with the same slug moves nothing` (registry "Testpartiet", CSV "TESTPARTIET": same directory, no `tidigare_filnamn`).
3. Add `an old filnamn is never given to a new party`: registry party with `tidigare_filnamn: ['gamla-namnet']`, CSV with a new party named "Gamla namnet" → new party gets `gamla-namnet-<kod>`.
4. Add `a renamed party and a new party sharing a slug are both suffixed`, and `two renamed parties sharing a slug are both suffixed`.
5. Add `a party renamed back reclaims its old filnamn`: registry party `filnamn: 'b'`, `tidigare_filnamn: ['a']`, CSV renames it to "A" → `filnamn: 'a'`, `tidigare_filnamn: ['b']`.
6. Add `a tidigare_filnamn that equals another party's filnamn stops the import` (expects `Duplicate filnamn`, snapshot unchanged).
7. Add `a rename moves the party's kandidatlista` (fixture tree with `data/val/2022/kandidatlistor/testpartiet.json` → `nya-testpartiet.json`), and `a rename whose target already exists stops the import before anything is written` (pre-create `data/parti/nya-testpartiet/`, expect exit 1 and unchanged snapshot).
8. Add a three-name fixture (`val-2018.csv` or a third CSV) and a test documenting the contract: chronological import gives `tidigare_filnamn: ['a', 'b']`, newest-first gives `['a']`. Update `identity()` to exclude `tidigare_filnamn` so the existing import-order test keeps asserting what is order-independent, and update the `deltagande` test to look up `nya-testpartiet`.
9. `scripts/fixtures/tree.js` `makeTree()` already writes every key on a registry party, so `tidigare_filnamn` fixtures need no change there; add an option for kandidatlistor files if the existing signature does not allow it.
   - Files to modify: `scripts/parti.test.js`, `scripts/fixtures/tree.js`, new fixture CSV(s).

### Phase 4: Site (`src/`)

1. Types (`src/types.ts`): add `tidigare_filnamn?: string[]` to `Parti`; extend `PartiIndexEntry` to `Pick<Parti, 'uuid' | 'beteckning' | 'filnamn' | 'tidigare_filnamn'>`. Add `PartiRedirect = { redirect: { filnamn: string; beteckning: string } }` and a type guard `isRedirect(props)`.
2. `src/pages/parti/[filnamn].tsx`:
   - Type the imported index as `PartiIndexEntry[]` before reading `tidigare_filnamn`.
   - `getStaticPaths`: paths for every `party.filnamn` plus every slug in `party.tidigare_filnamn ?? []`.
   - `getStaticProps`: if `params.filnamn` matches an index entry's `filnamn`, return the party as today. Otherwise find the entry whose `tidigare_filnamn` includes it and return `{ props: { redirect: { filnamn: entry.filnamn, beteckning: entry.beteckning } } }`. Neither found → `notFound: true` (unreachable with `fallback: false`, keeps the types honest).
   - Props type `Parti | PartiRedirect`; split into `PartyPage` and a small `RedirectPage`.
   - `RedirectPage` renders `<Head>` with `<title>{beteckning} - Partidata</title>`, `<meta httpEquiv="refresh" content={`0; url=/parti/${filnamn}/`} />`, `<link rel="canonical" href={`/parti/${filnamn}/`} />`, `<meta name="robots" content="noindex" />`, and a body with "Partiet heter numera {beteckning}." and a `<Link href={`/parti/${filnamn}/`}>` as the fallback.
   - Files to modify: `src/pages/parti/[filnamn].tsx`, `src/types.ts`
3. `src/pages/index.tsx` needs no change: it already links `party.filnamn`, which is now the current slug. Confirm the `PartiIndexEntry` type change compiles.
4. Add a `node:test` case (e.g. `scripts/site.test.js`, or a check in `parti.test.js` guarded by `fs.existsSync('out')`) is not practical without a build; instead add the export check to the Verification Checklist and run it in the PR (grep `out/parti/<old>/index.html` for the meta refresh and canonical).

### Phase 5: Docs

1. `README.md` `parti/<filnamn>/index.json` section: `uuid` is set once and never changes; `filnamn` is derived from the current `beteckning` and changes when the party is renamed; old slugs are kept in `tidigare_filnamn` and served as redirects. Add `tidigare_filnamn` to the field table and to the `parti/index.json` description. In `npm run import-val`: renamed parties move directory (and their kandidatlistor), validation still happens before any write, and the order-independence sentence is qualified: `tidigare_filnamn` records the slugs the registry has carried and can differ when a party with three or more names is imported out of order.
2. `CLAUDE.md` stack note: party pages are pre-rendered from `index.json`, plus one redirect page per `tidigare_filnamn`.
   - Files to modify: `README.md`, `CLAUDE.md`

### Phase 6: Data migration (last)

1. With Phases 1-5 merged into the branch and `npm test` green, run a one-off migration (not committed; Design Decision 3): load the registry, select every party with `tidigare_beteckningar` whose `filnamn` differs from `toFileName(beteckning)` and from `toFileName(beteckning)-<kod>`, assert the selection equals the 27-row manifest above, allocate the new slugs with `allocateFilnamn` (expect no suffixes), write `tidigare_filnamn` and the new `filnamn` into each party file, and move the directories with `git mv`. Then run `node scripts/parti.js` to regenerate `index.json`.
2. Verify byte identity: run `node scripts/parti.js` a second time and check `git diff --exit-code` against the first run's state (the script always reports files written, so a clean diff is the idempotence signal). Run `npm test`.
3. Expected diff: 27 renames under `data/parti/` (each file gaining `tidigare_filnamn`), `data/parti/index.json` re-sorted with 27 entries gaining `tidigare_filnamn`, nothing under `data/val/`. Paste the migration's dry-run output (the 27 moves) in the PR body.

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `scripts/parti.js` | Modify | `tidigare_filnamn` in load/build/index, single-pass `allocateFilnamn`, rename on `beteckning` change, `validateRenames`, `applyRenames`, uniqueness across old slugs |
| `scripts/import-val.js` | Modify | Apply directory moves between validate and write; log slug changes and final slugs of new parties |
| `scripts/parti.test.js` | Modify | Flip the rename test; add same-slug, reservation, suffix, reclaim, collision, kandidatlista, preflight and multi-hop tests |
| `scripts/fixtures/tree.js`, new fixture CSV(s) | Modify / Create | Kandidatlistor in the fixture tree; a third year for the multi-hop case |
| `data/parti/<27 renamed>/` | Move + Modify | Directories renamed to the current slug; party files gain `tidigare_filnamn` |
| `data/parti/index.json` | Modify | Regenerated: new slugs, `tidigare_filnamn` entries, re-sorted |
| `src/types.ts` | Modify | `tidigare_filnamn` on `Parti` and `PartiIndexEntry`; `PartiRedirect` and guard |
| `src/pages/parti/[filnamn].tsx` | Modify | Old slugs in `getStaticPaths`; redirect props and `RedirectPage` |
| `README.md`, `CLAUDE.md` | Modify | Document the new `filnamn` semantics, `tidigare_filnamn`, and the narrowed order-independence |

## Codebase Areas

List the primary directories/areas this plan touches (for conflict detection):
- `scripts/` (`parti.js`, `import-val.js`, tests and fixtures)
- `data/parti/` (27 directory renames, `index.json`)
- `src/pages/parti/`, `src/types.ts`
- `README.md`, `CLAUDE.md`

## Design Decisions

> Non-trivial choices made during planning. Feedback welcome; otherwise implementation proceeds with these.

### 1. Where the rename happens
**Options:** A: in `buildParties()` when the derived `beteckning` differs from the stored one. B: in `import-val.js` `main()` next to the existing `renamed` logging. C: derive `filnamn` purely from `beteckning` on every build.
**Decision:** A.
**Rationale:** `buildParties()` is the single place that knows the new `beteckning` and the registry, so the rebuild entry and the import share one code path. C would make the `-<kod>` suffix assignment depend on a tie-break order and would move every slug-function drift, so slugs would not be sticky. Provenance: the issue's proposal 1 says "när beteckningen ändras byter partiet `filnamn`" (user decision); the placement in `buildParties` and the single allocation pass are agent judgment.

### 2. Only renames move; slug-function drift stays
**Options:** A: migrate only parties whose `beteckning` changed (27). B: also realign the 5 slugs that `toFileName()` would produce differently today.
**Decision:** A.
**Rationale:** The issue is about renamed parties. The 5 drift slugs are stable URLs for parties that never changed their name; moving them gains nothing. Agent judgment, open to question.

### 3. Data migration as a one-off, not a committed script
**Options:** A: throwaway script run once, with the manifest in this plan, its dry-run output in the PR body, and an assertion that the selection equals the manifest. B: commit `scripts/migrate-filnamn.js`. C: a `--migrate` flag on `scripts/parti.js`.
**Decision:** A.
**Rationale:** After this PR the registry renames automatically on import, so the migration has no second use; the reviewable artifact is the data diff plus the manifest. Agent judgment, open to question; B is cheap if the reviewer prefers reproducibility in-repo.

### 4. Old slugs in `index.json`
**Options:** A: add `tidigare_filnamn` to `data/parti/index.json` entries. B: have `getStaticPaths` read all 675 party files.
**Decision:** A.
**Rationale:** `index.json` is the registry's derived listing and the site's only input to `getStaticPaths`; the field is small and only present for renamed parties. Agent judgment.

### 5. Redirect page contents
**Decision:** `<meta http-equiv="refresh" content="0; url=…">`, `<link rel="canonical">`, a text link, plus `<meta name="robots" content="noindex">`.
**Rationale:** Items 1-3 are the issue's proposal 2 (user decision). `noindex` is agent judgment: it keeps search engines from indexing the stub while canonical points them to the real page.

### 6. Old slugs are reserved forever
**Decision:** `allocateFilnamn` treats every `tidigare_filnamn` as taken, except for the party that owns it.
**Rationale:** Matches the issue's proposal 3 ("ett `tidigare_filnamn` aldrig kolliderar med ett aktivt `filnamn`"), extended so the validation is never triggered by the allocator itself. User decision plus agent judgment on the reclaim case.

### 7. `tidigare_filnamn` is history, not derived
**Options:** A: record only slugs the registry actually carried (order-dependent for three or more names). B: derive old slugs from every `tidigare_beteckningar` entry (order-independent, but serves redirects for URLs that never existed). C: persist explicit rename events.
**Decision:** A, with the README's order-independence promise narrowed accordingly and a test documenting the behaviour.
**Rationale:** Redirects exist for URLs that were published; inventing redirects for names that never had a page (B) adds pages nobody linked to. C is more machinery than the case warrants. Agent judgment, open to question; B is the simplest switch if strict order-independence matters more.

## Verification Checklist

- [ ] `npm test`: all `node:test` cases pass, including the new rename, same-slug, reservation, suffix, reclaim, collision, kandidatlista, preflight and multi-hop tests
- [ ] Migration: `node scripts/parti.js` twice in a row, `git diff --exit-code` between the runs is clean
- [ ] `git diff --stat -M main` shows 27 renames under `data/parti/` and no changes under `data/val/`
- [ ] `npm run lint && npm run typecheck && npm run build` green
- [ ] `out/parti/enad-rost/index.html` is the party page; `out/parti/feministiskt-initiativ/index.html` contains the meta refresh, canonical link and text link to `/parti/enad-rost/` (`grep -l 'http-equiv="refresh"' out/parti/*/index.html | wc -l` is 27)
- [ ] `npm run dev`: `/parti/feministiskt-initiativ/` lands on `/parti/enad-rost/`; the home page links Enad Röst to `/parti/enad-rost`
- [ ] Re-import with the archived 2026 CSV from #36 (`--file`, SHA-256 `fa87dd90…3346e`), not the live URL (it changes hourly): reports no renames and leaves `data/` unchanged
- [ ] README and CLAUDE.md describe `filnamn`/`tidigare_filnamn` and the narrowed order-independence accurately
- [ ] After merge: tag a release so the redirects deploy (CLAUDE.md: merging is not releasing)
