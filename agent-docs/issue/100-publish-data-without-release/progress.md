# Framsteg: Issue #100 — Publish data changes without a release

**Påbörjad:** 2026-09-07
**Senast uppdaterad:** 2026-09-07
**Status:** Slutförd (kod), produktionsverifiering återstår

## Genomförda steg

- [x] Fas 1, steg 1: `src/server/data-commit.ts`
- [x] Fas 1, steg 2: `/api/health` anger `data.commit` i båda grenarna
- [x] Fas 1, steg 3: `scripts/data-commit.test.js` — 4 tester
- [x] Fas 2, steg 1: `/data/`-sidan får `dataCommit` och länkar datan dit
- [x] Fas 2, steg 2: Versioneringsavsnittet och `Cache-Control`-raden
- [x] Fas 2, steg 3: `scripts/http-smoke.js` täcker med och utan `data-commit`
- [x] Fas 3, steg 1: `deploy.yaml` bygger bara taggar
- [x] Fas 3, steg 2: Releasen skriver `data-commit` före omstarten
- [x] Fas 3, steg 3: Publika röktestet kräver committen
- [x] Fas 4, steg 1: `.github/workflows/publish-data.yaml`
- [x] Fas 4, steg 2: Jobbets steg
- [x] Fas 5, steg 1: `deploy/README.md`
- [x] Fas 5, steg 2: `CLAUDE.md`
- [x] Fas 5, steg 3: `README.md` kontrollerad — ingen ändring behövdes

## Verifierat

- `npm run precommit` grönt: lint, typecheck, `check:derived-data`, `validate:data`,
  238 tester, `build:release` och `test:http`.
- `node --test scripts/data-commit.test.js`: saknad fil, giltig hash med och utan
  radbrytning, skräpinnehåll och en katalog i filens ställe.
- `npm run test:http`: hälsosvaret är exakt `{ status: 'ok', version }` utan filen,
  anger `data.commit` med en hash skriven i `.release/` mitt under körningen, och är
  sig likt igen när filen tagits bort. `/data/`-sidan länkar `tree/v<version>/data/`
  utan filen och `tree/<hash>/data/` med den. `.release/data-commit` finns inte kvar
  efteråt.
- Båda workflowfilerna parsas som YAML.

## Beslut under implementationen

- **Ingen vakt** (planens designbeslut 2 och 9). Användarbeslut i konversationen
  2026-09-07: publiceringen av data får aldrig bero på om `main` har oskeppade
  kodändringar — att publicera data och att släppa kod är två skilda saker.
  `publish-data.yaml` jämför alltså inte `main` med den driftsatta taggen, och
  `data/derived/riksdag.json` bevakas inte. I stället säger `CLAUDE.md` och
  `deploy/README.md` att den filen och `public/img/sveriges_riksdag.svg` ligger i
  bundeln och därför bara når partisidorna med en release. Planens beslut 2, 3 och 9
  är uppdaterade.

## Återstår

Punkterna i planens verifieringschecklista som kräver produktion, efter merge:

- Nästa `v*`-tagg: `deploy.yaml` skriver `data-commit` och den publika kontrollen
  kräver committen; en `workflow_dispatch` från en gren faller i "Require a tag".
- En ändring i ett partis `index.json` på `main` triggar "Publish data";
  `https://www.partidata.se/api/health/` anger `main`s commit och
  `/data/parti/<filnamn>/index.json` serveras med ny etagg.
- En push till `main` utan `data/**` triggar inte workflowet; `workflow_dispatch`
  från en gren publicerar ändå `main`s spets.
- En release som taggas medan "Publish data" kör startar först när datajobbet är
  klart.
