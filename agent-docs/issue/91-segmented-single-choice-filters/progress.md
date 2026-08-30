# Framsteg: Issue #91 — Present the election type and year filters as segmented single-choice controls

**Påbörjad:** 2026-08-30
**Senast uppdaterad:** 2026-08-30
**Status:** Slutförd (kod), manuell webbläsarkontroll återstår

## Genomförda steg

- [x] Fas 1, steg 1: `src/components/home/segments.ts`
- [x] Fas 1, steg 2: `scripts/home-segments.test.js` — 9 tester
- [x] Fas 2, steg 3: `src/components/home/SegmentedControl.tsx`
- [x] Fas 2, steg 4: Segmentstilar i `src/styles/_home.scss`
- [x] Fas 3, steg 5: `PartyFilters.tsx` använder `SegmentedControl`
- [x] Fas 3, steg 6: `HomeContent.tsx` kontrollerad, oförändrad
- [x] Fas 3, steg 7: typecheck + lint gröna före borttagningarna
- [x] Fas 4, steg 8: `toggleKind` borttagen ur `summary.ts` och testet
- [x] Fas 4, steg 9: `.home-chips`/`.home-chip*` borttagna
- [x] Fas 5, steg 10: `scripts/http-smoke.js` med radio-assertions och låsnings-assertion
- [x] Fas 6, steg 11: `npm run precommit` grönt
- [ ] Fas 6, steg 12: Manuell kontroll i webbläsare

## Verifierat

- `npm run precommit` grönt: lint, typecheck, derived-data, validate:data, 217 tester, `build:release`, `test:http`.
- Serverrenderad markup granskad mot den byggda artefakten:
  - `/` — `Valår` står på senaste året, `Valtyp` på "Alla", exakt en `checked` radio per grupp.
  - `/?valar=<tidigare>&valtyp=region&lan=01` — "Regionval" vald, "Riksdagsval" `disabled=""` med `aria-describedby` till ett `<span class="sr-only">` som bär låstexten; olåsta segment saknar `aria-describedby`.
  - `/?valtyp=riksdag&lan=01` — `pruneFilters` släpper länet, "Riksdagsval" vald och olåst, län- och kommunväljarna på "Hela landet"/"Alla kommuner".
- Byggd CSS innehåller `.home-segments`, `.home-segment`, `:first-of-type`/`:last-of-type`-rundningen och `:has()`-reglerna; noll träffar på `home-chip`.
- `.sr-only` är klippt till 1px och absolut positionerad, alltså fortsatt fokuserbar.

## Återstår

Punkterna i planens fas 6 som kräver en webbläsare, utförda av en människa i `npm run dev`:

- Tab-ordning, piltangenter och hopp över låsta segment.
- Hover-titeln på ett låst segment.
- "Rensa filter" ger senaste året och "Alla".
- Smal skärm (~360px): radbrytning och hörnen vid brytpunkten (designbeslut 6).
- VoiceOver i Safari: gruppnamn, position, valt läge och låstexten som beskrivning.
- Safari, #89-fallet: nedhållen piltangent i valårsgruppen i >30 s; utfallet antecknas i #89.
- Bakåtknappen efter ett partiklick visar samma segment valda.

## Anteckningar

Branch: `issue/91-segmented-single-choice-filters`, baserad på `main`.

Planens steg 3 ber om en bestämd attributordning i JSX så SSR-markupen följer den. React ordnar om attributen själv (`class`, `type`, `disabled`, `aria-describedby`, `name`, `checked`, `value`), så ordningen är inte styrbar därifrån. Smoke-testet matchar attributoberoende, som planen förutsatte, så inget hänger på det.
