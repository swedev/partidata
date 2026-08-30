# Issue #91: Present the election type and year filters as segmented single-choice controls

**Baserad på:** main

## Sammanfattning

Startsidans filterrad visar valtypen som tre lösa `aria-pressed`-chips där "alla" väljs genom att klicka av den valda chipen, och valåret som en dropdown. Båda blir en gemensam segmenterad envalsrad med ett explicit första segment för "alla" ("Alla" respektive "Alla valår"), byggd av native `<input type="radio">` i ett `<fieldset>` med visuellt dold `<legend>`, så att exakt ett segment alltid är valt och tabbstopp, piltangenter och hopp över låsta segment följer med elementen. Låsningen (län låser riksdagsval, kommun låser riksdags- och regionval) flyttar till en ren modul `segments.ts` med `node:test`, som också garanterar att den valda typen alltid har ett segment; låstexten behålls som `title` för hover och når hjälpmedel via `aria-describedby`. `toggleKind` tas bort, chip-stilarna i `_home.scss` ersätts av `.home-segments`/`.home-segment`, och smoke-testets sju markup-bundna assertions skrivs om till radio-semantik med en ny assertion för låsningen. Stegen är ordnade så att det nya läggs till och kopplas in innan det gamla tas bort. Tillstånd, URL, `query.ts`, `HomeContent.tsx`, län- och kommunväljarna och riksdagssektionen (#90) ändras inte. Piltangenter i en radio-grupp väljer per tryck och skriver URL:en varje gång, så verifieringen kör #89:s Safari-fall med nedhållen piltangent och antecknar utfallet där.

## Triageringsstatus

| Fält | Värde |
|------|-------|
| **Redo att arbeta** | Ja |
| **Risk** | Låg |
| **Säker för junior** | Ja |

## Plangranskning

**Status:** Granskad
**Granskad:** 2026-08-30
**Feedback:** Två granskningsrundor (codex). Första rundan: borttagningarna av `toggleKind` och chip-stilarna låg före inkopplingen och bröt bygget mellan faserna (nu fas 4, efter fas 3); #89:s retry beskrevs som säkrare än den är verifierad (nu formulerad som förväntat utfall plus ett obligatoriskt Safari-test); låstexten nådde bara mus (nu `aria-describedby` till ett dolt spann); "exakt ett valt" antogs i stället för att garanteras och `PartyFilters` behövde ett typpåstående (nu generisk `SegmentedControl<T>` och `kindSegments` som alltid tar med den valda typen); filantalet var 7, inte 8. Andra rundan pekade på att kantfallet fortfarande stred mot acceptanskriteriet, att "inom en sekund" överdrev retryn och att `title` som beskrivning är opålitlig — alla tre åtgärdade enligt ovan.

## Relaterade filer

- [plan.md](plan.md) — Fullständig implementationsplan
- [progress.md](progress.md) — Implementationsframsteg
- [research.md](research.md) — Forskningsresultat (om finns)

## Relaterade issues

- #90 — Två valårskontroller på startsidan ser ut som ett val; lämnas orört här, men den accessibla namngivningen behövs fortfarande
- #86 — (stängt) Filtren i URL:en; grunden för att kontrollen kan bytas utan att tillstånd eller länkar ändras
- #89 — `replaceState`-retryn som snabba piltangentsbyten kan slå i
