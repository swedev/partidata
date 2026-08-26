# Designunderlag

Designpaketet för Partidatas gränssnitt. Filerna är `.dc.html` — fristående
canvas-dokument som öppnas direkt i en webbläsare:

```
open "design/Partidata.dc.html"
```

`support.js` och `image-slot.js` är körtiden som dokumenten laddar. De måste
ligga kvar bredvid `.dc.html`-filerna för att dessa ska rendera.

## Dokument

| Fil | Innehåll |
|-----|----------|
| `Partidata.dc.html` | Startsidan: hero, sök och filter, riksdagspartier, största partierna utanför riksdagen, hela partilistan, tomläge och sidfot |
| `Partikort.dc.html` | Partikortet i storlekarna `lg`, `md` och `sm` |
| `Partisida.dc.html` | Partisidans struktur |
| `Partiprofil.dc.html` | Partiprofilens moduler |
| `Grafisk profil.dc.html` | Färger, typografi och logotypanvändning |
| `Logotyp - alternativ.dc.html` | Logotypvarianter |

## Prototyp, inte specifikation

Dokumenten är konceptimplementationer. De innehåller hårdkodade riksdagspartier,
genererade lokala partier, exempelresultat och länkar till sidor som inte finns.
Informationsstrukturen, layouten och den grafiska behandlingen är underlaget —
runtime och exempeldata är det inte.

## Utelämnade filer

Designpaketet innehåller material som medvetet inte ligger här:

- `reps/` — porträttbilder på namngivna riksdagsledamöter. Personuppgifter hör
  inte hemma i repot. `Partiprofil.dc.html` visar därför brutna bildrutor.
- `logos/` — partisymboler. Symbolerna och deras proveniens finns i
  `data/parti/<parti>/`; en andra kopia här vore en konkurrerande sanningskälla.
- `uploads/` — skärmklipp och arbetsmaterial från designarbetet.
- `val-logotyp.png`, `wikipedia-globe.jpeg` — tredjepartsmärken.

Originalpaketet är `Partidata gränssnitt design.zip`.
