# Plan: Issue #26 — Publish a documented JSON interface for Partidata's data

## Mål

Sajten ska själv servera sin data som JSON på stabila, dokumenterade adresser: registret, varje partis registerfil, partideltagandet per valår, riksdagsresultaten per valår, härledningen för riksdagen och SCB:s områdeskoder. Regeln är en enda: `https://www.partidata.se/data/<sökväg>` är samma fil som `data/<sökväg>` i repot, byte för byte, för de filer som står på en allowlist. Svaren kommer ur samma `data/`-träd som sajten redan läser genom `src/server/party-data.ts` — ingen kopia under `public/`. Adresserna svarar på `GET`, `HEAD` och `OPTIONS`, med `Content-Type`, cache-huvuden, `ETag` och CORS för läsning från andra webbplatser; allt annat är 404 eller 405. En sida på `/data/` dokumenterar adresserna, fälten, källorna, versioneringsprincipen, licensvillkoren och visar exempel som alltid pekar på filer som finns. Partisidans "Registerdata (JSON)" pekar på Partidatas adress i stället för på GitHub. Kandidatfiler och annat med personuppgifter exponeras inte — de avgörs i #33.

## Triagering

> Beslutsunderlag för detta issue.

| Fält | Värde |
|------|-------|
| **Blockeras av** | Inget |
| **Blockerar** | Inget |
| **Relaterade issues** | #33 (kandidatlistor och personuppgifter — uttryckligen utanför; allowlisten får aldrig släppa igenom `kandidatlistor/`), #48 (stängt; valresultaten är importerade, så villkoret "när #48 är implementerat" är uppfyllt), #53/#55 (mergade; server-renderad app är grunden), #25 (README-uppdatering — README får ett stycke om adresserna här, resten lämnas till #25), #28/#57 (Bootstrap/Tailwind — dokumentationssidan ska inte bygga på `.table` ur Bootstrap), #21 (deltagande per valår på partisidan — samma filer, ingen kodöverlappning) |
| **Omfattning** | ~17 filer i `src/server/`, `src/pages/`, `src/components/`, `src/styles/`, `scripts/`, `next.config.ts`, `README.md`, `CLAUDE.md` |
| **Risk** | Medel |
| **Komplexitet** | Medel |
| **Säker för junior** | Ja — med ägarens granskning av allowlisten (fas 1) och licenstexten (fas 3) innan merge |
| **Konfliktrisk** | Låg (ingen öppen plan rör dessa filer; alla 17 befintliga planmappar hör till issues som är stängda enligt `gh issue view` 2026-08-30). #25 saknar plan men äger README; den här planen lägger ett stycke där och rör inte fälttabellerna |

### Triagemässiga noteringar

- Issuet är öppet med etiketten `enhancement`, utan ansvarig och utan kommentarer (`gh issue view 26`, 2026-08-30); `projectItems.totalCount` är 0 via GraphQL samma dag, så det finns ingen projektstatus att läsa. Inga blockerare nämns. Läs om issuet innan arbetet börjar — planen är skriven mot det tillståndet.
- Gränsen för vad som är publikt går vid filen, inte vid fältet: varje fält i `parti/<filnamn>/index.json` lämnas ut, inklusive handlagda extrafält (README tillåter godtyckliga snake_case-fält sedan #79). Det är samma gräns som redan gäller — repot är publikt och partisidan länkar filen på GitHub — men den ska stå uttalad i README-stycket (fas 5) så att den som lägger till ett fält vet att det publiceras. Personuppgifter hör inte hemma i partifilen; #33 avgör var sådana lagras, och planen där utesluter git.
- Källornas villkor, kontrollerade 2026-08-30: Valmyndigheten — "all data är fri att använda, förutsatt att du anger Valmyndigheten som källa", https://www.val.se/valresultat-och-statistik/statistik-och-data/om-var-oppna-data; SCB — "Vi använder licensen CC0 för dessa data, vilket innebär att du får använda och sprida eller tillgängliggöra sådana data utan krav på att ange källa", https://www.scb.se/vara-tjanster/oppna-data/ (SCB rekommenderar ändå "Källa: SCB"). Wikidata — CC0, https://www.wikidata.org/wiki/Wikidata:Licensing. Dessa URL:er och datumet skrivs in på licenssidan (designbeslut 7).
- Bakgrunden i issuet stämmer med `main` (`a7eff4f`): appen kör `output: 'standalone'` bakom nginx, `data/` kopieras in i `.release/` av `scripts/build-release.js` och läses vid request av `src/server/party-data.ts`. Det finns alltså redan en process som har filerna — det som saknas är en route som lämnar ut dem.
- Risken i det här issuet är inte teknisk utan innehållslig: `data/val/2018/kandidatlistor/gotenes-framtid.json` innehåller namn, ålder och hemvist. Därför är det en allowlist (bara namngivna filmönster släpps ut), inte en denylist, och både `node:test` och HTTP-smoke kontrollerar att just den filen ger 404. Vem som helst kan läsa den på GitHub redan i dag; det ändrar inte att sajten inte ska servera den.
- Valmyndighetens partisymboler (PNG i `data/parti/<filnamn>/`) kan vara varumärkesskyddade (`data/partisymboler/README.md`) och serveras redan på `/partisymbol/<filnamn>/<bild>`. De ligger utanför `/data/`; JSON-filens `partisymbol.filnamn` förklaras på dokumentationssidan tillsammans med adressen.
- `profil.json` (två partier i dag) innehåller Wikipedia-utdrag under CC BY-SA 4.0 och nyhetsrubriker, och dess innehåll avgörs i #68–#75/#77. Den lämnas utanför `/data/` i den här PR:en (designbeslut 3); partisidans knapp "Profildata (JSON)" fortsätter peka på GitHub.
- Inga wiki-länkar i issuet; ingen `wiki`-konfiguration.

## Angreppssätt

**Adressregeln.** `/data/<sökväg>` serverar `data/<sökväg>` ur det `data/`-träd processen startats med (`dataRoot` i `createPartyDataStore`, i drift `.release/data/`). Innehållet är filens byte, inte en omserialisering, så `sha256` på svaret är `sha256` på filen i repot vid samma tagg. Det gör "samma validerade sanningskälla" till något som går att kontrollera utifrån, och det är också vad dokumentationssidan säger: samma fil finns på `https://github.com/swedev/partidata/blob/v<version>/data/<sökväg>`.

**Allowlisten** är en ren modul, `src/server/data-resources.ts`, med en funktion som tar URL-segmenten och svarar med vilken resurs de betecknar — eller ingen. Den är den enda platsen som avgör vad som lämnas ut:

| Segment | Resurs |
|---------|--------|
| `derived/parti.json` | Registret (`PartiIndexEntry[]`) |
| `derived/riksdag.json` | Kammaren och de största partierna utanför riksdagen |
| `regioner/index.json` | Läns- och kommunkoder (SCB) |
| `parti/<filnamn>/index.json` | Ett partis registerfil; `<filnamn>` ska vara ett aktuellt eller tidigare `filnamn` i registret |
| `val/<åååå>/partideltagande/<fil>.json` | `partier`, `riksdag`, `region`, `kommun` eller `landsting` |
| `val/<åååå>/valresultat/riksdag.json` | Riksdagsresultatet det året |

Allt annat är "ingen resurs": `kandidatlistor/`, `profil.json`, PNG-filer, `parti/kodbyten.json`, `valresultat/riksdag-partikopplingar.json`, `val/<år>/valresultat/scb-tabeller.json`, kataloger, tomma segment, `..`, versaler, och varje segment som inte matchar `^[a-z0-9-]+$` (sista segmentet plus `.json`). Ordningen är avsiktlig: segmenten klassas *innan* någon sökväg byggs, sökvägen byggs ur den klassade resursen (`dataPath(resource)`) och inte ur indata, och `path.relative(path.resolve(dataRoot), path.resolve(dataRoot, ...dataPath(resource)))` kontrolleras vara en relativ sökväg utan `..` innan något läses — hängslen och livrem, som `readPartySymbol` gör med `path.basename`. Symlänkar finns inte i `data/` och ingår inte i hotbilden.

**Lagret** (`src/server/party-data.ts`) får `resolveDataResource(segments)` som returnerar en diskriminerad union i samma stil som `resolveParty`: `{ kind: 'file', body, etag }`, `{ kind: 'redirect', destination }` för ett tidigare `filnamn`, eller `{ kind: 'notFound' }`. Kroppen läses en gång per sökväg och hålls i en `Map<string, Promise<…>>` som de andra cacharna i lagret — datan ändras bara när processen startas om vid deploy. Cachen är bunden av datans storlek: alla allowlistade filer tillsammans är under 28 MB (hela `data/` inklusive PNG och kandidatfiler), varav `val/2026/partideltagande/kommun.json` är den största på 6,9 MB, så värsta fallet är knappt 28 MB mer RSS efter att allt hämtats en gång — i samma storleksordning som det parsade startsidedatat som redan ligger i minnet (designbeslut 13). `etag` är filens SHA-256 som citerad sträng, `"<64 hex>"`; den är stark eftersom svaret är filens byte. Lagret får också `readDataCatalog()` för dokumentationssidan, cachad i ett eget `dataCatalogPromise`: vilka valår som finns och vilka av deras filer, antalet partier i registret, och ett exempelparti — det parti med flest mandat i senaste kammaren som har ett `filnamn`, annars registrets första — så att sidans exempel aldrig är döda länkar.

**Routen** `src/pages/api/data/[...path].ts` följer `partisymbol`- och `sitemap`-routernas mönster, nådd genom en rewrite i `next.config.ts` från `/data/:path+` (ett eller flera segment; `/data/` är dokumentationssidan och matchas inte). `trailingSlash: true` lägger inte till snedstreck på adresser med filändelse — det är samma väg som `/partisymbol/<filnamn>/<bild>.png` och `/sitemap.xml` redan går, och smoke-testet hämtar dem utan avslutande snedstreck i dag. Routen:

- exporterar `config = { api: { bodyParser: false, responseLimit: false } }`: Next varnar annars för svar över 4 MB (`kommun.json` är 6,9 MB), och en avvisad skrivmetod ska inte få sin kropp parsad innan 405;
- svarar på `GET`, `HEAD` och `OPTIONS`; annan metod → 405 med `Allow: GET, HEAD, OPTIONS`;
- sätter `Access-Control-Allow-Origin: *` på *varje* svar — 200, 304, 308, 404, 405 — utan det ser en webbläsarklient ett nätverksfel i stället för statuskoden. `OPTIONS` → 204 med `Access-Control-Allow-Methods: GET, HEAD, OPTIONS`, `Access-Control-Allow-Headers: If-None-Match` och `Access-Control-Max-Age: 86400`, *oavsett* om adressen finns: en preflight frågar om metoden får användas, inte om resursen finns, och resursens status kommer i det riktiga anropet (designbeslut 12);
- `file` → 200 med `Content-Type: application/json; charset=utf-8`, `Content-Length`, `Cache-Control: public, max-age=3600`, `Vary: Accept-Encoding` (nginx gzippar JSON utan `gzip_vary on`, så appen säger själv att kroppen varierar med kodningen), `ETag`, `X-Partidata-Version: <process.env.PARTIDATA_VERSION>` och `Access-Control-Expose-Headers: ETag, X-Partidata-Version` (ETag är inte CORS-safelistad och syns annars inte i `fetch`). Matchar `If-None-Match` etaggen — jämför efter att `W/` och citattecken skalats av varje kommaseparerad post, eftersom nginx försvagar etaggen till `W/"…"` när den gzippar; en post utan citattecken matchar aldrig — → 304 med samma huvuden (`ETag`, `Cache-Control`, `Vary`, `X-Partidata-Version`, CORS) men ingen kropp. `HEAD` ger exakt 200-svarets huvuden inklusive `Content-Length` utan kropp;
- `redirect` → 308 med `Location: /data/parti/<nytt filnamn>/index.json`;
- `notFound` → 404 med `Content-Type: application/json; charset=utf-8` och kroppen `{"fel":"Okänd resurs"}`; en okänd metod på en okänd adress ger 405, metoden prövas först som i symbolrouten.

Ingenting i `deploy/partidata.se.conf` behöver ändras: `gzip_types` innehåller redan `application/json`, `X-Content-Type-Options: nosniff` sätts där, `Vary` sätts i appen, och CORS sätts i appen så att `npm run test:http` prövar samma sak som produktionen skickar. Routen är också nåbar direkt på `/api/data/<sökväg>` (som `/api/partisymbol/…` och `/api/sitemap` är i dag); den adressen dokumenteras inte och räknas inte som stabil.

**Dokumentationssidan** `src/pages/data/index.tsx` är en server-renderad sida med `Header`/`Footer` som de andra, `<title>Data – Partidata</title>` och canonical `https://www.partidata.se/data/`. Den läser katalogen i `getServerSideProps` och skriver, i den här ordningen: en ingress; *Adresser* — regeln och en tabell med resurserna ovan, där varje rad är en riktig länk (`/data/derived/parti.json`, `/data/parti/<exempel>/index.json`, ett block per valår med de filer som finns); *Fält* — per resurs: toppnivåformen (array eller objekt), en tabell med fält, typ, obligatoriskt/valfritt och en rad beskrivning, hur identiteterna hänger ihop (`uuid` i registret = `uuid` i partifilen = `parti_uuid` i valresultaten; `kod` = `PARTIKOD`; läns- och kommunkoder = `regioner/index.json`), 2018-filernas avvikelser (`landsting.json`, inget `partier.json`, region/kommun listar bara partier utanför `riksdag.json`), och länk till README-avsnittet på GitHub under den byggda versionens tagg för bakgrunden; *Hämta* — ett `curl`- och ett `fetch`-exempel mot exempelpartiet, vad huvudena betyder (`Cache-Control`, `ETag`/`If-None-Match` — och att etaggen kan vara `W/`-märkt när svaret är komprimerat —, `Vary`, `X-Partidata-Version`, CORS) och statuskoderna (200, 304, 308, 404, 405, 204 på `OPTIONS`); *Versionering* — principen i designbeslut 6; *Licens och villkor* — designbeslut 7; *Det som inte finns här* — kandidatlistor (#33), partisymboler (adress `/partisymbol/`, varumärkesförbehållet), `profil.json` och kopplingstabellerna (på GitHub). Sidan är statisk text plus katalogens listor; ingen klientkod. Stilen läggs i `src/styles/_data.scss` (`@use` från `app.scss`): en `.data-page`-behållare som återanvänder `.site-shell`/`.home-intro`/`.description`, egna tabell- och `<pre>`-stilar i profilens färger — inte Bootstraps `.table`, som #28 vill ta bort.

**Länkarna.** `Header` får en `current`-prop (`'partier' | 'data'`) så att den aktiva understrykningen inte längre är hårdkodad på "Partier"; navigationen blir "Partier" (`/`), "Data" (`/data/`), "Om tjänsten". GitHub-länken flyttar till dokumentationssidan; sidfoten har den redan under "Öppenhet", som får "Data som JSON" (`/data/`) överst. `ExportSection` på partisidan pekar "Registerdata (JSON)" på `/data/parti/<filnamn>/index.json` och får en textlänk till `/data/`; "Profildata (JSON)" och "Projektet på GitHub" står kvar. `api/sitemap.ts` tar med `/data/`.

**Tester.** Allowlisten testas som ren funktion (`scripts/data-resources.test.js`, mönster `scripts/home-segments.test.js`); lagret testas i `scripts/party-data.test.js` mot ett temporärt `data/`-träd som också innehåller en `kandidatlistor`-fil och en PNG, med assertion att båda ger `notFound`; HTTP-smoke prövar allt issuet räknar upp mot det riktiga registret. Stegen är ordnade så att bygget är grönt efter varje fas.

## Steg

### Fas 1: Allowlist och lager med tester

1. Skapa `src/server/data-resources.ts`
   - `export type DataResource = { kind: 'registry' } | { kind: 'derived-parliament' } | { kind: 'regions' } | { kind: 'party'; filnamn: string } | { kind: 'participation'; valar: string; fil: string } | { kind: 'results'; valar: string }`
   - `export const PARTICIPATION_FILES = ['partier', 'riksdag', 'region', 'kommun', 'landsting'] as const`
   - `export function classifyDataPath (segments: string[]): DataResource | undefined` — varje segment ska matcha `/^[a-z0-9-]+$/` (sista segmentet `/^[a-z0-9-]+\.json$/`), valår `/^\d{4}$/`; matcha mot tabellen i Angreppssätt; allt annat `undefined`
   - `export function dataPath (resource: DataResource): string[]` — segmenten tillbaka från resursen, så lagret bygger sökvägen ur den klassade resursen och inte ur indata
   - Inga importer från `src/` med alias; relativa importer med `.ts`-ändelse som `segments.ts`, så modulen går att `require` från `node:test`
2. Skapa `scripts/data-resources.test.js`
   - accepterar var och en av de sex resursformerna med rätt fält
   - avvisar: `[]`, `['derived']`, `['derived', 'parti.json', 'x']`, `['parti', 'moderaterna']`, `['parti', 'moderaterna', 'profil.json']`, `['parti', 'moderaterna', '0001-moderaterna.png']`, `['parti', 'kodbyten.json']`, `['val', '2018', 'kandidatlistor', 'gotenes-framtid.json']`, `['val', '2022', 'valresultat', 'scb-tabeller.json']`, `['val', '22', 'partideltagande', 'partier.json']`, `['val', '2022', 'partideltagande', 'ovrigt.json']`, `['valresultat', 'riksdag-partikopplingar.json']`, `['..', 'package.json']`, `['parti', '..', 'kodbyten.json']`, `['Derived', 'parti.json']`, `['derived', 'parti.JSON']`, `['derived', 'parti.json/']`, `['']`
   - `dataPath(classifyDataPath(s))` ger tillbaka `s` för varje accepterad form
3. Ändra `src/server/party-data.ts`
   - `export type DataResourceResolution = { kind: 'file'; body: Buffer; etag: string } | { kind: 'redirect'; destination: string } | { kind: 'notFound' }`
   - `resolveDataResource (segments: string[]): Promise<DataResourceResolution>` i det returnerade objektet: `classifyDataPath` → `notFound` vid `undefined`; för `party`: `index.current.has(filnamn)` → läs, `index.redirects.get(filnamn)` → `redirect` till `/data/parti/<filnamn>/index.json`, annars `notFound`; för `participation`/`results`: läs; ENOENT → `notFound` (år utan den filen, t.ex. `val/2026/valresultat/riksdag.json` eller `val/2022/partideltagande/landsting.json`). Läsningen går via en `Map<string, Promise<{ body: Buffer; etag: string } | undefined>>` nycklad på sökvägen; `etag` = `'"' + createHash('sha256').update(body).digest('hex') + '"'`. Innan läsning: `const root = path.resolve(dataRoot); const file = path.resolve(root, ...dataPath(resource)); const rel = path.relative(root, file);` och kräv `rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)`, annars `notFound`
   - `export interface DataCatalog { antalPartier: number; exempel: { filnamn: string; beteckning: string }; valar: Array<{ valar: string; partideltagande: string[]; valresultat: boolean }> }` och `readDataCatalog (): Promise<DataCatalog>`: åren från `electionYears()`; `partideltagande` = de av `PARTICIPATION_FILES` som finns i `val/<år>/partideltagande/` (samma ordning som listan); `valresultat` = `readParliamentResults()` har året; `exempel` = partiet med flest mandat i senaste kammaren (`readParliamentYears` sorterat, första året, största `mandat` med `filnamn`), annars registrets första post. Cachas i ett eget `dataCatalogPromise` bredvid `homeDataPromise` (som håller `HomeData` och inte ska återanvändas)
   - `assertHealthy` lämnas orörd
4. Utöka `scripts/party-data.test.js`
   - Rör inte `makeData()` — befintliga tester förutsätter att `valresultat` är `undefined` för `testpartiet`. Lägg en hjälpare `withDataFiles(dataRoot)` som *ovanpå* `makeData()` skriver `val/2018/partideltagande/riksdag.json`, `val/2022/valresultat/riksdag.json` (minimal `schema_version: 2`-fil med en röst- och mandatrad för `testpartiet`, i samma form som `partyElectionResults`-testet bygger), `regioner/index.json` och `derived/riksdag.json`; PNG:n och `val/2018/kandidatlistor/testpartiet.json` finns redan i `makeData()`. De nya testerna anropar `withDataFiles` och skapar ett eget lager, så inget befintligt test ser de nya filerna
   - `resolveDataResource(['derived', 'parti.json'])` ger `file` vars `body` är byte-lika med filen på disk och vars `etag` är `"` + sha256 + `"`
   - `['parti', 'testpartiet', 'index.json']` → `file`; `['parti', 'gamla-testpartiet', 'index.json']` → `redirect` till `/data/parti/testpartiet/index.json`; `['parti', 'okant', 'index.json']` → `notFound`
   - `['val', '2018', 'kandidatlistor', 'testpartiet.json']` → `notFound` trots att filen finns; `['parti', 'testpartiet', '9001-testpartiet.png']` → `notFound`; `['parti', 'testpartiet', 'profil.json']` → `notFound`
   - `['val', '2022', 'partideltagande', 'landsting.json']` → `notFound` (år utan filen); `['val', '2018', 'partideltagande', 'riksdag.json']` → `file`
   - `readDataCatalog()` listar 2018 med `['riksdag']` och `valresultat: false`, 2022 med `[]` och `valresultat: true`; `antalPartier` är 2; `exempel.filnamn` är det parti som har mandat i resultatfilen
5. `npm test && npm run typecheck`

### Fas 2: Routen och rewriten

6. Skapa `src/pages/api/data/[...path].ts`
   - `export const config = { api: { bodyParser: false, responseLimit: false } }`
   - Sätt `Access-Control-Allow-Origin: *` först, på alla svar
   - `OPTIONS` → 204 med `Access-Control-Allow-Methods: GET, HEAD, OPTIONS`, `Access-Control-Allow-Headers: If-None-Match`, `Access-Control-Max-Age: 86400`, `end()` — före resursuppslaget, för alla adresser (designbeslut 12)
   - annan metod än `GET`/`HEAD` → `Allow: GET, HEAD, OPTIONS`, 405, `end()`
   - Läs `request.query.path`; är det inte en `string[]` → 404 som nedan
   - `partyData.resolveDataResource(path)`: `notFound` → 404, `Content-Type: application/json; charset=utf-8`, kropp `{"fel":"Okänd resurs"}` (tom vid `HEAD`); `redirect` → `Location`, 308, `end()`
   - `file`: `Cache-Control: public, max-age=3600`, `Vary: Accept-Encoding`, `ETag`, `X-Partidata-Version` (bara när `process.env.PARTIDATA_VERSION` finns), `Access-Control-Expose-Headers: ETag, X-Partidata-Version`; om `matchesEtag(request.headers['if-none-match'], etag)` → 304, `end()`; annars `Content-Type: application/json; charset=utf-8`, `Content-Length`, 200, `end(request.method === 'HEAD' ? undefined : body)`
   - Lägg `matchesEtag (header: string | undefined, etag: string): boolean` som exporterad funktion i `src/server/data-resources.ts` så att den får ett test (fas 2 steg 8) i stället för att ligga inline
7. Ändra `next.config.ts`: lägg till `{ source: '/data/:path+', destination: '/api/data/:path+' }` i `rewrites()` efter `partisymbol`-raden
8. Utöka `scripts/data-resources.test.js` med `matchesEtag(header, etag)` där `etag` är den citerade strängen: `'"abc"'` → sant; `'W/"abc"'` → sant; `'"x", "abc"'` → sant; `' "abc" '` → sant; `'*'` → sant; `undefined`, `''`, `'"abd"'`, `'abc'` (utan citattecken), `'"ab'`, `'W/abc'` → falskt
9. `npm run build:release && npm run test:http` (befintliga assertions gröna) och `curl -i http://127.0.0.1:<port>/data/derived/parti.json` mot `.release/server.js` för att se svaret med egna ögon: 200 direkt, inte 308 med snedstreck — det är vad `trailingSlash` gör med filändelser i dag (`/sitemap.xml`, `/partisymbol/…png`), och smoke-testet i fas 6 låser det med `redirect: 'manual'`. Skulle det ändå bli 308: ta reda på varför innan något ändras (Next-versionens `trailingSlash`-regler, rewritens form), och först om orsaken är rewrite-ordningen flytta den till `beforeFiles` — och skriv orsaken i PR:en

### Fas 3: Dokumentationssidan, navigationen och sitemapen

10. Skapa `src/styles/_data.scss` och `@use "./data";` i `src/styles/app.scss`
    - `.data-page` (max-bredd ~`50rem` för löptext, `.data-page table` full bredd inom `.site-shell`), tabeller med `border-top: 2px solid var(--partidata-text)` och `1px solid var(--partidata-line)` mellan rader som `.participation-list`, `th` i `var(--partidata-navy)`, `code`/`pre` i `var(--font-partidata-mono)` med bakgrund `var(--partidata-soft)` och `overflow-x: auto`, `h2` med `margin-top: clamp(2.5rem, 6vw, 4rem)`
11. Skapa `src/pages/data/index.tsx`
    - `getServerSideProps` → `{ props: await partyData.readDataCatalog() }`
    - `<Head>`: `<title>Data – Partidata</title>`, `<meta name="description" content="Partidatas data som JSON: adresser, fält, källor, versionering och licens.">`, ikon och canonical som de andra sidorna
    - `<Header current="data" />`, `<main className="container data-page">`, `<Footer />`
    - Sektioner med `id` och `aria-labelledby` som partisidan: `#adresser`, `#falt`, `#hamta`, `#versionering`, `#licens`, `#utanfor`
    - *Adresser*: regeln som mening + `<code>https://www.partidata.se/data/&lt;sökväg&gt;</code>`; tabell Resurs / Adress / Innehåll med riktiga `<a href>`: `/data/derived/parti.json`, `/data/derived/riksdag.json`, `/data/regioner/index.json`, `/data/parti/{exempel.filnamn}/index.json` (med "byt ut mot partiets `filnamn` ur registret"), och per år i `valar` (senaste först) en rad per fil i `partideltagande` och en för `valresultat/riksdag.json` när den finns. Nämn att ett tidigare `filnamn` svarar 308 till det nuvarande, och att `{antalPartier}` partier finns i registret
    - *Fält*: per resurs en underrubrik (`<h3>`), toppnivåformen i en mening, en tabell Fält / Typ / Obligatoriskt / Beskrivning byggd ur `FIELD_DOCS` i `src/pages/data/fields.ts` (nästa punkt), och för `parti/<filnamn>/index.json` meningen "Fält som inte står i tabellen är handlagda extrafält (snake_case, valfritt JSON-värde) och är lika publika". Relationerna och 2018-avvikelserna enligt Angreppssätt. Bokstavskoderna (`grunder` A/R/K; `kandidatlistor` finns inte här, men `R`/`K` i `partideltagande` betyder deltagandegrund) skrivs ut. README-länkarna byggs som `https://github.com/swedev/partidata/blob/${process.env.PARTIDATA_VERSION ? \`v${version}\` : 'main'}/README.md#…` med ankarna `#partifilnamnindexjson`, `#valårpartideltagande`, `#valårvalresultatriksdagjson`, `#derivedpartijson`, `#regionerindexjson` — kontrollera ankarna mot GitHubs rendering av README (GitHub tar bort `\` och `<>` och gemenar)
    - *Hämta*: `<pre>` med `curl -i https://www.partidata.se/data/parti/{exempel.filnamn}/index.json` och ett `fetch(...).then(r => r.json())`; en lista över huvudena med en rad var (inklusive att `ETag` är `W/`-märkt när svaret levereras komprimerat och att `If-None-Match` ändå ger 304); statuskoderna 200/304/308/404/405 och 204 på `OPTIONS`; att alla svar bär `Access-Control-Allow-Origin: *`; att bara `GET`, `HEAD` och `OPTIONS` tillåts
    - Skapa `src/pages/data/fields.ts` med `FieldDoc = { namn: string; typ: string; obligatoriskt: boolean; beskrivning: string }` och `FIELD_DOCS` per resurs, och `scripts/data-fields.test.js` som läser ett riktigt exemplar av varje resurs ur `data/` (registret, `data/parti/moderaterna/index.json`, senaste årets `partideltagande/partier.json`, ett `valresultat/riksdag.json`, `regioner/index.json`, `derived/riksdag.json`) och kontrollerar att varje toppnivånyckel i exemplaret finns i `FIELD_DOCS` (extrafält i partifilen undantagna: nycklar som inte finns i `PARTY_KEY_ORDER` från `scripts/parti.js`) och att varje `obligatoriskt: true`-fält finns i exemplaret. Nästlade fält skrivs med punktnotation (`partisymbol.filnamn`, `rostresultat.partier[].parti_uuid`) och täcks av tabellen men inte av testet. Datan är sanningen, inte TypeScript-typerna, så testet behöver inte tolka `src/types.ts`
    - *Versionering*: texten i designbeslut 6, inklusive länkmönstret till GitHub-taggen
    - *Licens och villkor*: texten i designbeslut 7, med källornas URL:er och kontrolldatum utskrivna
    - *Det som inte finns här*: kandidatlistor (länk till #33), partisymboler (`/partisymbol/<filnamn>/<partisymbol.filnamn>`, varumärkesförbehållet), `profil.json` och kopplingstabellerna med länk till `data/` på GitHub
12. Ändra `src/components/Header.tsx`: `function Header ({ current = 'partier' }: { current?: 'partier' | 'data' })`; `<Link href="/" className={current === 'partier' ? 'site-header__active-link' : undefined}>Partier</Link>`, `<Link href="/data/" className={current === 'data' ? … }>Data</Link>`, `<a href="#om-tjansten">Om tjänsten</a>`. Ta bort "Data på GitHub". `src/pages/index.tsx` och `src/pages/parti/[filnamn].tsx` behöver inte ändras (förvalet är `partier`)
13. Ändra `src/components/Footer.tsx`: under "Öppenhet", ny första post `<li><Link href="/data/">Data som JSON</Link></li>` (importera `Link` från `next/link`)
14. Ändra `src/pages/api/sitemap.ts`: `new URL('/data/', baseUrl).toString()` efter startsidan
15. `npm run dev` och läs sidan på `/data/`: varje länk i adresstabellen svarar 200; `Header` visar "Data" understruket på `/data/` och "Partier" på `/`

### Fas 4: Partisidans länkar

16. Ändra `ExportSection` i `src/components/party-profile/sources.tsx`
    - `const dataUrl = \`/data/parti/${slug}/index.json\`` (encodeURIComponent på `slug` som symbolrouten gör)
    - Texten: "Källan står vid varje uppgift på sidan. Partiets registerdata finns som JSON på Partidata; alla datafiler är versionshanterade på GitHub." och en `<Link href="/data/">Så använder du datan</Link>` efter knapparna
    - `profileUrl` (GitHub) och "Projektet på GitHub" står kvar

### Fas 5: Dokumentation i repot

17. Ändra `README.md`: nytt stycke överst i "Tillgänglig data": registret, partifilerna, `partideltagande/`, `valresultat/riksdag.json`, `regioner/index.json` och `derived/` serveras som JSON på `https://www.partidata.se/data/<sökväg>` — samma sökväg som under `data/` — med länk till `https://www.partidata.se/data/` för adresser, huvuden och villkor; kandidatlistor och `profil.json` serveras inte; och att varje fält i en partifil, extrafält inräknade, publiceras där (allowlisten går vid filen, inte vid fältet). Ändra inte fälttabellerna (#25 äger resten av README)
18. Ändra `CLAUDE.md` under "Stack": en punkt om att `/data/<sökväg>` serverar en allowlistad delmängd av `data/` genom `src/pages/api/data/[...path].ts` (rewrite från `/data/`), att allowlisten bor i `src/server/data-resources.ts` och är det enda stället som avgör vad som lämnas ut, och att `/data/` är dokumentationssidan
19. `deploy/README.md` behöver ingen ändring; nämn i PR-bodyn att nginx-konfigurationen är oförändrad och varför

### Fas 6: HTTP-smoke och verifiering

20. Utöka `scripts/http-smoke.js` (efter sitemap-blocket)
    - Hjälpare `expectDataHeaders(response, { etag, length, body = true })` som kontrollerar hela huvuduppsättningen på ett ställe: `content-type` = `application/json; charset=utf-8` när `body` är sant (200 och `HEAD` — `HEAD` bär 200-svarets huvuden; 304 utelämnar det), `content-length` = `length` när den anges, `cache-control` = `public, max-age=3600`, `vary` = `Accept-Encoding`, `etag` = `etag`, `x-partidata-version` = `version`, `access-control-allow-origin` = `*`, `access-control-expose-headers` innehåller både `ETag` och `X-Partidata-Version`
    - `registry = await fetch(\`${baseUrl}/data/derived/parti.json\`, { redirect: 'manual' })`: exakt 200 (ingen 308 från `trailingSlash`); `expectDataHeaders`; `etag` matchar `/^"[0-9a-f]{64}"$/` och är sha256 av `fs.readFileSync('data/derived/parti.json')`; kroppen är byte-lika med filen (`Buffer.equals`)
    - samma URL med `If-None-Match: <etag>` → 304 utan kropp och med `expectDataHeaders(…, { body: false })`; med `W/<etag>` → 304; med `If-None-Match: abc` (ociterat) och med `"<annan sha>"` → 200
    - `HEAD` → 200, `expectDataHeaders` med `length` = filens storlek, tom kropp
    - var och en av `POST`, `PUT`, `PATCH`, `DELETE` → 405 med `allow` = `GET, HEAD, OPTIONS` och `access-control-allow-origin` = `*`
    - `OPTIONS` på registret → 204 med `access-control-allow-origin` = `*`, `access-control-allow-methods` = `GET, HEAD, OPTIONS`, `access-control-allow-headers` innehåller `If-None-Match`, `access-control-max-age` = `86400`; `OPTIONS` på `/data/finns-inte.json` → också 204 med samma huvuden (designbeslut 12)
    - `/data/parti/${current.filnamn}/index.json` → 200 och `JSON.parse` ger `uuid === current.uuid`; `/data/parti/${previous.tidigare_filnamn[0]}/index.json` med `redirect: 'manual'` → 308 till `/data/parti/${previous.filnamn}/index.json` med `access-control-allow-origin` = `*`; `/data/parti/finns-inte/index.json` → 404, `content-type` JSON, kroppen parsear till `{ fel: 'Okänd resurs' }`, `access-control-allow-origin` = `*`
    - exakt 404 för var och en av: `/data/val/2018/kandidatlistor/gotenes-framtid.json` (kontrollera med `fs.existsSync` först; saknas filen → `assert.fail` med instruktion att peka på en annan kandidatfil, så att testet aldrig blir tomt), `/data/parti/${withSymbol.filnamn}/${withSymbol.partisymbol.filnamn}`, `/data/parti/${profiled.filnamn}/profil.json` (där `profiled` är ett parti vars `profil.json` finns — hoppa med en logg om inget finns), `/data/parti/kodbyten.json`, `/data/valresultat/riksdag-partikopplingar.json`, `/data/derived/`, `/data/%2e%2e/package.json`, `/data/parti/%2e%2e/kodbyten.json`, `/data/derived%2fparti.json`, `/data/derived/parti.json%00`, `/data/DERIVED/parti.json`. `%2e%2e` avkodas till `..` av Next och faller på segmentregexen; `%2f` blir ett segment med `/`, faller på samma; `%00` likaså. För adresser Next själv kan normalisera med en 308 innan routen nås — `/data/derived`, `/data/derived//parti.json`, `/data/derived/parti.json/` — och för en rå `http.request` med `path: '/data/../package.json'` (fetch normaliserar `..` innan sändning) är kravet i stället: följ högst en redirect inom `/data/`, och slutsvaret får inte vara 200 med JSON-kropp. Det som låses är att inget läcker, inte vilken kod ramverket väljer
    - `/api/data/derived/parti.json` → 200 (routens egen adress fungerar men dokumenteras inte)
    - `/data/val/${latest}/partideltagande/partier.json` → 200 och parsear till samma längd som filen; `/data/val/${results.at(-1).valar}/valresultat/riksdag.json` → 200; `/data/val/${latest}/valresultat/riksdag.json` → 404 om filen saknas för det året (som 2026 i dag), annars 200
    - `/data/` → 200; `<title[^>]*>Data – Partidata</title>`; plocka ut alla `href="/data/[^"]+"` ur sidan (mönster `partyGridLinks`) och `fetch` var och en med `redirect: 'manual'` → exakt 200 — det är "fungerande exempel" i acceptanskriteriet; sidan innehåller `Access-Control-Allow-Origin` och `CC0`
    - sitemapen innehåller `/data/`; `profileBody` innehåller `href="/data/parti/${current.filnamn}/index.json"` och inte `github.com/swedev/partidata/blob/main/data/parti/${current.filnamn}/index.json`; `homeBody` innehåller `href="/data/"` i navigationen
21. `npm run precommit`
22. Manuell kontroll mot `.release/server.js`: `ps -o rss` på processen direkt efter `/api/health`, sedan efter att varje länk på `/data/` hämtats en gång (loopa `href`-listan från steg 20 med `curl -o /dev/null`), sedan en gång till. Godkänt: ökningen mellan första och andra mätningen är under 60 MB (datan är 28 MB; utrymme för Buffer-overhead) och under 5 MB mellan andra och tredje (cachen växer inte per anrop; RSS rör sig ändå något med GC). `curl -i` på `/data/val/2026/partideltagande/kommun.json` två gånger — andra svaret ska komma ur cachen. Skriv siffrorna i PR:en. CORS i praktiken: starta en andra lokal HTTP-origin (`python3 -m http.server 8080` i en tom katalog med en `index.html` som kör `fetch('http://127.0.0.1:<port>/data/derived/parti.json').then(r => r.json()).then(d => console.log(d.length))`) och öppna `http://127.0.0.1:8080/` — två `http`-origins, så varken mixed content eller Private Network Access stör. Efter deploy: samma `fetch` mot `https://www.partidata.se/data/derived/parti.json` från devtools på en annan `https`-sida, plus `curl --compressed -i` och `curl -H 'Accept-Encoding: identity' -i` mot produktionsadressen för att se att nginx ger `Content-Encoding: gzip` respektive okomprimerat med samma `Vary` och en `W/`-etag i det komprimerade fallet

## Filöversikt

| Fil | Åtgärd | Syfte |
|-----|--------|-------|
| `src/server/data-resources.ts` | Skapa | Allowlisten: `classifyDataPath`, `dataPath`, `matchesEtag` |
| `scripts/data-resources.test.js` | Skapa | `node:test` för allowlisten och etag-jämförelsen |
| `src/server/party-data.ts` | Ändra | `resolveDataResource`, `readDataCatalog`, filcache med SHA-256 |
| `scripts/party-data.test.js` | Ändra | Lagrets nya metoder mot ett temporärt träd med kandidatfil och PNG |
| `src/pages/api/data/[...path].ts` | Skapa | Routen: metoder, CORS, cache, ETag/304, 308, 404 |
| `next.config.ts` | Ändra | Rewrite `/data/:path+` → `/api/data/:path+` |
| `src/pages/data/index.tsx` | Skapa | Dokumentationssidan, server-renderad ur katalogen |
| `src/pages/data/fields.ts`, `scripts/data-fields.test.js` | Skapa | Fältdokumentationen som typad lista, med test mot riktiga exemplar i `data/` |
| `src/styles/_data.scss`, `src/styles/app.scss` | Skapa / Ändra | Sidans tabell- och kodstilar |
| `src/components/Header.tsx` | Ändra | `current`-prop; "Data" → `/data/`; GitHub-länken bort ur navigationen |
| `src/components/Footer.tsx` | Ändra | "Data som JSON" under Öppenhet |
| `src/components/party-profile/sources.tsx` | Ändra | `ExportSection` pekar på `/data/parti/<filnamn>/index.json` |
| `src/pages/api/sitemap.ts` | Ändra | `/data/` i sitemapen |
| `scripts/http-smoke.js` | Ändra | 200/304/404/405/OPTIONS, content-type, CORS, etag, kandidatfil, partisidans länk |
| `README.md` | Ändra | Stycke om adresserna i "Tillgänglig data" |
| `CLAUDE.md` | Ändra | Punkt om `/data/`-routen och allowlisten |

## Berörda kodområden

- `src/server/`
- `src/pages/api/`
- `src/pages/data/`
- `src/components/` (Header, Footer, party-profile/sources)
- `src/styles/`
- `scripts/` (tester och HTTP-smoke)
- `next.config.ts`, `README.md`, `CLAUDE.md`

## Designbeslut

> Icke-triviala val gjorda under planeringen. Feedback välkommen; annars implementeras enligt dessa.

### 1. Adressen är repots sökväg: `/data/<sökväg>` ⇔ `data/<sökväg>`
**Alternativ:** A) spegla filträdet under `/data/` — B) ett eget REST-liknande schema (`/api/partier/`, `/api/partier/<uuid>/`) med omserialiserade svar
**Beslut:** A
**Motivering:** Issuet ber om en sida på `/data/` och om svar ur samma validerade filer som sajten läser (användarbeslut, #26). Med A är dokumentationen en regel plus en lista, versioneringen blir "samma fil på GitHub under taggen", och svaret går att verifiera byte för byte. B skulle kräva en andra representation att dokumentera, validera och hålla i synk. Att svaren är filens byte och inte `JSON.stringify(JSON.parse(...))` är agentens bedömning — öppen, men det är vad som gör `ETag = sha256(fil)` sant.

### 2. Allowlist i en ren modul, inte en denylist i routen
**Alternativ:** A) `classifyDataPath` räknar upp de filmönster som lämnas ut — B) servera allt under `data/` utom `kandidatlistor/` och PNG
**Beslut:** A
**Motivering:** Kandidatfiler får inte exponeras (användarbeslut, #26 och #33). En denylist faller åt fel håll när en ny katalog dyker upp i `data/`; en allowlist faller stängt. Att modulen är ren och testad följer konventionen från `segments.ts`/`query.ts` med `node:test` i `scripts/`.

### 3. `profil.json` lämnas utanför `/data/` i den här PR:en
**Alternativ:** A) servera `parti/<filnamn>/profil.json` också — B) inte i den här PR:en
**Beslut:** B
**Motivering:** Agentens bedömning — öppen. Issuets uppräkning är registret, partiernas registerdata, deltagande och valresultat; profilen nämns inte. Filen bär Wikipedia-utdrag (CC BY-SA 4.0) och nyhetsrubriker, finns för två partier, och dess innehåll avgörs i #68–#75/#77. Att ta med den skulle göra licensavsnittet villkorat per fält innan innehållet är bestämt. Partisidans knapp "Profildata (JSON)" fortsätter peka på GitHub; när profilen är fastlagd är det en rad i allowlisten och en rad på sidan.

### 4. `derived/riksdag.json` och `regioner/index.json` tas med
**Alternativ:** A) bara det issuet räknar upp — B) också härledningen och områdeskoderna
**Beslut:** B
**Motivering:** Agentens bedömning — öppen. `regioner/index.json` behövs för att läsa `deltagande.region`/`kommun` och `partideltagande/region.json`; utan den är deltagandet koder utan namn. `derived/riksdag.json` är den dokumenterade härledning startsidan bygger på (`docs/riksdagsvalresultat.md`), genererad ur filer som redan serveras. Kopplingstabellerna (`kodbyten.json`, `riksdag-partikopplingar.json`) och `scb-tabeller.json` är arbetsmaterial för importen och stannar på GitHub.

### 5. `Cache-Control: public, max-age=3600` med stark `ETag` och 304
**Alternativ:** A) `max-age=3600` + ETag — B) `max-age=300` som sitemapen — C) `no-cache` med enbart ETag
**Beslut:** A
**Motivering:** Agentens bedömning — öppen. Datan ändras bara vid deploy, så en timme är en förutsägbar övre gräns för "hur gammalt kan ett svar vara", vilket är vad issuet ber om att dokumentera; symbolrouten använder redan samma värde (befintlig konvention, `src/pages/api/partisymbol/[filnamn]/[bild].ts`). ETag/304 gör en omhämtning billig för klienter som pollar. En ny release bör i PR-bodyn nämnas som "syns inom en timme".

### 6. Versioneringsprincip
**Alternativ:** A) versionen i svaret (`X-Partidata-Version`) + regeln "tillägg utan förvarning, borttag med notis och 308" — B) versionerade adresser (`/data/v1/…`)
**Beslut:** A
**Motivering:** Agentens bedömning — öppen; issuet ber om att en princip dokumenteras men säger inte vilken. Principen som skrivs på sidan: (1) adresser och fältnamn är stabila och nya fält kan tillkomma utan förvarning — en läsare ska ignorera okända fält; (2) datan ändras bara vid en release, versionen står i `X-Partidata-Version`, i sidfoten och i `/api/health`, och samma filer finns på `https://github.com/swedev/partidata/tree/v<version>/data/`; (3) ett fält eller en adress som tas bort eller döps om görs i en release som noteras på `/data/`, och en flyttad adress vidarebefordras (308) när det går — som `parti/index.json` → `derived/parti.json` redan beskrivs i README. B skulle låsa fast en `v1` innan gränssnittet har haft en läsare.

### 7. Licensavsnittet: CC0 för sammanställningen, källvillkor per ursprung
**Alternativ:** A) "allt är CC0" — B) CC0 för Partidatas sammanställning och struktur, med källornas villkor uttryckligen per ursprung
**Beslut:** B
**Motivering:** Användarbeslut i #26 ("document which parts are covered by CC0 and which assets or sources carry other terms"). Texten: Partidatas sammanställning — struktur, `uuid`, `filnamn`, härledda fält, `derived/` — är CC0 1.0 (`LICENSE`, `package.json`). Valmyndighetens uppgifter är fria att använda med Valmyndigheten som källa (`data/partisymboler/README.md` citerar villkoret), och `kalla`/`kallurl`/`kallor` i filerna anger källan per post. Wikidata (`wikidata.grundat`) är CC0 enligt https://www.wikidata.org/wiki/Wikidata:Licensing. Villkoren är kontrollerade 2026-08-30 och skrivs på sidan med URL och datum: Valmyndigheten, https://www.val.se/valresultat-och-statistik/statistik-och-data/om-var-oppna-data — "fri att använda, förutsatt att du anger Valmyndigheten som källa"; SCB, https://www.scb.se/vara-tjanster/oppna-data/ — CC0, utan krav på källa, med rekommendationen "Källa: SCB". Implementeraren läser båda sidorna igen vid implementationen och uppdaterar datumet. Partisymboler serveras inte under `/data/` och kan vara varumärkesskyddade. `profil.json` (Wikipedia CC BY-SA 4.0, nyhetsrubriker) serveras inte (beslut 3). Kandidatuppgifter publiceras inte (#33).

### 8. CORS-huvud på alla svar, `OPTIONS` besvaras
**Alternativ:** A) `Access-Control-Allow-Origin: *` bara på 200 — B) på alla svar från routen, och `OPTIONS` → 204 med tillåtna metoder
**Beslut:** B
**Motivering:** Issuet kräver läsning från andra webbplatser utan att öppna skrivmetoder (användarbeslut). Utan huvudet på 404/405/308 får en webbläsarklient inte se statuskoden. `OPTIONS` är inget skrivande, och en klient som skickar `If-None-Match` från ett skript triggar preflight. Att sätta CORS i appen och inte i nginx är agentens bedömning: då prövar `npm run test:http` samma huvuden som produktionen skickar.

### 9. Dokumentationssidan är en server-renderad TSX-sida ur katalogen; fältkontraktet står på sidan, bakgrunden i README
**Alternativ:** A) statisk TSX med hårdkodade exempel — B) TSX som läser katalogen så att exempel och årslistor alltid stämmer, med fälttabeller (namn, typ, obligatoriskt) som kontrakt och länk till README för bakgrunden — C) hela README-fältdokumentationen flyttad till sidan
**Beslut:** B
**Motivering:** Agentens bedömning — öppen. Sidan ska ha fungerande exempel (användarbeslut, #26); med katalogen kan ett exempel inte peka på ett år eller parti som inte finns, och `standingParties`-mönstret i smoke-testet visar att projektet föredrar tester som räknar ut det förväntade ur datan. Fälttabellerna på sidan säger vad en läsare kan lita på — typ och obligatoriskt, som README inte anger — och testet mot riktiga exemplar i `data/` håller dem i takt med datan på toppnivå; nästlade strukturer (`partisymbol.bild`, `deltagande.<år>`, `kallor[]`, `rostresultat.partier[]`) dokumenteras med punktnotation i samma tabell men kontrolleras inte av testet, vilket är en känd begränsning. README behåller prosan om vad fälten betyder och hur de uppstår. C tömmer README, som #25 arbetar med; A ger döda länkar nästa gång ett parti byter `filnamn`.

### 10. Navigationen: "Data" ersätter "Data på GitHub"; sidfoten får "Data som JSON"
**Alternativ:** A) lämna navigationen, länka bara från partisidan — B) "Data" → `/data/` i huvudnavigationen, GitHub-länken kvar i sidfoten och på sidan
**Beslut:** B
**Motivering:** Agentens bedömning — öppen. Issuet ber bara om partisidans länk. Men en dokumentationssida som ingen navigation leder till hittas inte, och "Data på GitHub" i navigationen är den plats dagens läsare redan letar efter datan på. GitHub-länken försvinner inte: sidfoten har den, och `/data/` länkar dit per resurs.

### 11. 404-kroppen är JSON, `{"fel":"Okänd resurs"}`
**Alternativ:** A) tom kropp som symbolrouten — B) en liten JSON-kropp
**Beslut:** B
**Motivering:** Agentens bedömning — öppen. En klient som gör `r.json()` på ett fel får något att visa; svenskt fältnamn enligt konventionen i CLAUDE.md. Symbolrouten är ett bildsvar och behöver ingen kropp.

### 12. `OPTIONS` svarar 204 för alla adresser under `/data/`, även okända
**Alternativ:** A) slå upp resursen först och svara 404 på `OPTIONS` mot en okänd adress — B) 204 med tillåtna metoder oavsett adress
**Beslut:** B
**Motivering:** Agentens bedömning — öppen. En preflight frågar "får den här metoden användas här", inte "finns resursen"; resursens status kommer i det riktiga anropet, som bär CORS-huvudet. Att slå upp resursen i preflighten skulle bara flytta 404:an ett steg tidigare och göra webbläsarens felmeddelande sämre (en preflight som misslyckas syns som ett CORS-fel, inte som 404). Smoke-testet låser beteendet så att det är ett val och inte en bieffekt.

### 13. Hela filen cachas i minnet per sökväg
**Alternativ:** A) cacha kropp och etag för alla allowlistade filer — B) cacha bara etag och läs stora filer från disk varje gång — C) strömma alltid, räkna etag vid start
**Beslut:** A
**Motivering:** Agentens bedömning — öppen. Cachen är bunden av datan (under 28 MB totalt, 6,9 MB största fil) och växer inte per anrop; det är samma storleksordning som `HomeData` och resultatfilerna som redan hålls parsade. B sparar minne men ger disk-I/O på den största filen vid varje träff; C komplicerar 304-vägen. Steg 22 mäter och sätter gränsen 60 MB RSS-ökning; överskrids den byts till B i samma PR.

## Verifieringschecklista

- [ ] `GET /data/derived/parti.json` och `GET /data/parti/<filnamn>/index.json` ger 200, `application/json; charset=utf-8`, och kroppen är byte-lika med filen i repot
- [ ] `ETag` är filens SHA-256; `If-None-Match` (även `W/`) ger 304 med samma huvuden; ociterade eller fel etaggar ger 200
- [ ] `Cache-Control: public, max-age=3600`, `Vary: Accept-Encoding` och `X-Partidata-Version` = `package.json`-versionen; `HEAD` bär samma huvuden och `Content-Length`
- [ ] `Access-Control-Allow-Origin: *` på 200, 304, 308, 404 och 405; `OPTIONS` → 204 med `GET, HEAD, OPTIONS` även på okänd adress; `POST`/`PUT`/`PATCH`/`DELETE` → 405 med `Allow`
- [ ] Tidigare `filnamn` → 308 till nuvarande; okänt `filnamn` → 404 med JSON-kropp
- [ ] Exakt 404 för `val/<år>/kandidatlistor/*.json`, `profil.json`, PNG, `kodbyten.json`, `riksdag-partikopplingar.json`, `scb-tabeller.json`, kataloger, `..`/`%2e%2e`, `%2f`, `%00`, dubbla snedstreck och versaler
- [ ] Svaret från `/data/derived/parti.json` är 200 direkt (ingen `trailingSlash`-308); `responseLimit` avstängd så att `kommun.json` inte varnar
- [ ] Fälttabellerna på `/data/` täcker varje toppnivånyckel i riktiga exemplar ur `data/` (test), och README-stycket säger att alla fält i partifilen publiceras
- [ ] `/data/` renderar; varje länk i adresstabellen svarar 200; exemplen kan klistras in och köras; licens- och versioneringsavsnitten finns
- [ ] Partisidans "Registerdata (JSON)" pekar på `/data/parti/<filnamn>/index.json`; "Profildata (JSON)" pekar fortfarande på GitHub
- [ ] "Data" i huvudnavigationen och "Data som JSON" i sidfoten; sitemapen innehåller `/data/`
- [ ] `fetch` från en annan origin i en webbläsare läser registret (CORS i praktiken)
- [ ] RSS-ökning efter att alla resurser hämtats en gång under 60 MB och under 5 MB vid andra varvet; svarstid på `kommun.json` (6,9 MB) noterad i PR:en
- [ ] Efter deploy: `curl --compressed` och `Accept-Encoding: identity` mot produktionen ger gzip respektive okomprimerat, båda med `Vary`, och `W/`-etag i det komprimerade fallet
- [ ] `npm test` täcker allowlisten (accepterade och avvisade former), `matchesEtag`, lagrets `file`/`redirect`/`notFound` och katalogen
- [ ] `npm run precommit` grönt; nginx-konfigurationen oförändrad
