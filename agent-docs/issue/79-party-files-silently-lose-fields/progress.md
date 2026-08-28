# Framsteg: Issue #79 — Party files silently lose fields they are not expected to have

**Påbörjad:** 2026-08-28
**Senast uppdaterad:** 2026-08-28
**Status:** Klar

## Genomförda steg

- [x] Fas 1, steg 1: Exportera `EXTRA_KEY_PATTERN` och utöka `PARTY_KEY_ORDER`-docblocken med ansvarskontraktet
- [x] Fas 1, steg 2: `loadParties()` samlar och granskar okända nycklar (`_extraKeys()`)
- [x] Fas 1, steg 3: `buildParties()` skriver tillbaka utökningsnycklarna
- [x] Fas 1, steg 4: `_orderKeys()` placerar utökningsnycklar alfabetiskt sist, utan tomhetsrensning
- [x] Fas 1, steg 5: `loadParties()`-docblocken beskriver ägarskapet
- [x] Fas 2, steg 1: `validate.js` kräver giltigt nyckelnamn för utökningsfält
- [x] Fas 3, steg 1: Pass-through-tester i `scripts/parti.test.js` (10 nya tester)
- [x] Fas 3, steg 2: Bevarandekontroller i symbolskriptens tester
- [x] Fas 3, steg 3: Valideringstester i `scripts/validate.test.js` (3 nya tester)
- [x] Fas 4, steg 1: README-not om utökningskontraktet
- [x] Fas 5: Verifiering (no-diff, `validate:data`, `npm test`, `npm run precommit`)

## Verifieringschecklista

- [x] Ett handtillagt fält överlever `node scripts/parti.js`
- [x] Samma fält överlever en om-import
- [x] Två ombyggnader i rad ger byte-identiska filer, även med utökningsfält
- [x] Test täcker att ett handtillagt fält överlever en ombyggnad
- [x] Docblocken vid `loadParties()` beskriver vad koden gör
- [x] `node scripts/parti.js` mot committad data ger noll diff i `data/parti`
- [x] Alla JSON-värdetyper (inkl. `null`, `false`, `0`, `""`, `[]`, `{}`) bevaras djuplikt
- [x] Utökningsfält följer med vid filnamnsbyte
- [x] Ett handredigerat värde i ett valdata-härlett fält byggs fortfarande om
- [x] En ogiltig nyckel stoppar `runParti()`/`runImport()` utan att något skrivs
- [x] `npm run validate:data` accepterar giltiga utökningsfält och fäller ogiltiga nyckelnamn
- [x] README beskriver utökningskontraktet
- [x] `npm run precommit` grönt

## Anteckningar

- Utökningsvärdena passerar oförändrade från `readJson()` till `writeFiles()`, som redan
  serialiserar med `JSON.stringify` — bevarandekontraktet (JSON-djuplikhet, normaliserad
  formatering) faller därmed ut av befintlig kod utan extra kopiering.
- `_extraKeys()` granskar samtliga nycklar innan någon tilldelas, så `__proto__` fälls av
  mönstret innan den kan nå ett objekt.
- `npm run precommit` grönt: 151 tester, ingen fil under `data/` ändrad av implementationen.
