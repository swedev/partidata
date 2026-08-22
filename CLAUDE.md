# partidata — agent notes

Open data about Swedish political parties. Static public site, Swedish copy.

## Workflow

- Branch + PR flow — never commit directly to `main`. PRs are squash-merged.
- CI (`Integrate`) must be green: `npm run lint && npm run typecheck && npm run build`.
- Deploys happen on `v*` tags, not on merge: tag `main` and push the tag
  (see `deploy/README.md`). Merging is not releasing.

## Stack

- Next 16, pages router, `output: 'export'` — no server, no API routes, no
  `next/image` optimisation. `trailingSlash: true` so nginx `try_files` works.
- Party pages are pre-rendered from `data/parti/index.json` via
  `getStaticPaths`; every entry must have a matching `data/parti/<filnamn>/index.json`.
- Styling: Tailwind 3 + Bootstrap 5 tables via sass. `src/styles/base.scss` is
  the single CSS entry; it pulls in `app.scss` and `lato.scss` so Tailwind's
  `@layer` blocks share one file with the `@tailwind` directives.
- Data collection scripts live in `scripts/` and run offline
  (`node scripts/collect.js`); results are committed to `data/`.

## Deploy

`deploy/README.md` — nginx conf, certbot, deploy key, GitHub secrets.
