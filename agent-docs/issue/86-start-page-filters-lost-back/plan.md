# Plan: Issue #86 — Start page filters are lost after opening a party and going back

## Mål

Låt startsidans filtertillstånd — sökterm, valår, län, kommun, valtyp och sortering — leva i URL:ens query string, med förvalen utelämnade så att den ofiltrerade startsidan förblir `/`. Då överlever tillståndet att en läsare öppnar ett parti och går tillbaka (historiken bär URL:en), och en filtrerad vy blir länkbar: samma URL öppnad direkt ger samma lista, server-renderad. Antalet partier som fällts ut med "Visa fler" lämnas utanför (se designbeslut 6).

## Triagering

> Beslutsunderlag för detta issue.

| Fält | Värde |
|------|-------|
| **Blockeras av** | Inget |
| **Blockerar** | Inget |
| **Relaterade issues** | Inga (ingen öppen issue refererar #86; #57 rör Tailwind och berör inte startsidans logik) |
| **Omfattning** | 6 filer: `src/components/home/query.ts` (ny), `src/components/home/HomeContent.tsx`, `src/pages/index.tsx`, `scripts/home-query.test.js` (ny), `scripts/http-smoke.js`, `CLAUDE.md` |
| **Risk** | Medel (klientsidig routerkoppling i en komponent som i dag är ren React-state, och navigeringsbeteendet kan bara verifieras manuellt i webbläsare; hålls nere av att filter-/sorteringslogiken inte ändras och av att URL-tolkningen är en ren, testad modul) |
| **Komplexitet** | Medel |
| **Säker för junior** | Ja, med granskning — designbeslut 3–5 förklarar varför URL:en skrivs från state och inte tvärtom, och de manuella navigeringskontrollerna i fas 3 är obligatoriska |
| **Konfliktrisk** | Låg — samtliga befintliga planmappar hör till stängda issues; ingen öppen plan berör `src/components/home/` eller `src/pages/index.tsx` |

### Triagemässiga noteringar

- Inget projektbräde är konfigurerat (`agent-docs/github/project.json` saknas) och `agent-docs/github/info.json` finns inte, så ingen board-status eller release-gren att stämma av. Inga `release/*`-grenar finns; planen utgår från `main`.
- Issuet (öppet, inga etiketter, ingen tilldelad, inga kommentarer per 2026-08-29) anger uttryckligen att URL-riktningen är "the agent's suggestion, open to challenge". Acceptanskriterierna kräver dock en URL som återskapar vyn, vilket i praktiken avgör riktningen (se designbeslut 1).
- Ingen webbläsartestning finns i repot. Klientnavigeringen (bakåt, logotyp, omedelbart partiklick) verifieras därför manuellt som obligatorisk del av fas 3; att införa Playwright bedöms oproportionerligt för det här issuet och lämnas som en öppen fråga till användaren, inte som ett tyst beslut.

## Angreppssätt

I dag håller `HomeContent` (`src/components/home/HomeContent.tsx:29–31`) hela tillståndet i `useState`: `filters` seedas från `defaultFilters(valar)`, `order` från `defaultOrder`, `visible` från `PAGE_SIZE`. `update()` (rad 42) kör `pruneFilters` och nollställer `visible`. Startsidan (`src/pages/index.tsx:41`) renderas med `getServerSideProps` som bara läser `partyData.readHomeData()` och ignorerar `context.query`. När läsaren navigerar till `/parti/<filnamn>` och tillbaka monteras sidan om och allt börjar från förvalen.

Filter- och sorteringslogiken (`filtering.ts`, `sorting.ts`, `summary.ts`) är redan rena moduler med `node:test`-tester som `require`:ar `.ts`-filerna direkt (Node 24 type-stripping). URL-kodningen får samma form: en ny ren modul `query.ts` som översätter mellan query-parametrar och `{ filters, order }`, testad på samma sätt. Modulen får inte importera `next/router` eller något via `src/...`-baseUrl (Node löser inte det), och relativa runtime-importer måste bära `.ts`-ändelse — samma konvention som `sorting.ts` redan följer med `./summary.ts`.

Tre kopplingar behövs runt den modulen:

1. **Server → initialt tillstånd.** `getServerSideProps` tolkar `context.query` mot datans `valar`/`lan`/`kommuner` och skickar med `initial: { filters, order }` som prop. `HomeContent` seedar sina `useState` från `initial` i stället för från förvalen. Eftersom seeden kommer från props blir server-HTML och första klientrendering identiska, och en delad länk renderas filtrerad redan på servern — det är det som gör acceptanskriteriet "reproduces it when opened directly" mätbart i `http-smoke`.

2. **State → URL.** Lokalt state förblir sanningskällan (se designbeslut 3). Varje användaråtgärd som ändrar tillståndet — `update()`, sorteringsbytet och återställningen — serialiserar det nya tillståndet med förvalen utelämnade och skriver det omedelbart, i samma händelse, med `router.replace({ pathname: '/', query, hash }, undefined, { shallow: true, scroll: false })`. `shallow: true` hindrar att `getServerSideProps` körs om (hela partiregistret läses annars per tangenttryck), `scroll: false` hindrar att sidan hoppar till toppen vid varje filterändring, och `hash` läses ur `window.location.hash` i skrivögonblicket (sidhuvudets "Om tjänsten" är en vanlig fragmentlänk som routern inte ser) så `#om-tjansten` överlever. Skrivningen hoppas över när den normaliserade söksträngen redan är `window.location.search`; annars ersätts hela query stringen, så okända parametrar försvinner avsiktligt vid första användaråtgärden. Ingen fördröjning: URL:en är skriven innan nästa händelse kan inträffa, vilket är det som gör att en filterändring omedelbart följd av ett partiklick överlever bakåtnavigeringen (designbeslut 5). Ingen skrivning sker vid mount: en icke-kanonisk länk (`/?valar=2026`, okända parametrar) lämnas som den är tills läsaren rör något.

3. **Riktig navigering till `/` → nytt tillstånd.** Tillbaka-navigering från partisidan monterar `HomePage` på nytt, så seeden från props räcker där. Men en navigering från `/?valar=2018` till `/` via sidhuvudets logotyp (`Header.tsx:18`, `Link href="/"`) byter *inte* komponent — Next kör `getServerSideProps` igen och uppdaterar props, medan `useState` behåller det gamla tillståndet. Lösningen är att `HomePage` lyssnar på `router.events` `routeChangeComplete` och räknar upp en `generation` för varje icke-shallow ändring, som blir `key` på `HomeContent`; en riktig navigering till startsidan börjar då om från URL:en (designbeslut 4).

Tolkningen måste vara tolerant: okända eller ogiltiga värden (ett år datan saknar, en länskod som inte finns, `valtyp=eu`) faller tyst tillbaka till förvalet, arrayvärden (`?valar=2022&valar=2018`) behandlas som första värdet, och `pruneFilters` körs på resultatet så att `?valtyp=riksdag&lan=01` ger samma tillstånd som UI:t hade gett. Ingen redirect till kanonisk form görs — nästa filterändring skriver ändå om URL:en.

En kodningsdetalj som är lätt att missa: förvalet för valår är det *senaste* året, inte "alla". `valar: ''` (Alla valår) är alltså ett icke-förval och kan inte kodas som "parametern saknas". Därför får `valar` tre lägen: saknas → senaste året, `alla` → alla år, `<år>` → det året.

## Steg

### Fas 1: Ren URL-modul med tester

1. Skapa `src/components/home/query.ts`
   - `export interface HomeState { filters: HomeFilters; order: SortOrder }`
   - `export type HomeQuery = Record<string, string | string[] | undefined>` (formen `context.query`/`router.query` har, utan att importera `querystring`)
   - `export const ALL_YEARS = 'alla'` — token för "Alla valår"
   - `export function stateFromQuery (query: HomeQuery, data: Pick<HomeData, 'valar' | 'lan' | 'kommuner'>): HomeState`
     - `valar`: saknas eller ogiltigt → `defaultFilters(data.valar).valar`; `alla` → `''`; ett år i `data.valar` → det året
     - `valtyp`: `riksdag` | `region` | `kommun` (nycklarna i `electionKindLabels`), annars `''`
     - `lan`: kod som finns i `data.lan`, annars `''`; `kommun`: kod som finns i `data.kommuner`, annars `''`. Om `kommun` är giltig och `lan` saknas eller är ogiltig sätts `lan` till kommunens `HomeMunicipality.lan` (samma effekt som kommunväljarens `onChange` i `PartyFilters.tsx`, men från datan i stället för `kod.slice(0, 2)`); en giltig `lan` som inte är kommunens län lämnas åt `pruneFilters`, som då släpper kommunen
     - `q`: strängen som den är (ingen trimning; `normalise()` trimmar vid matchning), tom om den saknas
     - `sortering`: via `isSortOrder`, annars `defaultOrder`
     - Arrayvärden → första elementet; okända parametrar och hash ignoreras; slutligen `pruneFilters` på filtren
   - `export function queryFromState (state: HomeState, valar: string[]): Record<string, string>`
     - Fast nyckelordning `valar, valtyp, lan, kommun, q, sortering` så URL:en blir stabil
     - Regeln är "utelämna det som är lika med förvalet": `valar` utelämnas när det är `defaultFilters(valar).valar` (senaste året, eller `''` när datan saknar år — då skrivs aldrig `alla`), tomma strängar utelämnas, `sortering` utelämnas när den är `defaultOrder`; `valar=alla` skrivs för `''` bara när förvalet är ett år
     - `q` skrivs bara när `query.trim() !== ''`, och då som den är
   - Importera `./filtering.ts` och `./sorting.ts` med `.ts`-ändelse; `HomeData` bara som `import type`
   - Filer att skapa: `src/components/home/query.ts`
2. Skriv `scripts/home-query.test.js` i samma stil som `home-filtering.test.js`
   - Tom query → `{ filters: defaultFilters(valar), order: 'namn' }`
   - `valar=alla` → `valar: ''`; `valar=1900` (saknas i datan) → senaste året; `valar=2018` → `2018`
   - Ogiltig `lan`/`kommun`/`valtyp`/`sortering` faller tillbaka; giltiga går igenom
   - `kommun=1280` utan `lan` → `lan: '12'` (från `HomeMunicipality.lan`); `kommun=1280&lan=99` (ogiltigt län) → `lan: '12'`; `kommun=1280&lan=01` → kommunen prunas (läns­missmatch)
   - `valtyp=riksdag&lan=01` → `lan: ''` (pruning)
   - Arrayvärde tar första elementet; okända parametrar (`utm_source=x`) påverkar inget
   - `queryFromState` med förvalen ger `{}`; `valar: ''` ger `{ valar: 'alla' }` när datan har år men `{}` när `valar` är `[]`; `sortering` skrivs bara när den avviker; `q` av bara blanksteg skrivs inte, `q` med inre blanksteg skrivs som det är
   - Rundtur: för ett antal *kanoniska* tillstånd (kommun med sitt län, trimmad sökterm) gäller `stateFromQuery(queryFromState(s)) deepEqual s`; icke-kanoniska tillstånd (sökterm av bara blanksteg) testas som "serialiseras till `{}`" i stället
   - Filer att skapa: `scripts/home-query.test.js`

### Fas 2: Servern tolkar URL:en

1. Utöka `getServerSideProps` i `src/pages/index.tsx`
   - `const data = await partyData.readHomeData(); return { props: { ...data, initial: stateFromQuery(context.query, data) } }`
   - Ny typ `HomePageProps = HomeData & { initial: HomeState }`; `NextPage<HomePageProps>` och `GetServerSideProps<HomePageProps>`
   - `<link rel="canonical" href="https://www.partidata.se/">` lämnas oförändrad (designbeslut 8)
   - Filer att ändra: `src/pages/index.tsx` (rad ~10, ~41–43)

### Fas 3: Klienten seedar från och skriver till URL:en

1. Seed från props i `HomeContent`
   - Ta emot `initial` i props; `useState(initial.filters)` och `useState(initial.order)`
   - Behåll `defaultFilters(valar)` som `defaults` för "Rensa filter" — återställning ska gå till förvalen, inte till URL:ens startläge
   - Filer att ändra: `src/components/home/HomeContent.tsx` (rad ~27–31, ~59, ~71)
2. Skriv URL:en från state, i händelsehanterarna
   - `const router = useRouter()` (`next/router`); en `useRef<HomeState>` med senast begärda tillstånd och en `useRef` för en eventuell omförsökstimer
   - Hjälpfunktion `write (state: HomeState)`: spara `state` i ref:en; `search = new URLSearchParams(queryFromState(state, valar)).toString()`; om `search === new URLSearchParams(window.location.search).toString()` → returnera (ingen onödig routerhändelse); annars `router.replace({ pathname: '/', query: queryFromState(state, valar), hash: window.location.hash || undefined }, undefined, { shallow: true, scroll: false })`. Rejection: `error.cancelled` (routerns eget avbrott) ignoreras; annat fel loggas med `console.error` och en omförsökstimer (~1 s) skriver ref:ens senaste tillstånd — det är vad som händer när Safari vägrar `replaceState` (designbeslut 5)
   - `update(patch)`: beräkna `next = pruneFilters({ ...filters, ...patch })` från renderat state (händelserna är diskreta, så `filters` är aktuellt), `setFilters(next)`, `setVisible(PAGE_SIZE)`, `write({ filters: next, order })`
   - Sorteringsbytet: `setOrder(next)` följt av `write({ filters, order: next })`
   - Återställning: `update(defaults)` som i dag (sorteringen lämnas, designbeslut 9)
   - `useEffect` med enbart cleanup som rensar omförsökstimern vid unmount
   - Kommentaren vid omförsöket anger det tekniska skälet (webbläsares gräns för `history.replaceState`-anrop per tidsenhet) — inte produktresonemang
   - Filer att ändra: `src/components/home/HomeContent.tsx`
3. Börja om vid riktig navigering till startsidan
   - I `HomePage`: `useRouter()`, `const [generation, setGeneration] = useState(0)`, `useEffect` som registrerar `routeChangeComplete`-lyssnare `(url, { shallow }) => { if (!shallow) setGeneration(g => g + 1) }` och avregistrerar i cleanup; `<HomeContent key={generation} {...props} />`
   - Filer att ändra: `src/pages/index.tsx`
4. Manuell navigeringskontroll i `npm run dev` (obligatorisk — det finns ingen webbläsartestning i repot, och att införa Playwright för det här är oproportionerligt; kontrollerna är därför del av fasen, inte en efterhandsbonus)
   - Filter + sortering + sökterm, öppna parti, bakåt → allt står kvar
   - Byt ett select-/chip-värde och klicka på ett parti *omedelbart*, bakåt → ändringen står kvar
   - Skriv i sökfältet och klicka på första träffen *omedelbart* efter sista tangenttrycket, bakåt → hela söktermen står kvar (varje tangenttryck skrivs i sin egen händelse)
   - Från `/` välj 2018, klicka logotypen → listan står på senaste året och URL:en är `/`
   - Nätverksfliken: filterändringar ger inga `_next/data`-anrop; bakåtnavigering ger ett, som i dag
   - Sökfältet: markören hoppar inte, sidan scrollar inte vid ändring; `#om-tjansten` i URL:en överlever en filterändring
   - Verktyg: `run`-skillen eller chrome-devtools-MCP:n kan driva kontrollerna, men resultatet ska ändå läsas av en människa

### Fas 4: HTTP-smoke och dokumentation

1. Utöka `scripts/http-smoke.js`
   - Låt `standingParties()` returnera listan över år som har `partideltagande/partier.json` (inte bara katalognamn), och `assert.ok` att det finns minst två sådana år innan ett tidigare år (`years.at(-2)`) används
   - Läs varje partis `deltagande` ur `data/parti/<filnamn>/index.json` (samma källa som `readHomeData()`, via `facet()`-formen `riksdag`/`region`/`kommun`) så förväntade resultat kan räknas ut
   - Hämta `/?valar=<tidigare år>&valtyp=riksdag` och asserta resultatet, inte bara kontrollerna: `partyGridLinks` är lika med partierna vars `deltagande[<år>].riksdag` är sant, i svensk namnordning, första 48; rubriken räknar `>N av M<` med det antalet; `<option value="<år>" selected="">`; den tryckta chipen är just riksdagsvalet (`aria-pressed="true"[^>]*>Riksdagsval<`); `<link rel="canonical" href="https://www.partidata.se/">` finns kvar
   - Hämta `/?valar=<tidigare år>&sortering=kommuner&q=parti` och asserta: `<option value="kommuner" selected="">`, sökfältet renderas med `value="parti"`, rubriken räknar träffarna, och `partyGridLinks` är lika med de första 48 av träffarna (namn/förkortning/område innehåller "parti", normaliserat som i `normalise()` — diakritiska tecken bort, gemener) rangordnade på antal kommuner det året i fallande ordning, med stabil svensk namnordning (`comparePartyOrder`) inom lika antal; räkna fram listan i testet med samma regler, inte genom att importera `filtering.ts`/`sorting.ts` (smoke-testet ska vara oberoende av den kod det kontrollerar)
   - Hämta `/?valar=alla` och asserta `<option value="" selected="">Alla valår</option>` och att rubriken räknar `>M av M<` — utan år och utan andra filter släpper `matchesParticipation()` (`filtering.ts:104`) igenom alla partier, även de 31 utan registrerat deltagande — samt att `partyGridLinks` är de första 48 av hela registret i `comparePartyOrder`-ordning
   - Hämta `/?valar=1900&valtyp=eu` och asserta att senaste året är valt och ingen chip är `aria-pressed="true"` (ogiltiga värden faller tillbaka)
   - Hämta `/?valar=<senaste>` och asserta att `partyGridLinks` är identiska med `/`:s (förvalet i URL ger samma vy som `/`)
   - Filer att ändra: `scripts/http-smoke.js` (`standingParties()` rad ~30–45, assertioner efter rad ~160)
2. Notera konventionen i `CLAUDE.md`
   - En mening under "Stack": startsidans filter bärs i query strängen (`valar`, `valtyp`, `lan`, `kommun`, `q`, `sortering`), förval utelämnas, tolkningen bor i `src/components/home/query.ts`
   - Filer att ändra: `CLAUDE.md`

### Fas 5: Verifiering

1. `npm run precommit` (lint, typecheck, derived-data, validate:data, test, build:release, test:http)
2. Manuell kontroll i webbläsare enligt verifieringschecklistan nedan, inklusive Safari om tillgängligt (replaceState-gränsen)

## Filöversikt

| Fil | Åtgärd | Syfte |
|-----|--------|-------|
| `src/components/home/query.ts` | Skapa | Ren översättning query ⇄ `{ filters, order }`, förval utelämnade, `alla`-token, validering mot datan |
| `scripts/home-query.test.js` | Skapa | Tester för tolkning, serialisering och rundtur |
| `src/pages/index.tsx` | Ändra | `getServerSideProps` tolkar `context.query` → `initial`; `generation`-key på `HomeContent` vid icke-shallow navigering |
| `src/components/home/HomeContent.tsx` | Ändra | Seed från `initial`; effekt som skriver URL:en med shallow `router.replace` |
| `scripts/http-smoke.js` | Ändra | Assertioner på filtrerade URL:er, `alla`, ogiltiga värden och kanonisk `/` |
| `CLAUDE.md` | Ändra | En rad om URL-konventionen för startsidans filter |

## Berörda kodområden

- `src/components/home/`
- `src/pages/index.tsx`
- `scripts/http-smoke.js`, `scripts/home-*.test.js`

## Designbeslut

> Icke-triviala val gjorda under planeringen. Feedback välkommen; annars implementeras enligt dessa.

### 1. Tillståndet bärs i URL:ens query string
**Alternativ:** Query string vs `sessionStorage` vs Next-router-state
**Beslut:** Query string
**Motivering:** Acceptanskriterierna kräver en URL som återskapar en filtrerad vy när den öppnas direkt eller delas — det kan bara query stringen ge. `sessionStorage` hade löst bakåtnavigeringen men inte länkbarheten. Proveniens: användarbeslut via issuets acceptanskriterier; själva riktningen är i issuet markerad som agentförslag "open to challenge", men kriterierna låser den.

### 2. Parameternamn och `alla`-token
**Alternativ:** Parameternamn lika `HomeFilters`-nycklarna vs kortformer; "alla år" som tom parameter vs egen token
**Beslut:** `valar`, `valtyp`, `lan`, `kommun`, `q`, `sortering`; `valar=alla` för alla år; alla förval utelämnade
**Motivering:** Namnen följer fältnamnen i `HomeFilters` och issuets exempel (`?valar=2026&lan=…&valtyp=riksdag&q=…`), i svensk form som resten av datamodellen. `sortering` matchar väljarens `aria-label`. Förvalet för valår är det senaste året, så "alla år" är ett aktivt val som behöver ett eget värde; `alla` är läsbart och kan inte förväxlas med ett årtal. Kravet att `/` förblir kanonisk gör att förval måste utelämnas. Proveniens: `q`-namnet och principen "defaults omitted" är issuets; `sortering`-namnet och `alla`-tokenen är agentens bedömning — öppna att ifrågasätta.

### 3. Lokalt state förblir sanningskällan; URL:en skrivs från det
**Alternativ:** (a) `router.query` som enda källa och alla kontroller läser därifrån, (b) lokalt state som i dag, seedat från URL:en vid mount och skrivet till URL:en vid ändring
**Beslut:** (b)
**Motivering:** `router.replace` är asynkron. Med (a) blir sökfältet en kontrollerad input vars värde kommer en tick senare än tangenttrycket; React återställer då DOM-värdet till det gamla i mellantiden, vilket ger hoppande markör och tappade tecken vid redigering mitt i strängen. Med (b) svarar UI:t direkt som i dag och URL:en följer efter. Priset är att URL → state bara sker vid mount och vid riktig navigering (beslut 4), aldrig löpande — vilket är rätt, eftersom inget annat än den här komponenten skriver den URL:en. `replace` i stället för `push` så att varje tangenttryck inte blir en historikpost; bakåt från partisidan hamnar då på det senaste tillståndet. Proveniens: agentens bedömning — öppen att ifrågasätta.

### 4. Riktig navigering till `/` börjar om från URL:en via `key`
**Alternativ:** (a) Nyckla `HomeContent` på `router.asPath`, (b) nyckla på serialiserat `initial`-prop, (c) räkna upp en `generation` på icke-shallow `routeChangeComplete`
**Beslut:** (c)
**Motivering:** (a) monterar om vid varje egen shallow-skrivning (fokus i sökfältet försvinner per tangenttryck). (b) missar fallet där både gammalt och nytt `initial` är förvalen: `/` → shallow till `?valar=2018` → logotyp till `/` ger oförändrad key medan state fortfarande säger 2018. (c) reagerar exakt på det som ska nollställa: en navigering Next själv gjorde. Bieffekten är en renderingsram med gammalt state innan omstarten, vilket inte syns i praktiken. Proveniens: agentens bedömning — öppen att ifrågasätta.

### 5. Varje ändring skrivs omedelbart; en vägrad skrivning görs om efter en sekund
**Alternativ:** (a) Skriv i samma händelse vid varje ändring, (b) debounce på alla skrivningar, (c) debounce enbart för sökfältet
**Beslut:** (a), med omförsök vid fel
**Motivering:** Acceptanskriteriet kräver att historikposten är uppdaterad innan läsaren följer en partilänk. Både (b) och (c) lämnar en lucka där sista ändringen inte hunnit skrivas när partilänken klickas; med (a) finns ingen sådan lucka — `router.replace` för en shallow-ändring gör inga hämtningar och är klar långt innan nästa användarhändelse kan inträffa. Skälet att överväga en fördröjning alls är Safari, som begränsar `history.replaceState` till 100 anrop per 30 sekunder och kastar `SecurityError` däröver; det kräver ihållande skrivande i sökfältet i över 20 sekunder. När det ändå händer får `router.replace` en rejection: tillståndet i komponenten är oberört, felet loggas, och ett omförsök en sekund senare skriver det senaste tillståndet så att URL:en hinner ikapp innan läsaren rimligen har valt ett parti. Sista tangenttrycket har alltså alltid en skrivning på väg, utan att någon skrivning fördröjs i normalfallet. Proveniens: agentens bedömning — öppen att ifrågasätta; omförsöket kan strykas om Safari-gränsen bedöms försumbar.

### 6. Antalet utfällda partier ("Visa fler") lämnas utanför
**Alternativ:** `visa=<n>` i URL:en vs `sessionStorage` vs utanför scope
**Beslut:** Utanför scope; föreslå uppföljningsissue
**Motivering:** Issuet ställer upp `sessionStorage` och "dropped from scope" som likvärdiga. Nyttan av att återställa antalet är beroende av att även scrollpositionen återställs, vilket Nexts pages-router inte gör vid bakåtnavigering utan `experimental.scrollRestoration` — det hör ihop och bör göras i ett eget issue ("återställ utfällt antal och scrollposition vid bakåtnavigering") i stället för att halvgöras här. Acceptanskriterierna nämner inte antalet. Proveniens: användaren har gett båda alternativen; valet mellan dem är agentens bedömning.

### 7. Ogiltiga värden faller tyst tillbaka, ingen redirect
**Alternativ:** Redirect till kanonisk URL vid ogiltig/onormaliserad query vs tolerant tolkning utan redirect
**Beslut:** Tolerant tolkning; okända parametrar ignoreras och försvinner vid nästa skrivning
**Motivering:** En redirect på `/` för varje felformad länk kostar en rundtur och ger inget läsaren ser. Tolkningen mot datans faktiska år, län och kommuner garanterar att inget ogiltigt tillstånd når `filterParties`. Proveniens: agentens bedömning — öppen att ifrågasätta.

### 8. Kanonisk länk förblir `https://www.partidata.se/`
**Alternativ:** Kanonisk länk med query vs oförändrad
**Beslut:** Oförändrad
**Motivering:** Filtrerade vyer är samma sida; `/` som kanonisk är redan etablerat i `src/pages/index.tsx` och är ett acceptanskriterium. Proveniens: befintlig konvention och användarbeslut (issue #86).

### 9. "Rensa filter" lämnar sorteringen som den är
**Alternativ:** Återställningen nollställer även sorteringen vs bara filtren och söktermen, som i dag
**Beslut:** Som i dag — sorteringen lämnas
**Motivering:** `onReset` kallar `update(initialFilters)` och rör inte `order` (`HomeContent.tsx:59, 71`); knappen heter "Rensa filter" och sorteringen är inte ett filter. Konsekvensen är att URL:en efter en återställning blir `/` bara när sorteringen står på förvalet, annars `/?sortering=…` — vilket är korrekt, eftersom vyn då inte är den ofiltrerade förvalsvyn. Att låta återställningen även nollställa sorteringen är ett UX-beslut som inte fattats i issuet och därför inte görs här. Proveniens: befintlig konvention (`HomeContent.tsx`); huruvida den ska ändras är en öppen fråga för användaren.

## Verifieringschecklista

Automatiskt (`npm run precommit`):

- [ ] `scripts/home-query.test.js` täcker tolkning, serialisering, pruning, `alla`, tomt `valar` och rundtur för kanoniska tillstånd
- [ ] `http-smoke`: filtrerad URL ger filtrerat och sorterat grid i server-HTML, `alla` och ogiltiga värden faller rätt, `/?valar=<senaste>` är lika med `/`, kanonisk länk kvar (acceptanskriterium: en URL som återskapar vyn)
- [ ] `npm run precommit` grönt (acceptanskriterium)

Manuellt i webbläsare (obligatoriskt — navigeringsbeteendet har ingen automatisk täckning):

- [ ] Sätt valår, län, kommun, valtyp och sökterm, öppna ett parti, gå tillbaka: allt står kvar (acceptanskriterium)
- [ ] Ändra sortering till "Flest kommuner", öppna ett parti, gå tillbaka: sorteringen står kvar (acceptanskriterium)
- [ ] Byt ett select-/chip-värde och klicka på ett parti omedelbart, gå tillbaka: ändringen står kvar
- [ ] Kopiera URL:en för en filtrerad vy och öppna den i ett nytt fönster: samma lista och samma kontrollägen (acceptanskriterium)
- [ ] Ofiltrerad startsida har URL `/` utan query string; "Rensa filter" med förvald sortering tar tillbaka URL:en till `/` (acceptanskriterium)
- [ ] "Alla valår" ger `/?valar=alla` och återskapas från den URL:en
- [ ] `?kommun=1280` utan län: länet härleds och kommunväljaren visar kommunen; `?valtyp=riksdag&lan=01` ger Hela landet; `?valar=1900&valtyp=eu` ger förvalen
- [ ] Skriv i sökfältet: markören hoppar inte, inga tecken tappas, sidan scrollar inte till toppen vid filterändring; `#om-tjansten` överlever en filterändring
- [ ] Från `/?valar=2018`, klicka logotypen i sidhuvudet: listan står på senaste året och URL:en är `/`
- [ ] Nätverksfliken: inga `_next/data`-anrop vid filterändring; ett vid bakåtnavigering, som i dag
- [ ] Safari om tillgängligt: ihållande skrivning i sökfältet i en halv minut ger på sin höjd loggade fel, och URL:en hinner ikapp söktermen inom någon sekund efter att skrivandet upphört
