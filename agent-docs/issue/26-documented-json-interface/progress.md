# Framsteg: Issue #26 — Publish a documented JSON interface for Partidata's data

**Påbörjad:** 2026-08-30
**Senast uppdaterad:** 2026-08-30
**Status:** Klar

## Genomförda steg

- [x] Fas 1, steg 1: `src/server/data-resources.ts` — allowlisten (`classifyDataPath`, `dataPath`, `matchesEtag`)
- [x] Fas 1, steg 2: `scripts/data-resources.test.js` — accepterade och avvisade former
- [x] Fas 1, steg 3: `src/server/party-data.ts` — `resolveDataResource`, `readDataCatalog`, filcache med SHA-256
- [x] Fas 1, steg 4: `scripts/party-data.test.js` — `withDataFiles`, lagrets nya metoder
- [x] Fas 1, steg 5: `npm test && npm run typecheck`
- [x] Fas 2, steg 6: `src/pages/api/data/[...path].ts` — metoder, CORS, cache, ETag/304, 308, 404
- [x] Fas 2, steg 7: `next.config.ts` — rewrite `/data/:path+`
- [x] Fas 2, steg 8: `matchesEtag`-test
- [x] Fas 2, steg 9: `npm run build:release` och `curl -i` mot `.release/server.js` — 200 direkt, ingen `trailingSlash`-308
- [x] Fas 3, steg 10: `src/styles/_data.scss`, `@use` från `app.scss`
- [x] Fas 3, steg 11: `src/pages/data/index.tsx` och fältdokumentationen med test
- [x] Fas 3, steg 12: `Header` med `current`-prop
- [x] Fas 3, steg 13: `Footer` — "Data som JSON"
- [x] Fas 3, steg 14: `/data/` i sitemapen
- [x] Fas 3, steg 15: sidan lästes mot `.release/server.js`; alla adresslänkar svarar 200
- [x] Fas 4, steg 16: `ExportSection` pekar på `/data/parti/<filnamn>/index.json`
- [x] Fas 5, steg 17: README-stycket i "Tillgänglig data"
- [x] Fas 5, steg 18: `CLAUDE.md` under "Stack"
- [x] Fas 5, steg 19: `deploy/` orört
- [x] Fas 6, steg 20: `scripts/http-smoke.js`
- [x] Fas 6, steg 21: `npm run precommit`
- [x] Fas 6, steg 22: minnesmätning och cachekontroll

## Pågående arbete

Inget — implementationen ligger på `issue/26-documented-json-interface`.

## Anteckningar

- Fältdokumentationen ligger i `src/components/data/fields.ts`, inte i `src/pages/data/fields.ts`
  som planen skrev: pages-routern kräver att varje fil under `src/pages/` exporterar en
  React-komponent, och bygget avbryts med `page-without-valid-component` annars.
- `DataResource.fil` är typad som `ParticipationFile` (unionen av `PARTICIPATION_FILES`) i
  stället för `string`, så `dataPath` bygger sökvägen ur ett värde som allowlisten redan
  har smalnat av.
- Provet av adresser som Next självt normaliserar (`/data/derived`, `/data/derived//parti.json`,
  `/data/derived/parti.json/`) låser att högst en vidarebefordran följs, att den stannar under
  `/data/`, och att ett 200-svar bara kan vara registret. Planens formulering "slutsvaret får
  inte vara 200 med JSON-kropp" gäller de två sista adresserna, som normaliseras till registrets
  egen adress och rätteligen svarar 200.
- `Content-Length` prövas mot okomprimerade svar: Next komprimerar när klienten ber om det och
  svarar då styckvis.
- Etaggen är svag, `W/"<sha256>"`, inte stark som planen skrev. Next komprimerar svaret själv
  när klienten ber om det och lämnar etaggen orörd, så samma etagg skulle annars stå för två
  olika byteföljder — vilket en stark etagg inte får göra. Planens premiss att nginx äger
  gzip stämmer inte heller: `deploy/partidata.se.conf` sätter inte `gzip_proxied`, och
  förvalet `off` gör att nginx inte komprimerar vidarebefordrade svar alls. Att i stället
  stänga av Next-komprimeringen hade därför skickat 6,9 MB okomprimerat och krävt en
  nginx-ändring, som ligger utanför den här PR:en.
- Minnesmätning mot `.release/server.js`: 109,3 MB efter `/api/health`, 113,7 MB efter att alla
  24 adresser på `/data/` hämtats en gång, 113,7 MB efter andra varvet. `kommun.json` (6,9 MB):
  10,3 ms första gången, 3,3 ms ur cachen.
- Kvar som manuell kontroll: `fetch` från en annan origin i en webbläsare, och efter deploy
  `curl --compressed` respektive `Accept-Encoding: identity` mot produktionsadressen.
