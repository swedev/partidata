# Plan: Issue #80 — Move the generated party index to data/derived/parti.json

## Mål

Flytta det genererade partiregistret från `data/parti/index.json` till `data/derived/parti.json`, peka om varje läsare och skrivare, och skriva regeln en gång i README: allt under `data/derived/` är genererat och redigeras inte för hand. Filens form (en array, sorterad på `filnamn`, med tre obligatoriska och fyra valfria fält per parti) ändras inte. Frågan i issuet om filen alls förtjänar sin plats besvaras i designbeslut 1: den behålls, med motiveringen att dess uppgift är att vara det publika registret och sajtens slug-/uuid-tabell, inte att spara I/O. Valideringen skärps samtidigt så att den faktiskt upprätthåller regeln: ett register med fält generatorn inte skriver, eller en kvarlämnad `data/parti/index.json`, underkänns.

## Triagering

> Beslutsunderlag för detta issue.

| Fält | Värde |
|------|-------|
| **Blockeras av** | Inget |
| **Blockerar** | Inget tekniskt. #26 bör dock genomföras efter #80: #26 dokumenterar registrets adress och form publikt, och den dokumentationen ska skrivas mot den nya adressen, inte den gamla |
| **Relaterade issues** | #26 — publicerat JSON-gränssnitt; registrets adress och form är det som ska dokumenteras där |
| **Omfattning** | 18 filer: datafilen, 1 skrivare (`scripts/parti.js`), 6 läsare (`src/server/party-data.ts`, `scripts/validate.js`, `scripts/build-derived-data.js`, `scripts/riksdag-results.js`, `scripts/http-smoke.js`, `scripts/build-release.js`), 7 testfiler, 3 dokument (`README.md`, `src/types.ts`, `CLAUDE.md`) |
| **Risk** | Låg för koden (ren sökvägsflytt; varje läsare har ett test eller en CI-kontroll som faller om den missas). Medel för externa konsumenter: en README-dokumenterad GitHub-adress i ett publikt CC0-repo slutar fungera, utan möjlighet till omdirigering |
| **Komplexitet** | Låg |
| **Säker för junior** | Ja |
| **Konfliktrisk** | Låg — samtliga andra planmappar under `agent-docs/issue/` hör till stängda issues (#15–#86 kontrollerade 2026-08-30), inga öppna PR:er finns och `origin/main` är enda fjärrgrenen. Kontrollera `gh pr list` igen när arbetet börjar |

### Triagemässiga noteringar

- Inget projektbräde är konfigurerat (`agent-docs/github/project.json` saknas) och `agent-docs/github/info.json` finns inte, så ingen board-status eller release-gren att stämma av. Inga `release/*`-grenar finns; planen utgår från `main`.
- Issuet är öppet, märkt `enhancement`, ingen tilldelad, inga kommentarer (per 2026-08-30). Inget annat öppet issue refererar #80.
- #79 (stängt) noterade att #80 "berör också `scripts/parti.js`, bör inte arbetas parallellt" — #79 är mergat (`630808c`), så den samordningen är avklarad.
- Flytten är en brytande ändring för den som hämtar filen direkt från GitHub (README dokumenterar `parti/index.json` som publik data, CC0). Issuet ber om en rad i README om det; se designbeslut 5. Sajten själv serverar inte `data/` som filer (`deploy/README.md`: "Versioned JSON ... under `data/`" läses av Node-processen, inte av nginx), och `scripts/build-release.js` kopierar hela `data/`, så driftsättningen påverkas inte utöver den existenskontroll som byts i steg 2.6.
- `data/derived/riksdag.json` byggs med hjälp av registret (`scripts/build-derived-data.js:82`), så katalogen får ett internt beroende: `parti.json` först, sedan `riksdag.json`. Det dokumenteras i README (steg 4.1) och ändrar ingen ordning i `precommit`/CI, där `validate:data` och `check:derived-data` bara läser.

## Angreppssätt

Registret skrivs på ett ställe: `buildParties()` i `scripts/parti.js` bygger arrayen `index` ur de byggda partifilerna (rad 563–572), sorterar på `filnamn` med vanlig kodpunktsjämförelse och lägger den sist i `writeSet` (rad 577–580). Alla skript som skriver partidata går genom `buildParties()`/`writeFiles()` — `import-val`, `import-partisymboler`, `import-wikidata`, `measure-partisymboler` och `node scripts/parti.js` — så en sökvägsändring där täcker varje skrivväg. `validate()` i samma fil (rad 788–791) plockar registret som sista posten i `writeSet` och nämner `index.json` i felmeddelandet.

Läsarna är sex. `src/server/party-data.ts:248` läser registret en gång per process (`partyIndexPromise`) och bygger slug-tabell, vidarebefordringar från `tidigare_filnamn`, dubblettnamn och `byUuid`-uppslaget som riksdags- och utanför-riksdagen-modulerna använder. `scripts/validate.js:339–352` läser det som utgångspunkt för hela partivalideringen, kräver att katalogerna under `data/parti/` motsvarar posterna och att varje post är identisk med partifilen fält för fält (`INDEX_KEYS_FROM_PARTY`), med `parti/index.json` i ett dussin kontextsträngar. `scripts/build-derived-data.js:82` och `scripts/riksdag-results.js:364` (via `import-riksdagsval`, som läser men inte skriver registret) använder det som uuid-tabell. `scripts/http-smoke.js:119` läser det för att räkna ut förväntad rendering, och `scripts/build-release.js:24` kräver att filen finns i `.release/`.

Ingen fixtur skriver registret på förhand utom i tester som kringgår `parti.js`: `scripts/fixtures/tree.js` skriver bara partifiler och låter `parti.js` generera registret, medan `validate.test.js`, `party-data.test.js`, `build-derived-data.test.js` och `riksdag-results.test.js` skriver `parti/index.json` för hand i sina temporära träd. De läser eller skriver alla med sökvägsliteraler, så ändringen är mekanisk men måste göras i varje fil — ett missat test faller på `ENOENT`, vilket är avsikten.

Arbetet görs som en enda PR i ordningen: flytta filen och skrivaren, peka om läsarna, uppdatera testerna, skriva dokumentationen, och avsluta med att bygga om registret och kontrollera att inget mer ändrades. Fas 1–3 hänger ihop: efter fas 1 är läsarna trasiga tills fas 2 är klar, och testerna gröna först efter fas 3, så faserna är arbetsordning inom en commit, inte tre var för sig gröna commits. Filen flyttas med `git mv` så att historiken följer med.

Designbeslut 1 besvarar issuets fråga om filen förtjänar sin plats. Kort: startsidan läser registret plus alla 670 partifiler (tillsammans 1,71 MB, varav `deltagande` 1,08 MB) en gång per process, cachat i `homeDataPromise`. Ett register utökat med `deltagande` skulle vara omkring 1,62 MB — ungefär samma mängd bytes, men i en fil i stället för 671 — så vinsten av alternativ B finns men bara vid serverstart. Filens uppgift är en annan: det är det enda dokumenterade, publika registret över datasetet — det #26 ska publicera — och den slug-/uuid-tabell sajten och tre skript slår i. Den behålls med oförändrad form.

## Steg

### Fas 1: Flytta filen och skrivaren

1. Flytta datafilen med bevarad historik.
   - `git mv data/parti/index.json data/derived/parti.json`
   - Ingen innehållsändring: filen ska vara byte-identisk efter flytten (steg 5.1).
2. Peka om skrivaren i `scripts/parti.js`.
   - `buildParties()`: byt `dataPath('parti', 'index.json')` mot `dataPath('derived', 'parti.json')` i `writeSet` (rad 580). `writeFiles()` kör redan `mkdirSync(path.dirname(file), { recursive: true })`, så katalogen skapas i ett tomt träd (testträden i `scripts/fixtures/tree.js` har ingen `derived/`).
   - `validate()`: felmeddelandet `index.json has N entries` (rad 790) ska nämna `derived/parti.json`.
   - Docblocken ovanför `PARTY_KEY_ORDER` beskriver partifilerna och behöver inte ändras; kontrollera att ingen annan kommentar i filen nämner `parti/index.json`.
   - Filer att ändra: `scripts/parti.js`

### Fas 2: Peka om läsarna

1. `src/server/party-data.ts:248` — `path.join(dataRoot, 'derived', 'parti.json')`. Sökvägen till partifilerna (`parti/<filnamn>/index.json`) och till `derived/riksdag.json` (rad 344) rörs inte.
2. `scripts/validate.js` — `validatePartyRegistry()`:
   - Läs registret från `path.join(dataDirectory, 'derived', 'parti.json')` (rad 341).
   - Byt varje kontextsträng `parti/index.json` (rad 341–359) och `saknas i index.json` (rad 389) till `derived/parti.json`; kontroller mot partifilen (`skiljer sig mellan index och partifil`, rad 386) kan stå kvar som de är.
   - Lägg till att varje registerpost bara får ha nycklar ur `INDEX_KEYS_FROM_PARTY` (designbeslut 3). I dag kontrolleras att de sju fälten stämmer med partifilen och att varje befintligt fält stämmer, men ett fält som lagts till för hand i både register och partifil passerar, fast generatorn aldrig skriver det. Felmeddelande i stil med `derived/parti.json (<filnamn>): fältet "<key>" skrivs inte av scripts/parti.js`.
   - Lägg till en kontroll av att `data/parti/index.json` inte finns (designbeslut 6): katalogkontrollen på rad 348–352 filtrerar på `isDirectory()`, så en kvarlämnad fil är osynlig för den. Felmeddelande i stil med `parti/index.json ska inte finnas; registret ligger i derived/parti.json`.
3. `scripts/build-derived-data.js:82` — `path.join(dataDirectory, 'derived', 'parti.json')`. Skriptets egen `DERIVED_FILE`-konstant avser dess utdata och lämnas.
4. `scripts/riksdag-results.js:364` — `loadIdentityResolver()` läser registret från `path.join(dataRoot, 'derived', 'parti.json')`.
5. `scripts/http-smoke.js:119` — `path.join(projectRoot, 'data', 'derived', 'parti.json')`, i linje med hur `derived/riksdag.json` redan läses på raden under.
6. `scripts/build-release.js:24` — existenskontrollen `data/parti/index.json` byts mot `data/derived/parti.json`.
   - Filer att ändra: `src/server/party-data.ts`, `scripts/validate.js`, `scripts/build-derived-data.js`, `scripts/riksdag-results.js`, `scripts/http-smoke.js`, `scripts/build-release.js`

### Fas 3: Uppdatera testerna

1. `scripts/parti.test.js` — `identity()` (rad 61), rad 326, testerna på rad 527, 541 och 652 samt rad 659: läs `data/derived/parti.json`. Döp om testnamnen `index.json is sorted by filnamn ...`, `index.json carries ...` och `index.json does not take up ...` till `derived/parti.json ...`. I testet på rad 527, lägg till att `data/parti/index.json` inte har skapats.
2. `scripts/validate.test.js` — `makeData()` (rad 34) och det andra registret på rad 310 skriver `derived/parti.json`. Två nya deltest under den befintliga `assert.throws`-sviten: ett träd med både `derived/parti.json` och en kvarlämnad `parti/index.json` underkänns, och ett register vars post har ett extra fält (som också finns i partifilen, så fältjämförelsen inte är det som faller) underkänns med det nya meddelandet.
3. `scripts/party-data.test.js` — rad 39 och 222 skriver `derived/parti.json`.
4. `scripts/build-derived-data.test.js:42` — skriver `derived/parti.json`. Observera att `writePartyProfileParliamentView()` skriver `derived/riksdag.json` i samma katalog; `writeJson`-hjälparen skapar katalogen, så ordningen spelar ingen roll.
5. `scripts/riksdag-results.test.js:29` — skriver `derived/parti.json` (`mkdirSync` för `derived/` behövs, hjälparen där använder `fs.writeFileSync` direkt).
6. `scripts/import-partisymboler.test.js:111` och `scripts/measure-partisymboler.test.js:90` — läser `data/derived/parti.json`.
7. `scripts/fixtures/tree.js`, `scripts/import-val.test.js` och `scripts/import-wikidata.test.js` behöver ingen ändring: de skriver aldrig registret och läser det inte direkt.
   - Filer att ändra: de sju testfilerna ovan

### Fas 4: Dokumentation

1. `README.md`, avsnittet "Tillgänglig data":
   - Nytt underavsnitt `### derived/` med regeln, formulerad en gång: allt under `data/derived/` är genererat ur de övriga filerna i `data/` och redigeras inte för hand; en ändring görs i källfilerna och katalogen byggs om. Lista de två filerna med sina generatorer: `derived/parti.json` skrivs av `node scripts/parti.js` och av varje skript som går genom `buildParties()` (`import-val`, `import-partisymboler`, `import-wikidata`, `measure-partisymboler`); `derived/riksdag.json` skrivs av `npm run build:derived-data` (länk till `docs/riksdagsvalresultat.md`) och byggs ur `derived/parti.json` och valresultaten, så ordningen vid en fullständig ombyggnad är `node scripts/parti.js` följt av `npm run build:derived-data`. `derived/riksdag.json` saknar i dag omnämnande i README.
   - Flytta avsnittet `### parti/index.json` (rad 28–30) till `### derived/parti.json` under det nya avsnittet, och beskriv hela projektionen: `uuid`, `beteckning` och `filnamn` alltid; `tidigare_filnamn`, `omrade`, `forkortning` och `partisymbol` när partifilen har dem (i dag nämns varken `omrade` eller `forkortning`). Sorteringen på `filnamn` och att `tidigare_filnamn` är det sajten bygger vidarebefordringar från står kvar. Lägg till en rad för den som hämtar filen från GitHub: att den ersätter `parti/index.json` (designbeslut 5).
   - Rad 52: `De tas inte upp i parti/index.json` → `derived/parti.json`.
   - Rad 174 (`node scripts/parti.js`): `Bygger om partifilerna och data/derived/parti.json`.
2. `src/types.ts:179–181` — docblocken för `PartiIndexEntry`: `An entry in data/derived/parti.json`.
3. `CLAUDE.md`, stycket om dataskript: `node scripts/parti.js rebuilds the registry from data/ alone` kompletteras med att registret skrivs till `data/derived/parti.json`, att allt under `data/derived/` är genererat, och att `build:derived-data` läser `parti.json`.
4. `docs/riksdagsvalresultat.md` och `data/partisymboler/README.md` nämner bara `derived/riksdag.json` respektive partifilernas `index.json` och lämnas.
   - Filer att ändra: `README.md`, `src/types.ts`, `CLAUDE.md`

### Fas 5: Verifiering

1. Flytten är ren: `git show HEAD:data/parti/index.json | cmp - data/derived/parti.json` är tyst, och `test ! -e data/parti/index.json`.
2. Generatorn är stabil: med flytten stagad, kör `node scripts/parti.js` och kontrollera att `git diff --exit-code -- data` är tyst — registret skrivs byte-identiskt på den nya platsen och ingen `data/parti/index.json` återuppstår (`git status --porcelain` duger inte här, eftersom den stagade flytten själv syns där).
3. `npm run build:derived-data` från den nya `parti.json` ger heller ingen diff i `data/derived/riksdag.json`.
4. `npm run precommit` (lint, typecheck, `check:derived-data`, `validate:data`, `npm test`, `build:release`, `test:http`). `validate:data` är den kontroll som fångar en glömd läsare i `validate.js`; `test:http` fångar `party-data.ts`, `http-smoke.js` och `build-release.js`.
5. `grep -rn "parti/index.json\|'parti', 'index.json'" scripts src README.md CLAUDE.md docs` ska bara träffa kvarlämningskontrollen i `validate.js` med dess test och README-raden för GitHub-konsumenter.

## Filöversikt

| Fil | Åtgärd | Syfte |
|-----|--------|-------|
| `data/parti/index.json` → `data/derived/parti.json` | Flytta (`git mv`) | Registret på sin nya plats, oförändrat innehåll |
| `scripts/parti.js` | Ändra | Skriv registret till `derived/parti.json`; felmeddelande i `validate()` |
| `src/server/party-data.ts` | Ändra | Läs registret från den nya sökvägen |
| `scripts/validate.js` | Ändra | Ny sökväg, kontextsträngar, bara kända fält i registret, kontroll att `parti/index.json` inte finns kvar |
| `scripts/build-derived-data.js` | Ändra | uuid-tabellen läses från den nya sökvägen |
| `scripts/riksdag-results.js` | Ändra | `loadIdentityResolver()` läser den nya sökvägen |
| `scripts/http-smoke.js` | Ändra | Förväntad rendering räknas ut från den nya sökvägen |
| `scripts/build-release.js` | Ändra | Existenskontroll av `data/derived/parti.json` i `.release/` |
| `scripts/parti.test.js` | Ändra | Läs den nya sökvägen; testnamn; gamla sökvägen skapas inte |
| `scripts/validate.test.js` | Ändra | Fixturer skriver den nya sökvägen; deltest för kvarlämnad fil och för okänt registerfält |
| `scripts/party-data.test.js` | Ändra | Fixturer skriver den nya sökvägen |
| `scripts/build-derived-data.test.js` | Ändra | Fixtur skriver den nya sökvägen |
| `scripts/riksdag-results.test.js` | Ändra | Fixtur skriver den nya sökvägen |
| `scripts/import-partisymboler.test.js` | Ändra | Läser den nya sökvägen |
| `scripts/measure-partisymboler.test.js` | Ändra | Läser den nya sökvägen |
| `README.md` | Ändra | Avsnittet `derived/` med regeln och byggordningen; registrets avsnitt flyttat och fullständigt; rad 52 och 174 |
| `src/types.ts` | Ändra | Docblock för `PartiIndexEntry` |
| `CLAUDE.md` | Ändra | Dataskript-stycket nämner `data/derived/parti.json` och regeln |

## Berörda kodområden

- `data/parti/` (filen flyttas ut) och `data/derived/` (filen flyttas in)
- `scripts/` — `parti.js`, `validate.js`, `build-derived-data.js`, `riksdag-results.js`, `http-smoke.js`, `build-release.js` och deras tester
- `src/server/party-data.ts`, `src/types.ts`
- `README.md`, `CLAUDE.md`

## Designbeslut

> Icke-triviala val gjorda under planeringen. Feedback välkommen; annars implementeras enligt dessa.

### 1. Registret behålls, med samma fält
**Alternativ:** A) behåll filen som den är och flytta den; B) utöka den med `deltagande` så startsidan slipper läsa partifilerna; C) ta bort den och låt varje läsare bygga tabellen ur partifilerna
**Beslut:** A
**Motivering:** Agentens egen bedömning, öppen att ifrågasätta — issuet ställer frågan som B eller C. Siffrorna (mätta 2026-08-30): registret är 214 KB; startsidan läser det plus 670 partifiler, 1,71 MB totalt, varav `deltagande` är 1,08 MB; ett register med `deltagande` skulle bli omkring 1,62 MB, 7,6 gånger dagens. B ger alltså en verklig vinst — 671 filöppningar blir en, ungefär lika många bytes — men bara vid serverstart, eftersom `buildHomeData()` körs en gång per process och cachas i `homeDataPromise`; ingen har mätt kallstarten som ett problem. Priset är ett 7,6 gånger större publikt register som blandar identitet med startsidans filterdata. C är tekniskt möjligt — `getPartyIndex()` kunde läsa `readdir(data/parti)` plus 670 filer, som `buildHomeData()` redan gör — men tar bort det enda enfils-registret över datasetet, som README dokumenterar som publik data och som #26 ska publicera som endpoint, samt uuid-tabellen `build-derived-data.js` och `riksdag-results.js` slår i. Underhållskostnaden issuet nämner (synk, validering, ombyggnad) är redan automatiserad: `parti.js` skriver, `validate.js` kontrollerar likhet fält för fält, CI kör båda. A ger ett smalt, stabilt publikt register skilt från startsidans data. Blir kallstarten ett mätt problem är en separat `derived/home.json` för startsidan ett bättre svar än att bredda registret — det är en idé, inte ett beslut. Vill användaren i stället ha C är det ett eget issue: det ändrar sex läsare och README:s publika kontrakt.

### 2. Filens form ändras inte
**Alternativ:** A) bar array som i dag; B) objekt med `schema_version`/`genererad_fran` som `derived/riksdag.json`
**Beslut:** A
**Motivering:** Befintlig konvention (`PartiIndexEntry[]` i `src/types.ts`, alla sex läsare, README:s fältbeskrivning). Issuet är en sökvägsflytt; att byta form samtidigt vidgar den brytande ändringen utan att issuet ber om det. Ett metadatahuvud kan övervägas under #26, där formatet ändå ska dokumenteras — noterat där som öppen fråga, inte beslutat här.

### 3. `parti.js` förblir skrivare; `validate.js` förblir kontroll, och skärps
**Alternativ:** A) som i dag, med en nyckelkontroll tillagd; B) flytta skrivningen till `build-derived-data.js` och kontrollen till `check:derived-data`; C) ett `parti.js --check` som jämför genererad utdata byte för byte med den committade filen
**Beslut:** A
**Motivering:** Användarbeslut i issuet: "Two generators writing into one directory is fine as long as the directory's rule is about the files being generated". Att flytta skrivningen (B) skulle dessutom bryta att importskripten skriver register och partifiler i samma `writeSet`. `validatePartyRegistry()` kontrollerar i dag katalogerna mot posterna, `filnamn`-ordningen och de sju fältens värden mot partifilen — men inte att registret saknar andra fält, så ett fält som lagts till för hand på båda ställena passerar. Med nyckelkontrollen i steg 2.2 är innehållet låst till vad generatorn skriver; kvar utanför kontrollen är bara formatering och nyckelordning, som `parti.js` normaliserar vid nästa körning och som inte kan bära någon avvikande uppgift. C skulle täcka även det men kräver att `validate.js` kör hela `buildParties()` — tyngre än vad regeln behöver. Agentens bedömning i valet mellan A och C, öppen att ifrågasätta.

### 4. Sökvägen skrivs som literal i varje läsare
**Alternativ:** A) `path.join(..., 'derived', 'parti.json')` i varje fil; B) en exporterad konstant i `scripts/parti.js`
**Beslut:** A
**Motivering:** Befintlig konvention: `derived/riksdag.json` läses i dag som literal i `party-data.ts` och `http-smoke.js`, och `http-smoke.js` undviker avsiktligt att importera koden den testar. `party-data.ts` kan inte utan omväg importera en CommonJS-konstant från `scripts/`. Sex literaler är överblickbara, och steg 5.5 i verifieringen fångar en glömd.

### 5. README: regeln en gång, och en rad om den gamla adressen
**Alternativ:** A) bara regeln och den nya adressen; B) dessutom en rad om att filen ersätter `parti/index.json`
**Beslut:** B
**Motivering:** Användarbeslut i issuet: "worth a line in the README". Repot är publikt och CC0 och README har dokumenterat `parti/index.json` som hämtbar fil, så den som hämtar från GitHub behöver kunna slå upp varför adressen slutade fungera — det är historik som är sakinnehåll, inte spår av en redigering. Raden hålls till en mening; resten av avsnittet beskriver bara nuläget. Ingen omdirigering är möjlig på GitHub.

### 6. `validate:data` underkänner en kvarlämnad `data/parti/index.json`
**Alternativ:** A) ingen kontroll; B) `assert.ok(!fs.existsSync(...))` i `validatePartyRegistry()`
**Beslut:** B
**Motivering:** Agentens egen bedömning, öppen att ifrågasätta. Katalogkontrollen filtrerar på `isDirectory()`, så en fil som återskapas av en lokal körning med gammal kod, eller följer med i en dåligt löst merge, passerar obemärkt och skulle ligga kvar som ett andra, inaktuellt register i det publika repot. Kontrollen är en rad och ett deltest. Den nämner den gamla sökvägen, men som ett tekniskt villkor att slå upp, i samma anda som `legacyHtmlSlug`-undantaget strax under.

## Verifieringschecklista

- [ ] `data/derived/parti.json` finns och är byte-identisk med `HEAD:data/parti/index.json` (`git show ... | cmp`), och `data/parti/index.json` finns inte
- [ ] Varje läsare pekar på den nya sökvägen: `src/server/party-data.ts`, `scripts/validate.js`, `scripts/build-derived-data.js`, `scripts/riksdag-results.js`, `scripts/http-smoke.js`, `scripts/build-release.js`
- [ ] README har ett avsnitt `derived/` som säger att allt under `data/derived/` är genererat, listar båda filerna med sina generatorer och byggordningen `parti.js` → `build:derived-data`, och registrets avsnitt ligger under `derived/parti.json` med alla sju fält, deras optionalitet och en rad om den gamla adressen
- [ ] `src/types.ts` och `CLAUDE.md` nämner den nya sökvägen; `grep` enligt steg 5.5 träffar bara kontrollen i `validate.js`, dess test och README-raden
- [ ] `npm run validate:data` underkänner ett träd där `data/parti/index.json` finns kvar, och ett register med ett fält utanför `INDEX_KEYS_FROM_PARTY` (nya deltest i `validate.test.js`)
- [ ] `parti.test.js` kontrollerar att generatorn inte skapar `data/parti/index.json`
- [ ] Med flytten stagad ger `node scripts/parti.js` följt av `npm run build:derived-data` tyst `git diff --exit-code -- data`
- [ ] `npm run precommit` passerar, inklusive `validate:data`, `check:derived-data`, `build:release` och `test:http`
- [ ] Kantfall: ett tomt testträd utan `derived/` (som `scripts/fixtures/tree.js` skapar) — `writeFiles()` skapar katalogen, `parti.test.js` passerar oförändrat i övrigt
- [ ] Kantfall: `riksdag-results.test.js` skapar `derived/` innan det skriver registret för hand
