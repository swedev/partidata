# Plan: Issue #105 — Read data/derived/riksdag.json at request time instead of bundling it

## Mål

Varje datafil sajten visar läses från `data/` på disk vid förfrågan genom `src/server/party-data.ts`. Det är det som gör att `publish-data.yaml` (#100) kan sätta en dataändring i drift genom att rsynca `data/` och starta om processen. En fil bryter mot det: `src/components/party-profile/elections.tsx` importerar `data/derived/riksdag.json` statiskt (`import parliamentView from 'data/derived/riksdag.json'`), så kammarens sammansättning, valdeltagandeserien och dess källor kompileras in i JavaScript-bundeln vid bygget. En datapublicering uppdaterar `/data/derived/riksdag.json` på servern medan partisidorna fortsätter visa bundelns kopia till nästa release. `party-data.ts` läser redan samma fil vid förfrågan för startsidans "största partier utanför riksdagen" (`readOutsideParliament`), så filen laddas på två sätt i dag.

Läsningen flyttas till `party-data.ts`, det partisidans två sektioner behöver skickas som en prop genom `getServerSideProps`, importen försvinner, och de värden komponenten i dag räknar ut på modulnivå (`chamberComposition`, `parliamentComposition`, `nationalTurnout`, `turnoutSourceNames`, `turnoutFetched`, `chamberSeats`) räknas ut ur propen i stället. När ingenting i `src/` längre importerar från `data/` skrivs noterna i `CLAUDE.md` och `deploy/README.md` om så att bara `public/img/sveriges_riksdag.svg` nämns som det som fortfarande kräver en release.

## Triagering

> Beslutsunderlag för detta issue.

| Fält | Värde |
|------|-------|
| **Blockeras av** | Inget |
| **Blockerar** | Inget |
| **Relaterade issues** | #100 (stängt; uppföljningen kommer därifrån, och dess plan är där den statiska importen upptäcktes), #104 (mergad PR för #100), #35 (öppet; omkörningen av 2026-importen rör partideltagandet, inte valresultaten — `derived/riksdag.json` ändras bara om partiregistret ändrar de partier härledningen pekar på, och först då märks det här issuet) |
| **Omfattning** | 9 filer i `src/server/`, `src/components/party-profile/`, `src/pages/parti/`, `scripts/` och dokumentation |
| **Risk** | Låg |
| **Komplexitet** | Låg |
| **Säker för junior** | Ja |
| **Konfliktrisk** | Låg (#100 är mergad; ingen annan öppen plan rör `elections.tsx` eller `party-data.ts`) |

### Triagemässiga noteringar

- Inga blockerare. Repot har ingen `agent-docs/github/`-konfiguration, så projekttavlan har inte slagits upp.
- Arbetet utgår från `main` (`a436f5c`, tre commits efter `v0.11.2`). `publish-data.yaml` körs för hand med `gh workflow run`, och `CLAUDE.md`/`deploy/README.md` beskriver det tillståndet — det är de styckena som uppdateras här.
- `public/img/sveriges_riksdag.svg` genereras av `scripts/build-derived-data.js` ur samma data och serveras som statisk fil ur bundeln (sidhuvudets kammarbild i `src/components/Header.tsx`). Den ligger utanför det här issuet: dokumentationen behåller noten om att den fortfarande kräver en release (beslut 6).
- Ingen annan öppen plan i `agent-docs/issue/` nämner `elections.tsx`, `[filnamn].tsx` eller `party-data.ts` som fil att ändra.

## Angreppssätt

`party-data.ts` får en läsare `readParliamentView()` som, precis som `readParliamentResults()`, läser sin fil en gång per store och cachar promisen; omstarten vid en datapublicering är det som släpper cachen, vilket är samma kontrakt som alla andra läsningar i filen. Läsaren returnerar en smal vy av `data/derived/riksdag.json` — kammarens valår, källa och partier med förkortning och mandat, samt valdeltagandets serie och källor — inte hela filen, så att `storsta_utanfor_riksdagen` och proveniensfälten inte hamnar i sidans props. `readCurrentParty` sätter den som `riksdag` på `PartyPageData`, bara när filen finns och har både `kammare` och `valdeltagande` — `scripts/build-derived-data.js` skriver alltid båda, så en fil med bara det ena är ett trasigt bygge, inte ett tillstånd att rendera halvt (beslut 3).

`elections.tsx` tappar importen och modulkonstanterna. `ElectionResultsSection` får `riksdag` som prop och räknar `parliamentComposition` och `chamberSeats` ur den; `TurnoutSection` får `valdeltagande` som prop och räknar serien, källnamnen, hämtdatumet och diagrammets `aria-label` (första och sista valåret; i dag hårdkodat "1994 till 2022") ur den. Uträkningarna är små (349 platser, åtta valår) och görs i renderingen; sidan är serverrenderad, så ingen memoization behövs. `[filnamn].tsx` skickar propen vidare och renderar valdeltagandesektionen bara när både `valresultat` och `riksdag` finns; kammarblocket i resultatsektionen kräver dessutom `results.kammare` som i dag.

Testerna i `scripts/party-data.test.js` får ett fall som visar att `resolveParty` bär vyn ur filen och ett fall utan fil. `scripts/http-smoke.js` läser redan `data/derived/riksdag.json` och får två påståenden till: partisidan visar kammarens valår i sammansättningsrubriken och det senaste valdeltagandevärdet. Ett litet test i `scripts/` vaktar att ingen fil under `src/` importerar från `data/`, så att regeln issuet formulerar går att läsa ur testsviten.

Dokumentationen (`CLAUDE.md` rad 18–20, `deploy/README.md` rad 59–65) skrivs i nu-läge: bara `public/img/sveriges_riksdag.svg` ligger i bundeln.

## Steg

### Fas 1: Läsaren i `party-data.ts`

1. Utöka `DerivedParliamentFile` med filens `kammare` och `valdeltagande` som valfria fält
   - `kammare?: { valar: number; kalla: PartiProfilKalla; partier: Array<{ parti_uuid: string; forkortning: string; mandat: number }> }`
   - `valdeltagande?: { resultat: Array<{ valar: number; procent: number }>; kallor: Array<PartiProfilKalla & { id: string; titel?: string; version?: string; format?: string; sha256?: string; transkribering_sha256?: string }> }`
   - Filer att ändra: `src/server/party-data.ts`
2. Lägg till de exporterade typerna för vyn, bredvid `ParliamentYear`/`OutsideParliamentData`
   - `ParliamentChamber { valar: number; kalla: PartiProfilKalla; partier: Array<{ forkortning: string; mandat: number }> }`
   - `ParliamentTurnout { resultat: Array<{ valar: number; procent: number }>; kallor: PartiProfilKalla[] }` — källorna reduceras till `namn`/`url`/`hamtad`, som är det `SourceLine` och källraden visar
   - `ParliamentView { kammare: ParliamentChamber; valdeltagande: ParliamentTurnout }`
   - `PartyPageData` får `riksdag?: ParliamentView`
   - Filer att ändra: `src/server/party-data.ts`
3. Bryt ut en cachad läsning av `derived/riksdag.json`
   - `let derivedParliamentPromise: Promise<DerivedParliamentFile | undefined> | undefined;` och `readDerivedParliament()` med `??=` som `readParliamentResults()`; `readOutsideParliament` byter till den så att filen läses en gång per store
   - `readParliamentView(): Promise<ParliamentView | undefined>` returnerar `undefined` när filen saknas eller `kammare`/`valdeltagande` saknas, annars vyn; partierna mappas till `{ forkortning, mandat }` i filens ordning, och både `kammare.kalla` och `valdeltagande.kallor` reduceras till `{ namn, url, hamtad }` — typannoteringen tar inte bort `id`, `titel`, `sha256` ur objektet, det gör bara en explicit projektion
   - Filer att ändra: `src/server/party-data.ts`
4. `readCurrentParty` läser vyn i samma `Promise.all` som profilen, kandidatlistorna och resultaten och sätter `...(riksdag ? { riksdag } : {})`
   - Filer att ändra: `src/server/party-data.ts`
5. Ge `readDerivedParliament` en docblock i samma stil som `readParliamentResults` ("read once"); kommentaren på `readDataFile` om att datan bara ändras vid omstart stämmer fortfarande och lämnas

### Fas 2: Komponenterna och sidan

1. Ta bort importen och modulkonstanterna i `elections.tsx`
   - Ta bort `import parliamentView from 'data/derived/riksdag.json'` och raderna `chamberComposition`, `parliamentComposition`, `nationalTurnout`, `turnoutSourceNames`, `turnoutFetched` och `chamberSeats`
   - Gör om `chamberSeats`-IIFE:n till en funktion `chamberSeatPositions(partier: ParliamentChamber['partier'])` med samma geometri; platserna läggs ut i filens ordning (som i dag, `chamberComposition` är osorterad), bara sammansättningslistan sorteras efter mandat
   - `{ label, seats }`-formen som `chamberComposition` har i dag ersätts av `{ forkortning, mandat }` rakt igenom (`ChamberDiagram`, `parliamentComposition`, listan)
   - Filer att ändra: `src/components/party-profile/elections.tsx`
2. `ElectionResultsSection` får `chamber?: ParliamentChamber`
   - Signatur: `{ results: PartiValresultat; partyLabel?: string; chamber?: ParliamentChamber }`
   - Lokalen `const chamber = results.kammare` på rad 98 krockar med propen: döp om den till `partySeats` (den bär bara `mandat` och `valar` för partiet)
   - `parliamentComposition = chamber.partier.toSorted((a, b) => b.mandat - a.mandat)` och `chamberSeatPositions(chamber.partier)` räknas bara när `chamber` finns; `ChamberDiagram` tar `seats` (positionerna) som prop
   - Kammarblocket renderas när `partySeats && chamber`; rubriken, källraden (`chamber.kalla`) och sammansättningsrubriken använder `chamber.valar`
   - Filer att ändra: `src/components/party-profile/elections.tsx`
3. `TurnoutSection` får `turnout: ParliamentTurnout`
   - Serien, `sourceNames` (`[...new Set(kallor.map(k => k.namn))]`) och `fetched` (`kallor.map(k => k.hamtad).toSorted().at(-1)`) räknas i komponenten; källraderna mappar `turnout.kallor` med `key` av `url` och `hamtad` som i dag
   - SVG:ns `aria-label` blir `Valdeltagande i riksdagsval ${första valår} till ${sista valår}` ur serien i stället för den hårdkodade "1994 till 2022"
   - Filer att ändra: `src/components/party-profile/elections.tsx`
4. `[filnamn].tsx` plockar `riksdag` ur props och skickar vidare
   - `<ElectionResultsSection key={slug} results={valresultat} partyLabel={abbreviation} chamber={riksdag?.kammare} />`
   - `{valresultat && riksdag && <TurnoutSection turnout={riksdag.valdeltagande} />}`
   - Filer att ändra: `src/pages/parti/[filnamn].tsx`
5. Kör `npm run typecheck` och `npm run lint`; kontrollera med `grep -rn "from 'data/" src` att ingen import från `data/` finns kvar

### Fas 3: Tester

1. `scripts/party-data.test.js`: två fall efter testet "party pages derive their election results from the imported result files"
   - I testet skrivs `derived/riksdag.json` med `kammare` (valår, `kalla` med `id`/`titel`/`sha256`, två partier med `parti_uuid`) och `valdeltagande` (två år, två källor med olika `hamtad` och extra fält); `resolveParty('betapartiet').props.riksdag` `deepEqual` den reducerade vyn — partierna utan `parti_uuid`, `kammare.kalla` och `valdeltagande.kallor` som exakt `{ namn, url, hamtad }`
   - Tre fall som ger `props.riksdag === undefined`: filen saknas; filen har bara `storsta_utanfor_riksdagen`; filen har `kammare` men inte `valdeltagande`. I det första fallet fungerar `readHomeData()` fortfarande (utan `outsideParliament`)
   - Ett fall som visar att filen läses en gång per store: `readHomeData()` följt av `resolveParty(...)` på samma store, skriv om filen mellan anropen, partisidan visar det gamla innehållet; en ny store på samma katalog visar det nya
   - Fixturen i `withDataFiles` (`{ schema_version: 2, kammare: { valar: 2022, partier: [] } }`) saknar `valdeltagande` och ger `undefined` — de testerna påstår inget om `riksdag`, så den lämnas
   - Filer att ändra: `scripts/party-data.test.js`
2. `scripts/http-smoke.js`: i partisideblocket (efter påståendet om `id="deltagande"`)
   - `assert.match(profileBody, new RegExp(\`Riksdagens sammansättning (<!-- -->)?${chamber.valar}\`))` — React lägger `<!-- -->` mellan text och uttryck, samma mönster som `valet (<!-- -->)?${chamber.valar}` på rad 273
   - Det senaste valdeltagandevärdet ur `derivedParliament.valdeltagande.resultat.at(-1).procent`, formaterat som komponenten gör (`toFixed(2).replace(/0$/, '').replace('.', ',')`), följt av `(<!-- -->)? %`
   - `aria-label="Valdeltagande i riksdagsval ${första} till ${sista}"` ur samma serie
   - Ett parti med resultat men utan `riksdag` finns inte i den committade datan, så det fallet täcks av enhetstestet i steg 1, inte av röktestet
   - Filer att ändra: `scripts/http-smoke.js`
3. Nytt test `scripts/source-imports.test.js`: går igenom `src/**/*.{ts,tsx,js,jsx}` (`allowJs` är på) och samlar specifikatorerna ur `import ... from '...'`, `import '...'` (sidoeffektsimport), `export ... from '...'`, `import('...')` och `require('...')`; en specifikator som börjar med `data/` (baseUrl-import) eller som, relativ, löses mot filens katalog till något under `<repo>/data/` felar testet
   - Filer att skapa: `scripts/source-imports.test.js`

### Fas 4: Dokumentation

1. `CLAUDE.md`: meningen på rad 18–20 blir att `public/img/sveriges_riksdag.svg` byggs in i bundeln och därför når sidhuvudet först med en release, medan allt under `data/` läses vid förfrågan
   - Filer att ändra: `CLAUDE.md`
2. `deploy/README.md`: stycket på rad 59–65 skrivs om till en fil: `public/img/sveriges_riksdag.svg`, genererad av `scripts/build-derived-data.js`; meningen om att `/data/derived/riksdag.json` följer en datapublicering tas bort eftersom det nu gäller allt
   - Filer att ändra: `deploy/README.md`
3. `docs/riksdagsvalresultat.md` rad 42 säger att startsidan använder härledningen; lägg till att partisidornas kammarblock och valdeltagande läser samma fil
   - Filer att ändra: `docs/riksdagsvalresultat.md`

### Fas 5: Verifiering

1. `npm run precommit` (lint, typecheck, `check:derived-data`, `validate:data`, tester, `build:release`, `test:http`)
2. Bekräfta manuellt att partisidan följer datan utan ombyggnad: efter `npm run build:release`, ändra ett `procent`-värde i `.release/data/derived/riksdag.json`, starta `npm start`, hämta `/parti/miljopartiet-de-grona/` och se det ändrade värdet; återställ filen (den är en kopia, inte den committade). Ett `grep -rl "Allmänna valen" .release/.next/static` utan träff är stödjande bevis, inte beviset — strängen kan saknas av andra skäl
3. PR-body avslutas med `Closes #105`

## Filöversikt

| Fil | Åtgärd | Syfte |
|-----|--------|-------|
| `src/server/party-data.ts` | Ändra | `readDerivedParliament`/`readParliamentView`, typerna `ParliamentChamber`/`ParliamentTurnout`/`ParliamentView`, `riksdag` på `PartyPageData` |
| `src/components/party-profile/elections.tsx` | Ändra | Importen och modulkonstanterna bort; `chamber`- och `turnout`-props |
| `src/pages/parti/[filnamn].tsx` | Ändra | Skickar `riksdag` vidare; villkorar `TurnoutSection` |
| `scripts/party-data.test.js` | Ändra | Vyn ur filen och fallet utan fil |
| `scripts/http-smoke.js` | Ändra | Sammansättningsåret och valdeltagandet i partisidan |
| `scripts/source-imports.test.js` | Skapa | Vaktar att `src/` inte importerar från `data/` |
| `CLAUDE.md` | Ändra | Bara SVG:n nämns som bundlad |
| `deploy/README.md` | Ändra | Samma |
| `docs/riksdagsvalresultat.md` | Ändra | Partisidorna nämns som läsare av härledningen |

## Berörda kodområden

- `src/server/`
- `src/components/party-profile/`
- `src/pages/parti/`
- `scripts/` (tester och röktest)
- `CLAUDE.md`, `deploy/`, `docs/`

## Designbeslut

> Icke-triviala val gjorda under planeringen. Varje beslut är antingen avgjort här, med proveniens, eller uttryckligen markerat som att det kräver användaren eftersom ett felval skulle ge skada som inte går att backa. Feedback välkommen; annars implementeras enligt dessa, och beslut som är agentens bedömning listas i PR:en för granskning.

### 1. Läsningen sker i `party-data.ts` och når komponenten via props
**Alternativ:** A) `party-data.ts` läser filen, `getServerSideProps` skickar vyn som prop; B) komponenten läser filen själv i en serverkontext; C) härleda kammaren ur `readParliamentResults()` i stället för ur `derived/riksdag.json`
**Beslut:** A
**Proveniens:** användarbeslut (issue #105: "Move the read into `party-data.ts`, pass what the elections view needs through the party page's `getServerSideProps` props, and drop the import")
**Vid fel val:** begränsat
**Motivering:** Issuet anger vägen. C skulle göra `derived/riksdag.json` överflödig för partisidan men ändra vilken fil som är sanningskälla för kammaren, vilket är utanför issuet; `storsta_utanfor_riksdagen` behöver ändå filen.

### 2. En smal vy, inte hela filen, som prop
**Alternativ:** A) `riksdag: ParliamentView` med bara kammaren (valår, källa, förkortning + mandat) och valdeltagandet (serie + källor reducerade till `namn`/`url`/`hamtad`); B) hela `DerivedParliamentFile` som prop
**Beslut:** A
**Proveniens:** befintlig konvention (`HomeData` bär `ParliamentYear`/`OutsideParliamentData`, egna vyer av samma fil, inte råfilen; `readOutsideParliament` reducerar redan)
**Vid fel val:** begränsat (props-formen är intern för sidan och byts i en PR)
**Motivering:** Sidans props serialiseras in i HTML:en; `storsta_utanfor_riksdagen`, `genererad_fran` och källornas `sha256` har inget att göra där. Källorna behåller de tre fält `SourceLine` ritar.

### 3. Vyn är valfri och sektionerna renderas bara när den finns
**Alternativ:** A) `readOptionalJson`, `riksdag?: ParliamentView`, kammarblock och valdeltagande utelämnas när filen eller dess delar saknas; B) filen är obligatorisk och `resolveParty` kastar
**Beslut:** A
**Proveniens:** befintlig konvention (`readOutsideParliament` returnerar `undefined` utan fil; testfixturerna i `scripts/party-data.test.js` skriver `derived/riksdag.json` utan `valdeltagande`)
**Vid fel val:** begränsat — en saknad fil i produktion syns eftersom `scripts/http-smoke.js` kräver `id="deltagande"` på ett parti med resultat, och `publish-data.yaml` kör `check:derived-data` innan rsyncen
**Motivering:** Samma tolerans som resten av storen; testfixturerna behöver inte byggas om. Vyn är allt eller inget — `kammare` utan `valdeltagande` ger också `undefined` — eftersom `build-derived-data.js` alltid skriver båda och `check:derived-data` körs före varje publicering; att rendera kammaren men inte valdeltagandet skulle dölja ett trasigt bygge bakom en halv sida. Om användaren hellre vill att sidan felar högt utan filen är B rätt och `withDataFiles`-fixturen får `valdeltagande`.

### 4. Uträkningarna görs i renderingen, utan memoization
**Alternativ:** A) `chamberSeatPositions(partier)` och serieuträkningarna anropas i komponenten vid varje rendering; B) `useMemo`; C) räkna positionerna på servern och skicka som prop
**Beslut:** A
**Proveniens:** agentens bedömning
**Vid fel val:** begränsat (prestanda på en serverrenderad sida med 349 element; byts i en uppföljning)
**Motivering:** Sidan renderas en gång per förfrågan på servern och hydreras en gång; uträkningen är trivial. C skulle lägga 349 koordinatpar i props. B blir rätt om komponenten börjar rendera om vid interaktion i kammarblocket.

### 5. Typerna för vyn ligger i `party-data.ts`, inte `src/types.ts`
**Alternativ:** A) `ParliamentChamber`/`ParliamentTurnout`/`ParliamentView` exporteras från `src/server/party-data.ts`; B) i `src/types.ts`
**Beslut:** A
**Proveniens:** befintlig konvention (`HomeData`, `ParliamentYear`, `OutsideParliamentData`, `SymbolFrame` — alla sid-props-former — ligger i `party-data.ts`; `src/types.ts` bär datafilernas former)
**Vid fel val:** begränsat
**Motivering:** Komponenten importerar redan typer från `src/server/party-data` via sidan; `elections.tsx` importerar `ElectionType`/`CandidateLists` som är dubblerade i båda filerna, och vyn hör till sidans props, inte till datan på disk.

### 6. `public/img/sveriges_riksdag.svg` lämnas i bundeln och noteras i dokumentationen
**Alternativ:** A) Dokumentationen behåller noten om SVG:n; B) servera SVG:n från `data/` eller generera den vid förfrågan i samma PR
**Beslut:** A
**Proveniens:** användarbeslut (issue #105: "it is out of scope here but the same argument applies, so note in the docs that it still needs a release, or take it in a follow-up")
**Vid fel val:** begränsat
**Motivering:** Issuet ger valet; B blandar in `next/image`, `public/` och `build-derived-data.js` i en ändring som annars är en flytt av en läsning. Ett uppföljningsissue kan öppnas när #35 gör att SVG:n faktiskt ändras.

### 7. Ett test vaktar att `src/` inte importerar från `data/`
**Alternativ:** A) `scripts/source-imports.test.js` som läser `src/` och felar på en import från `data/`; B) ingen vakt, regeln står bara i `CLAUDE.md`
**Beslut:** A
**Proveniens:** agentens bedömning
**Vid fel val:** begränsat (ett test som tas bort)
**Motivering:** Issuets kärna är regeln "ingenting i `src/` importerar från `data/`", och den bröts en gång utan att någon märkte det förrän #100 planerades. Ett litet test gör regeln körbar i `npm test`; det fångar de fyra importformerna och relativa sökvägar, inte `fs`-läsningar med hårdkodad sökväg (de går genom `party-data.ts` och är just det regeln vill ha). B är rätt om användaren tycker att `CLAUDE.md` räcker.

## Verifieringschecklista

- [ ] `grep -rn "from 'data/" src` ger ingen träff
- [ ] Partisidan för ett riksdagsparti visar kammarblocket med rätt valår, källa och sammansättning, och valdeltagandesektionen med serien och källorna — samma som före ändringen
- [ ] Ett parti med röstrad utan mandat får valdeltagandesektionen men inget kammarblock (röktestets befintliga påståenden)
- [ ] Ett parti utan resultat får varken resultat- eller valdeltagandesektion
- [ ] `resolveParty` bär `riksdag` ur `derived/riksdag.json` och utelämnar den utan fil (`scripts/party-data.test.js`)
- [ ] `derived/riksdag.json` läses en gång per store, för både startsidan och partisidorna
- [ ] Ett ändrat värde i `.release/data/derived/riksdag.json` syns på partisidan efter omstart utan ombyggnad
- [ ] Valdeltagandediagrammets `aria-label` anger seriens första och sista valår
- [ ] `CLAUDE.md`, `deploy/README.md` och `docs/riksdagsvalresultat.md` nämner bara `public/img/sveriges_riksdag.svg` som bundlad
- [ ] `npm run precommit` grönt
