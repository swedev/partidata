# Framsteg: Issue #54 — Partinamn sorteras inte enligt svenska alfabetet

**Påbörjad:** 2026-08-26
**Senast uppdaterad:** 2026-08-26
**Status:** Implementerad lokalt

## Genomförda steg

- [x] Fas 1, steg 1: `src/server/collation.ts` med `compareSv()` och `assertSwedishCollation()`
- [x] Fas 1, steg 2: `src/server/party-data.ts` använder modulen för parti- och länssortering,
      `filnamn` som sekundärnyckel och en injicerbar kollationsvakt i `assertHealthy()`
- [x] Fas 1, steg 3: `src/pages/api/health.ts` loggar det fångade felet före 500-svaret
- [x] Fas 2, steg 4: Osorterad fixtur i `scripts/party-data.test.js` som låser hela invarianten
      (Jarl före Jämtlands Väl, Z → Å → Ä → Ö, `filnamn` vid identisk beteckning, län i svensk
      ordning) plus test som injicerar en kastande vakt
- [x] Fas 2, steg 5: `scripts/http-smoke.js` kör de literala kollationsjämförelserna och jämför
      startsidans partigrid mot facit ur `data/parti/index.json`
- [x] Fas 3, steg 6: `npm run precommit` grönt
- [x] Fas 3, steg 7: Ordningen verifierad mot release-artefakten (Jarl på index 226, Jämtlands Väl
      på 235; Åtvidabergs Framtid → Äkta demokrati → Älska Svedala → Öarnasväl; Örebro län och
      Östergötlands län sist i länslistan; `alternativet` före `alternativet-0510`)
- [ ] Fas 3, steg 8: PR-body med acceptansbeslut och release-beroende

## Pågående arbete

Implementationen är klar på branchen `issue/54-partinamn-svensk-sortering`. Ingen commit, push
eller PR är gjord — arbetet ligger i working tree för granskning.

## Anteckningar

- `tsconfig.json` fick `allowImportingTsExtensions: true`. `scripts/party-data.test.js` kräver in
  `src/server/party-data.ts` direkt, och Nodes ESM-resolver kräver då explicit `.ts` i den
  relativa importen av `./collation.ts`.
- `node --test` skriver en `MODULE_TYPELESS_PACKAGE_JSON`-varning för `collation.ts`, eftersom
  rotens `package.json` saknar `"type"`-fält och `scripts/` är CommonJS. Varningen är
  testoutput-brus, inte ett fel, och påverkar inte bygget.
- Regressionsskyddet är verifierat genom sabotage: borttagen sortering fäller både `npm test` och
  `npm run test:http`, och en kastande vakt ger `/api/health` 500 med orsaken i serverloggen.

## Återstående steg

- [ ] Skapa PR (lyft acceptansbeslutet om bokstavsgruppering och `v*`-taggen som krävs för release)
- [ ] Verifiera produktionens `@NODE_BINARY@` för svensk kollation före taggning
