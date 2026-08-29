# Issue #86: Start page filters are lost after opening a party and going back

**Baserad på:** main

## Sammanfattning

Startsidan håller sökterm, valår, län, kommun, valtyp och sortering enbart i `useState` i `src/components/home/HomeContent.tsx`, så en läsare som öppnar ett parti och går tillbaka börjar om från förvalen. Planen flyttar tillståndet till URL:ens query string (`valar`, `valtyp`, `lan`, `kommun`, `q`, `sortering`) med förvalen utelämnade så att `/` förblir kanonisk ("Alla valår" får token `valar=alla`, eftersom förvalet är det senaste året): en ny ren modul `src/components/home/query.ts` översätter query ⇄ tillstånd och testas med `node:test`, `getServerSideProps` tolkar `context.query` och seedar komponenten så att en delad länk renderas filtrerad redan på servern (verifierat i `http-smoke`), och `HomeContent` skriver URL:en i varje händelsehanterare med shallow `router.replace` utan scroll — omedelbart, så en ändring följd av ett partiklick överlever bakåtnavigeringen. En riktig navigering till `/` (t.ex. via logotypen) börjar om från URL:en genom en `key` som räknas upp på icke-shallow `routeChangeComplete`. "Rensa filter" lämnar sorteringen som i dag; antalet utfällda partier lämnas utanför scope, med förslag om uppföljningsissue tillsammans med scrollåterställning. Klientnavigeringen har ingen automatisk täckning och verifieras manuellt som obligatoriskt steg.

## Triageringsstatus

| Fält | Värde |
|------|-------|
| **Redo att arbeta** | Ja |
| **Risk** | Medel |
| **Säker för junior** | Ja, med granskning |

## Plangranskning

**Status:** Granskad
**Granskad:** 2026-08-29
**Feedback:** Tre granskningsrundor. Första rundan: fördröjda URL-skrivningar kunde tappa en ändring vid omedelbart partiklick, återställningens effekt på sorteringen var oklar (nu ett explicit beslut: sorteringen lämnas, designbeslut 9), URL-jämförelsen var ospecificerad, smoke-testet kontrollerade bara kontrollerna och inte resultatet, och flera kantfall (`valar=[]`, blanksteg i `q`, kommun med ogiltigt län, rundtur bara för kanoniska tillstånd) saknades. Andra rundan: fördröjningen slopades helt — varje ändring skrivs i sin egen händelse med omförsök när webbläsaren vägrar — hash läses ur `window.location` i stället för routern, skrivningen hoppas över när den normaliserade söksträngen redan är URL:ens, sök-/sorteringsscenariot i smoke-testet jämför hela gridet, och triageringen fick faktiska issue-metadata. Tredje rundan: `valar=alla`-assertionen rättades — utan år släpper `matchesParticipation()` igenom alla 670 partier, inte bara de 639 med deltagande. Avböjt: att införa Playwright för klientnavigeringen — bedöms oproportionerligt, i stället obligatoriska manuella kontroller i fas 3 och en öppen fråga till användaren.

## Relaterade filer

- [plan.md](plan.md) — Fullständig implementationsplan
- [progress.md](progress.md) — Implementationsframsteg

## Relaterade issues

- Inga öppna issues refererar #86
