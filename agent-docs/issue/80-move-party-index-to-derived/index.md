# Issue #80: Move the generated party index to data/derived/parti.json

**Baserad på:** main

## Sammanfattning

`data/parti/index.json` är en genererad projektion av de 670 partifilerna — sju fält per parti, skriven av `scripts/parti.js` och kontrollerad fält för fält av `scripts/validate.js` — men ligger bland katalogerna som är avsedda att redigeras, och inget i namnet säger att den inte får ändras för hand. Planen flyttar filen till `data/derived/parti.json` med `git mv`, pekar om skrivaren (`buildParties()`/`validate()` i `parti.js`) och de sex läsarna (`src/server/party-data.ts`, `validate.js`, `build-derived-data.js`, `riksdag-results.js`, `http-smoke.js`, `build-release.js`), uppdaterar de sju testfiler som läser eller skriver registret, och skriver regeln en gång i README under ett nytt avsnitt `derived/`: allt där är genererat och redigeras inte för hand. Filens form ändras inte; README beskriver samtidigt hela projektionen (tre obligatoriska och fyra valfria fält) och byggordningen inom `derived/`, där `riksdag.json` byggs ur `parti.json`. Issuets fråga om filen förtjänar sin plats besvaras med att den behålls: startsidans läsning av alla partifiler sker en gång per process och cachas, så I/O är inte argumentet; filen är det publika registret (#26) och sajtens slug-/uuid-tabell. `validate:data` får dessutom två kontroller som gör regeln verklig: registret får bara ha de fält generatorn skriver, och en `data/parti/index.json` får inte lämnas kvar.

## Triageringsstatus

| Fält | Värde |
|------|-------|
| **Redo att arbeta** | Ja |
| **Risk** | Låg för koden, Medel för externa konsumenter (dokumenterad GitHub-adress bryts utan omdirigering) |
| **Säker för junior** | Ja |

## Plangranskning

**Status:** Utkast
**Granskad:** Ej ännu
**Feedback:** N/A

## Relaterade filer

- [plan.md](plan.md) — Fullständig implementationsplan
- [progress.md](progress.md) — Implementationsframsteg

## Relaterade issues

- #26 — Publicerat JSON-gränssnitt; registrets nya adress och form är det som ska dokumenteras där, och ett eventuellt metadatahuvud på filen hör hemma i det arbetet
