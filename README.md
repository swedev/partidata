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

### parti/index.json

Register över samtliga partier, `{ uuid, beteckning, filnamn, partisymbol? }` sorterat på `filnamn`. Partier som har bytt namn har dessutom `tidigare_filnamn`, som sajten bygger sina vidarebefordringar från. Filen genereras från partifilerna och redigeras inte för hand.

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
| `forkortning` | Partiförkortning, när Valmyndigheten anger någon |
| `registrerad_partibeteckning` | Om partiet har registrerad partibeteckning |
| `valmyndigheten_registreringsdatum` | Datum då partibeteckningen registrerades |
| `partisymbol` | Filnamn och proveniens för partiets senast kända symbol |
| `deltagande` | Anmält deltagande per valår |

`deltagande` har ett uppslag per valår: `{ riksdag: bool, region: [länskod], kommun: [kommunkod] }`. Från 2022 listas alla val partiet deltar i, även deltagande som följer av anmälan på högre nivå. 2018 års data är insamlad på annat sätt och speglar därför årets filer, där ett riksdagsparti inte har några region- eller kommunposter alls.

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

Partiposterna i `riksdag.json`, `region.json` och `kommun.json` har ett `grunder`-fält med Valmyndighetens `DELTAGANDEGRUND` oförändrad. Ett parti kan ha flera anmälningar för samma valområde, med olika grund och olika datum, och då listas alla: de åtta riksdagspartierna har till exempel både `R` och `K` i riksdagsvalet 2026. `R` och `K` förekommer i stort sett bara för partier med registrerad partibeteckning. Vad bokstäverna står för framgår inte av filen — se Valmyndighetens beskrivning av anmälan om deltagande nedan.

> Om ett parti anmäler deltagande i val till riksdagen gäller anmälan också för:
> * val till region- och kommunfullmäktige i hela landet och,
> * nästa kommande val till Europaparlamentet.

Läs mer på: https://www.val.se/for-partier/anmal-deltagande.html

2018 års filer ligger kvar som de samlades in: `landsting.json` i stället för `region.json`, inget `partier.json`, 208 av 290 kommuner i `kommun.json`, och region- och kommunfilerna listar bara partier som inte finns i `riksdag.json`.

### val/\<år\>/kandidatlistor/\<parti.filnamn\>.json

Kandidatlistor per parti i alla val för angivna året. För tillfället endast ett utkast.


## Köra skripten

Skripten i `scripts/` hämtar in data och körs manuellt, utanför sajtbygget. Resultatet committas till `data/`.

Krav: Node 24 och `npm ci`. Skripten kan köras från vilken katalog som helst — alla sökvägar till `data/` utgår från repots rot.

### npm run import-val -- \<år\> [--file \<sökväg\>]

Hämtar `https://data.val.se/filer/val<år>/parti/deltagande-partier.csv`, skriver `data/val/<år>/partideltagande/` och uppdaterar `data/parti/`. Med `--file` läses en nedladdad kopia i stället, vilket gör en körning reproducerbar. Körningen skriver ut filens SHA-256 och en sammanfattning av nya, sammanslagna och omdöpta partier.

Partier identifieras på `PARTIKOD`, därefter på `parti/kodbyten.json` och sist på exakt namnmatchning mot ett parti som saknar egen kod i årets fil. Ett parti som har bytt namn får ett nytt `filnamn`, och `data/parti/<filnamn>/` flyttas dit tillsammans med partiets kandidatlistor. Allt valideras i minnet först — vid fel flyttas och skrivs ingenting och skriptet avslutas med felkod.

Körningen är idempotent: samma indata ger samma filer, oavsett i vilken ordning åren importeras. `tidigare_filnamn` är undantaget, eftersom fältet är historik över de adresser registret faktiskt har haft: ett parti som har hunnit heta tre olika saker får olika `tidigare_filnamn` beroende på i vilken ordning åren importerades.

### npm run import-partisymboler -- \<år\> [--file \<zip\>] [--legacy-dir \<katalog\>]

Hämtar Valmyndighetens `partisymboler.zip` för valåret, kopplar varje PNG till partiets stabila `uuid` via partikoden och skriver symbolen i partiets katalog. `--file` läser en redan nedladdad ZIP. `--legacy-dir` kan användas för en katalog med äldre `<partikod>.png`; de fyller endast luckor och ersätter aldrig en symbol från det aktuella paketet.

Valmyndigheten ska anges som källa för symbolerna. Partisymboler kan dessutom vara skyddade som varumärken och omfattas därför inte automatiskt av projektets CC0-dedikation. Se [data/partisymboler/README.md](data/partisymboler/README.md).

### node scripts/parti.js

Bygger om partifilerna och `data/parti/index.json` från det som redan finns i `data/`, utan att hämta något.

### npm test

Kör `node:test`-sviten för importen och partiregistret.


## Bidra

Om du är intresserad av att bidra med data eller hjälpa till med utveckling, slå iväg ett mail till hello@swedev.org.
