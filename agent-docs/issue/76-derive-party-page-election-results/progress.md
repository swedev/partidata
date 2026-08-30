# Framsteg: Issue #76 — Derive the party page's election results from the imported results

**Påbörjad:** 2026-08-30
**Senast uppdaterad:** 2026-08-30
**Status:** Klar

## Genomförda steg

- [x] Fas 1, steg 1: `PartiValresultat`/`PartiValresultatPost` i `src/types.ts`
- [x] Fas 1, steg 2: `readParliamentResults()` memoiserad, `sourceFor()` delad, `readParliamentYears()` läser den delade listan
- [x] Fas 1, steg 3: `partyElectionResults(files, uuid)` som ren, exporterad funktion
- [x] Fas 1, steg 4: `PartyPageData.valresultat` fylld i `readCurrentParty()`
- [x] Fas 1, steg 5: fixturen tar röstrader utan mandat; tester via store och direkt mot härledningen
- [x] Fas 2, steg 6: `src/pages/parti/[filnamn].tsx` läser `valresultat` ur props, `key={slug}`
- [x] Fas 2, steg 7: `ProfileHero` visar mandatblocket bara för kammarpartier
- [x] Fas 2, steg 8: `ElectionResultsSection` med villkorat kammarblock, `forandring`, källrad per valår
- [x] Fas 2, steg 9: `.profile-results__sources` lämnad orörd — flex-wrap bär de elva raderna
- [x] Fas 3, steg 10: de kurerade profiltyperna borttagna
- [x] Fas 3, steg 11: `validatePartyProfile()` avvisar nyckeln; deltestet speglar avvisningen
- [x] Fas 3, steg 12: `valresultat` borttaget ur de två `profil.json`
- [x] Fas 4, steg 13: smoke knyter partisidans mandat till `derived/riksdag.json`
- [x] Fas 4, steg 14: avsnittet "Partisidan" i `docs/riksdagsvalresultat.md`
- [x] Fas 4, steg 15: meningen om partisidan i `README.md`
- [x] Fas 5, steg 16: `npm run precommit` grönt
- [x] Fas 5, steg 17: manuell kontroll mot `.release`

## Pågående arbete

Inget — alla faser är genomförda.

## Anteckningar

De kurerade siffrorna för Liberalerna och Miljöpartiet kontrollerades rad för rad mot importen innan fältet togs bort: varje `rostandel` och `mandat` stämde exakt. Efter härledningen visar båda sidorna samma procent och mandat som förut, med röstetal ifyllda och Liberalernas serie utökad till 1994.

Kantfallet "senaste rad är inte kammaråret för ett parti som haft mandat" finns inte i datan — varje parti som någon gång haft mandat har också en röstrad 2022 — så det täcks bara av testerna mot `partyElectionResults()`.

Källistan i resultatsektionen växer från två rader till elva för Miljöpartiet. `.profile-results__sources` är en `flex-wrap`-rad och bär dem strukturellt; hur tätt de elva posterna läser är värt ett ögonkast i granskningen.
