# Issue #78: Show when a party was founded, from Wikidata

**Baserad på:** main

## Sammanfattning

Partisidan ska visa när partiet grundades, hämtat från Wikidata (P571) och tydligt skilt från registreringsdatumet hos Valmyndigheten. Planen lägger en `wikidata`-sektion (`id`, `grundat`, `hamtad`) som utökningsfält i `data/parti/<filnamn>/index.json` — mekanismen från #79 gör att den överlever varje ombyggnad — där Q-id:t länkas manuellt via granskad PR och ett nytt skript `npm run import-wikidata` hämtar och underhåller datumet i källans precision. `scripts/validate.js` validerar sektionens form och att inget Q-id delas av två partier; sidan visar uppgiften som ett villkorat nyckelfakta-block i heron med Wikidata-källrad. De åtta riksdagspartierna seedas i samma PR.

## Triageringsstatus

| Fält | Värde |
|------|-------|
| **Redo att arbeta** | Ja — #79 är stängt och implementerat; "Part of #68" är paraply, inte blockering |
| **Risk** | Låg–Medel |
| **Säker för junior** | Ja |

## Plangranskning

**Status:** Granskad
**Granskad:** 2026-08-29
**Feedback:** Två codex-pass. Pass 1 gav bl.a. att `fetchText` saknar header-stöd, att importern måste köra wikidata-valideringen före skrivning, att profilerade partier får fyra hero-block (fyrspaltsläge krävs), synligt Q-id i länktexten, fler Wikidata-kantfall (snaktype, kalendermodell, before/after, flera best-rank-datum → fel i stället för "tidigast") och semantisk datumvalidering med sluten nyckeluppsättning — allt inarbetat. Pass 2 gav in-memory-dubblettkontroll av Q-id före skrivning, egen `fetchEntity` direkt på `fetch` i stället för `fetchText`-utökning, in-memory-integrationstest i stället för temporär datakatalog, och trunkering av precision > 11 — också inarbetat.

## Relaterade filer

- [plan.md](plan.md) — Fullständig implementationsplan

## Relaterade issues

- #68 — Fill the party profile modules with sourced content (paraply, "Part of")
- #70 — Fill the party's own website and channels (P856 kan senare tas ur samma `wikidata`-sektion)
- #79 — Party files silently lose fields they are not expected to have (stängd förutsättning, implementerad i `630808c`)
- #80 — Move the generated party index to data/derived/parti.json (öppet; samma skriptkedja, bör inte arbetas parallellt)
