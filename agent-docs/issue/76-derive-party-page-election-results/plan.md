# Plan: Issue #76 — Derive the party page's election results from the imported results

## Mål

Partisidans valresultat — hero-blocken "Mandat i riksdagen" och "Riksdagsvalet ÅÅÅÅ", sektionen "Vad partiet har fått i val" och valdeltagandesektionen — ska härledas ur de importerade, validerade riksdagsresultaten i `data/val/<år>/valresultat/riksdag.json`, på samma sätt som startsidans riksdagssektion redan gör via `src/server/party-data.ts`. Det handkurerade fältet `profil.valresultat` tas bort helt: importen innehåller redan varje siffra det bär (och mer — röstetal, samt 1994 och 1998 för Liberalerna), så det finns inget kvar för fältet att uttrycka. Ett parti som saknar kopplade riksdagsresultat renderar ingen resultatsektion och inga resultatblock i heron.

## Triagering

> Beslutsunderlag för detta issue.

| Fält | Värde |
|------|-------|
| **Blockeras av** | Inget |
| **Blockerar** | Inget direkt; #26 (publicerat JSON-gränssnitt) bör känna till att `profil.json` inte längre bär `valresultat` |
| **Relaterade issues** | #68 (paraply, "Part of"), #21 (historiskt deltagande per valår på partisidan — samma sida, annan data), #35 (omkörning av 2026-importen — härledningen ska klara ett nytt valår utan kodändring), #77 (presentationsfält i `profil.json` — samma fil och validering, ingen plan ännu), #26 (JSON-gränssnitt) |
| **Omfattning** | ~12 kod-/dokumentfiler i `src/server/`, `src/components/party-profile/`, `src/pages/parti/`, `src/types.ts`, `scripts/`, `docs/` + `data/parti/<filnamn>/profil.json` × 2 |
| **Risk** | Låg–Medel (rör partisidans mest synliga modul, men datan är redan validerad och de två profilerade partierna får identiska siffror; ~100 partier får en sektion de inte haft) |
| **Komplexitet** | Medel (härledningen är enkel; kantfallen — partier utan mandat, luckor i serien, källor per rad, kammarår — kräver uttalade regler) |
| **Säker för junior** | Ja, med planen följd — reglerna i designbeslut 2–5 är de som annars lätt gissas fel |
| **Konfliktrisk** | Låg så länge #76 arbetas ensamt; Medel om #21 eller #77 startar parallellt. Alla befintliga planmappar hör till stängda issues. #77 (öppet, ingen plan) kommer att röra `src/types.ts` (`PartiProfil`), `scripts/validate.js` (`validatePartyProfile`) och `profil.json` — samma rader som fas 3 här. #21 (öppet, ingen plan) rör `src/pages/parti/[filnamn].tsx`. Rekommendation: låt #76 gå först |

### Triagemässiga noteringar

- "Part of #68" är paraply-koppling, inte blockering — samma läsning som i planen för #78. Issuet är öppet med etiketten `enhancement`, utan ansvarig, milstolpe eller kommentarer. Inget projektbräde är konfigurerat (`agent-docs/github/info.json` och `project.json` saknas), så ingen board-status har stämts av.
- Repot har inga `release/*`-refs; planen utgår från `main` (rent working tree vid planeringen, HEAD `8f57401`).
- **Issuets första öppna fråga är avgjord av datan.** De kurerade värdena för Liberalerna (2002–2022) och Miljöpartiet (1994–2022) stämmer siffra för siffra med `rostandel` och `mandat` i importen (kontrollerat 2026-08-30). Importen har dessutom `roster` för varje rad och Liberalernas 1994 och 1998. Det finns alltså inget "resultat importen inte kan uttrycka" att hålla ett override-fält för — fältet tas bort (designbeslut 1).
- **Issuets andra öppna fråga får en datadriven regel.** 106 av registrets 670 partier har minst en kopplad rad i `rostresultat.partier` i något valår 1994–2022; 8 har mandat 2022; 80 har en röstrad 2022 utan mandat (från Partiet Nyans 0,44 % ned till partier med 0,00 %). Partier utan kopplad rad — de 564 övriga — får ingen sektion. Vad som visas för de 98 med rader men utan plats i kammaren styrs av designbeslut 3–4.
- `rostresultat.ej_kopplade` och `aggregat` används inte: en historisk rad utan säkert uuid är ingen uppgift om ett visst parti, samma avgränsning som `storsta_utanfor_riksdagen` gör (`docs/riksdagsvalresultat.md`, punkt 3).
- `scripts/validate.js` kräver att varje resultatfil har `status: "slutligt"`, en `mandatfordelning` med `antal_mandat: 349` och mandatrader som summerar till 349; importern (`scripts/riksdag-results.js`) skriver alltid `status: "slutligt"`, och `docs/riksdagsvalresultat.md` definierar modellen som slutliga resultat. Sidan får därför skriva "slutligt resultat" som fakta, och kammaråret är helt enkelt det senaste importerade valåret — samma val som `buildParliamentView()` kallar `kammare`. Preliminära resultat ligger utanför modellen och utanför detta issue (#35 får ta det om det behövs).
- Att ta bort `valresultat` ur `profil.json` ändrar formen på en fil partisidan annonserar som maskinläsbar ("Profildata (JSON)" i `ExportSection`). Det är inte en teknisk blockering, men #26 (dokumenterat JSON-gränssnitt) ska nämna att fältet inte finns.

## Angreppssätt

**Datavägen.** `src/server/party-data.ts` läser redan alla `val/<år>/valresultat/riksdag.json` med `schema_version === 2` för startsidans `readParliamentYears()`. Läsningen bryts ut till en memoiserad `readParliamentResults()` (samma `??=`-mönster som `partyIndexPromise`), som både `readParliamentYears()` och den nya per-parti-härledningen använder. `ParliamentResultFile` utökas med `rostresultat` (`giltiga_roster`, `partier`) och `status`. `readCurrentParty()` slår upp partiets uuid i varje fil och bygger `valresultat`, som läggs på `PartyPageData` bredvid `candidateLists`.

**Datamodellen** (`src/types.ts`; ersätter `PartiProfilValresultat`/`PartiProfilValresultatPost`):

```ts
export interface PartiValresultatPost {
  valar: number;
  roster: number;
  rostandel: number;        // som lagrat i källfilen, två decimaler
  mandat: number;           // 0 när partiet saknar mandatrad det året
  forandring?: number;      // rostandel minus föregående importerade vals rostandel, två decimaler; se beslut 5
  kalla: PartiProfilKalla;  // röstradens källa (kallreferens → kallor[])
  mandatkalla?: PartiProfilKalla; // mandatradens källa, bara när den skiljer sig från röstradens (2010–2018)
}

export interface PartiValresultat {
  valtyp: 'riksdag';
  resultat: PartiValresultatPost[];         // stigande valår, bara år med kopplad röstrad
  kammare?: { valar: number; mandat: number }; // finns bara när partiet har mandat i det senaste importerade valet; se beslut 3
}
```

`kalla`/`mandatkalla` bär hela källobjektet ur filen (`id`, `titel`, `version`, `sha256` …) men typas `PartiProfilKalla`, precis som `ParliamentYear.kalla` på startsidan gör i dag. `readParliamentYears()` gör redan uppslaget `kallor.find(source => source.id === kallreferens)`; det blir en delad hjälpfunktion. Valfria fält (`forandring`, `mandatkalla`, `kammare`, `valresultat` självt) utelämnas med villkorad spridning (`...(x !== undefined ? { x } : {})`) — aldrig som explicit `undefined`, eftersom objektet blir `getServerSideProps`-props och Next serialiserar dem som JSON.

**Ren härledning, testbar utan filsystem.** Själva beräkningen — rader per uuid, `mandat`, `forandring`, `kammare`, källuppslag — läggs i en exporterad ren funktion `partyElectionResults(files, uuid)` i `party-data.ts`, så att `scripts/party-data.test.js` kan testa den både via fixturer på disk (som `makeHomeData()` redan skriver) och direkt med filobjekt i minnet. Funktionen sorterar själv sin indata stigande med `toSorted()` och muterar aldrig den memoiserade listan.

**Sidan.** `src/pages/parti/[filnamn].tsx` läser `valresultat` från props i stället för `profile?.valresultat`. `ProfileHero` får `results?: PartiValresultat` och renderar enligt beslut 4; `ElectionResultsSection` får `PartiValresultat` och renderar kammarblocket enligt beslut 3, källraderna per valår enligt beslut 6 och "Mot föregående val" ur `forandring`. `TurnoutSection` renderas när `valresultat` finns, som i dag.

**Kurerade fältet.** `PartiProfil.valresultat` tas bort ur typen, `validatePartyProfile()` avvisar nyckeln med ett meddelande som pekar på importen, och de två `profil.json` som bär fältet får det borttaget. Sidorna för L och MP ska rendera samma siffror före och efter (kontrolleras i fas 5).

**Smoke och dokumentation.** `scripts/http-smoke.js` får assertions som knyter partisidans mandat till `data/derived/riksdag.json` (samma siffra som startsidan) och som kontrollerar att ett parti utan resultat inte får någon sektion. `docs/riksdagsvalresultat.md` får ett avsnitt om partisidans härledning med samma numrerade regler som avsnittet om startsidan.

### Kantfall härledningen ska klara (fas 1 förutsätter dessa)

- **Röstrad utan mandatrad** → `mandat: 0`. Motsatsen (mandatrad utan röstrad) avvisas redan av `validate.js` ("mandatpartiet … saknar röstresultat") och behöver ingen hantering.
- **Lucka i serien** (partiet ställde upp 2010 och 2022 men inte 2014/2018) → `resultat` innehåller bara 2010 och 2022; `forandring` för 2022 utelämnas eftersom föregående importerade val (2018) saknar rad för partiet. `forandring` för det första valet i serien utelämnas alltid.
- **Senaste rad är inte kammaråret** (partiet hade mandat 2010, ingen rad sedan) → `kammare` saknas; heron visar partikoden i stället för mandatblocket, sektionen visar diagrammet men inget kammarblock.
- **Mandat i kammaråret** → `kammare = { valar, mandat }` där `valar` är det senaste importerade valåret (validering garanterar att varje fil har en fullständig mandatfördelning, så det är samma val som `buildParliamentView()` kallar `kammare`). `kammare.mandat` är detsamma som den sista postens `mandat` när posten är kammaråret.
- **Ett enda valår** → sektionens underrubrik blir "Riksdagsvalet ÅÅÅÅ" i stället för "Riksdagsval ÅÅÅÅ–ÅÅÅÅ"; `ElectionChart` klarar redan en punkt (`Math.max(1, results.length - 1)`).
- **Flera källor i ett år** (2010–2018: röster från `resultat`, mandat från `mandat`) → `mandatkalla` sätts när mandatradens källobjekt (per `id`) skiljer sig från röstradens; 2006 har två källfiler men röstraden pekar ut vilken av dem som gäller.
- **`val/<år>` utan `valresultat/`** (2026 i dag) → hoppas över, som `readParliamentYears()` gör.
- **Klientnavigering mellan partisidor** → `ElectionResultsSection` initierar sitt valda index en gång (`useState(results.resultat.length - 1)`). Vid `next/link`-navigering från en sida med åtta poster till en med en post skulle index 7 stå kvar och sektionen returnera `null`. Sektionen monteras därför om per parti med `key={slug}` (steg 6).
- **Inga resultatfiler alls** (testfixturen `makeData()`) → `valresultat` utelämnas ur props; sidan renderar som ett parti utan resultat.
- **Avrundning** → `forandring` beräknas som `Number((a - b).toFixed(2))`, så att 5,08 − 4,41 inte blir 0,6699999… i props.

## Steg

### Fas 1: Härledningen i servern, med tester
1. Utöka typerna i `src/types.ts`
   - Lägg till `PartiValresultatPost` och `PartiValresultat` enligt datamodellen ovan, med docblock som anger att posterna härleds ur `val/<år>/valresultat/riksdag.json` och att `kammare` betyder mandat i det senaste val som har mandatfördelning
   - Låt `PartiProfilValresultat`/`PartiProfilValresultatPost` och `PartiProfil.valresultat` stå kvar i detta steg — de tas bort i fas 3 när inget längre använder dem
   - Filer att ändra: `src/types.ts`
2. Bryt ut och memoisera läsningen av resultatfilerna i `src/server/party-data.ts`
   - `ParliamentResultFile` får `status: string`, `rostresultat: { giltiga_roster: number; partier: Array<{ parti_uuid: string; roster: number; rostandel: number; kallreferens: string }> }`; `mandatfordelning.partier` finns redan
   - Ny `readParliamentResults(): Promise<ParliamentResultFile[]>` — memoiserad med `parliamentResultsPromise ??=`, läser `electionYears()` och filtrerar på `schema_version === 2`, sorterad **stigande** på `valar`
   - Ny hjälpfunktion `sourceFor(file, reference)` som gör det uppslag `readParliamentYears()` gör i dag (`kallor.find(source => source.id === reference)`), och kastar ett fel som namnger valår och referens när källan saknas (samma beteende som `sourceFor()` i `scripts/build-derived-data.js`)
   - `readParliamentYears(byUuid)` skrivs om till att mappa över `readParliamentResults()` och sorterar sin egen projektion **fallande** (`.toSorted((a, b) => b.valar - a.valar)`, som i dag) utan att röra den delade listan; startsidans utdata ska vara byte-för-byte densamma (testet "mandate records resolve by stable uuid" förväntar `[2026, 2022]` och bevakar detta)
   - Filer att ändra: `src/server/party-data.ts`
3. Skriv den rena härledningen `partyElectionResults(files, uuid): PartiValresultat | undefined`
   - Börja med `const ordered = files.toSorted((a, b) => a.valar - b.valar)`; returnera `undefined` direkt om listan är tom (inga resultatfiler — `makeData()`-fixturen); kammaråret är `ordered.at(-1).valar`
   - För varje fil i ordning: hitta partiets röstrad; saknas den, hoppa över året. Annars bygg posten med `mandat` från mandatraden (0 om ingen), `kalla` via `sourceFor(file, rad.kallreferens)`, `mandatkalla` när mandatraden finns och dess källa har ett annat `id` än röstradens
   - `forandring` sätts när föregående fil i listan (inte föregående post) innehåller en röstrad för partiet
   - `kammare` sätts när partiet har en mandatrad med `mandat > 0` i kammarårets fil
   - Returnera `undefined` när inga poster byggdes
   - Exportera funktionen från modulen
   - Filer att ändra: `src/server/party-data.ts`
4. Koppla in i `readCurrentParty()` och `PartyPageData`
   - `PartyPageData` får `valresultat?: PartiValresultat`
   - `readCurrentParty()` läser `readParliamentResults()` parallellt med profil och kandidatlistor (utöka den befintliga `Promise.all`), anropar `partyElectionResults(files, party.uuid)` och sprider in `valresultat` bara när det finns (samma `...(x ? { x } : {})`-mönster som `profile`)
   - Filer att ändra: `src/server/party-data.ts`
5. Tester i `scripts/party-data.test.js`
   - Observera att `makeHomeData()` redan skriver en 2026-fil där `betapartiet` har alla 349 mandat, så **2026 är kammaråret i den fixturen** — `alfapartiet` (rad 2022, ingen rad 2026) får därför inget `kammare`, och testet "mandate records resolve by stable uuid" (`[2026, 2022]`) ska stå orört
   - Utöka `makeHomeData()` minimalt: låt `writeResult()` ta röstrader utan mandat (post utan `mandat`), och lägg till en röstrad för `zebrapartiet` 2022 utan mandat
   - Nytt test (via store): `resolveParty('betapartiet').props.valresultat` deep-equals `{ valtyp: 'riksdag', resultat: [{ valar: 2026, roster: 1, rostandel: 100, mandat: 349, kalla: source }], kammare: { valar: 2026, mandat: 349 } }` — ingen `forandring` (första posten), ingen `mandatkalla`
   - Nytt test (via store): `resolveParty('alfapartiet').props.valresultat` har en post (2022, `mandat: 200`) och inget `kammare`; `resolveParty('zebrapartiet')` har en post med `mandat: 0` och inget `kammare`
   - Nya tester direkt mot `partyElectionResults(files, uuid)` med filobjekt i minnet (en lokal `resultFile(year, rows, sources)`-hjälpare som bygger samma form som `writeResult()`):
     - 2018 (källor `resultat` + `mandat`, mandatrad med `kallreferens: 'mandat'`) och 2022 → `mandatkalla` 2018, `forandring` 2022 = `Number((r2022 - r2018).toFixed(2))`, `kammare` för 2022
     - rad 2018 och 2026 men inte 2022 → två poster, ingen `forandring` på 2026
     - rad 2018 men inte 2022 → sista posten 2018, inget `kammare`
     - filer givna i fallande ordning → samma utdata (funktionen sorterar själv)
     - uuid utan rad → `undefined`
     - `kallreferens` som saknas i `kallor` → kastar med valår och referens i meddelandet
     - inga explicita `undefined`-nycklar i utdata (`assert.ok(!('forandring' in post))` för första posten)
   - Befintligt test för `makeData()`: assert att `valresultat` är `undefined` för båda partierna (inga resultatfiler)
   - Befintliga tester för `home.riksdag` ska passera oförändrade
   - Filer att ändra: `scripts/party-data.test.js`

### Fas 2: Sidan och komponenterna läser den härledda datan
6. `src/pages/parti/[filnamn].tsx`
   - Plocka ut `valresultat` ur props; den lokala `latestResult` tas bort (heron härleder sista posten själv, företrädarsektionen använder `kammare`)
   - `ProfileHero` får `results={valresultat}` i stället för `latestResult`
   - `<ElectionResultsSection key={slug} results={valresultat} partyLabel={abbreviation} />` och `TurnoutSection` renderas när `valresultat` finns; `key={slug}` monterar om sektionen per parti så att det valda indexet aldrig överlever en klientnavigering till en sida med färre poster
   - `RepresentativesSection mandateCount={valresultat?.kammare?.mandat}` (bara kammarmandat ska stå i underrubriken "partiet har N mandat")
   - Filer att ändra: `src/pages/parti/[filnamn].tsx`
7. `ProfileHero` i `src/components/party-profile/overview.tsx` (beslut 4)
   - Prop `results?: PartiValresultat` ersätter `latestResult?: PartiProfilValresultatPost`
   - Block 1: `results.kammare` → "Mandat i riksdagen · N av 349 · Valresultat ÅÅÅÅ"; annars partikodsblocket
   - Block 2: `latest = results?.resultat.at(-1)` → "Riksdagsvalet ÅÅÅÅ · X %" med källrad `${latest.kalla.namn} · slutligt resultat` (validering garanterar att varje fil är slutlig); blocket utelämnas utan resultat
   - `keyFactCount = (results?.kammare ? 2 : latest ? 2 : 1) + 1 + (founded ? 1 : 0)` — ett parti med röstrad men utan kammarmandat visar partikod + Riksdagsvalet, så räkningen är oförändrad i alla tre fallen; fyrspaltsläget (`profile-keyfacts--four`) täcker fortfarande maximum
   - Filer att ändra: `src/components/party-profile/overview.tsx`
8. `ElectionResultsSection` i `src/components/party-profile/elections.tsx` (beslut 3, 5, 6)
   - Typer: `PartiValresultat`/`PartiValresultatPost`
   - Underrubrik: `resultat.length > 1 ? \`Riksdagsval ${first}–${last}, …\` : \`Riksdagsvalet ${first}, …\``
   - `sourceNames = [...new Set(results.resultat.map(post => post.kalla.namn))]` — samma mönster som `turnoutSourceNames` i `TurnoutSection`. Sektionsheaderns brand-text (`<small>valresultat · slutlig rösträkning</small>`) och introns `SourceLine` ("Valmyndigheten · slutlig rösträkning") byts till `${sourceNames.join(' och ')} · slutligt resultat`, så att 1994/1998 (SCB) inte tillskrivs Valmyndigheten; Valmyndigheten-bilden i branden står kvar (beslut 6)
   - Vald post: "Mot föregående val" visar `forandring` med tecken när det finns, annars "—"; headerns källtext blir `${result.kalla.namn} · slutligt resultat` i stället för det hårdkodade "Valmyndigheten · slutligt resultat"
   - Kammarblocket (`profile-results__bottom`) renderas bara när `results.kammare` finns; "Partiets N platser i kammaren" använder `kammare.mandat`
   - Källblocket (`profile-results__sources`): en `SourceLine` per post, med valåret som prefix (`<SourceLine source={post.kalla}>Riksdagsvalet {post.valar} · </SourceLine>`), följd av en rad för `mandatkalla` när den finns ("Riksdagsvalet ÅÅÅÅ, mandat · "). Nyckel `${valar}-${kalla.url}`
   - `chamberComposition`/`ChamberDiagram`/`TurnoutSection` oförändrade
   - Filer att ändra: `src/components/party-profile/elections.tsx`
9. Stil
   - Kontrollera att `.profile-results__sources` tål 8–11 rader (MP: 8 valår + 3 mandatkällor); om raderna behöver radbrytas som en lista, justera i `src/styles/_party-profile.scss`. Sannolikt ingen ändring
   - Filer att ändra (vid behov): `src/styles/_party-profile.scss`

### Fas 3: Ta bort det kurerade fältet
10. Typer: ta bort `PartiProfilValresultat`, `PartiProfilValresultatPost` och `PartiProfil.valresultat` ur `src/types.ts`; `npm run typecheck` ska visa att inget refererar dem längre
    - Filer att ändra: `src/types.ts`
11. Validering: i `validatePartyProfile()` ersätt blocket `if (profile.valresultat !== undefined) { … }` med `assert.equal(profile.valresultat, undefined, \`${context}.valresultat ska inte finnas; valresultat härleds ur val/<år>/valresultat/riksdag.json\`)`
    - `scripts/validate.test.js`: deltestet "invalid curated election results" byts till "curated election results are rejected" och förväntar det nya meddelandet
    - Filer att ändra: `scripts/validate.js`, `scripts/validate.test.js`
12. Data: ta bort nyckeln `valresultat` ur `data/parti/liberalerna-tidigare-folkpartiet/profil.json` och `data/parti/miljopartiet-de-grona/profil.json`. Övriga nycklar och ordning orörda. `npm run validate:data` ska passera; `node scripts/parti.js` ska vara no-diff (skriptet rör inte `profil.json`)
    - Filer att ändra: `data/parti/liberalerna-tidigare-folkpartiet/profil.json`, `data/parti/miljopartiet-de-grona/profil.json`

### Fas 4: Smoke-test och dokumentation
13. `scripts/http-smoke.js`
    - `current` (Miljöpartiet) är ett kammarparti: assert att blocket `<dt>Mandat i riksdagen</dt><dd>N <span>av 349</span></dd>` finns med exakt `N = chamber.partier.find(party => party.parti_uuid === current.uuid).mandat` (regexen omfattar `<dt>` och `<dd>` tillsammans, så en annan förekomst av samma tal på sidan inte kan uppfylla den; samma värde som startsidans riksdagssektion renderar för samma år — det är acceptanskriteriet "kan inte skilja sig"), `<section class="profile-results"` och `id="deltagande"`
    - Välj datadrivet ett parti med röstrad men utan mandat i kammaråret: läs `data/val/<chamber.valar>/valresultat/riksdag.json`, ta första (i `filnamn`-ordning) `rostresultat.partier`-uuid som saknas i `mandatfordelning.partier` och finns i registret; assert att dess sida har `profile-results` och `id="deltagande"` men varken `<dt>Mandat i riksdagen</dt>` eller "platser i kammaren"
    - `withoutParticipation` (Ångfärjepartiet) saknar resultat: assert först, mot datan, att dess uuid inte förekommer i någon `rostresultat.partier` i `data/val/*/valresultat/riksdag.json` (så att en framtida import som ger partiet en rad felar med ett begripligt meddelande i stället för en förbryllande sidassertion); assert sedan `doesNotMatch /profile-results/`, `doesNotMatch /id="deltagande"/` och `doesNotMatch /<dt>Mandat i riksdagen<\/dt>/`, bredvid den befintliga Grundat-assertionen
    - Filer att ändra: `scripts/http-smoke.js`
14. `docs/riksdagsvalresultat.md`: nytt avsnitt "Partisidan" efter "Största partierna utanför riksdagen", med numrerade regler: (1) posterna är partiets uuid-kopplade röstrader per valår, (2) mandat från mandatfördelningen, 0 utan rad, (3) förändring mot föregående importerade val bara när partiet har rad i båda, (4) kammarmandat bara i det senaste valet med mandatfördelning, (5) källan står per rad; ej kopplade rader och aggregat används inte. Notera att `profil.json` inte bär valresultat
    - Filer att ändra: `docs/riksdagsvalresultat.md`
15. `README.md`: i avsnittet `val/<år>/valresultat/riksdag.json` (rad 115–117) lägg till en mening om att partisidan härleder sina resultat ur filen, med länk till det nya avsnittet
    - Filer att ändra: `README.md`

### Fas 5: Verifiering
16. `npm run precommit` (lint, typecheck, check:derived-data, validate:data, test, build:release, test:http) grönt
17. Manuell kontroll i `npm run dev`:
    - `/parti/miljopartiet-de-grona/` och `/parti/liberalerna-tidigare-folkpartiet/`: samma procent och mandat som före ändringen, plus röstetal i "Röster" (tidigare "—") och L:s serie börjar 1994
    - `/parti/partiet-nyans/` (röstrad 2022, inga mandat): hero med partikod + "Riksdagsvalet 2022 0,44 %", sektion med diagram, inget kammarblock, "Mot föregående val" enligt 2018-raden om den finns
    - Ett parti med bara historiska rader (sök i `data/val/2010/…` efter ett uuid som saknas 2014–2022): sektionen visar serien, heron visar partikod, inget kammarblock
    - `/parti/angfarjepartiet/`: ingen resultatsektion, ingen valdeltagandesektion
    - Klientnavigering: ingen direktlänk mellan två partisidor finns i dagens UI (partisidan länkar bara till startsidan, som avmonterar sektionen), så fallet är inte nåbart manuellt; `key={slug}` behålls som billigt skydd inför framtida länkar (t.ex. #21) och verifieras genom kodläsning
    - Startsidans riksdagssektion oförändrad

## Filöversikt

| Fil | Åtgärd | Syfte |
|-----|--------|-------|
| `src/types.ts` | Ändra | `PartiValresultat`/`PartiValresultatPost`; `PartiProfil.valresultat` och de gamla profiltyperna bort |
| `src/server/party-data.ts` | Ändra | Memoiserad läsning av resultatfilerna, `partyElectionResults()`, `PartyPageData.valresultat` |
| `scripts/party-data.test.js` | Ändra | Fixturer med röstrader utan mandat och två källor; tester för härledningen och kantfallen |
| `src/pages/parti/[filnamn].tsx` | Ändra | Läser `valresultat` ur props i stället för profilen |
| `src/components/party-profile/overview.tsx` | Ändra | Hero: mandatblock bara för kammarpartier, källrad ur posten |
| `src/components/party-profile/elections.tsx` | Ändra | Ny typ, kammarblock villkorat, `forandring`, källrad per valår, underrubrik för ett år |
| `src/styles/_party-profile.scss` | Ändra (vid behov) | Källistan i resultatsektionen |
| `scripts/validate.js` | Ändra | Avvisar `profil.valresultat` med hänvisning till importen |
| `scripts/validate.test.js` | Ändra | Deltestet för det kurerade fältet speglar avvisningen |
| `data/parti/liberalerna-tidigare-folkpartiet/profil.json` | Ändra | `valresultat` borttaget |
| `data/parti/miljopartiet-de-grona/profil.json` | Ändra | `valresultat` borttaget |
| `scripts/http-smoke.js` | Ändra | Assertions: kammarparti, parti utan mandat, parti utan resultat; samma siffra som `derived/riksdag.json` |
| `docs/riksdagsvalresultat.md` | Ändra | Avsnittet "Partisidan" med härledningsreglerna |
| `README.md` | Ändra | Meningen om partisidan under `val/<år>/valresultat/riksdag.json` |

## Berörda kodområden

- `src/server/` (`party-data.ts`)
- `src/components/party-profile/` (`overview.tsx`, `elections.tsx`)
- `src/pages/parti/`
- `src/types.ts`
- `scripts/` (`validate.js`, `http-smoke.js`, tester)
- `data/parti/<filnamn>/profil.json` (två filer)
- `docs/`, `README.md`

## Designbeslut

> Icke-triviala val gjorda under planeringen. Feedback välkommen; annars implementeras enligt dessa.

### 1. Det kurerade fältet tas bort, inte behålls som override
**Alternativ:** A) ta bort `profil.valresultat` helt; B) behålla det som override för resultat importen inte kan uttrycka; C) behålla det men låta validate kräva att det stämmer med importen.
**Beslut:** A.
**Motivering:** Issuets kriterium för B — "only if it can carry something the imported data cannot" — är prövat mot datan och faller: varje kurerad siffra finns i importen, och importen har mer. B skulle dessutom göra "samma siffra kan inte skilja sig" till något validering måste bevaka i stället för något strukturen garanterar. C är B med extra kod för ett fält utan innehåll. Att validering aktivt *avvisar* nyckeln (steg 11) är agentens bedömning: `validatePartyProfile()` släpper i dag igenom okända nycklar tyst, och ett kvarglömt `valresultat` skulle då bli en oanvänd påstådd källa i en publicerad datafil. **Proveniens:** användarbeslut för själva riktningen (issue #76: "the work here is … to remove the duplication"); agentens bedömning för att avvisa nyckeln — öppen att ifrågasätta.

### 2. Härledningen sker vid request i `party-data.ts`, inte som en ny derived-fil
**Alternativ:** A) `partyElectionResults()` i `src/server/party-data.ts` över de memoiserade resultatfilerna; B) ett nytt `data/derived/valresultat/<filnamn>.json` (eller en per-parti-del i `derived/riksdag.json`) byggt av `scripts/build-derived-data.js`.
**Beslut:** A.
**Motivering:** Issuet säger uttryckligen "the way the start page already does", och startsidans mandat läses vid request ur `val/<år>/valresultat/riksdag.json` av `readParliamentYears()` — alltså samma filer, samma modul, samma cache-mönster. Acceptanskriteriet "same validated files as the start page's overviews" uppfylls bokstavligt. B skulle ge 106 committade filer (eller en stor) som `check:derived-data` måste bevaka och som avviker från hur sidan i övrigt läser partidata. Kostnaden för A är åtta små JSON-filer lästa en gång per process — samma kostnad startsidan redan betalar. **Proveniens:** befintlig konvention (`readParliamentYears()` i `src/server/party-data.ts`); valet mellan A och B är agentens bedömning.

### 3. "Kammarmandat" betyder mandat i det senaste importerade valet
**Alternativ:** A) kammarblock och "Mandat i riksdagen" visas när partiets *senaste post* har `mandat > 0`; B) bara när partiet har mandat i *kammaråret* (det senaste importerade valet — validering garanterar att varje fil har en fullständig mandatfördelning, så det är samma val som `buildParliamentView()` kallar `kammare`).
**Beslut:** B, uttryckt som `PartiValresultat.kammare`.
**Motivering:** Med A skulle ett parti vars senaste rad är 2010 med 3 mandat få "Partiets 3 platser i kammaren" ovanpå ett kammardiagram för 2022 — en falsk uppgift. `data/derived/riksdag.json` och startsidan definierar redan kammaren som det senaste valet; partisidan ska säga samma sak. Kammarblocket, mandatblocket i heron och `mandateCount` i företrädarsektionen styrs alla av `kammare`. **Proveniens:** befintlig konvention för definitionen (`scripts/build-derived-data.js`, `docs/riksdagsvalresultat.md` punkt 2); att koda den som ett eget fält är agentens bedömning.

### 4. Partier med röstrad men utan kammarmandat får sektionen och ett hero-block
**Alternativ:** A) sektion och "Riksdagsvalet ÅÅÅÅ X %" i heron för varje parti med minst en kopplad röstrad, partikoden kvar som första block; B) bara partier som någon gång haft mandat; C) en tröskel (t.ex. ≥ 1 % någon gång).
**Beslut:** A.
**Motivering:** Partidata återger Valmyndighetens siffror som de är; 0,44 % för Partiet Nyans eller 0,00 % (6 röster) för ett litet parti är sanna, källbelagda uppgifter om just det partiet, och sidan visar dem med samma källrad som riksdagspartierna. B och C är redaktionella val om vilka resultat som "räknas", vilket projektet i övrigt undviker (jfr #75, #77 i #68). Konsekvensen är att ~98 sidor får en sektion med ett diagram där mandatremsan visar nollor — det är läsbart och sant. Hero-räkningen förblir tre block (partikod, Riksdagsvalet, deltagande) plus eventuellt Grundat. **Proveniens:** agentens bedömning, öppen att ifrågasätta — särskilt 0,00 %-fallen. Om användaren vill ha en tröskel är den en enradig ändring i `partyElectionResults()` (filtrera på `roster`), inte en strukturändring.

### 5. "Mot föregående val" beräknas i servern mot föregående *importerade* val
**Alternativ:** A) komponenten jämför med föregående post i partiets serie (dagens beteende); B) servern sätter `forandring` bara när partiet har rad i det närmast föregående importerade valet.
**Beslut:** B.
**Motivering:** A ger för ett parti med rader 2010 och 2022 en "förändring mot föregående val" som i själva verket spänner tolv år och två val. Komponenten känner inte till vilka val som finns; servern gör det. Att räkna i servern gör regeln testbar i `node:test` utan React. Fältet utelämnas (inte 0) när jämförelsen inte finns, så komponenten renderar "—". **Proveniens:** agentens bedömning.

### 6. Källan står per valår i sektionen, inte som en deduplicerad lista
**Alternativ:** A) `PartiValresultat.kallor` som deduplicerad union av alla års källor, renderad som i dag (`results.kallor.map(SourceLine)`); B) `kalla`/`mandatkalla` per post, renderade en rad per valår med året som prefix.
**Beslut:** B.
**Motivering:** Källorna skiljer sig per år (SCB 1994–1998, Valmyndighetens arkivsidor 2002–2018 med separat mandatsida 2010–2018, JSON 2022) men har samma `namn` och `hamtad`, så A skulle rendera nio rader som alla lyder "Valmyndigheten · hämtat 2026-08-26" med olika länkar — oläsbart. Med B blir varje rad urskiljbar ("Riksdagsvalet 1994 · SCB · hämtat …"), och den valda postens header kan namnge sin egen källa i stället för det hårdkodade "Valmyndigheten", vilket i dag är fel för 1994 och 1998 (SCB). Samma sak gäller de två hårdkodade "Valmyndigheten · slutlig rösträkning"-texterna i sektionsheadern och intron: de byts till seriens källnamn ("SCB och Valmyndigheten · slutligt resultat" för MP), efter mönstret `turnoutSourceNames` i `TurnoutSection`. Valmyndigheten-bilden i `SectionHeader`-branden står kvar — Valmyndigheten är valmyndigheten även när SCB publicerade tabellen — men det är en bedömning värd att pröva. "Slutligt resultat" skrivs som fast text eftersom `validate.js` kräver `status: "slutligt"` i varje fil. **Proveniens:** agentens bedömning.

## Verifieringschecklista

- [ ] Partisidans resultat kommer ur `val/<år>/valresultat/riksdag.json` via `src/server/party-data.ts`; inget läses ur `profil.json` (acceptanskriterium 1)
- [ ] `scripts/http-smoke.js` kontrollerar att Miljöpartiets mandat på partisidan är samma siffra som `data/derived/riksdag.json` kammare (acceptanskriterium 2)
- [ ] Ångfärjepartiet (och varje parti utan kopplad röstrad) renderar varken resultatsektion, valdeltagandesektion eller "Mandat i riksdagen" (acceptanskriterium 3)
- [ ] `npm run validate:data` avvisar `profil.valresultat`; `scripts/party-data.test.js` täcker härledningen inklusive kantfallen i "Angreppssätt" (acceptanskriterium 4)
- [ ] L och MP visar samma procent och mandat som före ändringen; "Röster" är ifyllt; L:s serie börjar 1994
- [ ] Parti med röstrad utan mandat: hero med partikod + "Riksdagsvalet ÅÅÅÅ", sektion utan kammarblock, mandatremsa med 0
- [ ] Parti vars senaste rad inte är kammaråret: inget kammarblock, inget mandatblock i heron
- [ ] "Mot föregående val" visar "—" för första posten och vid lucka i serien
- [ ] Källraderna i sektionen namnger SCB för 1994/1998 och länkar mandatkällan separat 2010–2018; sektionsheader och intro namnger seriens källor, inte enbart Valmyndigheten
- [ ] Parti med röstrad utan mandat får valdeltagandesektionen (`id="deltagande"`); parti utan resultat får den inte (smoke)
- [ ] Klientnavigering från en sida med många poster till en med en post renderar sektionen (`key={slug}`)
- [ ] Props innehåller inga explicita `undefined`-värden (`forandring`, `mandatkalla`, `kammare`, `valresultat` utelämnas)
- [ ] Startsidans riksdagssektion och "största utanför riksdagen" är oförändrade (befintliga tester och smoke)
- [ ] `node scripts/parti.js` och `npm run check:derived-data` är no-diff
- [ ] `npm run precommit` grönt
