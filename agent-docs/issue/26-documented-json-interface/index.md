# Issue #26: Publish a documented JSON interface for Partidata's data

**Baserad på:** main

## Sammanfattning

Sajten serverar sin egen data som JSON under en enda regel: `https://www.partidata.se/data/<sökväg>` är filen `data/<sökväg>` i repot, byte för byte, för de filer som står på en allowlist — registret, varje partis registerfil, `partideltagande/` och `valresultat/riksdag.json` per valår, `derived/riksdag.json` och SCB:s områdeskoder. Allowlisten är en ren, testad modul (`src/server/data-resources.ts`); lagret `party-data.ts` läser filen ur samma `data/`-träd som sidorna, cachar den och sätter `ETag` = SHA-256; en API-route nådd via rewrite från `/data/:path+` svarar på `GET`/`HEAD`/`OPTIONS` med `Content-Type`, `Cache-Control: public, max-age=3600`, 304 på `If-None-Match`, `X-Partidata-Version` och `Access-Control-Allow-Origin: *` på varje svar, 308 för tidigare `filnamn`, 404 för allt utanför listan (kandidatlistor, `profil.json`, PNG, `..`) och 405 för andra metoder. `/data/` är en server-renderad dokumentationssida vars adresstabell och exempel byggs ur datan så att inga länkar är döda, med avsnitt om fält, huvuden, versioneringsprincip och licens (CC0 för sammanställningen, källvillkor per ursprung). Partisidans "Registerdata (JSON)" pekar på Partidata, navigationen får "Data", sidfoten "Data som JSON", sitemapen `/data/`. HTTP-smoke prövar 200/304/404/405/OPTIONS, content-type, CORS, etag, kandidatfilen och partisidans länk. nginx ändras inte.

## Triageringsstatus

| Fält | Värde |
|------|-------|
| **Redo att arbeta** | Ja |
| **Risk** | Medel |
| **Säker för junior** | Ja — med ägarens granskning av allowlisten och licenstexten innan merge |

## Plangranskning

**Status:** Granskad
**Granskad:** 2026-08-30
**Feedback:** Codex (två pass). Infört: `responseLimit: false` i routen, `Vary: Accept-Encoding`, `OPTIONS` som uttalat kontrakt (204 för alla adresser, designbeslut 12), `path.relative`-inneslutning och fler traversal-fall i smoke, en egen `dataCatalogPromise` och en separat testfixtur i stället för ändrad `makeData()`, fälttabeller med typ/obligatoriskt på sidan med test mot riktiga exemplar, README-länkar under den byggda taggen, en uttalad gräns "allt i partifilen är publikt" i README, minnesbudget (60 MB, tolerans 5 MB) och cachebeslut (13), källvillkor för Valmyndigheten/SCB/Wikidata med URL och kontrolldatum, två lokala HTTP-origins för CORS-provet och automatiserad "ingen 308"-assertion. Avvisat: `PUBLIC_PARTY_KEYS`-filtrering av partifilen (bryter byte-identiska svar och #79:s syfte — gränsen dokumenteras i stället), symlänkar i hotbilden, och 404-krav på adresser Next själv normaliserar med 308 (kravet är "aldrig 200 med JSON").

## Relaterade filer

- [plan.md](plan.md) — Fullständig implementationsplan
- [progress.md](progress.md) — Implementationsframsteg
- [research.md](research.md) — Forskningsresultat (om finns)

## Relaterade issues

- #33 — Kandidatlistor och personuppgifter: uttryckligen utanför; allowlisten får aldrig släppa igenom `kandidatlistor/`
- #48 — Stängt; riksdagsresultaten är importerade, så valresultat-adresserna kan publiceras nu
- #53 / #55 — Mergat; den server-renderade appen är grunden för att servera ur samma `data/`
- #25 — README-uppdatering; den här planen lägger bara ett stycke om adresserna, resten lämnas till #25
- #28 / #57 — Bootstrap/Tailwind; dokumentationssidan använder egna tabellstilar, inte Bootstraps `.table`
- #21 — Deltagande per valår på partisidan; samma filer, ingen kodöverlappning
