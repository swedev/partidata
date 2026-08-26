# Plan: Issue #49 — Bygg om startsidan enligt den nya profilen med riktig data

## Mål

Ersätt startsidans bokstavslista med designunderlagets informationsstruktur — intro, sökning/filter, partigrid och riksdagsöversikt — implementerad i den befintliga Next-appen med repots committade data. En återanvändbar Partikort-komponent (tre varianter) byggs i samma arbete. Ingen prototypdata, inga döda länkar.

## Triagering

> Beslutsunderlag för detta issue.

| Fält | Värde |
|------|-------|
| **Blockeras av** | #48 för *full* stängning (delmodulen "Största partierna utanför riksdagen" och röstandelar). Övrig omfattning är obruten; issuet villkorar själv de modulerna med "när #48 finns" |
| **Blockerar** | Inget nedströms issue. #17 löses och #23 överlappas av detta arbete (stängs när startsidan är verifierad) |
| **Relaterade issues** | #46 (stängd — profil/sidram finns), #53 (stängd — SSR-arkitekturen planen bygger på), #47 (stängd — Partikortet ingår nu i #49), #48 (öppen — valresultat/mandat), #17, #23, #26 (visa inga API-/nedladdningslänkar ännu), #33 (nämn inte kandidater i sök), #50 (stängd — partiprofilen) |
| **Omfattning** | drygt 20 filer i `src/pages/`, `src/components/`, `src/server/`, `src/styles/`, `scripts/`, `data/parti/`, `public/img/` |
| **Risk** | Medel–Hög |
| **Komplexitet** | Hög |
| **Säker för junior** | Nej |
| **Konfliktrisk** | Låg — inga andra öppna planer i `agent-docs/issue/`. `stash@{0}` ("WIP #47/#49 startsida och partikort") lämnas orörd; den är skapad mot `d8a8907`, före både partiprofilens layout (`fb54250`) och SSR-omläggningen (`9156001`), och används inte som underlag |

### Triagemässiga noteringar

- **#48 är öppet** men blockerar bara delar: mandatfördelning för 2022 finns redan committad i `data/val/2022/valresultat/riksdag.json` och härledd i `data/derived/partiprofil/riksdag.json` (`kammare`), med källa (Riksdagen, data.riksdagen.se). Riksdagspartier-modulen och riksdagsgrafiken kan därför byggas datadrivet redan nu, för de valår som har data. Det som saknas och kräver #48 är röstandelar per parti samt den dokumenterade metoden för "största partierna utanför riksdagen" — den modulen skjuts upp och renderas inte alls tills #48:s data finns.
- **#33** hanteras genom att sökfältets placeholder bara nämner det som är sökbart (namn och förkortning) — nuvarande placeholder "Sök parti, kandidater, regioner, m.m." lovar för mycket och ersätts.
- **#26** hanteras genom att inga JSON-/API-länkar visas; sidfotens befintliga GitHub-länkar räcker.
- Grenval: ingen release-koppling finns konfigurerad; arbetet utgår från `main` (arbetsträdet var rent).
- PR-koppling (agentbedömning, öppen för användaren): eftersom modulen "utanför riksdagen" ingår i #49:s omfattning men väntar på #48 är standardvalet `Part of #49` — issuet hålls öppet tills #48-modulerna finns. PR:en bör däremot stänga #17 (`Closes #17`); #23 stängs efter manuell responsivitetsverifiering. Vill användaren i stället flytta #48-modulerna till ett uppföljningsissue kan PR:en stänga #49 — det är ett scope-beslut som bara användaren kan fatta.

## Angreppssätt

Startsidan (`src/pages/index.tsx`) importerar i dag `data/parti/index.json` statiskt och renderar en bokstavsgrupperad länklista plus ett dött sökfält. Sidramen (Header/Footer, tokens, typografi) från #46 finns redan och behålls.

Ombyggnaden följer partisidans etablerade mönster (från #53): `getServerSideProps` som läser data via `src/server/party-data.ts`. Servern bygger en kompakt payload — partilista med namn, förkortning, slug, symbol-URL samt en facettsammanfattning av deltagande (valår → valtyp/län) — som klienten söker och filtrerar i utan ytterligare anrop. Facetterna byggs ur partifilernas `deltagande`-fält (issuets utpekade sanningskälla), cachas per process, och geografin hålls på länsnivå (kommunkodens två första siffror är länskoden) så payloaden förblir liten.

Tre datauppgifter behöver ordnas i grunden:

1. `data/parti/index.json` saknar `forkortning` — läggs till i `scripts/parti.js` och registret regenereras (committad datauppdatering).
2. Riksdagsgrafiken i headern (`public/img/sveriges_riksdag.svg`) hårdkodar en inaktuell mandatfördelning som tidlös dekoration — grupperna motsvarar 2018 års sammansättning med två vildar (S 100, M 70, SD 62 …), inte den committade 2022-fördelningen — och ska genereras från committad mandatdata och märkas med valår.
3. Riksdagspartier-modulen matchar mandatfördelningens `forkortning` mot partiregistret — kräver punkt 1 och defensiv matchning med test.

Partikortet byggs som en enda komponent med variantprop (`large`/`medium`/`small`), där hela kortet är en riktig `<Link>` till `/parti/<filnamn>`, symbolen renderas med `alt=""` (namnet finns som text, ingen dubblering för skärmläsare) och en neutral förkortningsmarkör visas när symbol saknas.

## Steg

### Fas 0: Utgångsläge

Implementationen utgår från aktuell `main`. `stash@{0}` ("WIP #47/#49 startsida och partikort", skapad på branchen `issue/47-partikort` mot `d8a8907`) lämnas **orörd** — den ska varken appliceras, poppas eller kastas. Dess `index.tsx` föregår SSR-omläggningen (`9156001`) och dess `app.scss` föregår partiprofilens layout (`fb54250`), så den är inte ett giltigt underlag för det här arbetet.

`src/components/PartyCard.tsx` finns inte i repot och byggs från grunden i fas 3.

### Fas 1: Datagrund — `forkortning` i partiregistret

1. Lägg till `forkortning` i indexposterna som `scripts/parti.js` skriver till `data/parti/index.json` (fältet finns redan i partifilerna och i `PARTY_KEY_ORDER`).
   - Filer att ändra: `scripts/parti.js`
2. Uppdatera `PartiIndexEntry` i `src/types.ts` (`Pick<…>` utökas med `forkortning`).
   - Filer att ändra: `src/types.ts`
3. Uppdatera datavalideringen så att indexpostens `forkortning` valideras mot partifilen, och uppdatera tester.
   - Filer att ändra: `scripts/validate.js`, `scripts/validate.test.js`, ev. `scripts/parti.test.js`
4. Kör `node scripts/parti.js` och committa regenererad `data/parti/index.json`; verifiera med `npm run validate:data`.

### Fas 2: Serverdata för startsidan

1. Ny funktion `readHomeData()` i `src/server/party-data.ts` (cachad per process, samma mönster som `partyIndexPromise`):
   - partilista från `data/parti/index.json` (uuid, beteckning, forkortning, filnamn, symbol-URL via befintligt `/partisymbol/`-mönster), sorterad alfabetiskt på beteckning med `sv`-locale — ingen annan rangordning;
   - deltagandefacetter per parti ur partifilernas `deltagande`-fält (`data/parti/<filnamn>/index.json`) — issuet anger uttryckligen partifilerna som sanningskälla för deltagande, och `scripts/parti.js` har redan normaliserat årsfilerna (inkl. 2018 års `landsting.json`) dit. Läsningen av ~675 små filer sker en gång per process och cachas. Facett per år → `{ riksdag: boolean, regionLan: string[], kommunLan: string[] }` (regionkoder resp. kommunkodernas tvåsiffriga länsprefix hålls isär, så att valtyp + län kan kombineras korrekt);
   - tillgängliga valår (för filtret) = år som förekommer i partiernas `deltagande`;
   - länslista (kod + namn) från `data/regioner/index.json`;
   - riksdagsöversikter: alla `data/val/<år>/valresultat/riksdag.json` som innehåller `mandatfordelning` (i dag endast 2022), var och en med valår, partier med mandat och källa, matchade mot registret via `forkortning`. Matchningskontrakt: en post upplöses till parti (uuid/filnamn/symbol) endast när förkortningen matchar exakt ett parti i registret; noll eller flera träffar ⇒ oupplöst post som renderas som neutral ruta utan länk — aldrig fel parti, aldrig krasch. (Registret har i dag ett fåtal dubblettförkortningar — tre vid skiftlägeskänslig, fyra vid skiftlägesokänslig jämförelse — ingen bland kammarens åtta partier. På sikt bör #48 leverera uuid så att förkortningsmatchning försvinner.)
   - Filer att ändra: `src/server/party-data.ts`
2. Tester för `readHomeData()` mot fixturer: facettbygget ur `deltagande` (inkl. länsprefix och år där region/kommun är tomma), förkortningsmatchning inkl. saknad och tvetydig förkortning, år utan data, flera år med `mandatfordelning`, sorteringen.
   - Filer att ändra: `scripts/party-data.test.js` (ev. `scripts/fixtures/`)

### Fas 3: Partikort-komponenten

1. Skapa `src/components/PartyCard.tsx`: en komponent, variantprop `'large' | 'medium' | 'small'`.
   - Innehåll: beteckning, förkortning, partisymbol (`next/image`, `unoptimized`, bibehållet bildförhållande via `object-fit: contain`, aldrig beskärning), neutral förkortningsmarkör som fallback (förkortning, annars initial ur beteckningen), primär metadata (t.ex. "73 mandat"), valfri sekundär metadata (t.ex. län/deltagandeomfattning).
   - Hela kortet är `<Link href={`/parti/${filnamn}`}>` — ingen `div` med `role="link"`. Symbolbilden får `alt=""` + `aria-hidden` eftersom partinamnet står i klartext.
   - Robusthet: långa partinamn (radbrytning, ingen overflow), saknad förkortning, saknad symbol.
   - Filer att ändra: `src/components/PartyCard.tsx` (ny)
2. Stilar i ny partial `src/styles/_party-card.scss`, inkopplad via `@use` i `app.scss` (samma mönster som `_party-profile.scss`): tokens från `:root` (`--partidata-*`), synligt fokusläge, de tre varianterna via modifierarklasser — inte tre implementationer.
   - Filer att ändra: `src/styles/_party-card.scss` (ny), `src/styles/app.scss`

### Fas 4: Startsidans struktur, sök och filter

1. Gör om `src/pages/index.tsx` till `getServerSideProps` + `readHomeData()`. Behåll Head-data (titel, beskrivning, favicon) och sidramen från #46.
   - Filer att ändra: `src/pages/index.tsx`
2. Intro-sektion: h1, kort tjänstebeskrivning, partiantal räknat från payloaden (aldrig fast tal).
3. Rena, testbara sök-/filterhjälpare i egen modul (`src/components/home/filtering.ts`), separerade från React-komponenterna:
   - textnormalisering i deburr-stil enligt #17: NFD-dekomposition + borttagna diakriter, gemener, trimning — "ostra" matchar "Östra"; sökning på beteckning och förkortning;
   - filtersemantik som AND-villkor, med tomt val = inget krav:
     - inget filter valt → alla partier (endast sökningen begränsar);
     - endast valår → deltagande i någon valtyp det året;
     - endast valtyp → deltagande i den valtypen något år;
     - valår + valtyp → deltagande i den valtypen det året;
     - län prövas mot rätt facett för valtypen (`regionLan` resp. `kommunLan`) och länsfiltret är aktivt bara när valtypen region eller kommun är vald — inte för riksdag och inte när valtyp saknas;
   - när valår eller valtyp ändras rensas filterval som blivit ogiltiga (t.ex. länsval när valtypen byts till riksdag);
   - riksdagssektionens valårsväljare är oberoende av gridets filter — de delar inte state.
   - Testmatris i `scripts/home-filtering.test.js`: normalisering ("ostra"/"Östra", förkortning, skiftläge, whitespace, tom sökning), varje filterkombination ovan, rensning av ogiltiga val, pagineringens återställning.
   - Filer att ändra: `src/components/home/filtering.ts` (ny), `scripts/home-filtering.test.js` (ny)
4. Sök + filter som klientkomponent (`src/components/home/PartySearch.tsx` eller motsvarande):
   - placeholder som bara lovar det sökbara: t.ex. "Sök parti på namn eller förkortning" (#33 ej implementerad — kandidater nämns inte);
   - filter: valår (från datan), valtyp (riksdag/region/kommun), län (från `data/regioner`); alternativ visas bara när underlag finns;
   - synlig aktiv filterstatus ("N partier matchar …") och en återställningsknapp;
   - tomläge med tydlig text och återställningsmöjlighet;
   - `<label>`/`fieldset` för alla fält, semantiska knappar, fungerar med tangentbord.
   - Filer att ändra: `src/components/home/PartySearch.tsx` (ny) m.fl. under `src/components/home/`
5. Partigrid: alla matchande partier som `PartyCard` (small) i responsivt CSS-grid, alfabetiskt, med "Visa fler"-knapp som avslöjar nästa batch (t.ex. 48 åt gången) — en riktig `<button>` med uppdaterad status för skärmläsare; ingen dold bortfiltrering. Visningsantalet återställs när resultatmängden ändras (ny sökning/nya filter).
6. Sidfot: behåll befintlig `Footer` (datakällor, GitHub, CC0, kontakt, felrapportering — allt finns redan från #46). Inga API-/nedladdningslänkar (#26).
7. Ta bort den gamla bokstavslistan och tillhörande stilar (`.party-index`, gamla `.home-intro`-regler som ersätts) ur `app.scss`.
   - Filer att ändra: `src/styles/app.scss`, ny `src/styles/_home.scss` vid behov

### Fas 5: Riksdagsmoduler av befintlig data

1. Riksdagspartier för valt valår: sektion med `PartyCard` (medium/large) för partierna i valårets `mandatfordelning` (mandat som primär metadata, källrad med källa och valår). Sektionens data kommer från `readHomeData()`:s lista av år med `mandatfordelning`; valårsväljaren renderas bara när fler än ett år finns — i dag blir det enbart 2022 utan väljare, och väljaren aktiveras när #48 fyller på årsfilerna. Oupplösta poster (se matchningskontraktet i fas 2) renderas som neutral ruta utan länk, inte som `PartyCard`.
   - Om `SourceLine`/`SectionHeader` från `src/components/party-profile/shared.tsx` återanvänds flyttas de till en genuint delad modul (t.ex. `src/components/shared.tsx`) i stället för att startsidan kopplas till profilmodulen.
   - Filer att ändra: `src/pages/index.tsx`, `src/components/home/RiksdagSection.tsx` (ny), ev. flytt av `shared.tsx`
2. Riksdagsgrafiken genereras från data i stället för att den statiska `sveriges_riksdag.svg` underhålls för hand (dagens fil visar 2018 års sammansättning med två vildar): utöka `scripts/build-derived-data.js` så att hemicykel-SVG:n genereras ur senaste årets `mandatfordelning`, committas och kontrolleras av det befintliga `check:derived-data`-steget. Genereringskontrakt:
   - de 349 platskoordinaterna beräknas deterministiskt i skriptet (hemicykelgeometri med fast radie-/vinkelformel och fast decimalprecision — byte-stabil output, samma princip som `PARTY_KEY_ORDER` i `scripts/parti.js`);
   - grupperna följer källdatans ordning i `mandatfordelning`;
   - förkortning som saknas i färgkartan renderas i neutral färg och får testet att larma (kartan ska täcka kammarens partier);
   - valåret bakas in i filen som metadata/kommentar.
   Testet i `scripts/build-derived-data.test.js` parsar den genererade SVG:n och verifierar gruppantal mot `mandatfordelning` samt det inbäddade valåret — inte bara att indata summerar till 349 (det täcker valideringen redan).
   - Tillgänglighet: headerns exemplar förblir dekorativt (`alt=""`, `aria-hidden` — som i dag; ett SVG-`<title>` är inte ett pålitligt tillgängligt namn via `next/image`). Valår och källa exponeras i stället som text i riksdagssektionen. Efter regenerering verifieras även en partisida, eftersom `Header` är delad.
   - Filer att ändra: `scripts/build-derived-data.js`, `scripts/build-derived-data.test.js` (ny/utökad), `public/img/sveriges_riksdag.svg` (regenererad), ev. `src/components/Header.tsx`
3. "Största partierna utanför riksdagen" implementeras **inte** i denna PR — metoden och datan definieras av #48. Ingen platshållare med exempeldata; sektionen saknas tills underlaget finns.

### Fas 6: Verifiering och städning

1. Utöka `scripts/http-smoke.js`: utöver titeln asserteras en känd partilänk, aktuellt riksdagsvalår och att partiantal/sektioner renderas i release-artefakten.
   - Filer att ändra: `scripts/http-smoke.js`
2. Sök igenom diffen: ingen fixture, slumpgenerering eller hårdkodad ranking från prototypen; alla länkar går till existerande sidor eller externa mål.
3. Manuell verifiering: mobil (~360 px) till bred desktop, tangentbordsnavigering, fokuslägen, skärmläsarens upplevelse av kort och sök, reduced motion om animation lagts till.
4. `npm run precommit` (lint, typecheck, check:derived-data, validate:data, test, standalone-bygge, HTTP-smoke — smoken verifierar startsidan i release-artefakten).

## Filöversikt

| Fil | Åtgärd | Syfte |
|-----|--------|-------|
| `scripts/parti.js` | Ändra | Skriv `forkortning` i `data/parti/index.json` |
| `data/parti/index.json` | Regenerera | Registret med `forkortning` |
| `src/types.ts` | Ändra | `PartiIndexEntry` med `forkortning` |
| `scripts/validate.js` | Ändra | Validera nya indexfältet |
| `scripts/validate.test.js` | Ändra | Test för valideringen |
| `src/server/party-data.ts` | Ändra | `readHomeData()`: partilista, facetter, valår, län, riksdagsöversikter |
| `scripts/party-data.test.js` | Ändra | Tester för `readHomeData()` |
| `src/components/PartyCard.tsx` | Skapa | Återanvändbart partikort, tre varianter |
| `src/styles/_party-card.scss` | Skapa | Kortets stilar |
| `src/components/home/filtering.ts` | Skapa | Rena sök-/filterhjälpare (normalisering, AND-semantik) |
| `scripts/home-filtering.test.js` | Skapa | Tester för sök/filter/paginering |
| `src/components/home/PartySearch.tsx` | Skapa | Klientsidig sökning/filter/grid |
| `src/components/home/RiksdagSection.tsx` | Skapa | Riksdagspartier för valt valår |
| `src/pages/index.tsx` | Ändra | Ny startsida med `getServerSideProps` |
| `src/styles/app.scss` | Ändra | Koppla in partials, ta bort bokstavslistans stilar |
| `src/styles/_home.scss` | Skapa | Startsidans layoutstilar |
| `scripts/build-derived-data.js` | Ändra | Generera riksdagsgrafiken ur mandatdata |
| `scripts/build-derived-data.test.js` | Skapa/Ändra | Test: 349 mandat, gruppstorlekar = data |
| `public/img/sveriges_riksdag.svg` | Regenerera | Versionskopplad mandatgrafik |
| `scripts/http-smoke.js` | Ändra | Assertera partilänk, valår och sektioner |
| `src/components/Header.tsx` | Ändra (ev.) | Grafiken förblir dekorativ; ev. kommentar/attribut |

## Berörda kodområden

- `src/pages/` (startsidan)
- `src/components/` (nya kort-/sök-/sektionskomponenter, Header)
- `src/server/party-data.ts`
- `src/styles/`
- `scripts/` (parti.js, validate.js, build-derived-data.js, tester)
- `data/parti/index.json`, `public/img/`

## Designbeslut

> Icke-triviala val gjorda under planeringen. Feedback välkommen; annars implementeras enligt dessa. Proveniens anges per beslut.

### 1. Startsidan via `getServerSideProps` + `party-data.ts`, inte statisk import
**Alternativ:** behålla statisk `import parties from 'data/parti/index.json'` vs SSR genom datalagret.
**Beslut:** SSR genom `src/server/party-data.ts`.
**Motivering:** Befintlig konvention — partisidorna läser redan JSON via datalagret (CLAUDE.md), och facetterna kräver serverlogik. Payloaden cachas per process så kostnaden per request är en engångsläsning. *(Proveniens: befintlig konvention.)*

### 2. `forkortning` läggs till i `data/parti/index.json`
**Alternativ:** läsa 675 partifiler i runtime vs utöka registret.
**Beslut:** utöka registret via `scripts/parti.js`.
**Motivering:** Sökning på förkortning är ett acceptanskriterium; fältet är litet, redan källbelagt i partifilerna och registret är uttryckligen härlett ur dem. Fullt `deltagande` läggs däremot *inte* i registret (kommunlistorna skulle mångdubbla filen). *(Proveniens: agentens egen bedömning — öppen att ifrågasätta.)*

### 3. Geografifilter på länsnivå, facetter ur partifilernas `deltagande`
**Alternativ:** (a) kommunnivåfilter med fulla kodlistor i payloaden vs länsnivå via kodprefix; (b) facetter ur partifilerna vs inversion av årsfilerna i `data/val/<år>/partideltagande/`.
**Beslut:** länsnivå, byggd ur partifilernas `deltagande`-fält, med region- och kommunlän åtskilda (`regionLan`/`kommunLan`) så att valtyp + län kombineras korrekt.
**Motivering:** Issuet anger partifilerna som sanningskälla för deltagande, och `scripts/parti.js` har redan normaliserat årsfilerna (inkl. 2018 års `landsting.json`) dit — inversion av årsfilerna vore en andra härledningsväg av samma data. Kommunkodens två första siffror är länskoden, så länsfacetten täcker "geografiskt deltagande" med en payload på bråkdelen av storleken (riksdagspartier deltar i ~290 kommuner × flera år). En gemensam länslista skulle ge falska träffar när valtyp och län kombineras, därför hålls facetterna per valtyp. Kommunnivå kan läggas till senare utan strukturbyte. *(Proveniens: källvalet är användarbeslut via issue #49; länsnivån är agentens egen bedömning — öppen att ifrågasätta.)*

### 4. Riksdagsgrafiken genereras ur committad mandatdata
**Alternativ:** (a) behålla statisk SVG och bara märka + testa den mot datan; (b) generera SVG:n ur `kammare` via skript och committa; (c) rendera hemicykeln som React-komponent i runtime.
**Beslut:** (b) — skriptgenererad, committad, testad SVG; valåret bakas in i filen och exponeras som text i riksdagssektionen, medan headerns exemplar förblir dekorativt (`alt=""`, `aria-hidden`).
**Motivering:** Issuet kräver att grafiken "genereras från eller versionskopplas till ett valår". Skriptvägen tar bort de hårdkodade mandaten helt, följer repots mönster (skript → committad, kontrollerad derived-data) och belastar inte varje sidrendering. Ett SVG-`<title>` är inte ett pålitligt tillgängligt namn via `next/image`, så valår/källa redovisas i sidinnehållet i stället. Partifärgerna hålls som presentationskarta i skriptet (förkortning → färg) eftersom datan saknar färgfält för de flesta partier — färger betraktas som presentation, inte politisk data. *(Proveniens: agentens egen bedömning — särskilt färgkartan är öppen att ifrågasätta.)*

### 5. Riksdagspartier byggs nu; "utanför riksdagen" väntar på #48
**Alternativ:** skjuta hela riksdagsöversikten till efter #48 vs bygga det som redan har committad, källbelagd data.
**Beslut:** riksdagspartier + mandatgrafik byggs mot årsfilerna `data/val/<år>/valresultat/riksdag.json` med `mandatfordelning` (i dag 2022; valårsväljaren renderas först när fler år finns); "största partierna utanför riksdagen" och röstandelar utgår tills #48 finns.
**Motivering:** Mandatdatan finns redan committad med källa, så modulen uppfyller "all visad politisk data kommer från committade JSON-filer". Metoden för utanför-riksdagen finns däremot inte och får inte improviseras. *(Proveniens: agentens egen bedömning, grundad i issuets egna villkor ("när #48 finns") — öppen att ifrågasätta.)*

### 6. Ett Partikort med variantprop
**Alternativ:** tre komponenter vs en komponent med `variant`-prop och modifierarklasser.
**Beslut:** en komponent, tre varianter i samma implementation, styrd av prop + SCSS-modifierare.
**Motivering:** Uttryckligt krav i issuet ("utan tre separata implementationer"); metadata-slots gör varianterna till layoutskillnader, inte logikskillnader. *(Proveniens: användarbeslut — issue #49.)*

## Verifieringschecklista

- [ ] Startsidan använder profilen från #46 (tokens, typografi, sidram).
- [ ] En `PartyCard`-komponent täcker stor/mellan/liten variant och fungerar i responsiva grids.
- [ ] All visad politisk data kommer från committade JSON-filer med känd källa; partiantal räknas från datan.
- [ ] Ingen fixture, slumpgenerering eller hårdkodad partiranking från prototypen i produktionskoden; riksdagsgrafikens mandat kommer ur data och är valårsmärkta.
- [ ] Sökning på namn och förkortning fungerar med diakritnormalisering ("ostra" matchar "Östra", #17); filter (valår, valtyp, län) visas bara när underlag finns, kombineras som AND med länet prövat per valtyp; filterstatus är synlig och återställbar; tomläget är hjälpsamt.
- [ ] Sökplaceholdern nämner inte kandidater (#33) och inga API-/nedladdningslänkar visas (#26).
- [ ] Alla länkar leder till existerande sidor eller externa mål; korten är riktiga länkar; symbolens alt dubblerar inte partinamnet.
- [ ] Långa partinamn, saknad förkortning och saknad symbol ger inte trasig layout; symboler beskärs aldrig.
- [ ] Mobil→bred desktop utan överlapp, avklippta namn eller horisontell scroll; tangentbord, synliga fokuslägen och skärmläsare verifierade; reduced motion respekteras.
- [ ] `npm run lint`, `npm run typecheck`, `npm run validate:data`, `npm test`, `npm run build` (via `npm run precommit` inkl. HTTP-smoke) gröna.
- [ ] `stash@{0}` ("WIP #47/#49") är orörd — varken applicerad, poppad eller kastad.
- [ ] Kantfall: parti utan symbol och utan förkortning; saknad och tvetydig förkortning vid mandatmatchning (oupplöst ⇒ neutral ruta utan länk); år där `deltagande` saknar region/kommun; valår utan partideltagande; ogiltiga filterval rensas vid års-/valtypsbyte; tomt sökresultat; "Visa fler" med tangentbord och återställning vid ny resultatmängd.
- [ ] HTTP-smoken asserterar känd partilänk, riksdagsvalår och renderade sektioner i release-artefakten.
