# Plan: Issue #79 — Party files silently lose fields they are not expected to have

## Mål

Gör partifilerna (`data/parti/<filnamn>/index.json`) till en faktisk sanningskälla: ett fält som lagts till för hand ska överleva både `node scripts/parti.js` och en om-import, i stället för att tyst försvinna. Skripten fortsätter äga de fält de hanterar; allt annat passerar igenom med bevarat innehåll, på en stabil plats i filen så att utskriften förblir byte-stabil. `scripts/validate.js` definierar vad ett acceptabelt extrafält är, och samma krav upprätthålls i skrivvägen så att en ogiltig nyckel stoppar körningen innan något skrivs.

## Triagering

> Beslutsunderlag för detta issue.

| Fält | Värde |
|------|-------|
| **Blockeras av** | Inget |
| **Blockerar** | #78 (grundandedatum från Wikidata behöver ett fält som överlever ombyggnad) |
| **Relaterade issues** | #78, #80, #26 |
| **Omfattning** | 7 filer: `scripts/parti.js`, `scripts/validate.js`, fyra testfiler, `README.md` |
| **Risk** | Låg–Medel (delad kod som skriver om samtliga 670 partifiler via fyra ingångar; hålls nere av no-diff-verifiering mot committad data) |
| **Komplexitet** | Låg–Medel |
| **Säker för junior** | Ja |
| **Konfliktrisk** | Låg så länge #80 inte arbetas parallellt (#80 berör också `scripts/parti.js`/indexskrivningen men har ingen plan ännu; alla befintliga planmappar hör till stängda issues). README-noten tangerar #25 (README-uppdatering), utan aktiv PR |

### Triagemässiga noteringar

- #78 (grundad-datum från Wikidata) deklarerar uttryckligen "Depends on #79" — det här issuet bör göras först, och fältformen i #78 avgörs där, inte här.
- #80 föreslår att flytta `data/parti/index.json` till `data/derived/parti.json`. Den här planen rör inte indexets plats, bara vad partifilerna behåller — men båda ändrar `scripts/parti.js`, så de bör inte arbetas parallellt.
- Inget projektbräde är konfigurerat (`agent-docs/github/project.json` saknas), så ingen board-status att stämma av.

## Angreppssätt

`loadParties()` (`scripts/parti.js:46`) läser varje partifil men plockar bara ut en fast fältuppsättning; `buildParties()` (`scripts/parti.js:372`) bygger om `data` från grunden och `_orderKeys()` (`scripts/parti.js:530`) skriver enbart nycklarna i `PARTY_KEY_ORDER`. Ett handtillagt fält försvinner alltså tyst vid nästa körning av `node scripts/parti.js`, `npm run import-val`, `npm run import-partisymboler` eller `scripts/measure-partisymboler.js` — alla fyra går genom samma `loadParties()` → `buildParties()` → `writeFiles()`-kedja, så en fix i de delade funktionerna täcker samtliga ingångar.

**Fältgränsen.** `PARTY_KEY_ORDER` är i dag en serialiseringsordning, men den är också exakt uppsättningen nycklar skripten hanterar — med olika företrädesregler per fält:

- *Härledda från valdata:* `kod`, `tidigare_koder`, `beteckning`, `tidigare_beteckningar`, `omrade`, `deltagande` byggs om från årsfilerna vid varje bygge; `forkortning` och `registrerad_partibeteckning` skrivs över när ett derived-årsrekord finns och behålls från filen annars.
- *Identitet och historik:* `uuid`, `filnamn`, `tidigare_filnamn` — läses från filen och underhålls av registrets egen allokerings-/omdöpningslogik.
- *Bevarade från filen:* `valmyndigheten_registreringsdatum` skrivs tillbaka som det lästes; `partisymbol` likaså, men sätts/uppdateras av import-/measure-partisymboler-skripten.

Allt utanför listan blir *utökningsfält* som passerar igenom. `PARTY_KEY_ORDER`-docblocken får det uttryckliga kontraktet: en nyckel i listan är en nyckel skripten tar ansvar för — den som lägger till en måste också läsa den i `loadParties()` och skriva den i `buildParties()`, annars återinförs den tysta förlusten för just den nyckeln.

Kärnidén:

1. **`loadParties()` bär med sig okända nycklar.** Varje parti får ett `extra`-objekt med alla poster i filen vars nyckel inte finns i `PARTY_KEY_ORDER`. Redan här valideras nyckelnamnet mot mönstret `^[a-z][a-z0-9_]*$` — en ogiltig nyckel kastar fel innan någonting byggts eller skrivits, med samma allt-eller-inget-beteende som registrets övriga fel. Det stoppar också `__proto__` (matchar inte mönstret) innan nyckeln någonsin tilldelas i ett vanligt objekt.
2. **`buildParties()` skriver tillbaka dem.** `party.data` byggs som i dag men extranycklarna (`party.extra`) följer med in i `_orderKeys()`, som efter `PARTY_KEY_ORDER`-nycklarna lägger ut alla utökningsnycklar i alfabetisk ordning (kodpunktsordning). Alfabetisk ordning ger en kanonisk, stabil plats: samma innehåll ger samma utskrift oavsett var i filen fältet lades till för hand.
3. **Bevarandekontraktet:** utökningsvärden bevaras JSON-djuplika (`JSON.parse`/`JSON.stringify`-rundan behåller värdet och nästlade objekts nyckelordning men normaliserar formateringen — blanksteg, escapes, talskrivning). Första ombyggnaden efter en handredigering normaliserar alltså serialiseringen; varje ombyggnad därefter är byte-identisk. Ingen tomhetsrensning görs på utökningsfält — `null`, `false`, `0`, `""`, `[]` och `{}` skrivs tillbaka som värden (till skillnad från de kända fälten, där `_orderKeys()` fortsatt rensar tomma).
4. **Nya partier** som skapas av `upsertParties()` har inga utökningsnycklar (`extra` tomt) — inget att bevara.
5. **`data/parti/index.json` förblir en ren projektion** av sju kända fält och tar inte upp utökningsnycklar. `validate.js`:s befintliga kontroll att varje indexnyckel matchar partifilen påverkas inte (indexposten är en delmängd av partifilen).
6. **`scripts/validate.js` ställer samma krav på committad data:** värden är friform-JSON, nyckelnamnet måste matcha mönstret. Mönstret och den kända fältuppsättningen exporteras från `scripts/parti.js` (`PARTY_KEY_ORDER` exporteras redan) så regeln bara finns på ett ställe. Skrivvägens kontroll i `loadParties()` hindrar skripten från att själva skriva en ogiltig nyckel; `validate.js`-kontrollen fångar det som committas på annan väg.
7. **Kommentaren vid `loadParties()`** skrivs om så den beskriver vad koden faktiskt gör: partifilerna är sanningskälla för identitet, historik och utökningsfält; de valdata-härledda fälten byggs om från årsfilerna vid varje bygge.
8. **README dokumenterar utökningskontraktet:** en kort not i fälttabellens avsnitt för `parti/<filnamn>/index.json` — ytterligare fält med snake_case-namn bevaras av skripten men tas inte upp i det genererade indexet.

Viktiga kantfall:

- Ett parti som byter namn (katalogflytt via `applyRenames()`) behåller sina utökningsnycklar — de sitter på partiobjektet och skrivs i den nya katalogen.
- Nästlade objektvärden är JSON-djuplika efter rundan och behåller sin nyckelordning; formateringen normaliseras första gången men är stabil därefter.
- Kontrollen i `loadParties()` gäller även det läs-enbara `--report-name-collisions`-läget — en ogiltig nyckel fäller alltså också rapporten. Det är avsiktligt konsekvent: samma laddning, samma krav.
- En nyckel som redan finns i `PARTY_KEY_ORDER` kan aldrig hamna i `extra` (filtreringen utgår från listan), så ett spreadat `extra` kan inte skugga ett hanterat fält.
- En ogiltig nyckel stoppar körningen innan något skrivits eller flyttats — datamängden lämnas orörd (samma garanti som `Duplicate uuid`-fallen).
- Den committade datamängden har inga utökningsfält i dag (allt sådant har redan rensats av tidigare körningar), så en ombyggnad efter ändringen ska ge noll diff i `data/parti/` — det verifieras explicit.

## Steg

### Fas 1: Pass-through i scripts/parti.js

1. Definiera gränsen och kontraktet
   - Exportera nyckelnamnsmönstret (t.ex. `EXTRA_KEY_PATTERN = /^[a-z][a-z0-9_]*$/`) bredvid `PARTY_KEY_ORDER`
   - Utöka `PARTY_KEY_ORDER`-docblocken med ansvarskontraktet (en nyckel i listan måste läsas i `loadParties()` och skrivas i `buildParties()`)
   - Filer att ändra: `scripts/parti.js` (rad ~6–26)
2. Låt `loadParties()` samla och granska okända nycklar
   - Bygg `extra` av alla poster vars nyckel inte finns i `PARTY_KEY_ORDER`; kasta fel med filens sökväg och nyckelnamnet när en nyckel inte matchar mönstret
   - Filer att ändra: `scripts/parti.js` (`loadParties()`, rad ~46–78)
3. Låt `buildParties()` skriva tillbaka dem
   - Skicka med `party.extra` in i `data`-bygget (spread före de explicita fälten, eller som separat argument till `_orderKeys()`)
   - `index`-projektionen lämnas orörd — inga utökningsnycklar där
   - Filer att ändra: `scripts/parti.js` (`buildParties()`, rad ~477–500)
4. Utöka `_orderKeys()` med stabil placering
   - Efter `PARTY_KEY_ORDER`-loopen: lägg ut kvarvarande nycklar sorterade alfabetiskt, utan tomhetsrensning för utökningsnycklar
   - Uppdatera funktionens docblock
   - Filer att ändra: `scripts/parti.js` (`_orderKeys()`, rad ~526–546)
5. Skriv om kommentaren så den stämmer med koden
   - `loadParties()`-docblocken (rad ~40–45) beskriver ägarskapet: identitet, historik och utökningsfält från partifilerna; valdata-härledda fält byggs om från årsfilerna
   - Filer att ändra: `scripts/parti.js`

### Fas 2: Validering i scripts/validate.js

1. Ställ samma krav på committad data i `validatePartyRegistry()`
   - Importera `PARTY_KEY_ORDER` och nyckelnamnsmönstret från `./parti.js`
   - För varje nyckel i partifilen som inte är känd: kräv att nyckeln matchar mönstret, med ett svenskt felmeddelande i samma stil som övriga (`"<filnamn>: fältet "<nyckel>" har inte ett giltigt fältnamn"` eller liknande)
   - Värden lämnas friforma — validate garanterar redan att filen är giltig JSON
   - Filer att ändra: `scripts/validate.js` (`validatePartyRegistry()`, rad ~271–346)

### Fas 3: Tester

1. Pass-through-tester i `scripts/parti.test.js`
   - Ett handtillagt fält (t.ex. `grundad: "1988-02-04"`) i en partifil överlever `runParti()` — acceptanskriteriets kärna
   - Om-import-sekvensen uttryckligen: importera ett år, lägg till fältet för hand, importera samma år igen — fältet finns kvar
   - Ombyggnad två gånger med ett handtillagt fält: första körningen normaliserar formateringen, andra körningen ger byte-identiskt träd (`snapshot()`-jämförelse mellan körning 1 och 2)
   - Utökningsnyckeln hamnar efter de kända nycklarna och flera utökningsnycklar sorteras alfabetiskt (jämför `Object.keys()` på den skrivna filen)
   - Tabelltest över värdetyper: `null`, `false`, `0`, `""`, `[]`, `{}` och ett nästlat objekt bevaras alla JSON-djuplikt
   - `data/parti/index.json` tar inte upp utökningsfältet
   - Ett handredigerat värde i ett valdata-härlett fält (t.ex. `forkortning`) byggs fortsatt om från årsfilerna — hanteringsgränsen är kvar
   - Ett utökningsfält följer med vid partibyte av filnamn (rename-fallet)
   - En ogiltig nyckel (t.ex. `Grundad`): `runParti()` och `runImport()` avslutas med felkod och `snapshot()` visar att inget skrivits
   - Filer att ändra: `scripts/parti.test.js`
2. Bevarande genom symbolskripten
   - En liten bevarandekontroll i vardera testfil: ett utökningsfält överlever symbolimporten respektive mätningen (båda går genom samma kedja, men testet låser att ingen av ingångarna regredierar)
   - Filer att ändra: `scripts/import-partisymboler.test.js`, `scripts/measure-partisymboler.test.js`
3. Valideringstester i `scripts/validate.test.js`
   - Ett utökningsfält med giltigt namn passerar valideringen
   - En nyckel som bryter mot mönstret (t.ex. `Grundad` eller `founded-date`) fälls med begripligt fel
   - Filer att ändra: `scripts/validate.test.js`

### Fas 4: Dokumentation

1. README-not om utökningskontraktet
   - I avsnittet `parti/<filnamn>/index.json`, efter fälttabellen: ytterligare fält med snake_case-namn bevaras vid ombyggnad och import men tas inte upp i `parti/index.json`
   - Filer att ändra: `README.md` (avsnittet vid rad ~32)

### Fas 5: Verifiering

1. Bekräfta först att `git status --porcelain -- data/parti` är tomt, kör sedan `node scripts/parti.js` och bekräfta att det fortfarande är tomt (fångar även otrackade filer; ingen datafil ändras av pass-through-koden)
2. Kör `npm run validate:data`, `npm test` och till sist `npm run precommit`

## Filöversikt

| Fil | Åtgärd | Syfte |
|-----|--------|-------|
| `scripts/parti.js` | Ändra | `loadParties()` behåller och granskar okända nycklar, `buildParties()`/`_orderKeys()` skriver dem stabilt, docblock beskriver ägarskapet och `PARTY_KEY_ORDER`-kontraktet |
| `scripts/validate.js` | Ändra | Utökningsfält accepteras med nyckelnamnskrav; mönster och känd fältlista importeras från `parti.js` |
| `scripts/parti.test.js` | Ändra | Tester för överlevnad, normalisering + byte-stabilitet, placering, värdetyper, indexprojektion, hanteringsgräns, rename och ogiltig nyckel |
| `scripts/import-partisymboler.test.js` | Ändra | Bevarandekontroll: utökningsfält överlever symbolimporten |
| `scripts/measure-partisymboler.test.js` | Ändra | Bevarandekontroll: utökningsfält överlever symbolmätningen |
| `scripts/validate.test.js` | Ändra | Tester för giltiga och ogiltiga utökningsnycklar |
| `README.md` | Ändra | Dokumenterar att extrafält bevaras men inte projiceras till indexet |

## Berörda kodområden

Lista de primära kataloger/områden som planen berör (för konfliktdetektering):
- `scripts/` (`parti.js`, `validate.js` och deras tester)
- `README.md` (dataavsnittet)
- `data/parti/` berörs inte i denna PR (inga datafiler ändras — verifieras i fas 5), men skrivbeteendet för katalogen ändras

## Designbeslut

> Icke-triviala val gjorda under planeringen. Feedback välkommen; annars implementeras enligt dessa.

### 1. Pass-through, inte fail-loudly
**Alternativ:** Okända nycklar bevaras och skrivs tillbaka vs importen felar högt på okänd nyckel
**Beslut:** Pass-through
**Motivering:** Issuet ställer upp båda men som huvudspår respektive reservspår ("Alternatively, if pass-through is not wanted"), och #78 förutsätter att ett handtillagt fält kan bo i partifilen — fail-loudly hade gjort #78 omöjligt utan att först bygga ut `PARTY_KEY_ORDER` för varje nytt fält. Proveniens: användarbeslut (issue #79:s "What to change" i kombination med #78).

### 2. Okända nycklar sist, i alfabetisk ordning, JSON-djuplikt bevarade
**Alternativ:** (a) Bevara filens ursprungliga position per nyckel, (b) alfabetiskt efter de kända nycklarna
**Beslut:** (b)
**Motivering:** Kanonisk ordning är oberoende av var i filen redigeraren råkade lägga fältet, vilket ger en enda giltig utskrift per innehåll — samma egenskap som `PARTY_KEY_ORDER` redan ger de kända fälten, och det som håller idempotens-testerna meningsfulla. Kontraktet är JSON-djuplikhet, inte byte-ordagrannhet: `JSON.parse`/`JSON.stringify` normaliserar formateringen vid första ombyggnaden (nästlade objekts nyckelordning bevaras), därefter är utskriften byte-stabil. Ingen tomhetsrensning görs på utökningsfält, eftersom skripten inte äger dem och inte ska döma dem. Proveniens: agentens egen bedömning — öppen att ifrågasätta; issuet kräver bara "a stable position".

### 3. Nyckelnamnskrav i både skrivväg och validering, friforma värden
**Alternativ:** Helt friform vs nyckelnamnsmönster enbart i `validate.js` vs mönster i både skrivväg och validering vs fullt schema för deklarerade extrafält
**Beslut:** Mönstret `^[a-z][a-z0-9_]*$` upprätthålls i `loadParties()` (stoppar körningen innan något skrivs) och i `scripts/validate.js` (granskar committad data); värden friforma; mönstret definieras en gång i `parti.js`
**Motivering:** Issuet delegerar frågan till `scripts/validate.js` utan att avgöra den, men enbart validering i efterhand låter `node scripts/parti.js` skriva en ogiltig nyckel som först en senare `npm run validate:data` fäller — silent-loss-problemets spegelbild. Kontrollen i skrivvägen ger allt-eller-inget som registrets övriga fel, och neutraliserar `__proto__` innan nyckeln tilldelas. Ett fullt schema i förväg låser fältformer som #78 avgör senare. Mönstret fångar malformade namn (versaler, bindestreck, blanksteg, inledande understreck) — inte felstavningar av giltiga namn; utökningsnamnrymden är medvetet friform, och det dokumenteras som en egenskap, inte döljs. Namnmönstret matchar samtliga befintliga fältnamn. Proveniens: agentens egen bedömning — öppen att ifrågasätta.

### 4. `data/parti/index.json` förblir utan utökningsfält
**Alternativ:** Projicera utökningsfält till indexet vs hålla indexet vid sina sju kända fält
**Beslut:** Indexet hålls oförändrat
**Motivering:** Indexet är en genererad projektion (befintlig konvention, bekräftad i issue #80:s beskrivning), och `INDEX_KEYS_FROM_PARTY` i `scripts/validate.js` definierar exakt vilka fält den bär. Konsumenter som behöver ett utökningsfält läser partifilen. Proveniens: befintlig konvention (`scripts/validate.js:11`, issue #80).

## Verifieringschecklista

- [ ] Ett fält som lagts till för hand i en partifil överlever `node scripts/parti.js` (acceptanskriterium)
- [ ] Samma fält överlever en om-import via `npm run import-val` (acceptanskriterium)
- [ ] Två ombyggnader i rad ger byte-identiska filer, även med utökningsfält (acceptanskriterium)
- [ ] Test täcker att ett handtillagt fält överlever en ombyggnad (acceptanskriterium)
- [ ] Docblocken vid `loadParties()` beskriver vad koden gör (acceptanskriterium)
- [ ] `node scripts/parti.js` mot committad data: `git diff --exit-code -- data/parti` går igenom
- [ ] Alla JSON-värdetyper (inkl. `null`, `false`, `0`, `""`, `[]`, `{}`) bevaras djuplikt
- [ ] Utökningsfält följer med vid filnamnsbyte (rename-fallet)
- [ ] Ett handredigerat värde i ett valdata-härlett fält byggs fortfarande om — gränsen är testad
- [ ] En ogiltig nyckel stoppar `runParti()`/`runImport()` utan att något skrivs
- [ ] `npm run validate:data` accepterar giltiga utökningsfält och fäller ogiltiga nyckelnamn
- [ ] README beskriver utökningskontraktet
- [ ] `npm run precommit` grönt
