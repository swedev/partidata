# Issue #100: Publish data changes without a release

**Baserad på:** main

## Sammanfattning

En ändring under `data/` når i dag partidata.se bara genom en full release med versionshöjning, tagg, bygge och omstart, fast de flesta ändringar på `main` är ren data. Ett nytt workflow `publish-data.yaml` körs vid push till `main` som rör `data/**` (och vid `workflow_dispatch`), checkar alltid ut `main`s spets, kör `validate:data` och `check:derived-data`, rsyncar `data/` till `$TARGET/data/` med `--delete` avgränsat till den katalogen, startar om `partidata.service` så att modul-cacherna i `party-data.ts` släpper de gamla filerna, och delar concurrency-gruppen `production-deploy` med releasen. Jobbet jämför inte `main` med den driftsatta koden: att publicera data och att släppa kod är två skilda saker. `deploy.yaml` bygger bara taggar, så den version servern anger alltid namnger en tagg vars träd är dess kod. Båda workflowen skriver `$TARGET/data-commit` efter sin rsync; `/api/health` anger `data.commit` när filen finns, workflowens publika kontroll kräver att den stämmer, och `/data/`-sidan länkar datan till den committen och säger att datan publiceras från `main` medan `X-Partidata-Version` och sidfoten fortsatt är kodens version. `deploy/README.md` och `CLAUDE.md` skrivs om från "merging is not releasing" till "dataändringar går live vid merge, kod behöver en tagg", och noterar att `data/derived/riksdag.json` och `public/img/sveriges_riksdag.svg` ligger i bundeln och därför bara når partisidorna med en release. Allt går i en PR.

## Triageringsstatus

| Fält | Värde |
|------|-------|
| **Redo att arbeta** | Ja |
| **Risk** | Medel |
| **Säker för junior** | Nej |

## Plangranskning

**Status:** Reviewed
**Granskad:** 2026-09-07
**Feedback:** Fem granskningsrundor (codex). Första rundan: `.version` identifierar inte en manuellt byggd gren; dispatch från gren och omkörningar kunde rsynca gammal data med `--delete`; concurrency-gruppen håller bara en väntande körning; felhantering, `TARGET`-miljön i omstartssteget, `pipefail`, undantagslistans motivering, props-typen och alla datalänkar, att `profil.json` inte serveras på `/data/`, och det manuella receptet — alla åtgärdade. Andra rundan: `data/derived/riksdag.json` importeras statiskt i `elections.tsx` (nu beslut 9), releasen måste bara bygga taggar (beslut 10), vakten läser versionen utan `--fail`, och jobbet checkar alltid ut `main`s spets (beslut 8). Tredje och fjärde rundan rättade baslinjen (`main` är en commit före `v0.11.2`) och filantalet i omfattningen (9); femte rundan bekräftade innehållet utan anmärkning.

## Relaterade filer

- [plan.md](plan.md) — Fullständig implementationsplan
- [progress.md](progress.md) — Implementationsframsteg
- [research.md](research.md) — Forskningsresultat (om finns)

## Relaterade issues

- #99 — (mergad PR) CIVIS-profilen; dataändringen som motiverade issuet
- #98 — Avgör om nginx eller Next komprimerar `/data/`; rör samma "Huvuden"-avsnitt på `/data/`-sidan
- #35 — Omkörningen av 2026-importen; första stora dataändringen som går den nya vägen, och kan ändra `public/img/sveriges_riksdag.svg` och `data/derived/riksdag.json` så att en release ändå krävs
