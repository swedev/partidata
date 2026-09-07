# Plan: Issue #100 — Publish data changes without a release

## Mål

I dag når en ändring under `data/` partidata.se bara genom en full release: `package.json` höjs, en `v*`-tagg pushas, `deploy.yaml` bygger den fristående appen, rsyncar `.release/` och startar om tjänsten. De flesta ändringar på `main` är ren data — ett parti som skickar in sina länkar (#99) — och en versionshöjning per sådan ändring är brus.

Ett separat workflow, `publish-data.yaml`, ska publicera enbart datan: det körs vid push till `main` som rör `data/**` (och vid `workflow_dispatch`), kör `npm run validate:data` och `npm run check:derived-data`, rsyncar `data/` till `$TARGET/data/` på produktionsvärden med den befintliga deploy-nyckeln, startar om `partidata.service` så att serverns modul-cacher släpper de gamla filerna, och delar concurrency-gruppen `production-deploy` så att det aldrig går omlott med en release. Servern får veta vilken commit datan kommer från, `/api/health` och `/data/`-sidan anger den, och `deploy/README.md`, `CLAUDE.md` och `/data/`-sidans versioneringsavsnitt skrivs om så att de säger det som blir sant: dataändringar går live vid merge, kodändringar behöver fortfarande en tagg, och de två filer som ligger i bundeln når partisidorna bara med en release.

## Triagering

> Beslutsunderlag för detta issue.

| Fält | Värde |
|------|-------|
| **Blockeras av** | Inget |
| **Blockerar** | Inget (men #35 — omkörningen av 2026-importen — blir den första stora dataändringen som går den här vägen) |
| **Relaterade issues** | #99 (mergad PR; den dataändring som motiverade issuet), #98 (öppet; avgör var `/data/` komprimeras och rör samma "Huvuden"-avsnitt på `/data/`-sidan), #35 (öppet; stor dataimport som kan ändra `public/img/sveriges_riksdag.svg` och `data/derived/riksdag.json` och därmed ändå kräva en release) |
| **Omfattning** | 9 filer att skapa eller ändra i `.github/workflows/`, `src/server/`, `src/pages/`, `scripts/`, `deploy/` och repots rot, plus `README.md` att kontrollera |
| **Risk** | Medel |
| **Komplexitet** | Medel |
| **Säker för junior** | Nej |
| **Konfliktrisk** | Låg (ingen annan öppen plan finns; alla planmappar under `agent-docs/issue/` hör till stängda issues. #98 saknar plan men kommer att röra `deploy/partidata.se.conf` och "Huvuden"-listan i `src/pages/data/index.tsx`, som den här planen ändrar en rad i) |

### Triagemässiga noteringar

- Issuet är öppet utan etiketter, ansvarig eller kommentarer, och repot har ingen `agent-docs/github/`-konfiguration, så ingen projekttavla har frågats. Inga blockerare nämns i texten. #99 är verifierat mergad (`gh pr view 99`, 2026-09-07).
- `main` är i dag en commit före `v0.11.2` (`891ab2c`, en rad i `src/components/Header.tsx`). Datapubliceringen bryr sig inte om det (designbeslut 2), men det säger vad `main` är, inte vad servern kör: releaseflödet är det enda som skriver `$TARGET/`, och det bygger i dag taggar eller — vid manuell körning — vilken ref som helst, fast `deploy/README.md` bara beskriver "an earlier tag". Planen gör README:s regel till workflowets (fas 3), så att den version servern anger alltid är en tagg vars kod är serverns.
- Servern läser `data/` från `process.cwd()` (`createPartyDataStore` i `src/server/party-data.ts`), och `WorkingDirectory` i `deploy/partidata.service.template` är `$DEPLOY_TARGET`, så `$TARGET/data/` är precis den katalog `build-release.js` kopierar `data/` till i `.release/data/`. Rsync av `data/` dit ersätter alltså samma filer som en release levererar.
- Fyra saker cachas i modul-promises i `party-data.ts`: partiregistret (`getPartyIndex`), riksdagsresultaten (`readParliamentResults`), startsidan (`readHomeData`) och datakatalogen (`readDataCatalog`), plus varje utlämnad `/data/`-fil med sin etagg (`dataFiles`). Partisidor och partisymboler läses däremot per anrop. Utan omstart skulle en ny `profil.json` synas på partisidan medan ett ändrat `index.json` inte nådde `/data/`-svaret, och ett nytt parti inte synas alls. Därför startas tjänsten om (designbeslut 1).
- En datafil ligger *i bundeln*, inte på disken: `src/components/party-profile/elections.tsx` importerar `data/derived/riksdag.json` statiskt (kammarens sammansättning, valdeltagande, källor), så det värdet bakas in vid `next build` och ändras inte av rsync och omstart. En ändring av den filen når partisidorna bara genom en release; det dokumenteras i stället för att bevakas (designbeslut 9). Ingen annan fil under `data/` importeras statiskt (`grep -rn "data/" src` med `import`/`require`, 2026-09-07).
- Sudoers-regeln på servern tillåter deploy-kontot exakt `systemctl restart partidata.service` (`deploy/README.md`). Det nya workflowet behöver inget mer än det, samma deploy-nyckel och samma fem hemligheter i miljön `production`. Steget "Restart and local health check" i `deploy.yaml` har i dag bara `HOST` och `USER` i sin miljö; `TARGET` måste läggas till där när steget också ska skriva en fil.
- `/data/`-sidan lovar i dag "Datan ändras bara när en ny version driftsätts" och länkar filerna "på GitHub under taggen". Det slutar vara sant med det här issuet, så texten måste ändras oavsett vad `/api/health` gör (designbeslut 4 och 5). `profil.json` ligger utanför allowlisten i `src/server/data-resources.ts` och serveras inte på `/data/`; en ändring som ska synas där måste röra en allowlistad fil, t.ex. ett partis `index.json`.
- `public/img/sveriges_riksdag.svg` genereras ur datan av `scripts/build-derived-data.js`, och `check:derived-data` faller om den inte stämmer. En dataändring som flyttar mandat ändrar alltså också en fil i `public/`, som bara skeppas av en release. Det är den andra bundlade filen, vid sidan av `data/derived/riksdag.json` (designbeslut 9).
- GitHubs concurrency-grupper håller högst *en* väntande körning: en ny körning i gruppen ersätter den som redan väntar, också med `cancel-in-progress: false`. Med en pågående körning, en väntande release och en ny datapush blir releasen avbruten. Det är sällsynt (tre händelser inom några minuter), utfallet syns som en avbruten körning, och releasen körs om med `workflow_dispatch` på taggen. Planen lovar därför inte en kö, bara att två körningar aldrig går samtidigt. Eftersom datajobbet alltid publicerar `main`s spets (nedan) spelar det ingen roll vilken datapush som till slut kör.

## Angreppssätt

Workflowet gör i tur och ordning: checka ut `main`s spets, `npm ci`, validera datan, rsynca `data/`, skriva vilken commit datan kommer från, starta om tjänsten och kontrollera via `/api/health` att servern svarar och rapporterar just den committen.

**Alltid `main`s spets.** `actions/checkout` får `ref: main`, oavsett trigger, och jobbet läser `git rev-parse HEAD` till `DATA_COMMIT` i `$GITHUB_ENV` som den commit allt sedan syftar på — inte `github.sha`. Det gör tre saker rätt på en gång: en `workflow_dispatch` från en gren publicerar ändå `main`; en omkörning av en gammal körning publicerar dagens `main`, inte gårdagens data med `--delete`; och en datapush som väntat i gruppen bakom en release publicerar det `main` är när den väl kör, också om andra commits hunnit landa. En avsiktlig återställning är en revert på `main`.

**Ingen vakt.** Jobbet jämför inte `main` med den driftsatta taggen: att publicera data och att släppa kod är två skilda saker (designbeslut 2). Datan valideras på `main`s spets av `validate:data` och `check:derived-data`, och det som rsyncas är det CI godkände. Två filer ligger i bundeln och nås inte av en datapublicering — `data/derived/riksdag.json`, som `elections.tsx` importerar statiskt, och `public/img/sveriges_riksdag.svg`, som `build-derived-data.js` genererar; det står i `CLAUDE.md` och `deploy/README.md` (designbeslut 9).

**Rsync och omstart.** `rsync -az --delete -e "ssh -i ~/.ssh/deploy_key -o IdentitiesOnly=yes" data/ "$USER@$HOST:$TARGET/data/"` — samma flaggor som releasen, men källa och mål är `data/`-katalogen, så `--delete` bara städar där. Därefter ett enda ssh-anrop, med `HOST`, `USER`, `TARGET` och `DATA_COMMIT` i stegets miljö, som skriver committen till `$TARGET/data-commit` via en temporär fil (`printf '%s\n' '<sha>' > '<target>/data-commit.tmp' && chmod 0644 '<target>/data-commit.tmp' && mv -f '<target>/data-commit.tmp' '<target>/data-commit'`, så att tjänstekontot kan läsa filen och den aldrig är halvskriven), kör `sudo systemctl restart partidata.service` och pollar `http://127.0.0.1:3000/api/health/` med samma `curl --retry` som releasen; `&&` mellan delarna gör att ett fel avbryter och ger stegets fel. Sist en publik kontroll som förutom att sidan svarar också kräver `.status == "ok" and .data.commit == $sha` i hälsosvaret (`jq -e`), vilket är beviset för att både filen och omstarten landade — inte att varje byte är rätt, men `validate:data` har kontrollerat filerna och rsync deras checksummor.

**Felhantering.** Rsync skriver varje fil till en temporär fil och byter namn, så en enskild fil är aldrig halv, men trädet är blandat medan rsyncen pågår, och en avbruten rsync lämnar det blandat tills nästa körning; releasen har exakt samma fönster i dag, och partisidorna läser per anrop medan cacherna håller det gamla tills omstarten. Ett fel i något steg gör körningen röd utan att något rullas tillbaka: nästa push till `main` som rör `data/`, eller en `workflow_dispatch`, rsyncar hela trädet på nytt och är återställningen så länge servern svarar på `/api/health` (också med 500), och en release återställer allt oavsett. Skrivs `data-commit` men omstarten faller, rapporterar den gamla processen den nya committen tills nästa lyckade omstart — det syns som en röd körning med fallerat omstartssteg, och det är därför den publika kontrollen inte ensam är beviset.

**Datans proveniens.** `PARTIDATA_VERSION` bakas in vid bygget ur `package.json` och är kodens version; den ska fortsätta betyda det i sidfoten, i `X-Partidata-Version` och i `/api/health`. Datan får en egen identitet: filen `data-commit` i arbetskatalogen, en rad med den 40 tecken långa commit-hashen, skriven av *båda* workflowen efter sin rsync (releasens `--delete` av `$TARGET/` tar bort filen, så releasen skriver den med taggens commit). En liten modul `src/server/data-commit.ts` läser filen per anrop — den är en rad och läses bara av `/api/health` och `/data/`-sidans `getServerSideProps` — och ger `undefined` om den saknas, som lokalt och i `npm run test:http`. Hälsosvaret blir `{ status, version, data: { commit } }` när filen finns och oförändrat annars. Eftersom filen läses per anrop kan `http-smoke.js` täcka båda lägena mot samma process: först utan fil (dagens `deepEqual` mot `{ status: 'ok', version }`), sedan med en fil skriven i `.release/` mitt under körningen, och sist tas filen bort. `/data/`-sidan länkar datan till `tree/<commit>/data/` när committen är känd och till taggen annars, och versioneringsavsnittet säger det nya: adresser och fält är stabila, datan publiceras från `main` när den mergas, kodversionen står i `X-Partidata-Version`, och `/api/health` anger datans commit.

**Ordning vid införandet.** Allt går i en PR. När den mergas rör den `src/`, så det nya workflowet triggas inte (ingen `data/**`-ändring). Första releasen efter mergen skeppar hälsokontrollen och skriver `data-commit`; en dataändring dessförinnan publiceras men saknar `data.commit` tills dess. Det ska stå i PR-bodyn.

## Steg

### Fas 1: Servern känner datans commit
1. Skapa `src/server/data-commit.ts` med `readDataCommit(root = process.cwd()): Promise<string | undefined>`.
   - Läser `path.join(root, 'data-commit')` som utf8, trimmar, returnerar strängen om den matchar `/^[0-9a-f]{40}$/` och annars `undefined`; `ENOENT` ger `undefined`, andra fel kastas.
   - Ingen cachning: filen är en rad och läses bara av hälsokontrollen och `/data/`-sidan.
   - Filer att skapa: `src/server/data-commit.ts`
2. Låt `/api/health` ange committen.
   - I `src/pages/api/health.ts`: läs `readDataCommit()` vid sidan av `assertHealthy()` och svara `{ status: 'ok', version, ...(commit ? { data: { commit } } : {}) }`; felgrenen får samma tillägg så att ett trasigt register fortfarande talar om vilken data det gäller. Läs committen före `assertHealthy()` så att den finns i båda grenarna; kastar läsningen (annat fel än `ENOENT`) hamnar det i felgrenen som i dag.
   - Filer att ändra: `src/pages/api/health.ts`
3. Testa läsaren.
   - `scripts/data-commit.test.js` med `node:test`, som `scripts/data-fields.test.js` importerar `.ts` ur `src/` direkt: en temporär katalog utan fil ger `undefined`, med en giltig hash ger hashen (även med avslutande radbrytning), med skräp ger `undefined`.
   - Filer att skapa: `scripts/data-commit.test.js`

### Fas 2: `/data/`-sidan säger det som blir sant
1. Ge sidan committen.
   - Nytt props-typ `DataPageProps = DataCatalog & { dataCommit?: string }` i `src/pages/data/index.tsx`; `NextPage<DataPageProps>` och `GetServerSideProps<DataPageProps>`, som returnerar `{ ...catalog, ...(dataCommit ? { dataCommit } : {}) }` (fältet utelämnas när det är `undefined`, som sidans övriga props). Komponenten destrukturerar `dataCommit` och räknar `dataRef = dataCommit ?? ref`.
   - De tre datalänkarna (versioneringsavsnittet, `tree/${ref}/data/parti` och `tree/${ref}/data` i licensavsnittet) går till `dataRef`; README-länken (`blob/${ref}/README.md#…`) står kvar på `ref`, för README hör till koden.
   - Filer att ändra: `src/pages/data/index.tsx`
2. Skriv om versioneringsavsnittet och `Cache-Control`-raden.
   - "Datan ändras bara när en ny version driftsätts" ersätts av att datan publiceras från `main` när en ändring mergas, att `X-Partidata-Version`, sidfoten och `/api/health` anger kodversionen, och att `/api/health` dessutom anger vilken commit datan kommer från (`data.commit`) — samma commit som länken pekar på. `Cache-Control`-raden säger att ett svar är som mest en timme äldre än filen på servern. Punkten om borttagna eller omdöpta fält står kvar; "en version som noteras här" gäller fortfarande, eftersom sådana ändringar rör koden.
   - Texten är svensk sajtkopia; fältnamnet `data.commit` och sökvägen `data-commit` är de enda engelska orden.
   - Filer att ändra: `src/pages/data/index.tsx`
3. Täck båda lägena i `scripts/http-smoke.js`.
   - Efter dagens hälsokontroll (rad 608–611): skriv en känd hash till `.release/data-commit`, hämta `/api/health` och kräv `{ status: 'ok', version, data: { commit } }`, hämta `/data/` och kräv att sidan länkar `tree/<hash>/data/`; ta bort filen i `finally` så att ett fallerat test inte lämnar den kvar. `.release/` byggs om av varje `build:release`, så filen är aldrig en del av artefakten.
   - Filer att ändra: `scripts/http-smoke.js`

### Fas 3: Releasen bygger bara taggar och skriver `data-commit`
1. I `.github/workflows/deploy.yaml`: gör versionskontrollen ovillkorlig genom att först kräva `github.ref_type == 'tag'` (ett steg som annars faller med beskedet att releasen körs från en tagg, som `deploy/README.md` säger) och sedan behålla jämförelsen tagg mot `package.json` utan `if:`. Uppdatera huvudkommentaren ("workflow_dispatch re-deploys the selected ref" blir "the selected tag") och README:s rad "The version check is skipped then" i fas 5.
   - Filer att ändra: `.github/workflows/deploy.yaml`
2. Steget "Restart and local health check": lägg `TARGET: ${{ secrets.DEPLOY_TARGET }}` i stegets miljö och lägg skrivningen via temporär fil (Angreppssätt) före `sudo systemctl restart …` i samma ssh-kommando, med `github.sha` (taggens commit) och `$TARGET` insatta lokalt och enkelcitat runt sökvägen i det fjärrkörda kommandot.
   - Filer att ändra: `.github/workflows/deploy.yaml`
3. Låt "Public smoke test" kräva committen: `shell: bash` och `curl … /api/health/ | jq -e --arg sha "$GITHUB_SHA" '.status == "ok" and .data.commit == $sha'` i stället för bara `--fail`. `jq` finns på `ubuntu-24.04`-runnern.
   - Filer att ändra: `.github/workflows/deploy.yaml`

### Fas 4: Workflowet `publish-data.yaml`
1. Skapa `.github/workflows/publish-data.yaml` med namnet "Publish data" och en huvudkommentar av samma slag som i `deploy.yaml`: vad som triggar, att det alltid är `main`s spets som publiceras, att inget byggs, att koden på servern måste vara `main`s.
   - `on: push: branches: [main], paths: ['data/**']` och `workflow_dispatch`.
   - `concurrency: { group: production-deploy, cancel-in-progress: false }`, `permissions: { contents: read }`, ett jobb `publish` med `runs-on: ubuntu-24.04`, `timeout-minutes: 10`, `environment: production`.
   - Filer att skapa: `.github/workflows/publish-data.yaml`
2. Steg i jobbet, i ordning:
   - `actions/checkout@v5` med `ref: main`; ett steg som skriver `DATA_COMMIT=$(git rev-parse HEAD)` till `$GITHUB_ENV`.
   - `actions/setup-node@v5` (node 24, npm-cache), `npm ci` — validatorerna kräver `scripts/`-modulerna men inga andra beroenden än de i `package.json`.
   - `npm run validate:data` och `npm run check:derived-data`.
   - "Install deploy key" — samma steg som i `deploy.yaml`.
   - "Rsync data to server": rsync-raden i Angreppssätt, med `data/` som källa och `$TARGET/data/` som mål.
   - "Record the commit, restart and local health check": ssh-kommandot i Angreppssätt, med `HOST`, `USER`, `TARGET` och `DATA_COMMIT` i miljön.
   - "Public smoke test": `shell: bash`; samma två curl-anrop som releasen, där hälsosvaret körs genom `jq -e` med kravet `.status == "ok" and .data.commit == $DATA_COMMIT`.
   - Filer att skapa: `.github/workflows/publish-data.yaml`

### Fas 5: Dokumentationen
1. `deploy/README.md`: inledningen får en mening om att `publish-data.yaml` rsyncar `data/` och startar om tjänsten när en push till `main` rör `data/**`; avsnittet "Release" får en not om att en release också tar med datan, och raden om att versionskontrollen hoppas över vid manuell körning ersätts av att workflowet bara bygger taggar; ett nytt kort avsnitt "Data" beskriver `data-commit`, vad `/api/health` anger, att jobbet alltid publicerar `main`s spets, att en väntande körning i `production-deploy` ersätts av nästa, att `workflow_dispatch` kör om synkningen, att en server som inte svarar alls återställs med en manuell release på gällande tagg, och att `data/derived/riksdag.json` och `public/img/sveriges_riksdag.svg` ligger i bundeln och därför bara når partisidorna med en release. "Manual deploy" får `data-commit`-skrivningen tillagd i det befintliga receptet (dess `rsync --delete` av roten tar bort filen) och en variant för enbart data: `npm ci`, de två validatorerna, rsync av `data/`, skrivning av committen och omstart.
   - Filer att ändra: `deploy/README.md`
2. `CLAUDE.md`, punkten under "Workflow": kod driftsätts på `v*`-taggar; en merge till `main` som rör `data/` publicerar datan av sig själv via `publish-data.yaml` så länge `main`s kod är den driftsatta (och `data/derived/riksdag.json` är orörd, eftersom den ligger i bundeln); en kodändring behöver fortfarande en tagg, och tar datan med sig.
   - Filer att ändra: `CLAUDE.md`
3. Kontrollera att `README.md` inte påstår något som blir fel (rad 28 säger bara "samma sökväg, samma byte" och hänvisar till `/data/` för versioneringen — ingen ändring väntas).

## Filöversikt

| Fil | Åtgärd | Syfte |
|-----|--------|-------|
| `.github/workflows/publish-data.yaml` | Skapa | Publicerar `main`s `data/` vid push till `main` som rör `data/**`, och vid `workflow_dispatch` |
| `.github/workflows/deploy.yaml` | Ändra | Bygger bara taggar; skriver `data-commit` före omstarten; kräver committen i det publika hälsosvaret |
| `src/server/data-commit.ts` | Skapa | Läser `data-commit` ur arbetskatalogen; `undefined` när filen saknas |
| `src/pages/api/health.ts` | Ändra | Anger `data.commit` när filen finns |
| `src/pages/data/index.tsx` | Ändra | Versioneringsavsnittet och `Cache-Control`-raden säger det nya; datalänkarna går till datans commit |
| `scripts/data-commit.test.js` | Skapa | `node:test` för läsaren: saknad fil, giltig hash, skräp |
| `scripts/http-smoke.js` | Ändra | Hälsosvaret och `/data/`-sidan med och utan `data-commit` |
| `deploy/README.md` | Ändra | Beskriver dataworkflowet, `data-commit`, taggkravet och manuell datapublicering |
| `CLAUDE.md` | Ändra | "Merging is not releasing" blir "dataändringar går live vid merge, kod behöver en tagg" |
| `README.md` | Kontrollera | Ingen ändring väntas |

## Berörda kodområden

- `.github/workflows/`
- `src/server/`
- `src/pages/api/`
- `src/pages/data/`
- `scripts/`
- `deploy/`
- repots rot (`CLAUDE.md`)

## Designbeslut

> Icke-triviala val gjorda under planeringen. Varje beslut är antingen avgjort här, med proveniens, eller uttryckligen markerat som att det kräver användaren eftersom ett felval skulle ge skada som inte går att backa. Feedback välkommen; annars implementeras enligt dessa, och beslut som är agentens bedömning listas i PR:en för granskning.

### 1. Omstart efter rsync i stället för att servern släpper sina cacher
**Alternativ:** A: `sudo systemctl restart partidata.service` efter rsyncen, som releasen. B: en väg för servern att släppa modul-promisarna i `party-data.ts` (t.ex. en signal eller en skyddad endpoint).
**Beslut:** A
**Proveniens:** agentens bedömning — issuet ställer upp båda och avgör inte.
**Vid fel val:** begränsat — omstarten kostar den sekund av 502 från nginx som varje release redan kostar; B kan läggas till senare utan att workflowet ändras mer än i ett steg.
**Motivering:** A kräver ingen kodändring, återanvänder den enda sudoers-regeln deploy-kontot har och ger ett hälsosvar som bevisar att den nya processen läser de nya filerna. B skulle behöva en autentiserad väg in i processen och kan ändå inte lova att en pågående begäran inte läser blandad data. B blir rätt val den dag dataändringar är så täta att omstarterna märks.

### 2. Ingen vakt: workflowet synkar `data/` från `main` oavsett vad koden gör
**Alternativ:** A: alltid synka `data/` från `main`. B: synka bara när taggen för den version `/api/health` anger och `HEAD` är lika utanför det som inte körs på servern.
**Beslut:** A
**Proveniens:** användarbeslut (konversation 2026-09-07) — att publicera data och att släppa kod är två skilda saker, och datapubliceringen får aldrig bero på om `main` har oskeppade kodändringar.
**Vid fel val:** begränsat — B är ett steg att lägga till om behovet visar sig.
**Motivering:** Datan valideras av `validate:data` och `check:derived-data` på `main`s spets, och det som når servern är det CI godkände. Fälten är additiva och adresserna stabila, så en dataändring är läsbar för den driftsatta koden. Beslut 3 (vad vakten gör när den faller) faller bort med vakten.

### 3. Utgår
Beslutet gällde vad vakten skulle göra när den föll. Det finns ingen vakt (beslut 2).

### 4. Datans commit anges i `/api/health`, inte i sidfoten eller i `X-Partidata-Version`
**Alternativ:** A: lämna allt som det är; bara texten på `/data/` ändras. B: `data-commit`-filen och `data.commit` i `/api/health`, kodversionen orörd överallt. C: dessutom ett nytt svarshuvud på `/data/` och en rad i sidfoten.
**Beslut:** B
**Proveniens:** agentens bedömning — issuet ber om just det här avgörandet.
**Vid fel val:** begränsat — C är ett tillägg ovanpå B; A är B minus en fil och ett fält.
**Motivering:** Utan committen finns inget sätt att kontrollera att en datapublicering landade, och `/data/`-sidans länk "samma filer på GitHub" skulle behöva peka på `main` i rörelse. Med B blir workflowets publika kontroll ett bevis (`.data.commit == $DATA_COMMIT`) och länken pekar på exakt de bytes som serveras. Sidfoten och `X-Partidata-Version` betyder fortfarande "kodens version", och hälsosvaret är där en driftsättning verifieras. C blir rätt om konsumenter av `/data/` visar sig behöva committen per svar; då är det ett huvud till i `[...path].ts`.

### 5. `data-commit` är en fil i arbetskatalogen, skriven av båda workflowen
**Alternativ:** A: en textfil `$TARGET/data-commit` som varje workflow skriver efter sin rsync. B: `build-release.js` skriver den in i `.release/` ur `git rev-parse HEAD`, så att releasens rsync bär den; dataworkflowet skriver den via ssh. C: en miljövariabel i systemd-enheten.
**Beslut:** A
**Proveniens:** agentens bedömning.
**Vid fel val:** begränsat — filen läses per anrop, så var den skrivs kan ändras utan kodändring i servern.
**Motivering:** Med A skriver båda workflowen filen på samma sätt, i samma ssh-anrop som omstarten, och `.release/` är identisk med ett lokalt bygge. B binder artefakten till git: ett lokalt bygge ur ett smutsigt träd eller utan `.git` skulle bära en commit som inte är dess data, och `http-smoke.js` skulle behöva veta vilken. C kräver `daemon-reload` och en ändrad sudoers-regel. Filen läses per anrop och cachas inte, eftersom den bara läses av hälsokontrollen och `/data/`-sidan.

### 6. Trigger: push till `main` med sökvägsfilter, inte `workflow_run` efter Integrate
**Alternativ:** A: `on: push` med `paths: ['data/**']`, och validatorerna körs om i jobbet. B: `workflow_run` efter "Integrate" så att bara grönt CI publicerar.
**Beslut:** A
**Proveniens:** användarbeslut (issue #100, "Trigger on pushes to `main` that touch `data/**`") — valet av vad som körs om i jobbet är issuets också.
**Vid fel val:** begränsat — B är en ändring av `on:` och ett steg som läser ut committen ur händelsen.
**Motivering:** B har inget sökvägsfilter och skulle kräva att jobbet själv räknar ut om pushen rörde `data/`; A får det gratis och kör de två datakontrollerna igen på samma commit, vilket är det issuet ber om.

### 7. Rsync-omfång: `data/` till `$TARGET/data/` med `--delete`
**Alternativ:** A: som ovan. B: rsync utan `--delete`. C: hela `.release/`-mönstret utan bygge.
**Beslut:** A
**Proveniens:** användarbeslut (issue #100, "`--delete` scoped to that directory").
**Vid fel val:** begränsat — filen som saknas i `data/` på `main` ska inte heller finnas på servern; det är hela poängen.
**Motivering:** Servern svarar ur registret (`getPartyIndex`) innan den rör disken, så en kvarlämnad katalog ger inte fel svar — men serverns `data/` ska vara `main`s `data/` byte för byte, som `/data/`-sidan lovar, och utan `--delete` växer skillnaden med varje borttagen fil och varje parti som byter `filnamn`.

### 8. Jobbet publicerar alltid `main`s spets, oavsett trigger
**Alternativ:** A: `actions/checkout` med `ref: main` och `DATA_COMMIT` ur `git rev-parse HEAD`. B: checka ut händelsens ref (`github.sha`) och kräva att den är `main`s spets. C: checka ut händelsens ref utan krav.
**Beslut:** A
**Proveniens:** agentens bedömning.
**Vid fel val:** begränsat — B är `ref:` bort och ett kontrollsteg till; ingen data skadas av A som inte också är `main`.
**Motivering:** Med A kan ingen körning publicera något annat än `main`: en `workflow_dispatch` från en gren, en omkörning av en gammal körning (som med `--delete` skulle rulla tillbaka datan) och en datapush som väntat bakom en release medan andra commits landat ger alla samma resultat — det `main` är när jobbet kör. B skulle fälla den väntande datapushen så snart en dokumentationscommit hunnit före, och datan bleve liggande tills nästa datapush. C är rollback-risken. En avsiktlig återställning är en revert på `main`.

### 9. `data/derived/riksdag.json` är dokumenterad som bundlad, inte bevakad
**Alternativ:** A: vakten diffar också `data/derived/riksdag.json` mot den driftsatta taggen och kräver release när den ändrats. B: bygg om partisidans riksdagsvy så att filen läses vid körning (via `party-data.ts` och sidans props). C: dokumentera att filen ligger i bundeln och att en ändring av den når partisidorna först med en release.
**Beslut:** C, med B som möjlig uppföljning
**Proveniens:** användarbeslut (konversation 2026-09-07) — samma beslut som 2: ingen vakt.
**Vid fel val:** begränsat — mellan en riksdagsdataändring på `main` och nästa release visar partisidorna gammal kammare medan `/data/derived/riksdag.json` visar ny. Filen ändras bara när ett riksdagsval importeras eller korrigeras.
**Motivering:** `elections.tsx` importerar filen statiskt och `public/img/sveriges_riksdag.svg` genereras av `build-derived-data.js`, så båda ligger i bundeln och nås inte av rsync och omstart. Det är ett faktum om systemet, och `CLAUDE.md` och `deploy/README.md` säger det. B tar bort skillnaden och hör till ett eget issue.

### 10. Releasen bygger bara taggar
**Alternativ:** A: `deploy.yaml` faller när `github.ref_type` inte är `tag`, och versionskontrollen görs ovillkorlig. B: lämna `workflow_dispatch` fri att bygga vilken ref som helst, som i dag.
**Beslut:** A
**Proveniens:** befintlig konvention (`deploy/README.md`: "run the workflow manually from an earlier tag") som workflowet inte upprätthåller; att göra den bindande är agentens bedömning.
**Vid fel val:** begränsat — ett `if:` på ett steg; den som behöver bygga en gren taggar den.
**Motivering:** Har en gren byggts manuellt anger servern en version vars tagg inte är dess kod, och `X-Partidata-Version`, sidfoten och `/api/health` pekar då ut något som inte går att slå upp. Med A är `.version` alltid en tagg vars träd är serverns, och README:s beskrivning blir sann. B blir rätt om det finns ett behov av att provköra otaggad kod i produktion — det bör då vara en separat miljö, inte ett undantag.

## Verifieringschecklista

- [ ] `npm run precommit` grönt; `node --test scripts/data-commit.test.js` täcker saknad fil, giltig hash (med och utan radbrytning) och skräp
- [ ] `npm run test:http`: hälsosvaret är exakt `{ status: 'ok', version }` utan `data-commit`, anger `data.commit` med filen skriven mitt under körningen, `/data/`-sidan länkar `tree/<hash>/data/` då och taggen annars, och filen är borta efteråt
- [ ] `/data/`-sidans versioneringsavsnitt och `Cache-Control`-raden stämmer med det nya flödet; README-länken går fortfarande till taggen; sidfoten och `X-Partidata-Version` är oförändrade
- [ ] Efter merge: `deploy.yaml` körs vid nästa `v*`-tagg, skriver `data-commit` och den publika kontrollen kräver committen; en `workflow_dispatch` av `deploy.yaml` från en gren faller i första steget
- [ ] Efter den releasen: en ändring i ett partis `index.json` på `main` triggar "Publish data"; körningen är grön, `https://www.partidata.se/api/health/` anger `main`s commit, och `/data/parti/<filnamn>/index.json` serveras med ny etagg
- [ ] En push till `main` som *inte* rör `data/**` triggar inte workflowet; `workflow_dispatch` från en gren publicerar ändå `main`s spets; en omkörning av en äldre körning publicerar dagens `main`
- [ ] En dataändring på `main` publiceras också när `main` har oskeppad kod i `src/`; en ändring i `data/derived/riksdag.json` når `/data/derived/riksdag.json` men inte partisidornas riksdagsvy förrän nästa release
- [ ] En release som taggas medan "Publish data" kör startar först när datajobbet är klart; en tredje händelse under tiden ersätter den väntande, och den avbrutna körningen körs om manuellt
- [ ] `deploy/README.md` och `CLAUDE.md` beskriver flödet; "Merging is not releasing" är ersatt; det manuella receptet skriver `data-commit`; raden om överhoppad versionskontroll är borta
