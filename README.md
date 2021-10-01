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

Baserad på XML-filen som går att ladda ner på val.se:<br />https://www.val.se/for-partier/partibeteckning/registrerade-partibeteckningar.html

Kompletterad med partier som registrerat deltagande i val till landstingsfullmäktige och kommunfullmäktige 2018. Har lagt till attribut `uuid` och `filnamn` för enklare hantering i kod och datastrukturer. Se `toFileName` i `./utils.js`.

### parti/\<filnamn\>.json

JSON-data för varje enskilt parti ska skapas och kommer ligga i t ex `/parti/miljopartiet-de-grona.json`.

### regioner/index.json

Koder för län och kommuner år 2020. Genererad utifrån:<br/>https://www.scb.se/hitta-statistik/regional-statistik-och-kartor/regionala-indelningar/lan-och-kommuner/lan-och-kommuner-i-kodnummerordning/

### val/\<year\>/partideltagande/\<valtyp\>.json

Partier som registrerat deltagande i val för angivna året.

> Om ett parti anmäler deltagande i val till riksdagen gäller anmälan också för:
> * val till region- och kommunfullmäktige i hela landet och,
> * nästa kommande val till Europaparlamentet.

Läs mer på: https://www.val.se/for-partier/anmal-deltagande.html

### val/\<year\>/kandidatlistor/\<parti.filnamn\>.json

Kandidatlistor per parti i alla val för angivna året. För tillfället endast ett utkast.

## Bidra

Om du är intresserad av att bidra med data eller hjälpa till med utveckling, slå iväg ett mail till hello@swedev.org.
