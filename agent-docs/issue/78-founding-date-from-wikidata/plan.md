# Plan: Issue #78 — Show when a party was founded, from Wikidata

## Mål

Partisidan ska kunna visa när partiet grundades — en hård, källbelagd uppgift från Wikidata (P571) — tydligt åtskild från registreringsdatumet hos Valmyndigheten. Kopplingen till Wikidata görs per parti genom ett manuellt granskat Q-id i partifilen; ett skript (`npm run import-wikidata`) hämtar grundandedatumet för de partier som har ett Q-id och skriver det genom registrets ordinarie skrivväg så att fältet överlever varje ombyggnad. Ingen namn-matchning sker i datavägen — ett datum visas bara för partier vars Wikidata-post en människa har bekräftat.

## Triagering

> Beslutsunderlag för detta issue.

| Fält | Värde |
|------|-------|
| **Blockeras av** | Inget — #79 (fält överlever ombyggnad) är stängt och implementerat (`extra`-mekanismen i `scripts/parti.js`) |
| **Blockerar** | Inget direkt; formbeslutet (en `wikidata`-sektion) sätter mönstret för P856 i #70 |
| **Relaterade issues** | #68 (paraply, "Part of"), #70 (partiets webbplats — kan senare ta P856 ur samma sektion), #79 (stängd förutsättning), #80 (öppet, flyttar `data/parti/index.json` — samma skriptkedja, bör inte arbetas parallellt) |
| **Omfattning** | ~13 kod-/dokumentfiler (nytt `scripts/import-wikidata.js` + test, `scripts/validate.js` + test, `scripts/http-smoke.js`, `src/types.ts`, `src/pages/parti/[filnamn].tsx`, `src/components/party-profile/overview.tsx`, `src/components/party-profile/shared.tsx`, `src/styles/_party-profile.scss`, `package.json`, `README.md`, `CLAUDE.md`) + `data/parti/<filnamn>/index.json` × 8 + ev. fixtures |
| **Risk** | Låg–Medel (ny nätverksberoende importväg, men den återanvänder #79:s bevarandemekanism och rör inte befintliga fält; sidändringen är additiv) |
| **Komplexitet** | Medel (Wikidata-tidsvärden med precision, rank, kalendermodell och snaktype kräver noggrann extraktion) |
| **Säker för junior** | Ja, med planen följd — Wikidata-formatets kantfall är dokumenterade i steg 2 |
| **Konfliktrisk** | Låg–Medel. Alla befintliga planmappar hör till stängda issues, men #80 (öppet, ingen plan) berör också `scripts/validate.js`, README och antaganden om `data/parti/index.json`-projektionen — den här planen ändrar inte `scripts/parti.js`, bara konsumerar kedjan, men de två bör inte arbetas parallellt |

### Triagemässiga noteringar

- Issuets "Depends on #79" är uppfyllt: #79 mergades i `630808c`. `wikidata` blir ett utökningsfält enligt exakt det kontrakt #79 införde — `loadParties()` bär det i `party.extra`, `_orderKeys()` skriver det efter de kända fälten i bokstavsordning, och `validate.js` släpper igenom nyckelnamnet. Inget i `scripts/parti.js` behöver ändras.
- "Part of #68" är paraply-koppling, inte blockering.
- Inget projektbräde är konfigurerat (`agent-docs/github/project.json` saknas), så ingen board-status har stämts av; issuet bär etiketten `enhancement`, har ingen assignee, ingen milstolpe och inga kommentarer.
- Repot har inga `release/*`-refs (varken lokalt eller mot `origin` i det lokala refläget); planen utgår från `main`.

## Angreppssätt

**Datan.** Partifilen `data/parti/<filnamn>/index.json` får en `wikidata`-sektion (utökningsfält enligt #79):

```json
"wikidata": {
  "id": "Q10613549",
  "grundat": "1988-02-06",
  "hamtad": "2026-08-29"
}
```

- `id` — Wikidata-entitetens Q-id. **Ägs av människor**: läggs till för hand (via PR) först när någon bekräftat att posten avser samma parti. Detta är issuets andra alternativ — den explicita, granskade länken — och det som gör varje uppgift spårbar till en entitet i stället för till en strängjämförelse. Käll-URL:en härleds ur id:t (`https://www.wikidata.org/wiki/<id>`), så ingen separat `url` lagras.
- `grundat` — P571 i den precision Wikidata anger: `"1988"`, `"1988-02"` eller `"1988-02-06"`. **Ägs av skriptet**; saknar entiteten P571 utelämnas fältet (och ett tidigare värde tas bort vid nästa hämtning — kvar vore ett påstående utan källa).
- `hamtad` — datum för senaste hämtning, `ÅÅÅÅ-MM-DD`. Ägs av skriptet.

Sektionen rymmer framtida Wikidata-egenskaper (P856 för #70, P1142) utan nytt formbeslut — fler skript-ägda nycklar bredvid `grundat`.

**Skriptet.** `scripts/import-wikidata.js` (`npm run import-wikidata`) läser registret via `loadParties()`, hämtar `Special:EntityData/<id>.json` för varje parti med `extra.wikidata.id`, extraherar P571 och skriver om registret via `buildParties()` + `writeFiles()` — samma kedja som `import-val`, vilket ger kanonisk serialisering och garanterar att `node scripts/parti.js` efteråt är no-diff. Innan något skrivs valideras varje byggd `wikidata`-sektion med samma valideringsfunktion som `validate.js` använder (delad, exporterad — se fas 1), och alla hämtningar och extraktioner ska ha lyckats: ett misslyckat anrop eller oväntat svar kastar innan `writeFiles()` anropas, som registrets övriga fel.

**Sidan.** Grundandedatumet visas som ett eget nyckelfakta-block ("Grundat") i partisidans hero, med källrad "Wikidata Q… · CC0 · hämtat …" där Q-id:t står synligt i länktexten. Registreringsdatumet står kvar orört i registersektionen med sin Valmyndigheten-inramning; de två datumen delar aldrig sektion, rubrik eller källmärkning. Observera att profilerade partier (L, MP) redan renderar tre block (två resultat + deltagande) — med "Grundat" blir de fyra, så gridden behöver ett uttalat fyrspaltsläge (fas 4); oprofilerade partier går från två block till tre och fyller dagens tre kolumner. Partier utan `wikidata.grundat` renderar exakt dagens hero — blocket är villkorat, ingen tom platshållare.

**Valideringen.** `scripts/validate.js` validerar sektionen semantiskt när den finns: Q-id-mönster, datum som är verkliga kalenderdatum i varje precision, `hamtad`, en sluten nyckeluppsättning, samt att inget Q-id används av två partier — dubblettkontrollen är det datalager-skydd som finns mot att en felmatchning kopierar ett annat partis identitet.

**Seedningen.** De åtta riksdagspartierna får `wikidata.id` i denna PR. Q-id:na slås upp och bekräftas manuellt (etikett, beskrivning och officiell webbplats i Wikidata-posten mot partiets kända uppgifter), listas parti-för-parti i PR-bodyn tillsammans med råa P571-påståenden, och PR-granskningen är den mänskliga bekräftelse acceptanskriteriet kräver. Övriga partier ansluts löpande via PR, aldrig via automatisk matchning.

### Wikidata-extraktionens kantfall (steg 2 förutsätter dessa)

- **Tidsformat:** P571-värden är `{ time: "+1988-02-06T00:00:00Z", precision: 9|10|11, calendarmodel, before, after, ... }`. Precision 9 = år, 10 = månad, 11 = dag; vid lägre precision innehåller time-strängen `-00-` för de okända delarna. `grundat` byggs av exakt de delar precisionen täcker. Precision < 9 (årtionde och grövre) avvisas med fel — inget svenskt parti bör ha det, och ett fel är bättre än ett hittat-på år. Precision > 11 (timme och finare) trunkeras till dag — värdet innehåller då redan ett fullständigt datum.
- **Snaktype och värdesaknad:** endast `snaktype: "value"` med ett `datavalue` av typen `time` är användbart. `somevalue`/`novalue`, saknat `datavalue` eller fel värdetyp behandlas som att påståendet saknar användbart värde; finns inget användbart P571 alls utelämnas `grundat`. En tidssträng som inte matchar det förväntade formatet, eller ett år utanför rimlig domän (före 1800, efter innevarande år), är fel — inte tyst överhoppning.
- **Kalendermodell:** endast proleptisk gregoriansk kalender (`Q1985727`) accepteras; annan kalendermodell (t.ex. juliansk) ger fel som namnger partiet, så en människa får avgöra hur datumet ska tolkas i stället för att skriptet tyst konverterar.
- **Osäkerhetsintervall:** `before`/`after` skilda från 0 ger fel — ett intervall är inte "grundat den".
- **Rank och flera värden:** använd best-rank-regeln — finns `preferred`-rankade P571 används endast de, annars `normal`; `deprecated` ignoreras alltid. Kvarstår flera värden med olika datum efter rank-filtret ger det fel som listar värdena och hänvisar till Wikidatas egen lösning — sätt `preferred`-rank på rätt påstående där (eller ta bort Q-id:t) — i stället för att skriptet tyst gissar; "välj tidigaste" kunde tyst plocka en föregångares eller omstridd bildningstid. Flera värden med samma resulterande datum är okej.
- **Anropen:** sekventiellt (ingen parallellhämtning), med beskrivande `User-Agent` enligt Wikimedias User-Agent-policy. `fetchText` i `scripts/utils.js` räcker inte här — den tar varken headers eller exponerar status/`Retry-After` — så importskriptet får en egen liten hämtfunktion (`fetchEntity(id)` e.d.) byggd direkt på `fetch`, som sätter User-Agent, respekterar HTTP 429 (vänta enligt `Retry-After`, begränsat antal omförsök; kvarstående 429/5xx är fel) och `JSON.parse`:ar svaret. Svar utan entiteten (omdirigerat/raderat Q-id, ett svar vars entitetsnyckel inte är det begärda id:t, eller trasig JSON) är fel, inte tyst överhoppning.

## Steg

### Fas 1: Datamodell och validering

1. Skriv en återanvändbar, ren valideringsfunktion för sektionen (t.ex. `validateWikidataSection(value, context)`), exporterad så både `validate.js` och importskriptet kan anropa den: `wikidata` ska vara ett objekt (inte array/null), `id` krävs (mönster `^Q[1-9]\d*$`), `hamtad` krävs (`ÅÅÅÅ-MM-DD`), `grundat` är valfritt och ska vara ett verkligt kalenderdatum i någon av precisionerna (`"1988"`, `"1988-02"`, `"1988-02-06"` — månad 01–12, dag giltig för månaden; `2026-99-99` och `1988-00` avvisas). Nyckeluppsättningen är sluten: endast `id`, `grundat`, `hamtad` tillåts, så stavfel som `grundatt` inte överlever tyst — P856 i #70 utökar uppsättningen när den implementeras. Läggs i `scripts/validate.js` och exporteras därifrån (ingen cirkulär require: `validate.js` → `parti.js` finns redan, importskriptet får kräva båda).
   - Filer att ändra: `scripts/validate.js`
2. Anropa funktionen i `validatePartyRegistry` när `party.wikidata` finns, och lägg till dubblettkontroll: samma `wikidata.id` får inte förekomma i två partifiler (samla under registerloopen, assert:a efteråt).
   - Filer att ändra: `scripts/validate.js`
3. Tester: giltig sektion i alla tre precisioner passerar; trasigt Q-id, omöjliga datum, tomma strängar, array/null som sektion, okänd nyckel, saknad `hamtad` och delat Q-id felar med begripliga meddelanden.
   - Filer att ändra: `scripts/validate.test.js`

### Fas 2: Importskriptet

1. Skapa `scripts/import-wikidata.js` med flödet: `loadParties()` → filtrera partier med `extra.wikidata.id` → hämta `https://www.wikidata.org/wiki/Special:EntityData/<id>.json` per parti (egen `fetchEntity`-hjälpfunktion enligt kantfallsavsnittet: User-Agent, sekventiellt, 429/`Retry-After`-omförsök, JSON- och entitetsnyckel-kontroll) → extrahera P571 enligt kantfallsreglerna → sätt `extra.wikidata.grundat`/ta bort vid saknad P571, sätt `extra.wikidata.hamtad` till dagens datum → validera varje ändrad sektion med fas 1-funktionen och assert:a i minnet att inget Q-id förekommer hos två partier (disk-valideringen i `validate:data` kommer först efteråt) → `loadYearFiles()` + `buildParties()` + `validate()` + `writeFiles()`. Alla hämtningar och extraktioner ska ha lyckats innan `writeFiles()` anropas (`writeFiles` är sekventiell, inte transaktionell — därför ligger alla fel före skrivsteget).
   - Kärnan struktureras som en ren funktion (t.ex. `applyWikidata(parties, entities, today)`) som muterar/returnerar partilistan, med extraktionen (`foundingDateFromEntity(entity, id)`), hämtfunktionen och argumentparsningen exporterade och `fetch`/klocka injicerbara — CLI-delen kopplar ihop de verkliga beroendena, samma mönster som `import-val.js`.
   - CLI: `npm run import-wikidata` (alla partier med Q-id), `npm run import-wikidata -- --parti <filnamn>` (ett parti; okänt filnamn eller parti utan Q-id ger begripligt fel). `--file <sökväg>` behövs inte — ingen bulk-källfil finns att peka på.
   - Filer att skapa: `scripts/import-wikidata.js`
2. Registrera npm-skriptet.
   - Filer att ändra: `package.json` (`"import-wikidata": "node scripts/import-wikidata.js"`)
3. Tester med fixture-entiteter (JSON i `scripts/fixtures/` vid behov): precision 9/10/11, precision > 11 trunkeras till dag, `preferred` vinner över `normal`, `deprecated` ignoreras, flera olika best-rank-datum → fel, `somevalue`/`novalue`/saknat `datavalue` → inget `grundat`, icke-gregoriansk kalendermodell → fel, `before`/`after` ≠ 0 → fel, precision < 9 → fel, trasig JSON och fel entitetsnyckel → fel, omförsökslogiken (`Retry-After` respekteras, gräns nås → fel), samt argumentparsningen. Därtill ett in-memory-integrationstest av `applyWikidata` med injicerad fetch och klocka (`loadParties`/`writeFiles` är rotade i repot och refaktoreras inte här): bara `--parti`-partiet ändras, försvunnen P571 tar bort `grundat` men behåller `id` och övriga sektionsnycklar, misslyckad hämtning kastar innan någon skrivmängd byggts, och `hamtad` är deterministiskt.
   - Filer att skapa/ändra: `scripts/import-wikidata.test.js`, ev. `scripts/fixtures/`

### Fas 3: Seed-data för riksdagspartierna

1. Slå upp och bekräfta Q-id för de åtta riksdagspartierna (Socialdemokraterna, Moderaterna, Sverigedemokraterna, Centerpartiet, Vänsterpartiet, Kristdemokraterna, Liberalerna, Miljöpartiet) direkt mot wikidata.org — kontrollera etikett, beskrivning och officiell webbplats mot partiets kända uppgifter. Lägg in `wikidata`-sektionen (endast `id`) i respektive `data/parti/<filnamn>/index.json`.
2. Kör `npm run import-wikidata` så skriptet fyller `grundat` och `hamtad`, och committa resultatet.
3. Kör `node scripts/parti.js` och verifiera no-diff (bevarandekontraktet från #79 håller).
4. Lista parti → Q-id → grundat i PR-bodyn, tillsammans med varje partis råa P571-påståenden (värde, precision, rank), för granskarens bekräftelse.
   - Filer att ändra: `data/parti/<filnamn>/index.json` × 8

### Fas 4: Typer och partisidan

1. Lägg till `PartiWikidata` (`id: string; grundat?: string; hamtad: string`) i `src/types.ts` och `wikidata?: PartiWikidata` på `Parti`. `PartyPageData` sprider hela partifilen, så värdet når sidan utan ändring i `src/server/party-data.ts`; `PartiIndexEntry` och startsidan berörs inte (utökningsfält projiceras inte till `parti/index.json`).
   - Filer att ändra: `src/types.ts`
2. Destrukturera `wikidata` i `PartyPage` och skicka till `ProfileHero`.
   - Filer att ändra: `src/pages/parti/[filnamn].tsx`
3. Lägg en precisionsmedveten formatterare i `src/components/party-profile/shared.tsx` (bredvid `formatSwedishDate`): `"1988"` → "1988", `"1988-02"` → "feb 1988", `"1988-02-06"` → "06 feb 1988" — `formatSwedishDate` får aldrig matas med `"1988"`, som skulle bli "01 jan 1988".
   - Filer att ändra: `src/components/party-profile/shared.tsx`
4. Rendera nyckelfakta-blocket i `ProfileHero` när `wikidata?.grundat` finns: `<dt>Grundat</dt>`, `<dd>` med `<time dateTime={grundat}>` runt det formaterade datumet, och `<dd class="profile-source">` med "<a href="https://www.wikidata.org/wiki/<id>">Wikidata <id></a> · CC0 · hämtat <hamtad>" — Q-id:t står synligt i länktexten, inte bara i URL:en.
   - Filer att ändra: `src/components/party-profile/overview.tsx`
5. Ge gridden ett uttalat fyrspaltsläge: profilerade partier renderar redan tre block (två resultat + deltagande), så med "Grundat" blir de fyra — ett ensamt block på rad två i dagens `repeat(3, …)`. Låt komponenten sätta en modifierare (t.ex. `profile-keyfacts--four`) när fyra block renderas, med `grid-template-columns: repeat(4, minmax(0, 1fr))` på desktop; den befintliga tvåspalts-brytpunkten ger 2×2 på smalare skärm och `:last-child:nth-child(odd)`-regeln hanterar udda antal som i dag. Verifiera profilerad och oprofilerad sida på desktop-, tablet- och mobilbredd.
   - Filer att ändra: `src/styles/_party-profile.scss`, `src/components/party-profile/overview.tsx`
6. Kontrollera att länken i `dd.profile-source` får läsbar färg/understrykning i hero-kontexten; lägg annars till en regel intill `.profile-keyfacts dd.profile-source`.
   - Filer att ev. ändra: `src/styles/_party-profile.scss`

### Fas 5: Dokumentation

1. README: `wikidata`-sektionen dokumenteras under `parti/<filnamn>/index.json` (fältets delar, ägarskapet — `id` av människor, `grundat`/`hamtad` av skriptet — och att ett Q-id bara läggs till efter manuell bekräftelse), och `npm run import-wikidata` får ett eget avsnitt under "Köra skripten".
   - Filer att ändra: `README.md`
2. CLAUDE.md: en rad om `npm run import-wikidata` i skriptuppräkningen under "Stack".
   - Filer att ändra: `CLAUDE.md`

### Fas 6: Verifiering

1. Utöka `scripts/http-smoke.js`: sidan för ett seedat parti ska innehålla "Grundat", det synliga Q-id:t och hämtdatumet.
   - Filer att ändra: `scripts/http-smoke.js`
2. `npm run precommit` (lint, typecheck, derived-data, validate:data, test, release-bygge, HTTP-smoke).
3. Manuell kontroll i `npm run dev`: ett seedat parti visar "Grundat" med källrad; ett parti utan sektion ser ut exakt som i dag; L och MP (som har `profil.json`) visar inte dubbla eller motstridiga grundat-uppgifter i hero (Wikipedia-faktarutan "Bildat 1981" ligger kvar i sin egen sektion med egen källa — det är två källor som redovisar var sin uppgift, inte en konflikt).

## Filöversikt

| Fil | Åtgärd | Syfte |
|-----|--------|-------|
| `scripts/import-wikidata.js` | Skapa | Hämtar P571 för partier med bekräftat Q-id, skriver via registrets skrivväg |
| `scripts/import-wikidata.test.js` | Skapa | Extraktion (precision, rank, snaktype, kalendermodell), hämtning/omförsök, argumentparsning, in-memory-integration |
| `scripts/validate.js` | Ändra | Delad semantisk validering av `wikidata`-sektionen + Q-id-dubblettkontroll |
| `scripts/validate.test.js` | Ändra | Tester för valideringen |
| `scripts/http-smoke.js` | Ändra | Assertion på "Grundat" + Q-id + hämtdatum för seedat parti |
| `package.json` | Ändra | `import-wikidata`-skriptet |
| `src/types.ts` | Ändra | `PartiWikidata`, `Parti.wikidata` |
| `src/pages/parti/[filnamn].tsx` | Ändra | Skicka `wikidata` till hero |
| `src/components/party-profile/overview.tsx` | Ändra | "Grundat"-nyckelfakta med källrad, fyrblocks-modifierare |
| `src/components/party-profile/shared.tsx` | Ändra | Precisionsmedveten datumformatterare |
| `src/styles/_party-profile.scss` | Ändra | Fyrspaltsläge för nyckelfakta, ev. länkstil i källraden |
| `data/parti/<filnamn>/index.json` (×8) | Ändra | Seedade `wikidata`-sektioner för riksdagspartierna |
| `README.md` | Ändra | Fältdokumentation + skriptavsnitt |
| `CLAUDE.md` | Ändra | Skriptuppräkningen |

## Berörda kodområden

- `scripts/` (nytt importskript, validering)
- `src/components/party-profile/`, `src/pages/parti/`, `src/types.ts` (rendering)
- `data/parti/` (seedade sektioner)
- `README.md`, `CLAUDE.md`, `package.json`

## Designbeslut

> Icke-triviala val gjorda under planeringen. Feedback välkommen; annars implementeras enligt dessa.

### 1. Fältet ligger i partifilen, som en `wikidata`-sektion

**Alternativ:** partifilen (`index.json`) vs `profil.json`; fristående fält vs sektion.
**Beslut:** en `wikidata`-sektion i partifilen.
**Motivering:** *Agentens bedömning inom issuets uppställda ram — öppen att ifrågasätta.* Issuet ställer upp båda alternativen utan att avgöra. Partifilen skalar till alla 670 partier — bara två har `profil.json`, och ett grundandedatum ska inte kräva att en hel kurerad profil skapas först — och är den fil issuet självt pekar ut som "the file people can correct through a pull request". Invändningen att partifilen annars speglar enbart Valmyndigheten besvaras strukturellt: sektionsnamnet `wikidata` gör källan explicit per uppgift, så inget i filen ser längre ut att komma från Valmyndigheten utan att göra det. Sektionsformen (inte ett fristående `grundat`-fält) är issuets egen uppmaning att "decide the shape once" — P856 (#70) och P1142 får plats utan nytt beslut. #79 byggde exakt bevarandemekanismen detta kräver.

### 2. Q-id i data, aldrig namn-matchning i datavägen

**Alternativ:** namnmatchning med manuell bekräftelse per parti vs manuellt granskat Q-id i filen.
**Beslut:** Q-id i filen; skriptet vägrar röra partier utan Q-id.
**Motivering:** Issuets egen riskanalys (157 träffar varav 12 tvetydiga; fel match är värre än ingen uppgift) pekar mot det spårbara alternativet, och acceptanskriteriet kräver bekräftad identitet. PR-flödet *är* den manuella bekräftelsen — granskad diff med Q-id-lista i PR-bodyn. En automatisk namnmatchare (ens som förslagsgenerator) lämnas medvetet utanför: den kan läggas till senare som rent rapporterande verktyg utan att datavägen ändras.

### 3. Minimal sektion: `id`, `grundat`, `hamtad` — käll-URL härleds

**Alternativ:** full `PartiProfilKalla`-struktur (`namn`/`url`/`hamtad`) per uppgift vs härledd källa.
**Beslut:** ingen lagrad käll-URL; sidan bygger `https://www.wikidata.org/wiki/<id>` ur id:t.
**Motivering:** *Agentens bedömning.* Källan är per konstruktion alltid Wikidata-entiteten själv — en lagrad URL vore en kopia av id:t som kan glida isär från det. `hamtad` behålls som eget fält eftersom det är hämtningens fakta, inte entitetens. Acceptanskriteriets "source, Q-id and fetch date" uppfylls: källan syns i sektionsnamnet och på sidan, Q-id:t och hämtdatumet står i sektionen.

### 4. Skriptet äger `grundat` och `hamtad`; saknad P571 tar bort `grundat`

**Alternativ:** behålla ett gammalt `grundat` när entiteten inte längre har P571 vs ta bort det.
**Beslut:** ta bort vid nästa körning.
**Motivering:** Ett kvarlämnat datum vore ett påstående vars källa inte längre gör det — motsatsen till projektets källkravsprincip. `id` rörs aldrig av skriptet; att koppla bort ett parti från Wikidata är ett mänskligt beslut, precis som att koppla det.

### 5. Placering i hero-nyckelfakta, inte i registersektionen

**Alternativ:** hero-`profile-keyfacts` vs `RegistrySection` vs egen sektion.
**Beslut:** ett villkorat block i heros nyckelfakta, med uttalat fyrspaltsläge för profilerade partier.
**Motivering:** *Agentens bedömning — öppen att ifrågasätta.* Acceptanskriteriet kräver visuell åtskillnad från registreringsdatumet; registersektionen är helt Valmyndigheten-märkt och fel hem för en Wikidata-uppgift. Hero-gridden har ett etablerat mönster för uppgift + källrad, syns för alla partier (inte bara profilerade), och ett villkorat block gör att sidor utan datum ser färdiga ut utan platshållare. Priset är layoutarbetet: profilerade partier går från tre block till fyra, vilket kräver fyrspaltsläget i fas 4 — fortfarande billigare och rättare än en egen sektion för en enda uppgift.

### 6. Precision lagras som avhuggen ISO-sträng

**Alternativ:** alltid fullt datum vs sträng i källans precision (`"1988"`, `"1988-02"`, `"1988-02-06"`) vs separat precisionsfält.
**Beslut:** avhuggen ISO-sträng.
**Motivering:** Att skriva `"1988-01-01"` för precision "år" vore att hitta på en uppgift. Strängformen bär precisionen i sig, sorterar rätt lexikografiskt och valideras semantiskt. Renderingen anpassar sig efter precisionen via formatteraren i fas 4 ("1988", "feb 1988", "06 feb 1988").

## Verifieringschecklista

- [ ] Grundandedatum visas endast för partier med manuellt bekräftat Q-id (acceptanskriterium 1)
- [ ] Uppgiften visar Q-id:t synligt i länktexten och hämtdatumet, och är visuellt skild från Valmyndighetens registreringsdatum (acceptanskriterium 2)
- [ ] `node scripts/parti.js` efter import är no-diff — fältet överlever ombyggnad (acceptanskriterium 3)
- [ ] Parti utan `wikidata`/`grundat` renderar dagens sida oförändrad, utan tomma platshållare; profilerade partier med fyra nyckelfakta-block ser rätt ut på desktop, tablet och mobil (acceptanskriterium 4)
- [ ] `npm run validate:data` felar på trasigt Q-id, omöjliga datum, okänd sektionsnyckel, saknad `hamtad` och Q-id-dubbletter (acceptanskriterium 5)
- [ ] Precision 9/10/11 lagras och renderas korrekt ("1988", "feb 1988", "06 feb 1988"); `"1988"` blir aldrig "01 jan 1988"
- [ ] `preferred`-rank vinner; `deprecated` ignoreras; flera olika best-rank-datum ger fel som hänvisar till rank-markering på Wikidata
- [ ] `somevalue`/`novalue`/saknad P571 ger sektion utan `grundat` och sidan visar inget datum; icke-gregoriansk kalender och `before`/`after` ≠ 0 ger fel
- [ ] Q-id som inte längre finns/omdirigerats ger fel, inte tyst överhoppning; misslyckad körning lämnar filsystemet orört
- [ ] HTTP-smoke verifierar "Grundat" + Q-id + hämtdatum på seedad sida; `npm run precommit` grönt
- [ ] PR-bodyn listar parti → Q-id → grundat med råa P571-påståenden för granskarens bekräftelse och avslutas med `Closes #78` (inte `Closes #68` — paraplyet refereras med `Part of #68`)
