# Framsteg: Issue #105 — Read data/derived/riksdag.json at request time instead of bundling it

**Påbörjad:** 2026-09-07
**Senast uppdaterad:** 2026-09-07
**Status:** Klar

## Genomförda steg

- [x] Fas 1, steg 1: `DerivedParliamentFile` utökas med `kammare` och `valdeltagande`
- [x] Fas 1, steg 2: Typerna `ParliamentChamber`/`ParliamentTurnout`/`ParliamentView`, `riksdag` på `PartyPageData`
- [x] Fas 1, steg 3: `readDerivedParliament()` och `readParliamentView()`; `readOutsideParliament` läser genom samma cache
- [x] Fas 1, steg 4: `readCurrentParty` sätter `riksdag`
- [x] Fas 1, steg 5: Docblock på `readDerivedParliament` och `readParliamentView`
- [x] Fas 2, steg 1: Importen och modulkonstanterna bort ur `elections.tsx`; `chamberSeatPositions()`
- [x] Fas 2, steg 2: `ElectionResultsSection` får `chamber`, lokalen döpt till `partySeats`
- [x] Fas 2, steg 3: `TurnoutSection` får `turnout`, `aria-label` ur serien
- [x] Fas 2, steg 4: `[filnamn].tsx` skickar `riksdag` vidare
- [x] Fas 2, steg 5: `typecheck`, `lint` och `grep -rn "from 'data/" src` utan träff
- [x] Fas 3, steg 1: Fyra fall i `scripts/party-data.test.js`
- [x] Fas 3, steg 2: Tre påståenden i `scripts/http-smoke.js`
- [x] Fas 3, steg 3: `scripts/source-imports.test.js`
- [x] Fas 4, steg 1: `CLAUDE.md`
- [x] Fas 4, steg 2: `deploy/README.md`
- [x] Fas 4, steg 3: `docs/riksdagsvalresultat.md`
- [x] Fas 5: `npm run precommit` grönt; ändrat värde i `.release/data/derived/riksdag.json` syns på partisidan efter omstart utan ombyggnad

**Slutfört:** 2026-09-07

## Anteckningar

- Kammarblocket ligger i en egen komponent `ChamberBlock` i `elections.tsx`, så att
  `chamberSeatPositions()` och sorteringen bara körs när `chamber` finns. Planen anger
  villkoret, inte formen; en egen komponent följer filens befintliga uppdelning
  (`ChamberDiagram`, `ElectionChart`).
- Verifiering: `.release/data/derived/riksdag.json` fick `valdeltagande.resultat[-1].procent`
  77.77, servern startades om utan ombyggnad, och `/parti/miljopartiet-de-grona/` visade
  77,77 %. `grep -rl "Allmänna valen" .release/.next/static` gav ingen träff. Filen
  återställdes och `npm run test:http` kördes om grönt.
