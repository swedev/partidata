/**
 * The field contract the documentation page publishes: what a reader can rely
 * on finding, and what type it has. `scripts/data-fields.test.js` checks every
 * top-level field against real specimens under `data/`, so the tables cannot
 * drift from the data. Nested fields are written with dot notation and marked
 * `[]` where the parent is a list; the test does not descend into them.
 */

export interface FieldDoc {
  namn: string;
  typ: string;
  obligatoriskt: boolean;
  beskrivning: string;
}

export interface ResourceDoc {
  /** The anchor and the key `scripts/data-fields.test.js` looks the specimen up by. */
  id: string;
  rubrik: string;
  adress: string;
  /** The shape of the top level, in one sentence. */
  form: string;
  /** The heading in README.md that carries the background prose. */
  readme: string;
  falt: FieldDoc[];
}

const KALLA_FALT: FieldDoc[] = [
  { namn: 'id', typ: 'sträng', obligatoriskt: true, beskrivning: 'Källans namn i filen; det som `kallreferens` pekar på.' },
  { namn: 'namn', typ: 'sträng', obligatoriskt: true, beskrivning: 'Utgivaren, till exempel Valmyndigheten eller SCB.' },
  { namn: 'titel', typ: 'sträng', obligatoriskt: true, beskrivning: 'Källdokumentets titel.' },
  { namn: 'url', typ: 'sträng', obligatoriskt: true, beskrivning: 'Adressen uppgiften hämtades från.' },
  { namn: 'version', typ: 'sträng', obligatoriskt: true, beskrivning: 'Källans egen versionsbeteckning, till exempel "Slutligt valresultat".' },
  { namn: 'format', typ: 'sträng', obligatoriskt: true, beskrivning: 'Mediatypen källan levererades i.' },
  { namn: 'hamtad', typ: 'datum', obligatoriskt: true, beskrivning: 'Datum då källan hämtades.' },
  { namn: 'sha256', typ: 'sträng', obligatoriskt: true, beskrivning: 'Kontrollsumma för den hämtade filen.' },
  { namn: 'transkribering_sha256', typ: 'sträng', obligatoriskt: false, beskrivning: 'Kontrollsumma för transkriberingen, när källan lästs ur ett dokument som inte är maskinläsbart.' },
];

export const FIELD_DOCS: ResourceDoc[] = [
  {
    id: 'registry',
    rubrik: 'derived/parti.json',
    adress: '/data/derived/parti.json',
    form: 'En lista med en post per parti, sorterad på filnamn.',
    readme: 'derivedpartijson',
    falt: [
      { namn: 'uuid', typ: 'sträng', obligatoriskt: true, beskrivning: 'Partiets stabila identitet. Samma uuid i partifilen och som `parti_uuid` i valresultaten.' },
      { namn: 'beteckning', typ: 'sträng', obligatoriskt: true, beskrivning: 'Partibeteckningen i det senaste val partiet finns med i.' },
      { namn: 'filnamn', typ: 'sträng', obligatoriskt: true, beskrivning: 'Partiets adress på sajten och katalognamnet under `parti/`.' },
      { namn: 'tidigare_filnamn', typ: 'lista av strängar', obligatoriskt: false, beskrivning: 'Adresser partiet har haft, äldst först. Var och en vidarebefordras till `filnamn`.' },
      { namn: 'omrade', typ: 'sträng', obligatoriskt: false, beskrivning: 'Kommun- eller länsnamn, när det senaste registrerade deltagandet ryms inom ett område.' },
      { namn: 'forkortning', typ: 'sträng', obligatoriskt: false, beskrivning: 'Partiförkortning, när Valmyndigheten anger någon.' },
      { namn: 'partisymbol', typ: 'objekt', obligatoriskt: false, beskrivning: 'Samma innehåll som `partisymbol` i partifilen.' },
    ],
  },
  {
    id: 'party',
    rubrik: 'parti/<filnamn>/index.json',
    adress: '/data/parti/<filnamn>/index.json',
    form: 'Ett objekt per parti.',
    readme: 'partifilnamnindexjson',
    falt: [
      { namn: 'uuid', typ: 'sträng', obligatoriskt: true, beskrivning: 'Partiets stabila identitet, satt en gång och aldrig ändrad.' },
      { namn: 'kod', typ: 'sträng', obligatoriskt: true, beskrivning: 'Valmyndighetens PARTIKOD i det senaste val partiet finns med i. Samma värde som `kod` i partideltagandet.' },
      { namn: 'tidigare_koder', typ: 'lista av strängar', obligatoriskt: false, beskrivning: 'Övriga partikoder partiet har burit.' },
      { namn: 'beteckning', typ: 'sträng', obligatoriskt: true, beskrivning: 'Partibeteckningen i det senaste valet.' },
      { namn: 'tidigare_beteckningar', typ: 'lista av strängar', obligatoriskt: false, beskrivning: 'Tidigare partibeteckningar, äldst först.' },
      { namn: 'filnamn', typ: 'sträng', obligatoriskt: true, beskrivning: 'Partiets adress på sajten.' },
      { namn: 'tidigare_filnamn', typ: 'lista av strängar', obligatoriskt: false, beskrivning: 'Adresser partiet har haft, äldst först.' },
      { namn: 'omrade', typ: 'sträng', obligatoriskt: false, beskrivning: 'Härlett kommun- eller länsnamn när deltagandet ryms inom ett område.' },
      { namn: 'forkortning', typ: 'sträng', obligatoriskt: false, beskrivning: 'Partiförkortning, när Valmyndigheten anger någon.' },
      { namn: 'registrerad_partibeteckning', typ: 'boolean', obligatoriskt: false, beskrivning: 'Om partiet har registrerad partibeteckning.' },
      { namn: 'valmyndigheten_registreringsdatum', typ: 'datum', obligatoriskt: false, beskrivning: 'Datum då partibeteckningen registrerades.' },
      { namn: 'partisymbol', typ: 'objekt', obligatoriskt: false, beskrivning: 'Partiets senast kända symbol med proveniens. Bildfilen serveras på /partisymbol/<filnamn>/<partisymbol.filnamn>, inte under /data/.' },
      { namn: 'partisymbol.filnamn', typ: 'sträng', obligatoriskt: true, beskrivning: 'PNG-filens namn i partiets katalog.' },
      { namn: 'partisymbol.kalla', typ: 'sträng', obligatoriskt: true, beskrivning: 'Utgivaren symbolen kommer från.' },
      { namn: 'partisymbol.kallurl', typ: 'sträng', obligatoriskt: true, beskrivning: 'Adressen symbolpaketet hämtades från.' },
      { namn: 'partisymbol.valar', typ: 'tal', obligatoriskt: true, beskrivning: 'Valåret symbolen levererades för.' },
      { namn: 'partisymbol.partikod', typ: 'sträng', obligatoriskt: true, beskrivning: 'Partikoden symbolen hämtades under.' },
      { namn: 'partisymbol.bild', typ: 'objekt', obligatoriskt: false, beskrivning: 'Bildfilens `bredd` och `hojd` i pixlar — arket symbolen levererades på.' },
      { namn: 'partisymbol.bildyta', typ: 'objekt', obligatoriskt: false, beskrivning: 'Teckningens `x`, `y`, `bredd` och `hojd` inom arket, så att alla symboler kan visas i samma optiska storlek.' },
      { namn: 'deltagande', typ: 'objekt', obligatoriskt: false, beskrivning: 'Anmält deltagande med ett uppslag per valår.' },
      { namn: 'deltagande.<år>.riksdag', typ: 'boolean', obligatoriskt: true, beskrivning: 'Om partiet deltar i riksdagsvalet det året.' },
      { namn: 'deltagande.<år>.region', typ: 'lista av strängar', obligatoriskt: true, beskrivning: 'Länskoder ur regioner/index.json.' },
      { namn: 'deltagande.<år>.kommun', typ: 'lista av strängar', obligatoriskt: true, beskrivning: 'Kommunkoder ur regioner/index.json. De två första siffrorna är länets kod.' },
      { namn: 'wikidata', typ: 'objekt', obligatoriskt: false, beskrivning: 'Partiets post på Wikidata, kopplad för hand i en granskad pull request.' },
      { namn: 'wikidata.id', typ: 'sträng', obligatoriskt: true, beskrivning: 'Q-id:t, till exempel Q504069. Käll-URL:en är https://www.wikidata.org/wiki/<id>.' },
      { namn: 'wikidata.grundat', typ: 'sträng', obligatoriskt: false, beskrivning: 'Grundandedatum (P571) i källans precision: "1988", "1988-02" eller "1988-02-06".' },
      { namn: 'wikidata.hamtad', typ: 'datum', obligatoriskt: true, beskrivning: 'Datum för den senaste hämtningen från Wikidata.' },
    ],
  },
  {
    id: 'participation-partier',
    rubrik: 'val/<år>/partideltagande/partier.json',
    adress: '/data/val/<år>/partideltagande/partier.json',
    form: 'En lista med en post per partikod i årets fil.',
    readme: 'valårpartideltagande',
    falt: [
      { namn: 'kod', typ: 'sträng', obligatoriskt: true, beskrivning: 'Valmyndighetens PARTIKOD det året.' },
      { namn: 'beteckning', typ: 'sträng', obligatoriskt: true, beskrivning: 'Partibeteckningen som den står i årets fil.' },
      { namn: 'forkortning', typ: 'sträng', obligatoriskt: true, beskrivning: 'Partiförkortningen, tom sträng när ingen anges.' },
      { namn: 'registrerad_partibeteckning', typ: 'boolean', obligatoriskt: true, beskrivning: 'Om beteckningen är registrerad.' },
      { namn: 'uuid', typ: 'sträng', obligatoriskt: true, beskrivning: 'Partiets identitet i registret.' },
    ],
  },
  {
    id: 'participation-riksdag',
    rubrik: 'val/<år>/partideltagande/riksdag.json',
    adress: '/data/val/<år>/partideltagande/riksdag.json',
    form: 'En lista med de partier som deltar i riksdagsvalet.',
    readme: 'valårpartideltagande',
    falt: [
      { namn: 'beteckning', typ: 'sträng', obligatoriskt: true, beskrivning: 'Partibeteckningen som den står i årets fil.' },
      { namn: 'kod', typ: 'sträng', obligatoriskt: true, beskrivning: 'Valmyndighetens PARTIKOD det året.' },
      { namn: 'uuid', typ: 'sträng', obligatoriskt: true, beskrivning: 'Partiets identitet i registret.' },
      { namn: 'grunder', typ: 'lista av strängar', obligatoriskt: false, beskrivning: 'Valmyndighetens DELTAGANDEGRUND, oförändrad: A anmält deltagande, R redan representerad, K anmält kandidater. Saknas i 2018 års filer.' },
    ],
  },
  {
    id: 'participation-omrade',
    rubrik: 'val/<år>/partideltagande/region.json, kommun.json, landsting.json',
    adress: '/data/val/<år>/partideltagande/region.json',
    form: 'En lista med en post per valområde, med områdets partier.',
    readme: 'valårpartideltagande',
    falt: [
      { namn: 'kod', typ: 'sträng', obligatoriskt: true, beskrivning: 'Läns- eller kommunkoden, samma koder som i regioner/index.json.' },
      { namn: 'namn', typ: 'sträng', obligatoriskt: true, beskrivning: 'Områdets namn.' },
      { namn: 'uuid', typ: 'sträng', obligatoriskt: true, beskrivning: 'Områdets identitet, samma som i regioner/index.json.' },
      { namn: 'partier', typ: 'lista av objekt', obligatoriskt: true, beskrivning: 'Partierna som deltar i valet i området; tom lista när inga finns.' },
      { namn: 'partier[].beteckning', typ: 'sträng', obligatoriskt: true, beskrivning: 'Partibeteckningen som den står i årets fil.' },
      { namn: 'partier[].kod', typ: 'sträng', obligatoriskt: true, beskrivning: 'Valmyndighetens PARTIKOD det året.' },
      { namn: 'partier[].uuid', typ: 'sträng', obligatoriskt: true, beskrivning: 'Partiets identitet i registret.' },
      { namn: 'partier[].grunder', typ: 'lista av strängar', obligatoriskt: false, beskrivning: 'DELTAGANDEGRUND — A, R eller K. Saknas i 2018 års filer.' },
    ],
  },
  {
    id: 'results',
    rubrik: 'val/<år>/valresultat/riksdag.json',
    adress: '/data/val/<år>/valresultat/riksdag.json',
    form: 'Ett objekt med det slutliga riksdagsresultatet för valåret.',
    readme: 'valårvalresultatriksdagjson',
    falt: [
      { namn: 'schema_version', typ: 'tal', obligatoriskt: true, beskrivning: 'Modellens version; 2 i dag.' },
      { namn: 'valtyp', typ: 'sträng', obligatoriskt: true, beskrivning: 'Valet filen gäller: "riksdag".' },
      { namn: 'valar', typ: 'tal', obligatoriskt: true, beskrivning: 'Valåret.' },
      { namn: 'status', typ: 'sträng', obligatoriskt: true, beskrivning: 'Resultatets status, till exempel "slutligt".' },
      { namn: 'kallor', typ: 'lista av objekt', obligatoriskt: true, beskrivning: 'Källorna filen bygger på. Varje rad i filen pekar på en av dem med `kallreferens`.' },
      ...KALLA_FALT.map(falt => ({ ...falt, namn: `kallor[].${falt.namn}` })),
      { namn: 'valdeltagande', typ: 'objekt', obligatoriskt: true, beskrivning: 'Valdeltagandet med `procent` och `kallreferens`.' },
      { namn: 'rostresultat', typ: 'objekt', obligatoriskt: true, beskrivning: 'Röstresultatet för riket.' },
      { namn: 'rostresultat.giltiga_roster', typ: 'tal', obligatoriskt: true, beskrivning: 'Antalet giltiga röster i valet.' },
      { namn: 'rostresultat.kallreferenser', typ: 'lista av strängar', obligatoriskt: true, beskrivning: 'Källorna avsnittet bygger på.' },
      { namn: 'rostresultat.partier', typ: 'lista av objekt', obligatoriskt: true, beskrivning: 'En rad per parti som kunnat kopplas till registret.' },
      { namn: 'rostresultat.partier[].parti_uuid', typ: 'sträng', obligatoriskt: true, beskrivning: 'Partiets `uuid` i registret.' },
      { namn: 'rostresultat.partier[].kallkod', typ: 'sträng', obligatoriskt: false, beskrivning: 'Partikoden källan använder.' },
      { namn: 'rostresultat.partier[].partibeteckning', typ: 'sträng', obligatoriskt: true, beskrivning: 'Partibeteckningen som källan skriver den.' },
      { namn: 'rostresultat.partier[].roster', typ: 'tal', obligatoriskt: true, beskrivning: 'Antalet röster.' },
      { namn: 'rostresultat.partier[].rostandel', typ: 'tal', obligatoriskt: true, beskrivning: 'Röstandelen i procent av giltiga röster.' },
      { namn: 'rostresultat.partier[].kallreferens', typ: 'sträng', obligatoriskt: true, beskrivning: 'Källans `id`.' },
      { namn: 'rostresultat.ej_kopplade', typ: 'lista av objekt', obligatoriskt: true, beskrivning: 'Rader som inte kunnat kopplas till ett parti i registret, redovisade utan gissat uuid.' },
      { namn: 'rostresultat.aggregat', typ: 'lista av objekt', obligatoriskt: true, beskrivning: 'Källans egna sammanslagningar, till exempel "Övriga partier".' },
      { namn: 'mandatfordelning', typ: 'objekt', obligatoriskt: true, beskrivning: 'Mandatfördelningen i kammaren.' },
      { namn: 'mandatfordelning.antal_mandat', typ: 'tal', obligatoriskt: true, beskrivning: 'Antalet mandat som fördelas, 349.' },
      { namn: 'mandatfordelning.kallreferenser', typ: 'lista av strängar', obligatoriskt: true, beskrivning: 'Källorna avsnittet bygger på.' },
      { namn: 'mandatfordelning.partier', typ: 'lista av objekt', obligatoriskt: true, beskrivning: 'En rad per parti med mandat: `parti_uuid`, `kallkod`, `partibeteckning`, `mandat` och `kallreferens`.' },
    ],
  },
  {
    id: 'derived-parliament',
    rubrik: 'derived/riksdag.json',
    adress: '/data/derived/riksdag.json',
    form: 'Ett objekt med den härledning startsidan bygger på.',
    readme: 'derived',
    falt: [
      { namn: 'schema_version', typ: 'tal', obligatoriskt: true, beskrivning: 'Modellens version.' },
      { namn: 'genererad_fran', typ: 'lista av strängar', obligatoriskt: true, beskrivning: 'Filerna härledningen byggdes ur, som sökvägar under data/.' },
      { namn: 'senast_uppdaterad', typ: 'datum', obligatoriskt: true, beskrivning: 'Datum då filen byggdes om.' },
      { namn: 'kammare', typ: 'objekt', obligatoriskt: true, beskrivning: 'Den sittande kammaren: `valar`, `partier` och `kalla`.' },
      { namn: 'kammare.partier[].parti_uuid', typ: 'sträng', obligatoriskt: true, beskrivning: 'Partiets `uuid` i registret.' },
      { namn: 'kammare.partier[].forkortning', typ: 'sträng', obligatoriskt: true, beskrivning: 'Partiförkortningen.' },
      { namn: 'kammare.partier[].mandat', typ: 'tal', obligatoriskt: true, beskrivning: 'Mandat i kammaren.' },
      { namn: 'valdeltagande', typ: 'objekt', obligatoriskt: true, beskrivning: 'Valdeltagandet per val i `resultat`, med källorna i `kallor`.' },
      { namn: 'storsta_utanfor_riksdagen', typ: 'objekt', obligatoriskt: true, beskrivning: 'De största partierna utanför riksdagen: `period`, `metod` och `partier`.' },
      { namn: 'storsta_utanfor_riksdagen.partier[].parti_uuid', typ: 'sträng', obligatoriskt: true, beskrivning: 'Partiets `uuid` i registret.' },
      { namn: 'storsta_utanfor_riksdagen.partier[].valar', typ: 'tal', obligatoriskt: true, beskrivning: 'Valåret partiets bästa resultat gäller.' },
      { namn: 'storsta_utanfor_riksdagen.partier[].roster', typ: 'tal', obligatoriskt: true, beskrivning: 'Antalet röster.' },
      { namn: 'storsta_utanfor_riksdagen.partier[].giltiga_roster', typ: 'tal', obligatoriskt: true, beskrivning: 'Giltiga röster i valet, som andelen räknas mot.' },
      { namn: 'storsta_utanfor_riksdagen.partier[].rostandel', typ: 'tal', obligatoriskt: true, beskrivning: 'Röstandelen i procent.' },
      { namn: 'storsta_utanfor_riksdagen.partier[].kalla', typ: 'objekt', obligatoriskt: true, beskrivning: 'Källan raden bygger på, i samma form som `kallor[]` i valresultaten.' },
    ],
  },
  {
    id: 'regions',
    rubrik: 'regioner/index.json',
    adress: '/data/regioner/index.json',
    form: 'En lista med ett län per post, med länets kommuner.',
    readme: 'regionerindexjson',
    falt: [
      { namn: 'kod', typ: 'sträng', obligatoriskt: true, beskrivning: 'SCB:s länskod, två siffror.' },
      { namn: 'namn', typ: 'sträng', obligatoriskt: true, beskrivning: 'Länets namn.' },
      { namn: 'uuid', typ: 'sträng', obligatoriskt: true, beskrivning: 'Länets stabila identitet.' },
      { namn: 'kommuner', typ: 'lista av objekt', obligatoriskt: true, beskrivning: 'Länets kommuner med `kod`, `namn` och `uuid`. Kommunkodens två första siffror är länets kod.' },
    ],
  },
];
