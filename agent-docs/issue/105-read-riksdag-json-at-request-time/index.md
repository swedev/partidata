# Issue #105: Read data/derived/riksdag.json at request time instead of bundling it

**Baserad på:** main

## Sammanfattning

`src/components/party-profile/elections.tsx` importerar `data/derived/riksdag.json` statiskt, så kammarens sammansättning och valdeltagandeserien kompileras in i bundeln och följer inte med en datapublicering (#100) förrän nästa release. Läsningen flyttas till `src/server/party-data.ts` som en cachad `readParliamentView()` bredvid `readParliamentResults()`; `readOutsideParliament` byter till samma läsning så filen läses en gång per store. `resolveParty` sätter en smal vy — kammarens valår, källa och partier med förkortning och mandat, samt valdeltagandets serie och källor — som `riksdag` på partisidans props. `ElectionResultsSection` får `chamber` och `TurnoutSection` får `turnout` som props och räknar seriens punkter, diagrammets `aria-label` och kammarens platser ur dem i renderingen; sidan renderar valdeltagandesektionen bara när vyn finns. Tester i `scripts/party-data.test.js`, två påståenden i `scripts/http-smoke.js` och ett nytt `scripts/source-imports.test.js` som vaktar att `src/` inte importerar från `data/`. `CLAUDE.md`, `deploy/README.md` och `docs/riksdagsvalresultat.md` skrivs om så att bara `public/img/sveriges_riksdag.svg` nämns som bundlad; SVG:n lämnas som issuet tillåter. Allt går i en PR.

## Triageringsstatus

| Fält | Värde |
|------|-------|
| **Redo att arbeta** | Ja |
| **Risk** | Låg |
| **Säker för junior** | Ja |

## Plangranskning

**Status:** Reviewed
**Granskad:** 2026-09-07
**Feedback:** Tre granskningsrundor (codex). Första rundan: namnkrocken `chamber` i `ElectionResultsSection`, Reacts `<!-- -->` i röktestets mönster, en verifiering som visar ändrad data utan ombyggnad, tre fall för saknad fil/sektion, explicit projektion av `kammare.kalla`, den hårdkodade `aria-label`-texten "1994 till 2022", importvaktens täckning och triagens formulering om #35 och filantalet — alla åtgärdade. Andra rundan la till sidoeffektsimporter i vakten; tredje bekräftade planen utan anmärkning.

## Relaterade filer

- [plan.md](plan.md) — Fullständig implementationsplan
- [progress.md](progress.md) — Implementationsframsteg
- [research.md](research.md) — Forskningsresultat (om finns)

## Relaterade issues

- #100 — Publish data changes without a release; uppföljningen kommer från dess plan (beslut 9 där)
- #104 — Mergad PR för #100
- #35 — Omkörningen av 2026-importen; ändrar `data/derived/riksdag.json` och når partisidorna utan release först när det här är gjort
