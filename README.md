# Partidata

[![Status](https://img.shields.io/badge/Status-Working%20on%20first%20draft-red.svg)]

Öppen data om politiska partier i Sverige.


## Domän

* partidata.se
* annan?


## Syfte

Tillgängliggöra data om alla Sveriges politiska partier på ett öppet och transparent sätt.


## Funktioner på hemsidan

* Hitta partier – sök och bläddra.
* Partisida - enskild sida med all tillgänglig information om partiet.
* Registrera uppdatering - formulär för att enkelt skicka in ny eller uppdaterad data.


## Tillgänglig data

Registret, partifilerna, `val/<år>/partideltagande/`, `val/<år>/valresultat/riksdag.json`, `regioner/index.json` och `derived/` serveras som JSON på `https://www.partidata.se/data/<sökväg>` — samma sökväg som här under `data/`, och samma byte. Adresser, fält, huvuden, versioneringsprincip och licensvillkor står på https://www.partidata.se/data/. Kandidatlistorna och `profil.json` serveras inte.

Gränsen för vad som publiceras går vid filen, inte vid fältet: varje fält i en partifil lämnas ut, extrafälten inräknade. Ett fält som inte tål att publiceras hör inte hemma i partifilen.

### parti/\<filnamn\>/index.json

En fil per parti. `uuid` sätts en gång och ändras aldrig — det är den identitet `val/`-filerna refererar till. `filnamn` är partiets adress på sajten och följer partiets `beteckning`: byter partiet namn får det ett nytt `filnamn`, katalogen flyttas dit, och den gamla adressen läggs till i `tidigare_filnamn` och serveras som en vidarebefordran till den nya. `filnamn` skapas med `toFileName` i `scripts/utils.js`, med suffixet `-<kod>` när flera partier ger samma filnamn. Ett `filnamn` som registret en gång har burit ges aldrig till ett annat parti.

| Fält | Innehåll |
|------|----------|
| `uuid` | Stabil identitet |
| `kod` | Valmyndighetens `PARTIKOD` i det senaste val partiet finns med i |
| `tidigare_koder` | Övriga koder partiet har burit |
| `beteckning` | Partibeteckning i det senaste valet |
| `tidigare_beteckningar` | Tidigare partibeteckningar, äldst först |
| `filnamn` | Partiets adress på sajten |
| `tidigare_filnamn` | Adresser partiet har haft, äldst först, som vidarebefordras till `filnamn` |
| `omrade` | Härlett kommun- eller länsnamn när det senaste registrerade valdeltagandet ryms inom ett område |
| `forkortning` | Partiförkortning, när Valmyndigheten anger någon |
| `registrerad_partibeteckning` | Om partiet har registrerad partibeteckning |
| `valmyndigheten_registreringsdatum` | Datum då partibeteckningen registrerades |
| `partisymbol` | Filnamn och proveniens för partiets senast kända symbol |
| `deltagande` | Anmält deltagande per valår |

Tabellen är de fält skripten hanterar. Ytterligare fält får läggas till för hand så länge namnet är snake_case (`^[a-z][a-z0-9_]*$`); de bevaras vid ombyggnad och import, med valfritt JSON-värde, och skrivs efter fälten ovan i bokstavsordning. De tas inte upp i `derived/parti.json` — den som behöver ett sådant fält läser partifilen.

`deltagande` har ett uppslag per valår: `{ riksdag: bool, region: [länskod], kommun: [kommunkod] }`. Från 2022 listas alla val partiet deltar i, även deltagande som följer av anmälan på högre nivå. 2018 års data är insamlad på annat sätt och speglar därför årets filer, där ett riksdagsparti inte har några region- eller kommunposter alls.

`wikidata` är ett sådant fält, och håller partiets post på Wikidata tillsammans med det som lästs ur den. Sektionen har tre delar: `id`, `grundat` och `hamtad`. `id` är Q-id:t för partiets post på Wikidata, till exempel `Q504069`, och käll-URL:en `https://www.wikidata.org/wiki/<id>` härleds ur det. Fältet ägs av människor: det läggs till genom en granskad pull request, först när någon har bekräftat att posten avser samma parti — etikett, beskrivning och officiell webbplats mot partiets kända uppgifter. Ingen automatisk namnmatchning kopplar ett parti till Wikidata. Stegen för att lägga till en koppling står under [npm run import-wikidata](#npm-run-import-wikidata----parti-filnamn).

`grundat` och `hamtad` ägs av `npm run import-wikidata`. `grundat` är Wikidatas P571 i den precision källan anger — `"1988"`, `"1988-02"` eller `"1988-02-06"` — och utelämnas när posten inte anger något grundandedatum; ett tidigare värde tas då bort, eftersom en uppgift utan källa inte hör hemma i datan. `hamtad` är datumet för den senaste hämtningen.

När `partisymbol` finns ligger PNG-filen i samma katalog som partiets `index.json`. Filnamnet innehåller både den partikod symbolen hämtades under och en läsbar namn-slug, till exempel `0001-moderaterna.png`. Symbolen från det senaste importerade valet används. För partier som saknar symbol i 2026 års paket används i vissa fall den senast kända symbolen från Valmyndighetens arkiv för EU-valet 2019. `valar`, `partikod` och `kallurl` anger symbolens proveniens.

### parti/kodbyten.json

`{ "<ny kod>": "<gammal kod>" }` — granskade kopplingar för partier som fått ny `PARTIKOD` och samtidigt bytt namn, så att importen håller ihop dem till ett parti. Importen avbryts och ber om en post här när ett namn matchar flera partier.

### regioner/index.json

Koder för län och kommuner år 2020. Genererad utifrån:<br/>https://www.scb.se/hitta-statistik/regional-statistik-och-kartor/regionala-indelningar/lan-och-kommuner/lan-och-kommuner-i-kodnummerordning/

### val/\<år\>/partideltagande/

Fyra filer per valår, skrivna av `npm run import-val`:

| Fil | Innehåll |
|-----|----------|
| `partier.json` | En post per `PARTIKOD` i årets fil: kod, beteckning, förkortning, registrerad partibeteckning, uuid |
| `riksdag.json` | Partier som deltar i riksdagsvalet |
| `region.json` | En post per län som har anmälda partier, med länets partier |
| `kommun.json` | Alla 290 kommuner, med kommunens partier (tom lista när inga finns) |

Partiposterna i `riksdag.json`, `region.json` och `kommun.json` har ett `grunder`-fält med Valmyndighetens `DELTAGANDEGRUND` oförändrad. Ett parti kan ha flera anmälningar för samma valområde, med olika grund och olika datum, och då listas alla: de åtta riksdagspartierna har till exempel både `R` och `K` i riksdagsvalet 2026. `R` och `K` förekommer i stort sett bara för partier med registrerad partibeteckning.

Bokstäverna förklaras inte i filen. Valmyndigheten beskriver dem så här:

| Grund | Valmyndighetens formulering |
|-------|------------------------------|
| `A` | Anmält deltagande |
| `R` | Redan representerad, anses anmält deltagande |
| `K` | Anmält kandidater och anses genom det anmält deltagande |

Alla tre betyder att partiet deltar i valet i det valområdet; de skiljer sig bara i hur partiet kvalificerade sig. Källa: [Partier som deltar i val](https://www.val.se/stalla-upp-i-val/anmalda-och-registrerade-partier/partier-som-deltar-i-kommande-val).

Valmyndigheten beskriver också en anmälans räckvidd:

> Om ett parti anmäler deltagande i val till riksdagen gäller anmälan också för:
> * val till region- och kommunfullmäktige i hela landet och,
> * nästa kommande val till Europaparlamentet.

Läs mer på: https://www.val.se/stalla-upp-i-val/anmala-parti-till-val/anmal-att-partiet-vill-delta-i-val

Filen låter sig inte läsas som en tillämpning av den regeln, så räkna inte med den när du tolkar raderna. I 2026 års fil har 156 partier `A` i riksdagsvalet, varav 115 finns i alla 290 kommuner och 41 i mellan 0 och 287; samtidigt finns sju partier i alla 290 kommuner utan att ha `A` i riksdagsvalet. Vänsterpartiet (285 kommuner) och Miljöpartiet (278) saknas i enskilda kommuner helt och hållet. Filen skiljer alltså inte på en egen anmälan per valområde och en anmälan som gäller vidare.

2018 års filer ligger kvar som de samlades in: `landsting.json` i stället för `region.json`, inget `partier.json`, 208 av 290 kommuner i `kommun.json`, och region- och kommunfilerna listar bara partier som inte finns i `riksdag.json`.

### val/\<år\>/kandidatlistor/\<parti.filnamn\>.json

Kandidatlistor per parti i alla val för angivna året. För tillfället endast ett utkast. Fältet `val` anger valtypen med `R` för riksdag, `L` för landsting (region) och `K` för kommun.

### Bokstavskoder i datan

Tre kodsystem möts i `data/val/`, och `R` och `K` betyder olika saker i två av dem. Läs alltid koden mot filen den står i:

| Var | Koder | Betyder |
|-----|-------|---------|
| `partideltagande/*.json` → `grunder` | `A` `R` `K` | anmält deltagande · redan representerad · anmält kandidater |
| `kandidatlistor/*.json` → `val` | `R` `L` `K` | riksdag · landsting (region) · kommun |
| Källans CSV → `VALTYP` | `RD` `RF` `KF` | riksdag · regionfullmäktige · kommunfullmäktige |

### val/\<år\>/valresultat/riksdag.json

Slutligt riksdagsresultat 1994–2022 i en gemensam, källoberoende modell: giltiga röster, röster och andel per parti, mandat, stabilt parti-uuid samt källreferenser med SHA-256. Historiska rader som inte kan identitetskopplas säkert och aggregerade `Övriga partier` redovisas uttryckligen utan gissade uuid:n. Partisidans valresultat härleds ur den här filen, enligt [reglerna för partisidan](docs/riksdagsvalresultat.md#partisidan). Se [modell, källor och rankingmetod](docs/riksdagsvalresultat.md).

### derived/

Allt under `data/derived/` är genererat ur de övriga filerna i `data/` och redigeras inte för hand. En ändring görs i källfilerna, varefter katalogen byggs om.

| Fil | Genereras av |
|-----|--------------|
| `derived/parti.json` | [`node scripts/parti.js`](#node-scriptspartijs), och varje importskript som bygger om partifilerna: `import-val`, `import-partisymboler`, `import-wikidata`, `measure-partisymboler` |
| `derived/riksdag.json` | [`npm run build:derived-data`](docs/riksdagsvalresultat.md) |

`derived/riksdag.json` byggs ur `derived/parti.json` och valresultaten, så ordningen vid en fullständig ombyggnad är `node scripts/parti.js` följt av `npm run build:derived-data`.

### derived/parti.json

Register över samtliga partier, sorterat på `filnamn`, med `uuid`, `beteckning` och `filnamn` för varje parti. Därutöver `tidigare_filnamn`, `omrade`, `forkortning` och `partisymbol` för de partier vars partifil har fälten; de har samma innebörd som i [partifilen](#partifilnamnindexjson). `tidigare_filnamn` är det sajten bygger sina vidarebefordringar från. Filen ersätter `parti/index.json` — den som hämtar registret direkt från GitHub behöver byta adress.


## Köra skripten

Skripten i `scripts/` hämtar in data och körs manuellt, utanför sajtbygget. Resultatet committas till `data/`.

Krav: Node 24 och `npm ci`. Skripten kan köras från vilken katalog som helst — alla sökvägar till `data/` utgår från repots rot.

### npm run import-val -- \<år\> [--file \<sökväg\>]

Hämtar `https://data.val.se/filer/val<år>/parti/deltagande-partier.csv`, skriver `data/val/<år>/partideltagande/` och uppdaterar `data/parti/`. Med `--file` läses en nedladdad kopia i stället, vilket gör en körning reproducerbar. Körningen skriver ut filens SHA-256 och en sammanfattning av nya, sammanslagna och omdöpta partier.

Partier identifieras på `PARTIKOD`, därefter på `parti/kodbyten.json` och sist på en normaliserad namnmatchning (tekniskt likvärdig Unicode, trim, gemener, skiljetecken och upprepade blanksteg) mot ett parti som saknar egen kod i årets fil. Alla bokstäver och diakritiska tecken behålls; en verklig stavningsskillnad måste granskas och anges i `kodbyten.json`. Namnmatchningen används bara när både register och import är entydiga; annars avbryts importen. Har alla registerpartier med namnet redan sina egna koder i årets fil finns inget att slå ihop, och posten blir ett nytt parti. Ett parti som har bytt namn får ett nytt `filnamn`, och `data/parti/<filnamn>/` flyttas dit tillsammans med partiets kandidatlistor. Allt valideras i minnet först — vid fel flyttas och skrivs ingenting och skriptet avslutas med felkod.

Körningen är idempotent: samma indata ger samma filer, oavsett i vilken ordning åren importeras. `tidigare_filnamn` är undantaget, eftersom fältet är historik över de adresser registret faktiskt har haft: ett parti som har hunnit heta tre olika saker får olika `tidigare_filnamn` beroende på i vilken ordning åren importerades.

### npm run import-partisymboler -- \<år\> [--file \<zip\>] [--legacy-dir \<katalog\>]

Hämtar Valmyndighetens `partisymboler.zip` för valåret, kopplar varje PNG till partiets stabila `uuid` via partikoden och skriver symbolen i partiets katalog. `--file` läser en redan nedladdad ZIP. `--legacy-dir` kan användas för en katalog med äldre `<partikod>.png`; de fyller endast luckor och ersätter aldrig en symbol från det aktuella paketet.

Valmyndigheten ska anges som källa för symbolerna. Partisymboler kan dessutom vara skyddade som varumärken och omfattas därför inte automatiskt av projektets CC0-dedikation. Se [data/partisymboler/README.md](data/partisymboler/README.md).

### npm run import-wikidata [-- --parti \<filnamn\>]

Hämtar `https://www.wikidata.org/wiki/Special:EntityData/<id>.json` för varje parti som har ett `wikidata.id`, läser grundandedatumet (P571) och skriver `wikidata.grundat` och `wikidata.hamtad` i partifilen. Med `--parti` hämtas ett enda parti. Partier utan Q-id rörs inte, och skriptet lägger aldrig till ett Q-id självt.

Datumet lagras i källans precision. Har posten flera P571-påståenden gäller preferred-rank framför normal, och deprecated läses aldrig; anger posten två olika datum på samma rang avbryts körningen — vilket som gäller avgörs på Wikidata, med rangmarkering, inte här. Ett värde i en annan kalendermodell än den proleptiskt gregorianska, ett osäkerhetsintervall eller en precision grövre än år avbryter också körningen, liksom ett Q-id som har omdirigerats eller tagits bort. Allt hämtas och valideras innan något skrivs, så en misslyckad körning lämnar `data/` orört.

#### Koppla ett parti till Wikidata

1. Leta upp partiets post på Wikidata och kontrollera att den avser samma parti — etikett, beskrivning och officiell webbplats mot partiets kända uppgifter, och för lokalpartier den kommun posten anger mot kommunerna i partiets `deltagande`. Flera partier delar beteckning, så namnlikhet räcker inte.
2. Lägg till Q-id:t för hand i partiets `index.json`:

   ```json
   "wikidata": { "id": "Q504069" }
   ```

3. Kör `npm run import-wikidata -- --parti <filnamn>`. Skriptet hämtar P571 och fyller `grundat` och `hamtad`.
4. Committa partifilen med alla tre fälten. En sektion med bara `id` underkänns av `npm run validate:data`, eftersom `hamtad` saknas.

Detsamma gäller när ett Q-id ändras: hämtningen sker aldrig av sig själv, så `grundat` ligger kvar från den förra posten tills importen körts om. Valideringen kontrollerar formen, inte att datumet kommer från det id som står i filen.

En körning utan `--parti` hämtar om samtliga kopplade partier och sätter deras `hamtad` till dagens datum, även för de partier vars datum är oförändrat. Då ändras alltså filer som inte har med den koppling man arbetar med att göra, och rättningar som gjorts på Wikidata sedan förra körningen följer med in. Använd `--parti` när en enskild koppling läggs till eller ändras, och en fullständig körning när avsikten är att uppdatera allt.

Skriptet skriver ut `Att kontrollera:` när ett hämtat datum inte rimmar med partiets egen post — grundat efter att beteckningen registrerades, eller ett parti utan registrerad beteckning som grundades långt före det första val vi har det i. Det är en varning, inte ett fel: datumet är hämtat och skrivet, och den som kopplat partiet får avgöra om posten avser rätt parti.

### npm run import-riksdagsval -- \<år\> --hamtad \<datum\> --file \<käll-id\>=\<sökväg\>

Importerar en lokal kopia av Valmyndighetens eller SCB:s slutliga riksdagsresultat till den gemensamma modellen. Käll-id:n och antal filer varierar med valår. Samma källfiler och argument ger identiska JSON-filer; se [importinstruktionerna](docs/riksdagsvalresultat.md#import).

### node scripts/parti.js

Bygger om partifilerna och `data/derived/parti.json` från det som redan finns i `data/`, utan att hämta något.

`node scripts/parti.js --report-name-collisions` skriver i stället en rapport över olika partier vars aktuella namn blir lika efter normalisering. Rapporten ändrar inga filer och varje träff måste bedömas manuellt.

### npm run validate:data

Kontrollerar att partiregistret, partifilerna, valårens partireferenser samt region- och kommundatan är konsistenta. Kontrollen körs också i CI före tester och bygge.

### npm test

Kör `node:test`-sviten för importen och partiregistret.


## Bidra

Om du är intresserad av att bidra med data eller hjälpa till med utveckling, slå iväg ett mail till hello@swedev.org.
