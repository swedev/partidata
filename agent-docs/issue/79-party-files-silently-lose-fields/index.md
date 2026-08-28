# Issue #79: Party files silently lose fields they are not expected to have

**Baserad på:** main

## Sammanfattning

`loadParties()` i `scripts/parti.js` läser bara en fast fältuppsättning och `buildParties()`/`_orderKeys()` skriver bara nycklarna i `PARTY_KEY_ORDER`, så ett fält som läggs till för hand i `data/parti/<filnamn>/index.json` försvinner tyst vid nästa ombyggnad eller import — trots att filerna kallas sanningskälla och hela produkten bjuder in till rättelser via pull request. Planen låter `loadParties()` bära med sig okända nycklar och `buildParties()` skriva tillbaka dem på en stabil, alfabetisk plats efter de kända fälten, så utskriften förblir byte-stabil och idempotenstesterna behåller sin mening. Extrafält har friforma värden men snake_case-nyckelnamn; kravet upprätthålls både i skrivvägen (`loadParties()` stoppar en ogiltig nyckel innan något skrivs) och i `scripts/validate.js`, och docblocken skrivs om så de beskriver det faktiska ägarskapet. Detta avblockerar #78 (grundandedatum från Wikidata).

## Triageringsstatus

| Fält | Värde |
|------|-------|
| **Redo att arbeta** | Ja |
| **Risk** | Låg–Medel |
| **Säker för junior** | Ja |

## Plangranskning

**Status:** Granskad
**Granskad:** 2026-08-28
**Feedback:** Två granskningsrundor. Första rundan: preciserade fältägarskapet (`PARTY_KEY_ORDER` är serialiseringsordning, inte ägarschema — kontrakt tillagt i docblocken), flyttade nyckelnamnskontrollen även till skrivvägen så en ogiltig nyckel stoppar körningen innan något skrivs (täcker även `__proto__`), ersatte "ordagrant" med JSON-djuplikhetskontraktet, rättade `party.party.extra`-felskrivningen och lade till README-dokumentation av utökningskontraktet. Andra rundan: rättade fältkategoriseringen (`valmyndigheten_registreringsdatum` bevaras av `parti.js` själv), preciserade att mönstret fångar malformade namn men inte felstavningar, lade till bevarandetester genom symbolskriptens båda ingångar, bytte no-diff-kontrollen till `git status --porcelain -- data/parti` med ren baslinje, samt noterade att `--report-name-collisions` också omfattas av nyckelkontrollen och att README-noten tangerar #25.

## Relaterade filer

- [plan.md](plan.md) — Fullständig implementationsplan
- [progress.md](progress.md) — Implementationsframsteg

## Relaterade issues

- #78 — Grundandedatum från Wikidata; deklarerar "Depends on #79" och avgör själv fältformen
- #80 — Flytt av `data/parti/index.json` till `data/derived/`; berör också `scripts/parti.js`, bör inte arbetas parallellt
- #26 — Publicerat JSON-gränssnitt; extrafältens form påverkar så småningom det dokumenterade formatet
