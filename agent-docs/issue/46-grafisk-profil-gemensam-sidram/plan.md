# Implementation Plan: Grafisk profil och gemensam sidram

## Summary

Ersätt den äldre Lato/SweDev-gröna presentationen med Partidatas fastställda
profil. Leveransen omfattar kanoniska SVG-original, profilfärger, Hanken
Grotesk och IBM Plex Mono, favicon, återanvändbar header och ny footer. Den
befintliga startsidan och partisidan ska fortsätta fungera medan #49 och #50
senare bygger vidare på samma grund.

## Triage Info

| Field | Value |
|-------|-------|
| **Blocked by** | None |
| **Blocks** | #49 och #50 |
| **Scope** | globala styles, app-wrapper, brand-assets, header/footer och befintliga sidkopplingar |
| **Risk** | Medium – globala styles påverkar samtliga statiskt exporterade sidor |
| **Complexity** | Medium |

## Analysis

- Nuvarande sida använder lokalt Lato, blå standardlänkar, svensk flagga i
  rubriker och en grön SweDev-footer.
- Designprofilen fastställer Hanken Grotesk för gränssnitt, IBM Plex Mono för
  data och etiketter samt sex centrala färger.
- Logotypen ska levereras som slutna, fyllda konturbanor i sina slutliga
  koordinater. SVG-filerna får inte innehålla `stroke`, grupper eller
  `transform`; ordmärket ska aldrig återskapas med text eller annan typografi.
- Prototypens navigation innehåller mål som ännu inte finns. Den gemensamma
  sidramen länkar bara till startsidan, GitHub och verkliga avsnitt.
- Prototypens CC BY 4.0 och hej@partidata.se är exempeldata. Repots CC0 och
  hello@swedev.org gäller.

## Implementation Steps

### Phase 1: Assets och tokens

1. Lägg in primär, negativ och svart logotyp samt fristående symbol från det
   levererade designpaketet under `public/img/partidata/`. Konvertera symbolens
   streck till fyllda konturer och baka in alla positionsförflyttningar i
   respektive paths koordinater.
2. Använd symbolen som SVG-favicon och uppdatera båda sidtypernas head-data.
3. Ladda Hanken Grotesk och IBM Plex Mono med Nexts fontstöd så att de
   självhostas i exporten.
4. Inför CSS-variabler för marinblå, signalgul, papper, kort, linje och text.
5. Ersätt globala Lato- och standardlänkregler med profilens typografi,
   fokusläge, bakgrund och länkar.

### Phase 2: Gemensam sidram

6. Skapa en återanvändbar `Header` med kanonisk logotyp och endast fungerande
   navigation.
7. Bygg om `Footer` till profilens ljusa, källorienterade struktur och behåll
   SweDev som diskret projektavsändare.
8. Koppla headern till partisidan och redirect-sidan. Startsidan behåller sin
   nuvarande informationsstruktur tills #49 men får rätt logotyp, typografi,
   bakgrund och footer.
9. Ta bort svensk flagga ur sidtitlar och synlig huvudrubrik.

### Phase 3: Verifiering

10. Kör lint, typecheck, validate:data, test och build.
11. Granska startsida, vanlig partisida och redirect-sida i Chrome DevTools på
    desktop och 390 px mobil.
12. Kontrollera att alla länkar har verkliga mål, att favicon och SVG-resurser
    laddas och att ingen horisontell scroll eller console error uppstår.

## Design Decisions

### Next-font i stället för externa runtime-länkar

Typsnitten hämtas vid bygge och självhostas av Next. Besökaren blir inte
beroende av Google Fonts och den statiska exporten behåller samma typografi.

### Headern används inte dubbelt på startsidan

Designens startsida har en egen stor logotypkomposition som implementeras i
#49. #46 gör headerkomponenten klar och använder den på undersidorna; den
befintliga startsidan får den nya logotypen utan en extra kompakt header.

### Bara fungerande navigation

Länkar till ännu ej implementerade Val- och API-sidor utelämnas. GitHub,
startsidan, footerankaret och externa källor används direkt.

## Verification Checklist

- [x] Fyra kanoniska SVG-resurser finns i `public/img/partidata/`
- [x] Samtliga SVG-former är paths; inga `stroke`, grupper eller `transform`
- [x] SVG-symbolen används som favicon
- [x] Hanken Grotesk och IBM Plex Mono självhostas i byggresultatet
- [x] Header och footer är responsiva och semantiska
- [x] CC0 och hello@swedev.org visas; ingen exempellicens eller exempelkontakt
- [x] Ingen svensk flagga återstår i titlar eller huvudrubrik
- [x] Inga döda navigationslänkar introduceras
- [x] Lint, typecheck, validate:data, test och build är gröna
- [x] PR-body avslutas med `Closes #46`
