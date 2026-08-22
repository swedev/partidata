# Implementation Plan: Datainsamlingsskripten i scripts/ är trasiga (fel sökväg till utils, saknade beroenden)

## Summary

`node scripts/collect.js` (and `scripts/parti.js`) cannot start: `scripts/collect.js` and `scripts/helpers.js` `require('./utils.js')` but the file lives in `src/utils.js`; `src/utils.js` and `scripts/parti.js` require `lodash` and `uuid`, which are not in `package.json`; and data paths are resolved inconsistently (`process.cwd()` in some places, `__dirname` in others). Fix: move `src/utils.js` to `scripts/utils.js` (nothing in the site imports it), drop the `lodash`/`uuid` usages in favour of `String.prototype.normalize` and `crypto.randomUUID()` (no new dependencies), resolve every data path against the repository root, add an `npm run collect` script, and document how to run the scripts in `README.md`. Scope is deliberately "make it start again" — #19 will replace `collect.js`/`helpers.js`/`parti.js` with a CSV import, so no rewrite of the collection logic here.

## Triage Info

> Decision-support metadata for this issue.

| Field | Value |
|-------|-------|
| **Blocked by** | None |
| **Blocks** | #19 Uppdatera partidata för valen 2022 och 2026 ("Beror på #18"). The issue comment also lists #20 and #29, but both were closed 2026-08-22 as NOT_PLANNED, superseded by #19. |
| **Related issues** | #19 (will delete `collect.js`/`helpers.js` and replace `parti.js` once the CSV import works — keep this fix minimal), #24 (CI data validation; proposes `scripts/validate.js` "ren Node, inga nya beroenden" — same no-deps direction as this plan), #25 (README rewrite — also fixes the `./utils.js` reference and documents local running; coordinate wording so the two PRs do not fight over the same README lines), #20 and #29 (closed, superseded by #19) |
| **Scope** | 7 files across `scripts/`, `src/` (file removal), `package.json`, `README.md`, `CLAUDE.md` |
| **Risk** | Low |
| **Complexity** | Low |
| **Safe for junior** | Yes |
| **Conflict risk** | Low–Medium — the other plans in `agent-docs/issue/` (#15 merged, #16 `src/pages/**` + `src/types.ts`, #27 `src/pages/index.tsx`) touch no file in this plan. `README.md` is shared with the unplanned #25 (full README rewrite) and `CLAUDE.md`/`scripts/` with #19; keep the README addition small so #25 can absorb it. |

### Triage Notes
No explicit blockers; the only comment on the issue ("Blockerar #19, #20 och #29") describes what this issue blocks, not what blocks it. There is no `agent-docs/github/info.json` or `project.json`, so no project-board fields were queried and branch alignment was skipped (no `release` field); current branch is `main`. Verified locally on 2026-08-22 (Node v24.14.1): `node scripts/collect.js` fails with `Cannot find module './utils.js'`; `package-lock.json` contains neither `lodash` nor `uuid`; `npx eslint scripts src/utils.js` passes (eslint-config-next lints plain `.js` files too, so the moved file stays linted). Sequencing: #18 → #24 → #19 — #19 builds on runnable scripts (and removes most of them afterwards), and the comment on #24 asks for data validation to be in place before #19 rewrites large amounts of data. Neither affects #18 itself.

## Analysis

- **Who uses `src/utils.js`.** Only `scripts/collect.js` (`loadJSONFile`) and `scripts/helpers.js` (`loadJSONFile`, `loadXML`). `rg utils src` finds no import from the site; `tsconfig.json` has `allowJs` but `include` is `**/*.ts`/`**/*.tsx`, so the file is not type-checked either. Moving it to `scripts/utils.js` makes the existing `require('./utils.js')` lines correct without editing them. `README.md` currently points at "`toFileName` i `./utils.js`" — update that reference.
- **`lodash` usages.** `_.deburr` in `toFileName` (utils) and `_.pick` in `parti.js`. `_.deburr` can be replaced by `name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')` (write the range with `\u` escapes, not literal combining characters). Checked against the dataset: for all 333 entries in `data/parti/index.json` the NFD version yields the same `filnamn` as today except 8 entries whose `filnamn` were hand-adjusted anyway (`framstegspartiet-1223/1224/1226` disambiguated by partikod, and five with a trailing `-` from an older version of the function, e.g. `igov-direct-`); none of the 333 `beteckning` values contain characters that lodash deburrs but NFD does not (ø, æ, ß, đ, þ, œ). `_.pick(party, ['uuid','beteckning','filnamn'])` becomes object destructuring.
- **`uuid` usage.** `newUuid()` in utils wraps `uuidV4()`; `crypto.randomUUID()` (Node ≥ 14.17, the repo requires `node >= 24`) produces the same v4 format. `newUuid` is not called by any script today but is the helper #19 will use for new parties, so keep it.
- **Path resolution.** `loadJSONFile(...segments)` uses `path.resolve(...)` which is cwd-relative; `_getRiksdagPartyMap` builds `path.resolve('data', 'val', year, 'partideltagande/riksdag.json')` (cwd-relative); `collect.js` uses `path.resolve('data', 'val', …)` (cwd-relative) and `parti.js` uses `path.join('data', 'parti', 'index.json')` (cwd-relative); `parseULFile`/`parseKommunXMLFile` use `path.resolve(__dirname, filePathname || 'ul.html')` (scripts-dir-relative, for ad-hoc downloaded files that do not exist in the repo). Introduce one `ROOT = path.resolve(__dirname, '..')` in `scripts/utils.js` and a `dataPath(...segments)` helper so every committed data file resolves from the repo root regardless of cwd; make `loadJSONFile` go through it. The two file parsers for ad-hoc inputs (`parseULFile`, `parseKommunXMLFile`) are not called by any script and only matter for manual use; leave their `__dirname`-relative resolution untouched to keep this change limited to committed data files (#19 deletes them).
- **Behaviour of the scripts on the current data (smoke-test baseline).** `collect.js` skips every kommun that already has `partier`; all 208 entries in `data/val/2018/partideltagande/kommun.json` have it, so a run logs `Starting at index: 208`, makes no HTTP requests, and after one 2 s tick rewrites the file. `JSON.stringify(data, null, 2)` is byte-identical to the committed file (no trailing newline — verified), so `git status` stays clean. `parti.js` rewrites `data/parti/index.json` from itself with a trailing newline — also verified byte-identical. Both scripts are therefore safe to run as "does it start and is it idempotent" checks — but note the smoke test makes no network request, so it proves startup and path resolution, not that collection from the legacy `data.val.se` XML endpoint still works (that endpoint, and the error handling around it, are #19's concern). They should not be "fixed" further: incomplete kommun coverage (#20) and error handling (#29) are closed in favour of #19.
- **`npm run collect`.** `package.json` has no script for the collectors. Add `"collect": "node scripts/collect.js"`. `parti.js` is a one-off index rebuild that #19 replaces; it does not need its own npm script (document `node scripts/parti.js` in the README instead).
- **Docs.** `CLAUDE.md` says the scripts "run offline (`node scripts/collect.js`)". After this change it is true again; adjust to mention `npm run collect` and note that `collect.js` does fetch from `data.val.se` ("offline" here means outside the site build, not "without network"). `README.md` gets a short "Köra skripten" section (Swedish, like the rest of the file).
- **Lint/CI.** CI runs `npm run lint && npm run typecheck && npm run build`. `eslint .` already lints `scripts/*.js` and `src/utils.js` cleanly; after the move nothing changes for lint. No TS, no Next impact. `crypto` and `node:` built-ins are fine under the Next ESLint config (no `import/no-nodejs-modules` rule).

## Implementation Steps

### Phase 1: Move utils and drop the missing dependencies
1. Move `src/utils.js` to `scripts/utils.js` with `git mv` so history follows the file.
   - Files to move: `src/utils.js` → `scripts/utils.js`
2. Remove the `lodash` and `uuid` requires in `scripts/utils.js`.
   - `toFileName`: replace `_.deburr(name)` with `name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')`; keep the rest of the chain unchanged.
   - `newUuid`: `return crypto.randomUUID();` with `const crypto = require('crypto');` (or `node:crypto`).
   - Keep the `Buffer` require — it is used by `Buffer.concat(chunks)` in `loadXML`.
   - Files to modify: `scripts/utils.js`
3. Remove `lodash` from `scripts/parti.js`.
   - `parties.map(({ uuid, beteckning, filnamn }) => ({ uuid, beteckning, filnamn }))`; delete the `lodash` require.
   - Files to modify: `scripts/parti.js`

### Phase 2: Resolve data paths from the repository root
4. Add a root-anchored path helper in `scripts/utils.js`.
   - `const ROOT = path.resolve(__dirname, '..');` and `function dataPath (...segments) { return path.join(ROOT, 'data', ...segments); }`; export `dataPath` (and `ROOT` if useful).
   - Contract: `loadJSONFile(...segments)` resolves `path.join(ROOT, ...segments)` — segments are relative to the repository root, so existing callers that pass `'data', 'parti', 'index.json'` keep working unchanged. `dataPath(...segments)` is the convenience for the `data/` subtree and is what the scripts use for write paths.
   - Files to modify: `scripts/utils.js`
5. Use the helper everywhere a committed data file is read or written.
   - `scripts/helpers.js`: `_getRiksdagPartyMap` → `loadJSONFile('data', 'val', String(year), 'partideltagande', 'riksdag.json')`. Leave `parseULFile`/`parseKommunXMLFile` as they are.
   - `scripts/collect.js`: `kommunJsonFile = dataPath('val', year, 'partideltagande', 'kommun.json')`, read with `JSON.parse(fs.readFileSync(kommunJsonFile, 'utf8'))`; keep the existing write. Remove the now-unused `path` require.
   - `scripts/parti.js`: write to `dataPath('parti', 'index.json')`; remove the now-unused `path` require.
   - Files to modify: `scripts/helpers.js`, `scripts/collect.js`, `scripts/parti.js`

### Phase 3: npm script and documentation
6. Add `"collect": "node scripts/collect.js"` under `scripts` in `package.json`. No dependency changes.
   - Files to modify: `package.json`
7. Document the scripts in `README.md` (Swedish).
   - New section "Köra skripten" after "Tillgänglig data": requirements (Node 24, `npm ci`), `npm run collect` — what it does (fills in `partier` for kommuner in `data/val/<år>/partideltagande/kommun.json` from `data.val.se`, max 40 kommuner per run, re-run until `Starting at index` equals the number of kommuner), that it can be run from any directory, and `node scripts/parti.js` (rebuilds `data/parti/index.json` from the party files). Mention that results are committed to `data/`.
   - Fix the reference "`toFileName` i `./utils.js`" → `scripts/utils.js`.
   - Files to modify: `README.md`
8. Update the "Stack" bullet in `CLAUDE.md` to `npm run collect` / `node scripts/collect.js`, and say the collectors fetch from `data.val.se` and are run manually, outside the site build.
   - Files to modify: `CLAUDE.md`

### Phase 4: Verify
9. Confirm `data/val/2018/partideltagande/kommun.json` and `data/parti/index.json` are clean before testing. From the repo root: `npm run collect` → expect `Starting at index: 208`, then `Done, writing file …kommun.json` after ~2 s; `git diff --exit-code -- data/val/2018/partideltagande/kommun.json` must pass (byte-identical rewrite).
10. From another directory, with absolute paths: `cd /tmp && node /abs/path/to/partidata/scripts/collect.js` → same output (proves cwd-independence); `node /abs/path/to/partidata/scripts/parti.js` → `git diff --exit-code -- data/parti/index.json` passes.
11. `node -e "const u=require('./scripts/utils.js'); console.log(u.toFileName('Östra vägen (C)'), u.newUuid())"` → `ostra-vagen-c` and a v4 uuid. Optionally, as a one-off check (not committed): map every `beteckning` in `data/parti/index.json` through `toFileName` and confirm only the 8 known hand-adjusted entries differ from `filnamn`.
12. `npm run lint && npm run typecheck && npm run build` (the CI `Integrate` job). `ls src/utils.js` must fail; `grep -rn "lodash\|require('uuid')" scripts src` must find nothing.
13. Open a PR against `main` (branch + PR flow, squash-merged). End the body with `Closes #18`. No deploy tag is needed — nothing in `out/` changes.

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/utils.js` → `scripts/utils.js` | Move + Modify | Live next to its only consumers; replace `lodash.deburr` with NFD normalisation and `uuid` with `crypto.randomUUID()`; add `ROOT`/`dataPath` and root-anchored `loadJSONFile` |
| `scripts/helpers.js` | Modify | Root-anchored `riksdag.json` path; ad-hoc file parsers take an explicit path |
| `scripts/collect.js` | Modify | Root-anchored `kommun.json` path |
| `scripts/parti.js` | Modify | Drop `lodash.pick`; root-anchored output path |
| `package.json` | Modify | Add `collect` npm script |
| `README.md` | Modify | "Köra skripten" section; fix `utils.js` reference |
| `CLAUDE.md` | Modify | Accurate description of how the scripts run |

## Codebase Areas

List the primary directories/areas this plan touches (for conflict detection):
- `scripts/` (all files)
- `src/` (removal of `utils.js` only)
- repo root (`package.json`, `README.md`, `CLAUDE.md`)

## Design Decisions

> Non-trivial choices made during planning. Feedback welcome; otherwise implementation proceeds with these.

### 1. Remove the `lodash`/`uuid` usages instead of adding them as devDependencies
**Options:** A) Add `lodash` and `uuid` to `devDependencies`; B) replace with `String.prototype.normalize` + `crypto.randomUUID()`.
**Decision:** B
**Rationale:** The issue offers both (user decision, issue #18: "eller ersätt med … och slipp beroendena"). B matches the direction of #19 and #24 ("ren Node, inga nya beroenden") and avoids adding two packages to a lockfile for three call sites. Verified on the dataset that NFD normalisation produces the same `filnamn` as `_.deburr` for every current party name (see Analysis). Residual difference: lodash also transliterates ø/æ/ß/đ/þ/œ, which NFD does not — no current name contains them; a future name with one of them would get a `-` for that character, which could in principle collide with another party. Collision handling is already #19's problem (it imports ~416 new 2022/2026 names and already plans partikod-based disambiguation, cf. `framstegspartiet-1223`), so #19 must assert non-empty, unique `filnamn` over the new names before writing party directories; this issue only has to keep the 333 existing slugs stable. Agent judgment on accepting that edge.

### 2. Keep the fix minimal — no rewrite of `collect.js`
**Options:** A) While touching the scripts, also fix error handling (#29), fetch the missing 82 kommuner (#20), or convert to `async`/`fetch`; B) only make the scripts start and resolve paths correctly.
**Decision:** B
**Rationale:** #20 and #29 were closed as NOT_PLANNED on 2026-08-22, superseded by #19, which will delete `collect.js`/`helpers.js` and the XML parser (user decision, issue #19 plan step 4 and the closing comments). Investing in code that is scheduled for removal would be wasted; the value of this issue is that #19 can start from runnable, correctly-pathed helpers (`loadJSONFile`, `toFileName`, `newUuid`).

### 3. Move `utils.js` into `scripts/` rather than fixing the `require` paths
**Options:** A) Change the two requires to `require('../src/utils.js')`; B) `git mv src/utils.js scripts/utils.js`.
**Decision:** B
**Rationale:** Suggested in the issue (user decision). The file is Node-only CommonJS with `https`/`fs` — it has no business under `src/`, which is the Next app. Moving keeps `src/` pure TS and leaves the existing `require('./utils.js')` lines untouched.

### 4. Anchor paths on `path.resolve(__dirname, '..')`, not on `process.cwd()`
**Options:** A) Standardise on cwd-relative paths and document "run from repo root"; B) standardise on a repo-root constant derived from `__dirname`.
**Decision:** B
**Rationale:** The issue names the cwd/`__dirname` mix as the problem. B makes `node scripts/collect.js`, `npm run collect` and an absolute invocation from elsewhere all behave the same, and is what #19's new `import-val.js` can reuse. Inputs supplied by the caller (`parseULFile(file)`) remain cwd-relative, as is conventional for CLI arguments. Agent judgment.

### 5. Only `collect` gets an npm script
**Options:** A) Add `collect` and `parti:index` (or similar) scripts; B) add only `collect` and document `node scripts/parti.js` in the README.
**Decision:** B
**Rationale:** The issue asks for an npm script `collect` (user decision). `parti.js` is a one-off index rebuild that #19 replaces; an npm alias would have to be removed again shortly. Agent judgment — trivial to add if preferred.

## Verification Checklist

- [ ] `node scripts/collect.js` from the repo root starts, logs `Starting at index: 208`, writes the file, and leaves `git status --porcelain` empty
- [ ] The same command run from a different working directory (absolute path to the script) behaves identically
- [ ] `node scripts/parti.js` runs and leaves `git status` clean
- [ ] `npm run collect` exists and runs `scripts/collect.js`
- [ ] `src/utils.js` no longer exists; `scripts/utils.js` exports `toFileName`, `newUuid`, `loadXML`, `loadJSONFile`, `dataPath`
- [ ] `grep -rn "lodash\|require('uuid')" scripts src` finds nothing; `package.json` has no new dependencies
- [ ] `scripts/helpers.js` `parseULFile`/`parseKommunXMLFile` unchanged; no `path` require left unused in `collect.js`/`parti.js`; `Buffer` require kept in `utils.js`
- [ ] `toFileName('Östra vägen (C)') === 'ostra-vagen-c'`; `newUuid()` matches `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`
- [ ] `README.md` has a "Köra skripten" section and no longer references `./utils.js`; `CLAUDE.md` describes `npm run collect`
- [ ] `npm run lint && npm run typecheck && npm run build` green
- [ ] PR body ends with `Closes #18`
