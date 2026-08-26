# Implementation Plan: Server-renderad Next.js-app

## Mål

- En gemensam partiprofilrenderare hanterar alla aktuella partiadresser vid
  request; bygget ska inte skapa en HTML-fil per parti.
- Partidata fortsätter använda versionshanterade JSON-filer som datakälla.
- Tidigare partiadresser ger riktiga permanenta HTTP-redirects och okända
  adresser ger HTTP 404.
- Produktionsartefakten är reproducerbar, självbärande och kan aktiveras eller
  återställas utan att en halvfärdig release blir publik.
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
- upptäcka tillgängliga valår från `data/val/` i stället för att hårdkoda
  2018/2022/2026;
- aldrig bygga en filsökväg från en slug eller ett bildnamn innan värdet har
  matchats mot registerdatan;
- returnera serialiserbara props och tydliga resultattyper för sida, redirect
  och not found.

JSON-data och bildfiler läggs med i varje release. Processens working directory
är release-roten, så servermodulen kan läsa `data/` utan externa mounts.

### 2. Partiprofil vid request

Ändra `src/pages/parti/[filnamn].tsx`:

- ersätt `getStaticPaths` och `getStaticProps` med `getServerSideProps`;
- använd servermodulen direkt, utan ett internt API-anrop;
- returnera `{ redirect: { destination, permanent: true } }` för ett tidigare
  filnamn;
- returnera `{ notFound: true }` för en okänd slug;
- ta bort den HTML-/meta-refresh-baserade `RedirectPage`;
- sätt canonical-URL för den aktuella partiadressen;
- sätt en uttrycklig delad cachepolicy för publika profilsvar.

Första implementationen använder
`Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300`.
nginx får en kort proxycache för GET/HEAD och deployflödet tömmer sidcachen vid
releasebyte. POST, cookies, health och felstatus ska inte cachelagras.

### 3. Partisymboler som runtime-resurs

Build-time-importen av symbolfilen fungerar inte som generell runtime-läsning.
Skapa en Node-route, exempelvis
`src/pages/partisymbol/[filnamn]/[bild].ts`, som:

- verifierar både filnamn och bildnamn mot partiets registerpost;
- läser endast den registrerade symbolfilen;
- svarar med korrekt MIME-typ, `Content-Length` och en begränsad publik
  cachetid;
- svarar 404 på fel kombination och tillåter inte path traversal.

Partisidan får en URL till denna route i stället för ett webpack-genererat
bildobjekt.

### 4. Sitemap och health

- Lägg till `src/pages/sitemap.xml.tsx` med servergenererad XML.
- Sitemap innehåller startsidan och aktuella partiadresser, aldrig
  `tidigare_filnamn`.
- Bas-URL läses från en icke-hemlig runtime-konfiguration med
  `https://www.partidata.se` som produktionsvärde.
- Lägg till `src/pages/api/health.ts`. Den ska kontrollera att processens
  partidata går att läsa och endast svara med ett minimalt statusobjekt.
- Health-svaret ska vara `no-store` och inte exponera miljö- eller
  versionsdetaljer.

## Build och releaseartefakt

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
- hela `data/`;
- en manifestfil med Git-SHA/version och checksummor.

Skriptet ska misslyckas om `server.js`, partidatan eller statiska assets saknas.

### Paketkommandon

- Lägg till `npm start` för lokal produktionskörning.
- Ta bort `postbuild`-beroendet på `scripts/validate-export.js` och katalogen
  `out/`.
- Ersätt exportvalideringen med runtime-/HTTP-tester enligt testmatrisen.
- Lägg releasebygget i ett separat kommando så vanlig `npm run build` fortsatt
  är snabbt och CI kan testa båda stegen uttryckligen.

## Produktionsdeploy

### Release-layout

Deployroten kommer från den skyddade produktionsmiljön. Under den används
generiska underkataloger:

- `releases/<version>/` – kompletta, immutable releaser;
- `current` – atomisk symlink till aktiv release;
- `previous` – senast verifierade release för rollback;
- `shared-next-static/` – ackumulerade, innehållsnamngivna Next-assets så klienter
  som laddade HTML under ett releasebyte fortfarande hittar sina chunks.

Behåll ett litet antal verifierade releaser och rensa endast releaser som inte
är `current` eller `previous`.

### Systemprocess

Lägg en generell systemd-mall i `deploy/`:

- dedikerat, oprivilegierat servicekonto;
- `WorkingDirectory` pekar på `current`;
- `NODE_ENV=production`, loopback-bindning och port kommer från en skyddad
  environment-fil;
- `ExecStart` kör standalone-artefaktens `server.js` med den installerade,
  stödda Node-versionen;
- automatisk restart vid oväntat processfel;
- rimlig systemd-hardening utan att blockera läsning av releasefilerna.

Deploykontot ska bara kunna aktivera releaser och starta om den specifika
tjänsten; breda sudo-rättigheter ska inte dokumenteras eller krävas av
workflowen.

### nginx

Ersätt den statiska `try_files`-konfigurationen med en reverse proxy mot
loopback-processen:

- bevara TLS, apex-redirect och säkerhetsheaders;
- vidarebefordra `Host`, klient-IP och protokollheaders;
- hantera WebSocket-/keep-alive-headers på ett Next-kompatibelt sätt;
- servera `/_next/static/` från den delade assetkatalogen med immutable cache;
- använd kort proxycache endast för publika GET/HEAD-svar;
- returnera 502 om appen är nere i stället för att visa en gammal statisk sida.

Validera alltid en staged nginx-konfiguration innan den ersätter den aktiva.

### Workflowsekvens

`.github/workflows/deploy.yaml` ska fortfarande endast kunna deploya en tagg.
Lägg till en explicit tag guard även för `workflow_dispatch`.

1. Checka ut taggen, installera med `npm ci` och kör hela verifieringskedjan.
2. Bygg standalone-release och verifiera manifest/checksummor.
3. Ladda upp till en ny stagingkatalog; ändra aldrig `current` under upload.
4. Flytta stagingkatalogen till `releases/<version>` när uploaden är komplett.
5. Spara befintlig `current` som rollbackmål och växla symlinken atomiskt.
6. Starta om tjänsten och gör health check mot loopback med retries.
7. Vid fel: återställ föregående symlink, starta om och verifiera rollback innan
   workflowen avslutas som misslyckad.
8. Vid godkänd lokal health: töm HTML-proxycachen och gör publik HTTPS-smoke.
9. Markera releasen som verifierad och rensa äldre, inaktiva releaser.

Workflowloggen får inte skriva ut värdnamn, konton, sökvägar eller secrets.

## Första produktionsväxlingen

Första växlingen skiljer sig från en normal deploy och görs först efter merge:

1. Installera stödd Node-runtime och den granskade systemtjänsten.
2. Ladda upp en release utan att ändra nuvarande nginx-site.
3. Starta Next-processen på loopback och verifiera alla smoke-URL:er direkt.
4. Staga och validera den nya nginx-konfigurationen.
5. Växla nginx till reverse proxy och gör publik smoke test.
6. Om publik smoke misslyckas: återställ den tidigare nginx-konfigurationen;
   den befintliga statiska sajten ska fortfarande finnas kvar som rollback under
   hela växlingen.
7. Ta bort den gamla statiska webbrooten först i ett senare underhållssteg.

Inga servermutationer görs under själva kodimplementationen eller PR-reviewn.

## Testmatris

### Enhetstester

- aktuell slug ger fulla props;
- tidigare slug ger permanent redirect till aktuell slug;
- okänd och osäker slug ger not found utan filsystemsåtkomst utanför `data/`;
- profilfil och kandidatlista är valfria;
- valår upptäcks utan hårdkodad lista;
- symbolroute accepterar endast registrerad fil och rätt MIME-typ;
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
  - tidigare filnamn → permanent redirect med korrekt `Location`;
  - okänd slug → 404;
  - registrerad partisymbol → 200 och `image/png`;
  - `/sitemap.xml` → 200 och XML;
  - `/api/health` → 200 och `no-store`.

### Visuell regression

- jämför startsidan och minst två partiprofiler före/efter i Chrome;
- verifiera desktop och 390 px mobil;
- kontrollera att inga hydrationfel, konsolfel eller saknade assets tillkommer.

### Deploytest före produktionsväxling

- testa releaseaktivering och rollback med en medvetet trasig health check i en
  isolerad katalog/process;
- verifiera att en avbruten upload inte påverkar `current`;
- verifiera att nginx-konfigurationen underkänns före installation om syntaxen
  är fel;
- verifiera att tidigare release åter blir frisk efter rollback.

## Implementationsordning

1. Servermodul och enhetstester för route-/dataupplösning.
2. `getServerSideProps`, riktiga redirects/404 och canonical-URL.
3. Symbolroute, sitemap och health med tester.
4. Standalone-konfiguration och reproducerbart releasebygge.
5. HTTP-smoke test som startar den byggda artefakten i CI.
6. Generiska systemd-/nginxmallar och uppdaterad deploydokumentation.
7. Atomiskt taggbaserat workflow med rollbacklogik.
8. Full lokal verifiering och PR; serverväxling först efter grön merge.

## Referenser

- [Next.js: getServerSideProps](https://nextjs.org/docs/pages/building-your-application/data-fetching/get-server-side-props)
- [Next.js: standalone output](https://nextjs.org/docs/pages/api-reference/config/next-config-js/output)
- [Next.js: self-hosting and caching](https://nextjs.org/docs/pages/guides/self-hosting)

