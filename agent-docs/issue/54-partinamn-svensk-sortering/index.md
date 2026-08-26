# Issue #54: Partinamn sorteras inte enligt svenska alfabetet

**Baserad på:** main

## Sammanfattning

Partinamn sorterades enligt ASCII-slugordning (Å/Ä/Ö vikta till A/O) i stället för svensk kollation, så Jämtlands Väl hamnade före Jarl och Å/Ä/Ö-partier bland A-partierna. PR #56 rättade startsidans ordning med `Intl.Collator('sv')`; denna plan stänger kvarstående luckor: en delad kollationsmodul, en körtidsvakt i `/api/health` som gör en Node utan svensk ICU-data till ett synligt hälsofel, och en ordningskänslig regressionskontroll i `scripts/http-smoke.js`.

## Triageringsstatus

| Fält | Värde |
|------|-------|
| **Redo att arbeta** | Ja |
| **Risk** | Låg |
| **Säker för junior** | Ja |

## Plangranskning

**Status:** Granskad
**Granskad:** 2026-08-26
**Feedback:** Två granskningsrundor: skärpte enhetstestets fixtur (osorterad, hela Å/Ä/Ö-invarianten, identiska beteckningar med `filnamn` som sekundärnyckel), injicerbar kollationsvakt som bevisar hälsokopplingen, loggning i `/api/health`, korrigerade att röktestets facit delar serverns ICU-data (fallback fångas av vakten, inte grid-jämförelsen) samt dokumenterade att deployns hälsogate ligger efter restart, med engångsverifiering av produktionens Node före taggning. Granskarens förslag att blockera på grupperingsbeslutet tillämpades inte — beslutet lyfts i stället explicit vid plangranskning och i PR:en.

## Relaterade filer

- [plan.md](plan.md) — Fullständig implementationsplan
- [progress.md](progress.md) — Implementationsframsteg

## Relaterade issues

- #49 — Startsidans ombyggnad (PR #56, mergad) rättade huvudlistans sorteringsordning
- #38 — Särskiljning av partier med samma namn berör samma lista men inte sorteringen
