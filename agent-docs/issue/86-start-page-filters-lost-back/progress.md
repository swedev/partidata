# Framsteg: Issue #86 — Start page filters are lost after opening a party and going back

**Påbörjad:** 2026-08-29
**Senast uppdaterad:** 2026-08-29
**Status:** Klar

## Genomförda steg

- [x] Fas 1, steg 1: `src/components/home/query.ts` — ren översättning query ⇄ `{ filters, order }`
- [x] Fas 1, steg 2: `scripts/home-query.test.js` — tolkning, serialisering, pruning, rundtur
- [x] Fas 2, steg 1: `getServerSideProps` i `src/pages/index.tsx` tolkar `context.query` → `initial`
- [x] Fas 3, steg 1: `HomeContent` seedar tillståndet från `initial`
- [x] Fas 3, steg 2: `HomeContent` skriver URL:en i händelsehanterarna
- [x] Fas 3, steg 3: `generation`-key på `HomeContent` vid icke-shallow navigering
- [x] Fas 3, steg 4: Manuell navigeringskontroll i webbläsare
- [x] Fas 4, steg 1: `scripts/http-smoke.js` — assertioner på filtrerade URL:er
- [x] Fas 4, steg 2: `CLAUDE.md` — rad om URL-konventionen
- [x] Fas 5: `npm run precommit` och manuell verifieringschecklista

## Pågående arbete

Inget — implementationen följer planen.

## Anteckningar

Grenen skapades från `main` (5b530fb). `npm run precommit` är grönt: 220 `node:test`-tester
och HTTP-smoken, som nu kontrollerar filtrerade URL:er mot förväntat grid räknat ur
`data/parti/*/index.json`.

Kontrollerna i webbläsare kördes mot `.release`-artefakten på port 3999, driven via
chrome-devtools:

- Valår, valtyp, län, kommun, sortering och sökterm skriver var sin URL i nyckelordningen
  `valar, valtyp, lan, kommun, q, sortering`; bakåt från en partisida återställer alla sex.
- Ett select-byte följt av ett partiklick i samma händelse överlever bakåtnavigeringen
  (`valar=2022` fanns i historikposten), liksom sju tangenttryck följda av ett klick på
  första träffen (`?q=moderat`).
- Logotypen från `/?valar=2018&sortering=senaste` ger `/` med senaste året och förvald
  sortering.
- `#om-tjansten` överlever både en filterändring och "Rensa filter"; inga `_next/data`-anrop
  vid filterändring; sidan hoppar inte till toppen.
- Redigering mitt i söksträngen behåller fokus och markörläge, inga tecken tappas.
- Direktlänkar: `?kommun=1280` härleder länet, `?valtyp=riksdag&lan=01` släpper länet,
  `?kommun=1280&lan=01` släpper kommunen, `?valar=1900&valtyp=eu` faller tillbaka på
  förvalen, `?valar=alla` ger 670 av 670.

Safari-kontrollen av `history.replaceState`-gränsen (designbeslut 5) är inte körd — den
kräver att Safari startas.
