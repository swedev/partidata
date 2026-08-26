# Issue #49: Bygg om startsidan enligt den nya profilen med riktig data

**Baserad på:** main

## Sammanfattning

Startsidan byggs om enligt designunderlagets informationsstruktur i den befintliga Next-appen: intro med partiantal ur datan, klientsidig sökning med diakritnormalisering (namn/förkortning) och AND-filter (valår, valtyp, län) ur partifilernas `deltagande`, responsivt partigrid med "Visa fler", riksdagspartier och skriptgenererad, valårsmärkt mandatgrafik ur committad valresultatdata, samt befintlig sidfot. En återanvändbar `PartyCard`-komponent med tre varianter byggs i samma arbete. Servern levererar en kompakt payload via `src/server/party-data.ts` (`getServerSideProps`); `forkortning` läggs till i partiregistret. Fas 0 förlikar befintligt WIP i `stash@{0}` med användaren. Modulen "största partierna utanför riksdagen" utgår tills #48 levererat metod och data.

## Triageringsstatus

| Fält | Värde |
|------|-------|
| **Redo att arbeta** | Ja — fas 0 kräver dock användarens besked om `stash@{0}`; delmodulen "utanför riksdagen" väntar på #48 och utelämnas |
| **Risk** | Medel–Hög |
| **Säker för junior** | Nej |

## Plangranskning

**Status:** Granskad
**Granskad:** 2026-08-26
**Feedback:** Två codex-pass. Pass 1 gav skärpt facettmodell (regionLan/kommunLan, AND-semantik), deburr-normalisering per #17, matchningskontrakt för förkortningar, testtäckning och a11y-beslut för riksdagsgrafiken — allt tillämpat. Pass 2 hittade befintligt WIP i `stash@{0}` (nu fas 0), rättade SVG-fakta (2018 års sammansättning), pekade ut partifilerna som deltagandekälla per issuet samt kompletterade filter- och genereringskontrakten — allt tillämpat.

## Relaterade filer

- [plan.md](plan.md) — Fullständig implementationsplan
- [progress.md](progress.md) — Implementationsframsteg
- [research.md](research.md) — Forskningsresultat (om finns)

## Relaterade issues

- #46 — Grafisk profil och gemensam sidram (stängd; grunden som återanvänds)
- #53 — Server-renderad Next-app (stängd; SSR-arkitekturen planen bygger på)
- #47 — Återanvändbar Partikort-komponent (stängd; ingår nu i #49:s omfattning, WIP finns i `stash@{0}`)
- #48 — Valresultat- och mandatdata (öppen; krävs för "utanför riksdagen" och röstandelar)
- #17 — Funktionellt sökfält på startsidan (löses av detta arbete)
- #23 — Startsida och sidfot inte responsiva (bör kunna stängas efter verifiering)
- #26 — Publicering av JSON-data (inga API-/nedladdningslänkar visas ännu)
- #33 — Kandidatlistor (kandidater nämns inte i sökfältet förrän implementerat)
- #50 — Partiprofilens layout (stängd; parallellt arbete, delar grafisk grund)
