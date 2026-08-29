# Framsteg: Issue #78 — Show when a party was founded, from Wikidata

**Påbörjad:** 2026-08-29
**Senast uppdaterad:** 2026-08-29
**Status:** Klar

## Genomförda steg

- [x] Fas 1, steg 1: `validateWikidataSection` i `scripts/validate.js`
- [x] Fas 1, steg 2: Anrop i `validatePartyRegistry` + Q-id-dubblettkontroll
- [x] Fas 1, steg 3: Tester i `scripts/validate.test.js`
- [x] Fas 2, steg 1: `scripts/import-wikidata.js`
- [x] Fas 2, steg 2: npm-skriptet `import-wikidata`
- [x] Fas 2, steg 3: `scripts/import-wikidata.test.js`
- [x] Fas 3, steg 1: Q-id för de åtta riksdagspartierna
- [x] Fas 3, steg 2: Kör `npm run import-wikidata`
- [x] Fas 3, steg 3: `node scripts/parti.js` no-diff
- [x] Fas 3, steg 4: Q-id-lista till PR-bodyn
- [x] Fas 4, steg 1: `PartiWikidata` i `src/types.ts`
- [x] Fas 4, steg 2: `wikidata` vidare till `ProfileHero`
- [x] Fas 4, steg 3: Precisionsmedveten formatterare
- [x] Fas 4, steg 4: "Grundat"-blocket med källrad
- [x] Fas 4, steg 5: Fyrspaltsläge i nyckelfakta-gridden
- [x] Fas 4, steg 6: Länkstil i källraden
- [x] Fas 5, steg 1: README
- [x] Fas 5, steg 2: CLAUDE.md
- [x] Fas 6, steg 1: `scripts/http-smoke.js`
- [x] Fas 6, steg 2: `npm run precommit`
- [x] Fas 6, steg 3: Manuell kontroll

## Slutförd

2026-08-29

## Anteckningar

- Q-id:na för de åtta riksdagspartierna slogs upp mot wikidata.org och kontrollerades på etikett, beskrivning, land (P17 = Q34), instans (P31 = Q7278) och officiell webbplats (P856) mot partiets kända uppgifter. Alla åtta har exakt ett P571-påstående med normal rang och dagsprecision.
- `validateWikidataSection` och `WIKIDATA_KEYS` exporteras ur `scripts/validate.js`; importskriptet använder båda, så formkravet står på ett ställe.
- Importskriptet avbryter om `buildParties()` föreslår omdöpningar — namnbyten hör till `node scripts/parti.js` och `import-val`, inte hit.
- `node scripts/parti.js` efter importen ger ingen ytterligare diff: de åtta partifilerna är den enda ändringen.
- Manuell kontroll i webbläsaren: fyra nyckelfakta-block på 1440 och 760 px, 2×2 under 700 px och en kolumn under 520 px, utan horisontell scroll. Parti utan sektion renderar dagens sida. MP:s Wikipedia-faktaruta ("Bildat 1981") ligger kvar i sin egen sektion med egen källa och motsäger inte hero-blocket.

