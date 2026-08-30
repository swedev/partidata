# Framsteg: Issue #80 — Move the generated party index to data/derived/parti.json

**Påbörjad:** 2026-08-30
**Senast uppdaterad:** 2026-08-30
**Status:** Klar

## Genomförda steg

- [x] Fas 1, steg 1: `git mv data/parti/index.json data/derived/parti.json`
- [x] Fas 1, steg 2: `scripts/parti.js` skriver registret till `derived/parti.json`
- [x] Fas 2, steg 1: `src/server/party-data.ts` läser den nya sökvägen
- [x] Fas 2, steg 2: `scripts/validate.js` — ny sökväg, kontextsträngar, nyckelkontroll, kvarlämningskontroll
- [x] Fas 2, steg 3: `scripts/build-derived-data.js`
- [x] Fas 2, steg 4: `scripts/riksdag-results.js`
- [x] Fas 2, steg 5: `scripts/http-smoke.js`
- [x] Fas 2, steg 6: `scripts/build-release.js`
- [x] Fas 3: De sju testfilerna
- [x] Fas 4: `README.md`, `src/types.ts`, `CLAUDE.md`
- [x] Fas 5: Verifiering

## Pågående arbete

Inget — alla faser är genomförda.

## Anteckningar

- Verifieringschecklistan är avbockad i sin helhet: flytten är byte-identisk
  (`git show HEAD:data/parti/index.json | cmp - data/derived/parti.json`),
  `node scripts/parti.js` följt av `npm run build:derived-data` ger tyst
  `git diff --exit-code -- data`, och `npm run precommit` passerar med 209
  gröna tester.
- `grep` enligt steg 5.5 träffar bara kvarlämningskontrollen i `validate.js`,
  dess deltest, `parti.test.js`-assertionen och README-raden för
  GitHub-konsumenter.
- Placeringen av README-avsnittet `derived/` lämnades öppen av planen; det ligger
  sist under "Tillgänglig data", efter källfilerna det genereras ur.

**Slutförd:** 2026-08-30
