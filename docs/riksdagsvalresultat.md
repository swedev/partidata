# Riksdagsvalresultat

`data/val/<år>/valresultat/riksdag.json` är den kanoniska modellen för slutliga riksdagsresultat. Källornas tekniska format — skannad PDF, äldre HTML och Valmyndighetens JSON — finns inte kvar i modellens struktur.

## Modell

Varje valfil innehåller:

- valtyp, valår och status;
- valdeltagande;
- antal giltiga röster;
- individuella partirader med källans namn, källkod, röster och röstandel;
- ej kopplade partirader, när den historiska identiteten inte kan knytas entydigt till Partidatas partiregister;
- aggregat som `Övriga partier`, utan påhittat parti-uuid;
- mandatfördelning via stabilt parti-uuid;
- en eller flera primärkällor med titel, URL, version, hämtdatum, mediatyp och SHA-256. För de skannade tabellerna lagras även transkriberingens SHA-256.

Varje röst- och mandatrad har `kallreferens`. Därför går det att se exakt vilken källfil raden kommer från även när ett val kräver flera officiella sidor.

`rostandel` härleds som `roster / giltiga_roster` och avrundas till två decimaler för lagring och visning. Rangordningar jämför i stället de exakta heltalskvoterna och påverkas inte av avrundningen.

## Primärkällor

- 1994 och 1998: SCB:s officiella publikationer *Allmänna valen*, tabellerna för hela rikets röster och mandat. Tabellerna är skannade; de granskade transkriberingarna finns i `scb-tabeller.json` bredvid respektive valfil.
- 2002–2018: Valmyndighetens arkiverade presentationer av slutligt valresultat. Separata sidor används för övriga partier 2006 och för mandat 2010–2018.
- 2022: Valmyndighetens JSON för slutligt valresultat i hela riket.

Käll-URL och checksumma finns i varje valfil. En ändrad källfil eller manuell transkribering ger alltså en synlig checksummeändring i diffen.

## Partiidentitet

Importeraren försöker i ordning:

1. källans numeriska partikod mot aktuell eller tidigare kod i partiregistret;
2. granskade historiska namn- och kodkopplingar i `data/valresultat/riksdag-partikopplingar.json`;
3. ett entydigt aktuellt eller tidigare partinamn.

En osäker träff blir `ej_kopplade`, inte en gissad identitet. Exempelvis blockeras historiska namn där ett senare registrerat parti med samma namn inte automatiskt kan antas vara samma organisation. Namnbyten som Folkpartiet till Liberalerna och Feministiskt initiativ till Enad Röst hålls däremot ihop genom samma uuid.

## Största partierna utanför riksdagen

Startsidan använder den deterministiska härledningen i `data/derived/riksdag.json`:

1. Perioden är 1994 till senaste importerade riksdagsval.
2. Partier med mandat i periodens senaste val tas bort.
3. Endast individuellt särredovisade resultat som är entydigt kopplade till ett uuid i det aktuella Partidata-registret kan rangordnas. Ej kopplade rader och aggregat rangordnas inte.
4. Varje partis högsta exakta andel giltiga röster behålls. Vid exakt lika andel används det senaste valåret.
5. Partierna sorteras efter exakt andel, därefter röstetal och till sist uuid. De sex första visas.

Avgränsningen i punkt 3 är viktig för de äldsta SCB-tabellerna, där mindre partier endast publicerades som ett gemensamt `Övriga partier`. Startsidan påstår därför inte att ett okänt parti i ett historiskt aggregat hade ett visst resultat.

## Import

Importeraren läser lokala kopior av primärkällorna. Hämtdatum måste anges uttryckligen, så samma filer och argument alltid ger identiska JSON-byte.

```sh
npm run import-riksdagsval -- 2022 \
  --hamtad 2026-08-26 \
  --file resultat=/sökväg/RD_S.json
```

För ett äldre val med två källsidor anges båda käll-id:n. För 1994 och 1998 anges dessutom den committade transkriberingen:

```sh
npm run import-riksdagsval -- 1994 \
  --hamtad 2026-08-26 \
  --file publikation=/sökväg/scb-1994.pdf \
  --transkribering data/val/1994/valresultat/scb-tabeller.json
```

Efter import körs `npm run build:derived-data` och `npm run validate:data`.
