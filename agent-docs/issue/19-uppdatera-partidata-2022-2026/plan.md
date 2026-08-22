# Implementation Plan: Uppdatera partidata för valen 2022 och 2026 (nuvarande data är från 2018/2020)

## Summary

Replace the 2018-only election data and the ~2020 party register with data imported from Valmyndigheten's `deltagande-partier.csv` for 2022 and 2026. A new `scripts/import-val.js <år>` downloads (or reads) the CSV, reconciles `data/parti/` (party files + `index.json`) using `PARTIKOD` as identity, and writes `data/val/<år>/partideltagande/{partier,riksdag,region,kommun}.json`. The XML-based collector (`collect.js`, `helpers.js`, `loadXML`) is removed; `scripts/parti.js` becomes the party-registry module. 2018 data stays as static history. Rendering the new fields on the party page is left to #21.

## Triage Info

> Decision-support metadata for this issue.

| Field | Value |
|-------|-------|
| **Blocked by** | None. #18 and #29 are closed (#18 merged in `ba9c1c9`, current `main`). #24 (Validera data/ i CI, open) is related, not a prerequisite: the Next build already fails when an index entry lacks its party file, the import is deterministic/idempotent, and the import script itself asserts the invariants it depends on (step 4.v) |
| **Blocks** | #33 (kandidaturer.csv import reuses the CSV helper and the 2022/2026 registry), #21 (party-page participation needs the new `deltagande` data) |
| **Related issues** | #20 (closed; 2022/2026 kommun files cover all 290, the 2018 file stays 208/290), #29 (closed, superseded), #21, #24, #25, #33 |
| **Scope** | 2 script files rewritten/created, 1 modified, 2 deleted; 8 new data files; all ~650–700 party files regenerated; `src/types.ts`, `src/components/Footer.tsx`; README/CLAUDE/package.json |
| **Risk** | High — identity reconciliation (uuid/filnamn) is irreversible once committed and published, and ~700 generated records are hard to eyeball |
| **Complexity** | Medium |
| **Safe for junior** | No |
| **Conflict risk** | Medium — #25 (README rewrite) touches `README.md`; this plan limits its README edits to the data-layout and script sections. No other open plan touches `scripts/` or `data/` |

### Triage Notes

- Both comments on the issue are resolved by the current state: #18 and #29 are closed, #20 is closed as superseded for current elections, and candidate data is explicitly deferred to #33.
- The CSV URL pattern and columns in the issue were re-verified on 2026-08-23. Row/party counts are snapshot-specific: the 2026 file is updated hourly until 13 September 2026, so the plan uses structural invariants for verification and records the imported snapshot's SHA-256 and retrieval time in the PR.
- External dependency: `data.val.se` availability. `--file` makes every step reproducible from a downloaded copy.
- Sequencing: the comment on #24 was a recommendation, not a hard dependency (issue owner, 2026-08-23). Sufficient for this PR is that `import-val.js` asserts the invariants it relies on — unique `filnamn`, unique `uuid`, every party referenced from val data exists in the index, all 290 kommuner present — and exits non-zero on violation (step 4.v). #24 generalises those assertions into a standalone CI validator afterwards.
- Design Decision 2 (alias file + name fallback that fails on ambiguity) is confirmed by the issue owner (2026-08-23) after checking the CSVs: 192 of 195 same-name parties keep their `PARTIKOD` 2022→2026, with a handful of reassignments (e.g. Kommunens Väl `0526`→`0503`, Kalle Ankapartiet `1579`→`1825`) and 13 repo-vs-2026 mismatches, several of which are distinct local parties sharing a generic name. Hence `PARTIKOD` is the primary key, `kodbyten.json` records known rebindings, and the name fallback must never merge two parties silently.
- The 2026 import is provisional until Valmyndigheten's data is final: anmälan om deltagande and kandidatanmälan close before the election and the file is updated hourly. Acceptance for this issue is a dated snapshot (SHA-256 in the PR); a follow-up re-import after the final pre-election update (and again after 13 September 2026 if the file changes) is part of the definition of done — step 19.
- `partisymboler.zip` is not in scope.

## Analysis

### Current state

- `data/parti/index.json` (333 entries, `{uuid, beteckning, filnamn}`) and one `data/parti/<filnamn>/index.json` per entry (`{uuid, beteckning, filnamn, kod, forkortning?, valmyndigheten_registreringsdatum?}`). Every entry has a matching folder; `kod` is unique and present everywhere. The index is sorted by `filnamn` except for two inversions (`kommunpartiet-vansbro`/`-mellerud`, `sjukvardspartiet-vastra-gotaland`/`-bollnas`).
- `data/val/2018/partideltagande/`: `riksdag.json` (79 × `{beteckning, kod, uuid}`), `landsting.json` (20 län × `{kod, namn, uuid, partier[]}`), `kommun.json` (208 of 290 kommuner, same shape — #20). The 2018 region/kommun files deliberately list only parties that are *not* in `riksdag.json`, so a riksdag party has zero lower-level entries there.
- `data/regioner/index.json`: 21 län with `kommuner[]`, each with `kod`, `namn`, `uuid`. This is the authority for region/kommun names and uuids.
- `scripts/`: `utils.js` (`ROOT`, `dataPath`, `toFileName`, `newUuid`, `loadXML`, `loadJSONFile`), `helpers.js` (XML parsing, loads `parti/index.json`), `collect.js` (XML fetch loop), `parti.js` (rewrites index from the in-memory party list). `npm run collect` runs `collect.js`. There is no test script.
- `src/types.ts` defines `Parti` and `PartiIndexEntry`; `src/pages/parti/[filnamn].tsx` renders kod, förkortning and registration date; `src/pages/index.tsx` only uses `beteckning`/`filnamn`.

### Source data facts (verified against the live CSVs on 2026-08-23)

- Header starts with a UTF-8 BOM; `;`-separated; no quote characters anywhere in either file; 16 columns as listed in the issue. `PARTIFÖRKORTNING` is a single space when missing (about half of the parties). Column 15 (`ANMÄLDAKANDIDATER`) is also a single space when not applicable.
- **Riksdag rows are per valkrets** (29 valkretsar × party). The same party can have `DELTAGANDEGRUND` `A` in some valkretsar and `K`/`R` in others. `riksdag.json` must deduplicate on `PARTIKOD`; a party participates in riksdagsvalet if it has any RD row.
- `RF` rows use the 2-digit länskod as `VALOMRÅDESKOD` (20 regions; Gotland has none), `KF` rows use the 4-digit kommunkod (290). Both are listed per valkrets, so deduplicate per (valområde, partikod).
- Within one year a code has exactly one name. The same code can carry a different name in different years (19 codes differ between the repo and 2026; 22 between 2022 and 2026), e.g. `0532` Feministiskt initiativ → Enad Röst, `0498` Öpartiet → Mälaröpartiet.
- **PARTIKOD is not stable across elections for every party.** 146 of the 416 codes in the 2026 snapshot match a repo `kod`; 156 repo codes appear in neither 2022 nor 2026. Some are the same party under a new code — e.g. repo `1299 Medborgarpartiet` vs 2026 `0505 Medborgarpartiet`, `1413`→`1497 Brobyggarpartiet`, `1378`→`1773 Norrlandspartiet`. Matching purely on code would create a second `medborgarpartiet-0505` page next to a stale `medborgarpartiet`. See Design Decision 2.
- `toFileName` collisions: inside 2026 alone, four slugs are shared by different codes (`kommunens-val` ×3, `kommunlistan` ×3, `alternativet` ×2, `habodemokraterna` ×2), and a dozen new codes map to a slug already used by an existing repo entry. The committed convention for this is a `-<kod>` suffix (`framstegspartiet-1223`, `-1224`, `-1226`). Note that case-insensitive names are therefore not unique in the registry either (three "Framstegspartiet"), which matters for Design Decision 2.
- All 2018 `riksdag.json` codes exist in the repo, so 2018 files need no changes.

### Key considerations

- **URL stability.** `filnamn` is the public URL. Existing slugs must survive; renamed parties keep their slug (Design Decision 3).
- **uuid stability.** uuids live in the party files and are the cross-reference key from `val/` files. They are read from disk and never regenerated for a known party. New uuids are allocated once and persisted, so re-running the import is a no-op.
- **Idempotence and order-independence.** Output must be byte-identical for identical input: sorted keys, arrays sorted by `kod`/`filnamn`, `JSON.stringify(…, null, 2) + '\n'`. Derived party fields (current name, abbreviation, registration flag, `deltagande`) are computed from the per-year files on disk, not from the order scripts were run in. "Order-independent" means: once uuids are persisted, importing the years in any order yields the same files (a first run from a clean baseline allocates random uuids, so it cannot be byte-compared with another first run).
- **Validate before writing.** All parsing, reconciliation and reference checks happen in memory; nothing is written if any check fails.
- **One source of truth for participation.** `val/<år>/partideltagande/*.json` is authoritative; party files carry a derived per-year summary matched by `uuid` (historical files keep old codes after a re-code, so matching by `kod` would miss them).
- **No new dependencies** (`engines: node >= 24`, `fetch` and `node:test` built in). Pure CommonJS like the existing scripts.

## Implementation Steps

### Phase 1: CSV helper and import (`scripts/utils.js`, `scripts/import-val.js`)

1. `scripts/utils.js`: add `fetchText(url)` (throws on non-2xx with status and URL) and `parseCsv(text, { separator: ';' })`; remove `loadXML` and the `https`/`Buffer` requires.
   - `parseCsv`: strip BOM, split on `\r?\n`, drop empty lines, split on the separator, trim values, map `' '` → `''`. Throw on a quote character anywhere (the source is unquoted today; #33 can upgrade to a quote-aware parser), on duplicate header names, and on any row whose width differs from the header.
2. Create `scripts/import-val.js` with CLI `node scripts/import-val.js <år> [--file <path>]`.
   - Without `--file`: `fetchText('https://data.val.se/filer/val<år>/parti/deltagande-partier.csv')`. Log the SHA-256 of the text and the retrieval time so they can be quoted in the PR.
   - Validate the header contains exactly the 16 expected column names. Validate each row: `VALTYP ∈ {RD, RF, KF}`, `DELTAGANDEGRUND ∈ {A, R, K}`, `PARTIKOD` is four digits, `VALOMRÅDESKOD` is `00` for RD, two digits for RF, four digits for KF, `REGISTRERADPARTIBETECKNING ∈ {J, N}`. Assert each `PARTIKOD` has one `PARTIBETECKNING`, one `PARTIFÖRKORTNING` and one registration flag within the file.
3. Build the year's structures in memory, deduplicating per (valområde, `PARTIKOD`):
   - `partier`: one record per unique code — `{ kod, beteckning, forkortning?, registrerad_partibeteckning: bool, uuid }`, sorted by `kod`. This is the year-based source for the registry's derived fields.
   - `riksdag`: codes with any `RD` row → `[{ beteckning, kod, uuid, grund }]` sorted by `kod`.
   - `region`: `RF` → one entry per län from `data/regioner/index.json` that has RF rows: `{ kod, namn, uuid, partier: [{ beteckning, kod, uuid, grund }] }`.
   - `kommun`: `KF` → one entry per kommun from `data/regioner/index.json`, **all 290**, `partier` possibly empty. Names and uuids come from `regioner/index.json`; an unknown `VALOMRÅDESKOD` is a hard error.
   - `grund`: when a party has several rows in the same valområde, keep `A` if present, else `R`, else `K`.
4. Exact sequence — everything is built and validated in memory, and the filesystem is touched only in the last step:
   1. parse and validate the whole CSV (step 2);
   2. `loadParties()` and `upsertParties(år, partier)` in memory — allocates uuids for new parties (Phase 2);
   3. build `partier`/`riksdag`/`region`/`kommun` (step 3) with the resolved uuids;
   4. `buildParties(parties, yearFiles)` (Phase 2) — derives party fields from the year files already on disk plus this year's in-memory structures, and returns the full write-set: every party file and `index.json`;
   5. assert the invariants the import depends on, and `process.exit(1)` with a clear message if any fails: `filnamn` unique across the registry; `uuid` unique; every party referenced from the year structures (and from every existing `data/val/*/partideltagande/*.json`) exists in the index; `kommun.json` contains exactly the 290 kommuner from `data/regioner/index.json`; no code appears twice across `kod`+`tidigare_koder`; every region/kommun code exists; `index.json` length equals the number of party files. These are the checks #24 later generalises into a CI validator;
   6. write all files (`mkdir -p`): `data/val/<år>/partideltagande/{partier,riksdag,region,kommun}.json`, then party files and `index.json`. A failure here can only be an I/O error, and `git status` shows exactly what was touched.
5. Log a summary: rows read, unique parties, parties created (with slug), fallback merges (old kod → new kod, name), renamed parties, written paths.

### Phase 2: Party registry (`scripts/parti.js`, rewritten)

6. Rewrite `scripts/parti.js` as a module exporting `loadParties()`, `upsertParties(year, partier)`, `buildParties(parties, yearFiles)` and `writeFiles(writeSet)`; keep a `node scripts/parti.js` entry point that runs `loadParties` → `buildParties` (all years from disk) → validate → `writeFiles` (rebuild from disk).
   - `loadParties()` reads every `data/parti/*/index.json` (not the top-level `index.json`) — the party files are the source of truth; `index.json` is derived. It also loads `data/parti/kodbyten.json` (Design Decision 2).
7. `upsertParties(year, partier)` for each record:
   - Match by `kod` against `kod` and `tidigare_koder`.
   - Else, if `kodbyten.json` maps the new code to an existing code, merge into that party.
   - Else, exact case-insensitive `beteckning` match restricted to parties whose `kod` does not occur in `data/val/<any year ≥ 2022>/partideltagande/partier.json` nor in the current import. Exactly one candidate → merge and log; zero → new party; more than one → throw, instructing to add an entry to `kodbyten.json`.
   - Merge = keep `uuid` and `filnamn`; add the new code to the party's code set (`koder`, in memory). The name-fallback search also considers a code absent from the *other* imported year, so a party re-coded between 2022 and 2026 merges regardless of which year is imported first; the alias file is consulted in both directions (new→old and old→new).
   - New party = `{ uuid: newUuid(), koder: [kod], beteckning, filnamn }` with `filnamn = toFileName(beteckning)`, suffixed `-<kod>` when that slug already exists on another party (Design Decision 4). Two new parties sharing a slug both get suffixes.
   - Nothing else is set here; the current code, name, abbreviation and flags are derived in `buildParties` from the year files so results do not depend on import order.
8. `buildParties(parties, yearFiles)`:
   - Read all `data/val/*/partideltagande/partier.json` (2022+) and, for 2018, `riksdag.json` as a partial equivalent (name and code only), with the in-memory structures of the year being imported taking the place of its files. Per party, the record from the newest year present (matched by `uuid`) gives `kod`, `beteckning`, `forkortning` (cleared when the newest record has none) and `registrerad_partibeteckning`; `tidigare_koder` = every other code the party has carried, `tidigare_beteckningar` = every other distinct name from older years and from the pre-existing file, oldest first. Parties absent from every year file keep their existing fields.
   - `deltagande`: for each year read `riksdag.json`, `region.json` (or `landsting.json`), `kommun.json`; match by `uuid`; produce `{ "<år>": { riksdag: bool, region: ["10", …], kommun: ["0114", …] } }` with codes sorted ascending, listing only years with any entry. Document in README that for 2018 the lists contain only explicit entries (riksdag parties have none below riksdag level), while 2022+ lists include `R`/`K` inherited participation.
   - Produce each `data/parti/<filnamn>/index.json` with keys in a fixed order (`uuid, kod, tidigare_koder, beteckning, tidigare_beteckningar, filnamn, forkortning, registrerad_partibeteckning, valmyndigheten_registreringsdatum, deltagande`), omitting undefined/empty optional keys.
   - Produce `data/parti/index.json` as `[{ uuid, beteckning, filnamn }]` sorted by `filnamn` with plain code-unit comparison (fixes the two existing inversions; that diff is expected).
   - Throw if two parties share a `filnamn`, `uuid`, or a code across `kod`/`tidigare_koder`.
9. Create `data/parti/kodbyten.json` (`{ "<ny kod>": "<gammal kod>" }`, initially `{}` unless the import reports an ambiguous name). `package.json`: replace `"collect"` with `"import-val": "node scripts/import-val.js"` and add `"test": "node --test"` (Node's default pattern finds `scripts/*.test.js`; `node_modules` is excluded). Add `- run: npm test` to `.github/workflows/ci.yml` after `npm run typecheck`, and `&& npm test` to the `precommit` script.

### Phase 3: Tests

10. Add `scripts/import-val.test.js` and `scripts/parti.test.js` (`node:test`, fixtures under `scripts/fixtures/`, writing to a temp copy of a minimal `data/` tree):
    - BOM stripping, `' '` → empty, row-width and header errors, quote rejection;
    - RD per-valkrets dedup and `A > R > K` precedence;
    - all 290 kommuner present with empty `partier`;
    - identity: kod match, `tidigare_koder` match, `kodbyten.json` alias, single-candidate name fallback, ambiguous name → error, slug collision → `-<kod>`;
    - renamed code keeps `filnamn` and gets `tidigare_beteckningar`;
    - a party re-coded between 2022 and 2026 ends up as one party with `tidigare_koder` in either import order;
    - nothing is written when validation fails (temp tree unchanged after an invalid CSV);
    - idempotence (second run produces identical bytes) and order-independence after uuids exist (2026 then 2022 equals 2022 then 2026).

### Phase 4: Run the import, remove the collector, docs

11. Download both CSVs once to the scratchpad, then `node scripts/import-val.js 2022 --file …` and `… 2026 --file …`. Note each file's SHA-256 and retrieval time for the PR body.
12. Review the generated diff: no pre-existing `filnamn`/`uuid` changed; every fallback merge in the log is plausible (otherwise add to `kodbyten.json` and re-run); renamed codes show the new `beteckning` and keep their `filnamn`; `index.json` entry count equals the number of party folders.
13. Re-run both imports (same `--file`s, reverse order) and confirm `git status` is clean.
14. Only after step 13 succeeds: delete `scripts/collect.js` and `scripts/helpers.js`.
15. `src/types.ts`: extend `Parti` with `tidigare_koder?: string[]`, `tidigare_beteckningar?: string[]`, `registrerad_partibeteckning?: boolean`, `deltagande?: Record<string, { riksdag: boolean; region: string[]; kommun: string[] }>` so #21 can consume the data. The page itself is unchanged here.
16. `src/components/Footer.tsx`: point the Valmyndigheten source at `https://data.val.se/` labelled "partibeteckningar och partiers anmälda deltagande i val".
17. `README.md` — only the "Tillgänglig data" and "Köra skripten" sections (the rest is #25): `val/<år>/partideltagande/{partier,riksdag,region,kommun}.json`, the 2018 `landsting.json` naming and subset semantics, the new party-file fields, `kodbyten.json`, `npm run import-val -- <år> [--file …]`, `npm test`. `CLAUDE.md`: update the data-scripts bullet.
18. `npm run lint && npm run typecheck && npm run build && npm test`; spot-check `/parti/feministiskt-initiativ/` (title "Enad Röst"), a new party, and a `-<kod>`-suffixed one with `npm run dev`.
19. Snapshot policy for 2026: the PR records the imported snapshot (SHA-256, retrieval time). Open a follow-up issue "Uppdatera 2026-importen efter sista anmälningsdag / efter valet" so the data is re-imported once Valmyndigheten's file stops changing; each re-import is a plain `npm run import-val -- 2026` + commit.

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `scripts/utils.js` | Modify | Add `parseCsv`, `fetchText`; remove `loadXML` |
| `scripts/import-val.js` | Create | CLI: download/read CSV, validate, build year files, drive registry |
| `scripts/parti.js` | Rewrite | Registry: load/upsert/write party files and `index.json`, derived fields and `deltagande` |
| `scripts/import-val.test.js`, `scripts/parti.test.js`, `scripts/fixtures/` | Create | `node:test` coverage for parsing, identity and idempotence |
| `scripts/collect.js`, `scripts/helpers.js` | Delete | XML collector superseded |
| `package.json` | Modify | `collect` → `import-val`; add `test`, extend `precommit` |
| `.github/workflows/ci.yml` | Modify | Run `npm test` |
| `data/parti/kodbyten.json` | Create | Reviewed new-code → old-code aliases |
| `data/val/2022/partideltagande/{partier,riksdag,region,kommun}.json` | Create | 2022 participation |
| `data/val/2026/partideltagande/{partier,riksdag,region,kommun}.json` | Create | 2026 participation |
| `data/parti/index.json` | Modify (generated) | Union of 2018/2022/2026 parties |
| `data/parti/*/index.json` | Modify/Create (generated) | New fields, new parties |
| `src/types.ts` | Modify | New optional `Parti` fields |
| `src/components/Footer.tsx` | Modify | Data source link and wording |
| `README.md`, `CLAUDE.md` | Modify | Data layout and script docs |

## Codebase Areas

List the primary directories/areas this plan touches (for conflict detection):
- `scripts/` (all files)
- `data/parti/` (all files, generated)
- `data/val/2022/`, `data/val/2026/` (new)
- `src/types.ts`, `src/components/Footer.tsx`
- `README.md` (data and scripts sections), `CLAUDE.md`, `package.json`

## Design Decisions

> Non-trivial choices made during planning. Feedback welcome; otherwise implementation proceeds with these.

### 1. One command per year does download, registry update and val/ output
**Options:** A) separate `import-val.js` (val files) and `parti.js` (index) run in sequence; B) `import-val.js <år>` does everything, `parti.js` is the module plus a standalone rebuild.
**Decision:** B.
**Rationale:** The val files need uuids, and uuids for new parties are allocated by the registry, so A would need a two-pass dance or uuid-less val files. B keeps "run one command, commit" per the issue's step 1. Provenance: agent's judgment, consistent with the issue's steps 1–2; open to question.

### 2. Identity: `PARTIKOD` first, then alias file, then single-candidate name fallback
**Options:** A) match on `kod` only (issue text); B) `kod`/`tidigare_koder`, then a committed `kodbyten.json`, then an exact case-insensitive name match restricted to parties whose code is absent from every year ≥ 2022 — merge only when exactly one candidate, fail when ambiguous.
**Decision:** B.
**Rationale:** `PARTIKOD` is the primary key — 192 of 195 same-name parties keep their code 2022→2026 — but Valmyndigheten does reassign codes (Kommunens Väl `0526`→`0503`, Kalle Ankapartiet `1579`→`1825`, Medborgarpartiet `1299`→`0505`, Brobyggarpartiet, Norrlandspartiet), and 13 repo-vs-2026 mismatches include distinct local parties sharing a generic name. With A the site would have two pages for one party and the old page would never show participation again; a naive name match would merge unrelated parties. B preserves URLs and uuids, `kodbyten.json` records known rebindings as reviewed committed data, and "exactly one candidate or fail" guarantees the name fallback never merges two parties silently (the registry already has three case-insensitive "Framstegspartiet"). Provenance: confirmed by the issue owner on 2026-08-23 after verifying the CSVs; every automatic merge is still logged and listed in the PR.

### 3. Renamed parties keep their `filnamn`
**Options:** A) keep old slug, update `beteckning`; B) new slug from the new name plus a redirect from the old one.
**Decision:** A.
**Rationale:** The site is a static export behind nginx `try_files`; redirects would need `deploy/` nginx changes and a redirect map. The issue offers both ("behållas eller redirectas"). Keeping slugs is zero-risk for URLs; `tidigare_beteckningar` preserves discoverability. Provenance: agent's judgment within the options the issue gives; open to question.

### 4. Slug collisions get a `-<kod>` suffix
**Options:** A) `-<kod>` suffix; B) numeric `-2`, `-3`; C) include kommun name.
**Decision:** A.
**Rationale:** Existing convention in the committed data (`framstegspartiet-1223/-1224/-1226`). Deterministic and independent of import order. Provenance: existing convention.

### 5. Per-year `partier.json` as the source for derived party fields
**Options:** A) `upsertParties` writes name/abbreviation/flag directly, "newest year wins" by run order; B) each year writes `partier.json`, and `writeParties` derives current values from the newest year on disk.
**Decision:** B.
**Rationale:** A depends on the order scripts were run and on in-memory state; B is a pure function of the committed files, so a rebuild (`node scripts/parti.js`) and any import order give the same result, and the year-specific record (name, abbreviation, registration) is preserved as data rather than lost in a merge. Provenance: agent's judgment (from review feedback); open to question.

### 6. No party-page UI changes in this issue
**Options:** A) add participation rows/table to `[filnamn].tsx` here; B) leave rendering to #21.
**Decision:** B.
**Rationale:** #21 is the dedicated issue and asks for *where* a party participates, not counts; doing a partial version here would conflict with it. Only `src/types.ts` is extended so #21 can consume the data. Provenance: existing issue scope (#21).

### 7. `region`/`kommun` files list all parties with a `grund` marker
**Options:** A) mirror 2018 (`landsting.json` lists only non-riksdag parties); B) list every party with RF/KF rows and record `grund` (`A`/`R`/`K`).
**Decision:** B.
**Rationale:** Faithful to the source and lets consumers filter either way; the 2018-style subset (local parties only) is reproduced by excluding parties present in the same year's `riksdag.json`, and `grund` additionally tells whether a listing is the party's own anmälan (`A`) or inherited from a higher level (`R`/`K`). The 2018 files are not rewritten; README documents the difference. Provenance: agent's judgment; open to question.

## Verification Checklist

- [ ] `node scripts/import-val.js 2022 --file …` and `… 2026 --file …` run from any working directory without new dependencies and write eight val files
- [ ] Header/row validation rejects a CSV with missing or extra columns, quotes, or an invalid `VALTYP`/`DELTAGANDEGRUND`; a non-2xx response fails loudly; nothing is written on failure
- [ ] Invariants (snapshot-independent): `riksdag.json` has one entry per unique code with an RD row; `region.json` has 20 län; `kommun.json` has 290 kommuner in both years; `partier.json` count equals the number of unique codes in the CSV
- [ ] Every `uuid` in `data/val/*/partideltagande/*.json` exists in exactly one party file; no `"NOT FOUND"`
- [ ] All 333 pre-existing `filnamn` and `uuid` values are unchanged; renamed codes show the new `beteckning` and list the old one in `tidigare_beteckningar`
- [ ] Fallback merges are logged, reviewed in the PR, and carry `tidigare_koder`; ambiguous names stop the import until `kodbyten.json` resolves them
- [ ] Import exits non-zero (nothing written) when an invariant fails: duplicate `filnamn`, duplicate `uuid`, a val-data uuid missing from the index, or fewer than 290 kommuner
- [ ] No duplicate `filnamn`, `uuid`, or code across `kod`/`tidigare_koder`; collision slugs carry `-<kod>`
- [ ] Re-running both imports (same files, reverse order) leaves `git status` clean
- [ ] `npm test` passes locally and runs in `ci.yml`; `scripts/collect.js`, `scripts/helpers.js`, `loadXML` are gone; `grep -rn "collect" package.json README.md CLAUDE.md` finds nothing stale
- [ ] Follow-up issue for the post-deadline/post-election 2026 re-import exists and is referenced from the PR
- [ ] `npm run lint && npm run typecheck && npm run build` green; every entry in `data/parti/index.json` builds a page
- [ ] `/parti/feministiskt-initiativ/` renders "Enad Röst"
- [ ] README data/scripts sections and CLAUDE.md describe the new layout; PR body quotes the CSV SHA-256s and retrieval times and ends with `Closes #19`
