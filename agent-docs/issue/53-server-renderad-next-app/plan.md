# Implementation Plan: Server-renderad Next.js-app

## Mål

- En gemensam partiprofilrenderare hanterar alla aktuella partiadresser vid
  request; bygget ska inte skapa en HTML-fil per parti.
- Partidata fortsätter använda versionshanterade JSON-filer som datakälla.
- Tidigare partiadresser ger riktiga permanenta HTTP-redirects och okända
  adresser ger HTTP 404.
- Produktionsartefakten är reproducerbar, självbärande och kan startas av den
  hanterade Node-processen.
- Miljöspecifika konton, värdnamn, sökvägar och åtkomstuppgifter stannar i den
  skyddade produktionsmiljön och dokumenteras inte i repot.

## Avgränsning

- Pages Router och den befintliga React/CSS-designen behålls.
- Startsidan får fortsätta vara statiskt optimerad men serveras av Next.js.
- Sökfältets funktionalitet ingår inte i #53.
- Ingen databas eller administrativ skrivfunktion införs.
- Ingen Docker-runtime införs; appen är en ensam Node-tjänst utan databas eller
  migrationsbehov och körs som en hanterad systemprocess.

## Beslutad runtime-arkitektur

### 1. Servermodul för partidatan

Skapa `src/server/party-data.ts` som är enda vägen från routes till `data/`.
Modulen ska:

- läsa och indexera `data/parti/index.json` en gång per process;
- skilja aktuellt `filnamn`, `tidigare_filnamn` och okänd slug;
- läsa `index.json`, valfri `profil.json` och kandidatlistor för ett verifierat
  aktuellt filnamn;
- upptäcka endast numeriska valårskataloger under `data/val/` som faktiskt
  innehåller `kandidatlistor/`, i stället för att hårdkoda 2018/2022/2026 eller
  tolka exempelvis `partideltagande/` som ett valår;
- aldrig bygga en filsökväg från en slug eller ett bildnamn innan värdet har
  matchats mot registerdatan;
- returnera serialiserbara props och tydliga resultattyper för sida, redirect
  och not found.

JSON-data och bildfiler läggs med i varje release. Processens working directory
är release-roten, så servermodulen kan läsa `data/` utan externa mounts.

Modulen ska kunna importeras direkt av befintliga `node --test` under Node 24.
Håll därför dess runtime-beroenden till relativa filer eller `node:`-moduler och
runtime-`fs`; använd inte `src/...`-/`data/...`-alias eller bundlade JSON-importer
i servermodulen. Testerna importerar modulen via dess relativa filsökväg, utan en
separat testbundler.

### 2. Partiprofil vid request

Ändra `src/pages/parti/[filnamn].tsx`:

- ersätt `getStaticPaths` och `getStaticProps` med `getServerSideProps`;
- använd servermodulen direkt, utan ett internt API-anrop;
- returnera en Next-redirect med `permanent: true` till
  `/parti/<aktuell-slug>/` för ett tidigare filnamn, vilket ska ge HTTP 308;
- returnera `{ notFound: true }` för en okänd slug;
- ta bort den HTML-/meta-refresh-baserade `RedirectPage`;
- ta bort de då oanvända `PartiRedirect`- och `isRedirect`-typerna;
- sätt canonical-URL för den aktuella partiadressen;
- sätt en uttrycklig delad cachepolicy för publika profilsvar.

Inför ingen separat nginx-proxycache i första implementationen. Trafikmängden
motiverar inte cacheinfrastruktur eller purge-rättigheter; Next renderar
profilsidan per request. Cache kan läggas till senare om faktisk last visar ett
behov.

### 3. Partisymboler som runtime-resurs

Build-time-importen av symbolfilen fungerar inte som generell runtime-läsning.
Skapa API-routen
`src/pages/api/partisymbol/[filnamn]/[bild].ts` och en rewrite i
`next.config.ts` från `/partisymbol/:filnamn/:bild` till API-routen. Routen ska:

- verifiera både filnamn och bildnamn mot partiets registerpost;
- läsa endast den registrerade symbolfilen;
- svara med korrekt MIME-typ, `Content-Length` och en begränsad publik
  cachetid;
- stödja GET och HEAD och svara 405 med `Allow: GET, HEAD` för andra metoder;
- svara 404 på fel kombination och aldrig tillåta path traversal.

Partisidan får en URL till denna route i stället för ett webpack-genererat
bildobjekt.

### 4. Sitemap och health

- Lägg till `src/pages/api/sitemap.ts` med servergenererad XML och en rewrite
  från `/sitemap.xml` till API-routen.
- Sitemap innehåller startsidan och aktuella partiadresser, aldrig
  `tidigare_filnamn`.
- Bas-URL läses från en icke-hemlig runtime-konfiguration med
  `https://www.partidata.se` som produktionsvärde.
- Lägg till `src/pages/api/health.ts`. Den ska kontrollera att processens
  partidata går att läsa och endast svara med ett minimalt statusobjekt.
- Health-svaret ska vara `no-store` och inte exponera miljö- eller
  versionsdetaljer.

Health används av deployens smoke test för att kontrollera att den omstartade
processen kan läsa data.

## Build och deployartefakt

### Next-konfiguration

I `next.config.ts`:

- ersätt `output: 'export'` med `output: 'standalone'`;
- behåll befintliga font-, Sass- och bildinställningar tills de har verifierats
  i runtime-bygget;
- kopiera `data/` uttryckligen till releaseartefakten i stället för att förlita
  sig på att dynamisk `fs`-läsning upptäcks av output tracing.

Nexts standalone-output innehåller server och nödvändiga Node-beroenden men
kopierar inte automatiskt `public/` eller `.next/static/`. Lägg därför till ett
reproducerbart releaseskript som bygger en stagingkatalog med:

- innehållet i `.next/standalone/`;
- `public/`;
- `.next/static/` under rätt `.next/`-sökväg;
- hela `data/`.

Skriptet ska misslyckas om `server.js`, partidatan eller statiska assets saknas.

### Paketkommandon

- Lägg till `npm start` för lokal produktionskörning.
- Ta bort `postbuild`-beroendet på `scripts/validate-export.js` och katalogen
  `out/`.
- Uppdatera `precommit` samtidigt så det inte indirekt förutsätter `postbuild`
  eller `out/` och i stället kör den nya runtime-/releaseverifieringen.
- Ersätt exportvalideringen med runtime-/HTTP-tester enligt testmatrisen.
- Lägg releasebygget i ett separat kommando så vanlig `npm run build` fortsatt
  är snabbt och CI kan testa båda stegen uttryckligen.

## Produktionsdeploy

### Målstruktur och systemprocess

`DEPLOY_TARGET` i den skyddade produktionsmiljön pekar på den enda katalog där
standalone-artefakten körs. Ingen releasehistorik eller symlinkstruktur byggs på
servern.

Lägg en generell systemd-mall i `deploy/`:

- dedikerat, oprivilegierat servicekonto;
- `WorkingDirectory` pekar på `DEPLOY_TARGET`;
- `NODE_ENV=production`, loopback-bindning och port kommer från en skyddad
  environment-fil;
- `ExecStart` kör artefaktens `server.js` med den installerade Node-versionen;
- automatisk restart vid oväntat processfel;
- `WantedBy=multi-user.target` och dokumenterad `systemctl enable` så processen
  startar efter serveromboot.

Deploykontot behöver endast skriva till `DEPLOY_TARGET` och starta om den
specifika tjänsten. En äldre Git-tagg kan deployas om manuellt om en återgång
behövs; automatisk rollback ingår inte.

### nginx

Ersätt den statiska `try_files`-konfigurationen med en enkel reverse proxy mot
loopback-processen:

- bevara TLS, apex-redirect och säkerhetsheaders;
- vidarebefordra `Host`, klient-IP och protokollheaders;
- använd Next-kompatibel HTTP/1.1- och keep-alive-proxying;
- låt Next-processen servera `public/` och `/_next/static/` från den paketerade
  artefakten;
- inför ingen proxycache.

Validera nginx-konfigurationen med `nginx -t` före installation.

### Workflowsekvens

`.github/workflows/deploy.yaml` fortsätter deploya en uttryckligen vald Git-tagg:

1. Checka ut taggen, installera med `npm ci` och kör verifieringskedjan.
2. Bygg den kompletta standalone-artefakten.
3. Rsynca artefakten med `--delete` till `DEPLOY_TARGET`.
4. Starta om systemd-tjänsten.
5. Kontrollera `/api/health` mot loopback och gör en publik HTTPS-smoke.

En kort driftstörning under rsync och omstart är acceptabel. Om smoke-testet
misslyckas avslutas workflowen som misslyckad; felet rättas eller en tidigare
tagg deployas om manuellt. Workflowloggen får inte skriva ut secrets.

## Första produktionsväxlingen

Första växlingen görs efter merge och får innebära en kort driftstörning:

1. Installera Node-runtime och systemd-tjänsten.
2. Bygg och ladda upp standalone-artefakten till `DEPLOY_TARGET`, vilket ersätter
   den statiska exporten.
3. Starta processen och verifiera `/api/health` direkt mot loopback.
4. Installera den validerade reverse-proxy-konfigurationen i nginx.
5. Verifiera den publika sajten.

Inga servermutationer görs under själva kodimplementationen eller PR-reviewn.

## Testmatris

### Enhetstester

- aktuell slug ger fulla props;
- tidigare slug ger permanent redirect till aktuell slug;
- okänd och osäker slug ger not found utan filsystemsåtkomst utanför `data/`;
- profilfil och kandidatlista är valfria;
- endast numeriska valårskataloger med `kandidatlistor/` upptäcks; kataloger utan
  kandidatlistor och icke-årskataloger ignoreras;
- `node --test` kan importera servermodulen utan alias-loader eller bundler;
- symbolroute accepterar endast registrerad fil och rätt MIME-typ, hanterar HEAD
  utan body och svarar 405 på andra metoder;
- sitemap innehåller alla aktuella slugs exakt en gång och inga tidigare slugs;
- health ger 200 med läsbar data och 500 om datakällan saknas.

### Produktionsbygge lokalt och i CI

- `npm run lint`, `npm run typecheck`, `npm run validate:data` och `npm test`;
- `npm run build` visar `/parti/[filnamn]` som dynamisk serverroute och genererar
  inte hundratals partifiler;
- releasekommandot skapar en komplett standalone-katalog utan `out/`;
- starta releaseartefakten med Node och kontrollera via HTTP:
  - `/` → 200;
  - en innehållsrik partiprofil → 200 med rätt titel och profiltext;
  - ett parti utan profilfil → 200;
  - tidigare filnamn → 308 med `Location: /parti/<aktuell-slug>/`;
  - okänd slug → 404;
  - registrerad partisymbol → 200 och `image/png`;
  - `/sitemap.xml` → 200 och XML;
  - `/api/health` → 200 och `no-store`.

### Visuell regression

- jämför startsidan och minst två partiprofiler före/efter i Chrome;
- verifiera desktop och 390 px mobil;
- kontrollera att inga hydrationfel, konsolfel eller saknade assets tillkommer.

### Deploytest före produktionsväxling

- verifiera att artefakten innehåller `server.js`, `data/`, `public/` och
  `.next/static/`;
- starta artefakten i en isolerad katalog och kontrollera health och smoke-URL:er;
- verifiera att nginx-konfigurationen underkänns före installation om syntaxen
  är fel;
- verifiera att systemd-tjänsten kan startas om och svarar på health efteråt.

## Implementationsordning

1. Servermodul och enhetstester för route-/dataupplösning.
2. `getServerSideProps`, riktiga redirects/404 och canonical-URL.
3. Symbolroute, sitemap och health med tester.
4. Standalone-konfiguration och reproducerbart releasebygge.
5. HTTP-smoke test som startar den byggda artefakten i CI.
6. Generiska systemd-/nginxmallar och uppdaterad deploydokumentation.
7. Enkelt taggbaserat workflow som rsyncar artefakten och startar om tjänsten.
8. Full lokal verifiering och PR; serverväxling först efter grön merge.

## Referenser

- [Next.js: getServerSideProps](https://nextjs.org/docs/pages/building-your-application/data-fetching/get-server-side-props)
- [Next.js: standalone output](https://nextjs.org/docs/pages/api-reference/config/next-config-js/output)
- [Next.js: self-hosting and caching](https://nextjs.org/docs/pages/guides/self-hosting)
