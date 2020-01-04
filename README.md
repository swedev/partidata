# Partidata

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

### partilista.json

Baserad på XML-filen som går att ladda ner på val.se:<br />
https://www.val.se/for-partier/partibeteckning/registrerade-partibeteckningar.html

Har lagt till attribut `uuid` och `name` för enklare hantering i kod och datastrukturer.

`name` har genererats på följande sätt:

```js
  partier.forEach(parti => {
    parti.name = _.deburr(parti.partibeteckning)
      .toLowerCase()
      .replace(' - ', '-')
      .replace(/[)(]/g, '')
      .replace(/[^a-z0-9]/g, '-');
  });
```

### /parti/<name>.json

JSON-data för varje enskilt parti ska skapas och kommer ligga i t ex `/parti/miljopartiet-de-grona.json`.


## Bidra

Om du är intresserad av att bidra med data eller hjälpa till med utveckling, slå iväg ett mail till hello@swedev.org.
