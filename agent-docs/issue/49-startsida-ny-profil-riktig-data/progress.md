# Framsteg: Issue #49 — Bygg om startsidan enligt den nya profilen med riktig data

**Påbörjad:** 2026-08-26
**Senast uppdaterad:** 2026-08-26
**Status:** Klar

## Genomförda steg

- [x] Fas 0: Utgångsläge — `stash@{0}` orörd, arbetet utgår från `main`
- [x] Fas 1, steg 1: `forkortning` i indexposterna i `scripts/parti.js`
- [x] Fas 1, steg 2: `PartiIndexEntry` utökad i `src/types.ts`
- [x] Fas 1, steg 3: `INDEX_KEYS_FROM_PARTY` i `scripts/validate.js` plus tester i `validate.test.js` och `parti.test.js`
- [x] Fas 1, steg 4: `data/parti/index.json` regenererad (289 av 673 partier har förkortning)
- [x] Fas 2, steg 1: `readHomeData()` i `src/server/party-data.ts` — partilista, deltagandefacetter, valår, länslista, riksdagsöversikter
- [x] Fas 2, steg 2: Tester för `readHomeData()` i `scripts/party-data.test.js`
- [x] Fas 3, steg 1: `src/components/PartyCard.tsx` med varianterna large/medium/small
- [x] Fas 3, steg 2: `src/styles/_party-card.scss` inkopplad i `app.scss`
- [x] Fas 4, steg 1–2: Startsidan via `getServerSideProps`, intro med partiantal ur payloaden
- [x] Fas 4, steg 3: `src/components/home/filtering.ts` + `scripts/home-filtering.test.js`
- [x] Fas 4, steg 4: `PartySearch` med sök, filter, filterstatus och återställning
- [x] Fas 4, steg 5: Partigrid med "Visa fler" och paginering som återställs per resultatmängd
- [x] Fas 4, steg 6–7: Sidfoten behållen; bokstavslistans stilar borttagna ur `app.scss`
- [x] Fas 5, steg 1: `RiksdagSection` ur `readHomeData().riksdag`
- [x] Fas 5, steg 2: Riksdagsgrafiken genereras i `scripts/build-derived-data.js`, testad i `build-derived-data.test.js`
- [x] Fas 6, steg 1: HTTP-smoken asserterar partiantal, partilänk, sektioner och riksdagsvalår
- [x] Fas 6, steg 2–4: Diffgenomgång, manuell verifiering i webbläsare, `npm run precommit` grön

## Pågående arbete

Inget — implementationen är klar på grenen `issue/49-startsida-ny-profil-riktig-data`.

## Anteckningar

- Modulen "största partierna utanför riksdagen" ingår inte; den väntar på #48 enligt planens designbeslut 5. Issuet bör därför inte stängas av den här PR:en (`Part of #49`), medan #17 löses.
- Riksdagsgrafiken visade tidigare 2018 års sammansättning; den genereras nu ur `data/val/2022/valresultat/riksdag.json` och bär valåret som `data-valar` plus en genereringskommentar. `check:derived-data` bevakar filen.
- Förkortningsmatchningen mot mandatfördelningen är skiftlägesokänslig och upplöser bara entydiga träffar; kammarens åtta förkortningar är alla entydiga i registret.
- Manuell verifiering: sök med diakritnormalisering ("vanster" → Vänsterpartiet), AND-filter, länsfältet visas bara för region-/kommunval och rensas vid byte till riksdagsval, "Visa fler" laddar 48 åt gången och nollställs vid ny sökning, inget horisontellt överflöde ned till smal vy, inga konsolfel.
- `stash@{0}` ("WIP #47/#49") är orörd.
