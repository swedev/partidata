# partidata — agent notes

Open data about Swedish political parties. Swedish copy.

## Workflow

- Branch + PR flow — never commit directly to `main`. PRs are squash-merged.
- CI (`Integrate`) must be green; `npm run precommit` runs the equivalent local
  lint, typecheck, data validation, tests, standalone build and HTTP smoke.
- Deploys happen on `v*` tags, not on merge: tag `main` and push the tag
  (see `deploy/README.md`). Merging is not releasing.

## Stack

- Next 16, pages router, `output: 'standalone'`, served as a managed Node process
  behind nginx. `next/image` optimisation remains disabled.
- Party pages use `getServerSideProps` and read JSON through
  `src/server/party-data.ts`. Previous slugs return HTTP 308, unknown slugs 404.
- `npm run build:release` packages `.release/`; `npm run test:http` starts that
  exact artifact and verifies the public routes locally.
- Styling: Tailwind 3 + Bootstrap 5 tables via sass. `src/styles/base.scss` is
  the single CSS entry; it pulls in `app.scss` and `lato.scss` so Tailwind's
  `@layer` blocks share one file with the `@tailwind` directives.
- Data scripts live in `scripts/` and are run manually, outside the site build.
  `npm run import-val -- <år> [--file <sökväg>]` imports Valmyndigheten's
  `deltagande-partier.csv` from `data.val.se`, writes
  `data/val/<år>/partideltagande/` and reconciles `data/parti/`;
  `npm run import-partisymboler -- <år> [--file <zip>] [--legacy-dir <dir>]`
  imports code-and-name-labelled PNG party symbols into each party directory,
  records their provenance in `partisymbol` and measures each file into
  `partisymbol.bild`/`partisymbol.bildyta` — the sheet the symbol was delivered
  on and the box its drawing occupies, which is how the site shows every symbol
  at the same optical size; `npm run measure-partisymboler` re-measures the
  already committed symbols without re-importing them;
  `node scripts/parti.js` rebuilds the registry from `data/` alone. Results are
  committed to `data/`. Paths resolve from the repo root, so the scripts run
  from any directory. `npm run validate:data` checks the committed data tree;
  `npm test` runs the `node:test` suite in `scripts/`.

## Deploy

`deploy/README.md` — nginx conf, certbot, deploy key, GitHub secrets.
