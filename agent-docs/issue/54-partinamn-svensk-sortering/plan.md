# Plan: Issue #54 — Partinamn sorteras inte enligt svenska alfabetet

## Mål

Alla alfabetiskt sorterade listor — startsidans partilista och länsfiltret —
ska följa svensk kollation (A–Z, Å, Ä, Ö), så att t.ex. **Jarl** kommer före
**Jämtlands Väl** och namn på Å/Ä/Ö hamnar efter Z. Listor med innehållsordning
(mandatfördelning i källans ordning, kandidatlistor i valsedelsordning) berörs
inte. Ordningen ska dessutom vara skyddad mot regression: dels via test som
låser den svenska ordningen, dels via en körtidskontroll som gör att en
Node-runtime utan svensk ICU-data ger ett synligt hälsofel i stället för tyst
felsortering.

## Triagering

> Beslutsunderlag för detta issue.

| Fält | Värde |
|------|-------|
| **Blockeras av** | Inget |
| **Blockerar** | Inget |
| **Relaterade issues** | #49 (startsidans ombyggnad — fortfarande öppet, men dess PR #56 är mergad och rättade huvudlistans ordning), #38 (särskiljning av partier med samma namn — rör samma lista men inte sorteringen) |
| **Omfattning** | 5 filer i `src/server/`, `src/pages/api/` och `scripts/` |
| **Risk** | Låg |
| **Komplexitet** | Låg |
| **Säker för junior** | Ja |
| **Konfliktrisk** | Låg (övriga planer i `agent-docs/issue/` avser redan mergat arbete; planen för #49 rör `src/components/home/` men PR #56 är merged) |

### Triagemässiga noteringar

- **Grundorsak vid rapporttillfället:** den då driftsatta startsidan (t.o.m.
  `v0.6.0`) renderade partilistan i den ordning `data/parti/index.json` har,
  och registret sorteras av `scripts/parti.js` på **filnamn** — ASCII-slugs
  där diakriter vikts bort (`jamtlands-val-bracke` < `jarl`, `akta-demokrati`
  under A). Det ger exakt symptomen i issuet: Jämtlands Väl före Jarl, och
  Å/Ä/Ö-partier insprängda bland A/O.
- **Delvis rättat av PR #56** (mergad efter att issuet skapades; issue #49 är
  ännu öppet): den nya startsidan sorterar partilistan och länslistan vid
  request med `Intl.Collator('sv')` i `src/server/party-data.ts`, vilket ger
  korrekt ordning på en Node med full ICU. Lokal körning bekräftar rätt
  ordning.
- **Kvarstående luckor** som denna plan stänger: (1) testerna låser inte den
  svenska ordningen — fixturen i `scripts/party-data.test.js` passerar även
  under rotkollation, och röktestet kontrollerar bara att första partiet
  länkas; buggen har redan skeppats en gång; (2) `Intl.Collator('sv')` faller
  **tyst** tillbaka till rotkollation om runtimens Node saknar svensk
  locale-data (t.ex. en Node byggd med small-icu), och produktionsserverns
  Node (systemd-tjänstens `@NODE_BINARY@`) ligger utanför repots kontroll;
  (3) rättningen är inte släppt — deploy sker på `v*`-taggar, så sajten
  visar fel ordning tills en ny tagg pushas.
- Issuets förväntan om **bokstavsgruppering** (Å/Ä/Ö som egna bokstäver)
  avsåg den gamla startsidans grupperade lista. Den mergade startsidan
  (PR #56) visar en platt lista "Sorterat A–Ö" utan bokstavsgrupper, så det
  finns ingen gruppering kvar att rätta. Att den platta listan ersätter
  grupperingskravet är dock ett acceptansbeslut — det lyfts för bekräftelse
  redan vid plangranskningen (designbeslut 3) och upprepas i PR:en (steg 8),
  aldrig tyst antaget.

## Angreppssätt

Sorteringslogiken finns redan på rätt ställe — presentationlagret
(`buildHomeData` i `src/server/party-data.ts`) sorterar med
`Intl.Collator('sv')`, medan dataregistret `data/parti/index.json` avsiktligt
ligger kvar i deterministisk filnamnsordning (låst av `scripts/parti.test.js`).
Planen ändrar därför inte datalagret utan gör tre saker:

1. **Samla kollationen i en delad modul** så att alla ställen som sorterar
   svenska namn använder samma collator, och så att det finns en funktion som
   kan verifiera att runtimen faktiskt sorterar svenskt.
2. **Gör felsortering till ett hälsofel.** `partyData.assertHealthy()` backar
   `/api/health`, som både `scripts/http-smoke.js` och deployjobbets
   hälsokontroller (lokal curl efter restart samt publik smoke) gatar på. En
   Node utan svensk kollation gör alltså deployjobbet synligt rött i stället
   för att sajten tyst visar fel ordning. Observera att deployn rsyncar och
   startar om **före** hälsokontrollen, så den felsorterande artefakten är
   redan aktiv när jobbet failar — åtgärd och återställning dokumenteras i
   steg 8, och produktionens Node verifieras dessutom en gång före taggning.
3. **Lås ordningen i testerna.** Enhetstestet i `scripts/party-data.test.js`
   får en avsiktligt osorterad fixtur som täcker hela invarianten (Jarl före
   Jämtlands Väl, Z före Å före Ä före Ö), och `npm run test:http` — som
   startar den riktiga release-artefakten — verifierar att startsidans
   renderade partigrid följer samma ordning. Testernas rollfördelning:
   grid- och enhetsjämförelserna fångar **kodregressioner** (sorteringen tas
   bort eller ändras), medan **ICU-fallback** fångas av kollationsvaktens
   literala jämförelser — röktestets facit beräknas nämligen med samma
   ICU-data som servern den startar (`process.execPath`), så på en
   small-icu-Node skulle facit och utfall falla tillbaka likadant och matcha.

Viktiga observationer från kodläsningen:

- `buildHomeData` sorterar både `parties` (på `beteckning`) och `lan` (på
  `namn`) med en lokal `new Intl.Collator('sv')` — båda ska gå över till den
  delade modulen.
- `scripts/party-data.test.js` kräver in TS-modulen direkt
  (`require('../src/server/party-data.ts')`, Node 24 type-stripping), så
  enhetstest av sorteringen hör hemma där. Dagens fixtur
  (Alfa/Beta/Duplikat/Östra) är redan i förväntad ordning även under
  rotkollation och fångar därför inte buggen.
- `scripts/http-smoke.js` skapar redan en egen `Intl.Collator('sv')` för att
  hitta första partiet; den kontrollen är inte ordningskänslig (första partiet
  börjar på A under båda kollationerna) och fångar därför inte buggen.
- Startsidan server-renderar bara de första `PAGE_SIZE = 48` korten
  (`src/components/home/filtering.ts`), och riksdagssektionen länkar samma
  partisidor tidigare i dokumentet — ordningskontrollen i röktestet måste
  därför avgränsas till "Alla partier"-gridens markup, inte hela bodyn.
  48-kortskontrollen täcker inte hela alfabetet — därför bär enhetstestet
  helhetsinvarianten.
- Registret innehåller flera partier med **identisk beteckning** (t.ex.
  `Alternativet`, `Framstegspartiet`, `Kommunens Väl`, `Kommunlistan`), där
  collatorn ger 0 — deras inbördes ordning behöver en explicit
  sekundärnyckel för att vara deterministisk (designbeslut 4; jfr #38 om att
  särskilja dem visuellt).
- `/api/health` sväljer i dag felet (`catch` utan loggning) — för att vaktens
  felmeddelande ska gå att diagnostisera vid en failad deploy måste handlern
  logga det fångade felet server-side.
- Sökfältets normalisering viker bort diakriter (`normalise` i
  `src/components/home/filtering.ts`), så en sökning på "ä" matchar även "a"
  — manuell verifiering av Å/Ä/Ö-ordningen kan inte göras via sökningen utan
  görs genom att bläddra fram hela listan eller inspektera sidans
  serialiserade data.

## Steg

### Fas 1: Delad svensk kollation med körtidsvakt

1. Skapa `src/server/collation.ts`
   - Exportera en delad collator, t.ex. `export const svCollator = new Intl.Collator('sv')`
     och en jämförelsefunktion `compareSv(a: string, b: string): number`.
   - Exportera `assertSwedishCollation(): void` som kastar med tydligt
     felmeddelande om runtimen inte sorterar svenskt, verifierat med
     faktiska jämförelser (inte bara `resolvedOptions().locale`):
     `compareSv('z', 'å') < 0`, `compareSv('å', 'ä') < 0`,
     `compareSv('ä', 'ö') < 0` samt `compareSv('Jarl', 'Jämtlands') < 0`.
     (Under rotkollation flippar åtminstone `z`/`å`- och
     `Jarl`/`Jämtlands`-jämförelserna; de inbördes å/ä/ö-jämförelserna kan
     råka stämma även där, men hela sviten tillsammans låser invarianten.)
   - Filer att ändra: `src/server/collation.ts` (ny)
2. Använd modulen i `src/server/party-data.ts`
   - Ersätt den lokala `const collator = new Intl.Collator('sv')` i
     `buildHomeData` med import från `src/server/collation.ts` för både
     parti- och länssorteringen.
   - Gör partisorteringen deterministisk vid lika beteckning med `filnamn`
     som sekundärnyckel (designbeslut 4).
   - Lägg till kollationsvakten i `assertHealthy()` så att `/api/health`
     svarar 500 på en runtime med fel kollation. Ge `createPartyDataStore`
     en injicerbar vakt (t.ex.
     `createPartyDataStore(dataRoot, { assertCollation = assertSwedishCollation } = {})`)
     så att enhetstestet kan bevisa kopplingen (steg 4).
   - Filer att ändra: `src/server/party-data.ts`
3. Logga hälsofel i `src/pages/api/health.ts`
   - `catch`-grenen loggar det fångade felet (`console.error`) innan den
     svarar 500, så att orsaken (t.ex. kollationsvaktens meddelande) syns i
     tjänstens journal vid en failad deploy-hälsokontroll.
   - Filer att ändra: `src/pages/api/health.ts`

### Fas 2: Regressionsskydd i testerna

4. Skärp enhetstestet i `scripts/party-data.test.js`
   - Gör `makeHomeData`-fixturen avsiktligt osorterad och komplettera den med
     partier som täcker hela invarianten: `Jarl` och `Jämtlands Väl`, namn på
     Z, Å, Ä och Ö (utöver befintliga `Östra partiet`) samt ett par med
     identisk beteckning för att låsa sekundärnyckeln på `filnamn`.
   - Asserta hela den resulterande sekvensen (som i dag, via
     `home.parties.map(...filnamn)`) så att testet failar både under
     rotkollation och om produktionssorteringen tas bort.
   - Lägg till ett Å/Ä/Ö-län i regionfixturen och asserta länens ordning.
   - Bevisa hälsokopplingen via injektionsseamen från steg 2: injicera en
     kastande vakt och asserta att `store.assertHealthy()` rejectar med det
     felet (det negativa ICU-fallet går inte att framkalla på en
     full-ICU-Node, men seamen bevisar att vakten faktiskt anropas).
   - Filer att ändra: `scripts/party-data.test.js`
5. Utöka `scripts/http-smoke.js` med en ordningskänslig kontroll av startsidan
   - Kör de literala kollationsjämförelserna (samma invariant som
     `assertSwedishCollation`) i röktestets början, så att testet failar
     direkt på en runtime utan svensk ICU-data i stället för att räkna fram
     ett fallback-facit.
   - Beräkna facit ur `data/parti/index.json`:
     `expected = parties.toSorted(svensk kollation på beteckning, filnamn som sekundärnyckel).slice(0, 48)`.
   - Plocka ut "Alla partier"-gridens del av HTML:en (markupen efter
     `id="alla-partier"`, listan med klassen `home-grid`) och extrahera
     `/parti/<filnamn>`-länkarna i dokumentordning.
   - Asserta att de extraherade länkarna är exakt `expected`-partiernas
     filnamn i samma ordning. Kontrollen fångar kodregressioner i
     serverns sortering; ICU-fallback fångas inte av själva jämförelsen
     (facit beräknas med samma ICU-data som servern) utan av
     invariantkontrollen ovan och av hälsovakten som röktestet redan
     väntar på.
   - Asserta antalet extraherade länkar (48) så att kontrollen inte tyst
     blir tom om markupen ändras; failar extraktionen ska testet faila, inte
     hoppa över.
   - Filer att ändra: `scripts/http-smoke.js`

### Fas 3: Verifiering och släpp

6. Kör `npm run precommit` (lint, typecheck, datavalidering, test,
   release-bygge och röktest mot artefakten).
7. Verifiera manuellt i dev-servern att "Alla partier" visar Jarl före
   Jämtlands Väl och att Å-, Ä- och Ö-partier ligger sist i den ordningen —
   genom att bläddra fram hela listan med "Visa fler partier" (sökning
   fungerar inte för detta eftersom den viker bort diakriter).
8. Skriv PR-bodyn så att den (a) lyfter acceptansbeslutet att den platta
   listan "Sorterat A–Ö" ersätter issuets bokstavsgruppering — öppet för
   användaren att underkänna innan merge — och (b) noterar att merge inte är
   release: den driftsatta sajten visar fel ordning tills `main` taggas
   (`v*`) och deployn rullat.
   - **Release-beroende:** före taggningen bör produktionens Node verifieras
     en gång — be användaren köra systemd-tjänstens `@NODE_BINARY@` med en
     enradskontroll (`new Intl.Collator('sv').compare('z','å') < 0`) på
     servern (ssh kräver ändå användarens medverkan). Officiella
     Node-binärer sedan v14 har full ICU, så utfallet väntas vara grönt.
   - Om deployns hälsokontroll ändå failar på kollationsvakten: den nya
     artefakten är då redan aktiv (rsync + restart sker före kontrollen) och
     sidorna svarar 200 med fel ordning medan `/api/health` ger 500 och
     jobbet är rött. Åtgärd: installera/peka `@NODE_BINARY@` på en
     full-ICU-Node och rulla om; återställning: deploya föregående tagg.
   - Själva taggningen är ett separat beslut utanför denna plan.

## Filöversikt

| Fil | Åtgärd | Syfte |
|-----|--------|-------|
| `src/server/collation.ts` | Skapa | Delad svensk collator + `assertSwedishCollation()` |
| `src/server/party-data.ts` | Ändra | Använd delade collatorn; kollationsvakt i `assertHealthy()` |
| `src/pages/api/health.ts` | Ändra | Logga fångat hälsofel så vaktens orsak syns i journalen |
| `scripts/party-data.test.js` | Ändra | Osorterad fixtur som låser hela den svenska ordningen |
| `scripts/http-smoke.js` | Ändra | Ordningskänslig kontroll av startsidans partigrid |

## Berörda kodområden

- `src/server/`
- `src/pages/api/`
- `scripts/` (endast testfiler och `http-smoke.js`)

## Designbeslut

> Icke-triviala val gjorda under planeringen. Feedback välkommen; annars implementeras enligt dessa.

### 1. Datalagret behåller filnamnsordning; svensk kollation är presentationens ansvar
**Alternativ:** Sortera om `data/parti/index.json` på beteckning med svensk kollation vs behålla ASCII-ordning på filnamn och sortera vid rendering.
**Beslut:** Behåll filnamnsordningen i registret.
**Motivering:** Befintlig konvention — `scripts/parti.js` sorterar registret på filnamn och `scripts/parti.test.js` låser det; PR #56 lade presentationssorteringen vid request. Registerordningen är deterministisk oberoende av ICU-data (skripten kan köras på vilken Node som helst), och konsumenten sorterar för sitt syfte. *(Proveniens: befintlig konvention.)*

### 2. Körtidsvakt i hälsokontrollen i stället för egen kollationsimplementation eller deploy-preflight
**Alternativ:** (A) Lita på `Intl.Collator('sv')` och låta `assertHealthy()` verifiera att runtimen sorterar svenskt; (B) skriva en egen ICU-oberoende svensk jämförelsefunktion; (C) lägga en ssh-preflight i deployjobbet som kör kollationskontrollen med produktionens `@NODE_BINARY@` före rsync/restart.
**Beslut:** A, kompletterat med en manuell engångsverifiering av produktionens Node före taggning (steg 8).
**Motivering:** `Intl.Collator` ger korrekt full kollation (versaler, é→e-variant, bindestreck) som en egenimplementation lätt får fel; risken är enbart en runtime utan svensk locale-data. Deployjobbet gatar redan på `/api/health` både lokalt efter restart och publikt, så vakten gör felet synligt utan nya pipeline-steg, och loggningen i steg 3 gör orsaken diagnostiserbar. Vakten **förhindrar** dock inte att den felsorterande artefakten hinner bli aktiv (rsync + restart sker före kontrollen) — det residualfönstret accepteras eftersom engångsverifieringen före taggning i praktiken eliminerar sannolikheten, och en misslyckad deploy återställs med föregående tagg. C (ssh-preflight i workflowen) ger tidigare fail men bygger ut deploy-workflowens ssh-yta för ett fel som ändå fångas — läggs till om vakten någon gång faktiskt löser ut. *(Proveniens: agentens egen bedömning — öppen att ifrågasätta; B väljs om drift på small-icu-Node någonsin blir ett faktiskt krav.)*

### 3. Ingen bokstavsgruppering återinförs — men beslutet lyfts till användaren
**Alternativ:** Återinföra den gamla startsidans A–Ö-grupper (med Å/Ä/Ö som egna grupper) vs behålla den platta listan "Sorterat A–Ö".
**Beslut:** Behåll den platta listan, och lyft explicit i PR:en att detta ersätter issuets grupperingsförväntan (steg 8).
**Motivering:** Startsidans nya layout utan bokstavsgrupper är användarens mergade design (PR #56, issue #49); issuets grupperingskrav beskrev den gamla layoutens fel. Men issuet nämner grupperingen uttryckligen, så att den utgår är ett acceptansbeslut användaren ska få ta ställning till — inte en tyst tolkning. Om gruppering återinförs senare ska Å/Ä/Ö vara egna bokstäver — det täcks då av den delade kollationsmodulen. *(Proveniens: layouten är användarbeslut via mergad PR #56; att den ersätter grupperingskravet är agentens tolkning som lyfts för bekräftelse.)*

### 4. Explicit sekundärnyckel på `filnamn` vid identiska beteckningar
**Alternativ:** Lita på att sorteringen är stabil och att registrets filnamnsordning avgör vs jämföra explicit på `filnamn` när collatorn ger 0.
**Beslut:** Explicit sekundärjämförelse på `filnamn`.
**Motivering:** Registret innehåller flera partier med identisk beteckning (`Alternativet`, `Framstegspartiet`, `Kommunens Väl`, `Kommunlistan` m.fl.). `Array.prototype.sort` är stabil i moderna V8, men en implicit invariant som vilar på både stabilitet och registrets inordning är skörare än en rad explicit kod, och `filnamn` är unikt och redan listans React-nyckel. *(Proveniens: agentens egen bedömning — öppen att ifrågasätta.)*

## Verifieringschecklista

- [ ] "Alla partier" listar Jarl före Jämtlands Väl (bläddra fram via "Visa fler partier")
- [ ] Partier på Å, Ä och Ö ligger efter partier på Z, i ordningen Å, Ä, Ö
- [ ] Länsfiltret listar län i svensk ordning (Örebro län och Östergötlands län sist)
- [ ] Partier med identisk beteckning kommer i deterministisk `filnamn`-ordning (låst av enhetstestets fixtur)
- [ ] `npm test` failar om produktionssorteringen tas bort eller ändras (verifierat genom att tillfälligt sabotera sorteringen lokalt)
- [ ] `npm test` failar när en kastande kollationsvakt injiceras i `createPartyDataStore` (bevisar att `assertHealthy()` anropar vakten)
- [ ] `npm run test:http` failar om startsidans partigrid avviker från svensk ordning (verifierat på samma sätt som enhetstestet)
- [ ] `/api/health` svarar 500 och loggar orsaken om kollationsvakten kastar (verifierat genom att tillfälligt injicera en kastande vakt lokalt)
- [ ] `npm run precommit` grönt
- [ ] Produktionens `@NODE_BINARY@` verifierad för svensk kollation före `v*`-taggning (enradskontroll körd av användaren)
- [ ] PR:en lyfter acceptansbeslutet om bokstavsgrupperingen och noterar att en `v*`-tagg krävs innan rättningen syns på partidata.se
