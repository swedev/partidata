# Plan: Issue #91 — Present the election type and year filters as segmented single-choice controls

## Mål

Startsidans filterrad har två envalskontroller som inte ser ut som enval: valtypen är tre lösa chips (`aria-pressed`-knappar i `src/components/home/PartyFilters.tsx`) där "alla valtyper" väljs genom att klicka av den valda chipen utan att något visar det läget, och valåret är en dropdown. Båda ska bli samma sorts kontroll: en segmenterad envalsrad med ett explicit första segment för "alla", så att exakt ett segment alltid är valt och läget syns. Segmenten byggs av native `<input type="radio">` i ett `<fieldset>` med `<legend>`, så att tabbstopp, piltangenter och semantik följer med elementen. Tillstånd, URL, `query.ts` och dess tester ändras inte; län och kommun förblir dropdowns.

## Triagering

> Beslutsunderlag för detta issue.

| Fält | Värde |
|------|-------|
| **Blockeras av** | Inget |
| **Blockerar** | Inget |
| **Relaterade issues** | #90 (två valårskontroller ser ut som en), #86 (stängt; införde URL-tillståndet kontrollerna skriver), #89 (öppet; `replaceState`-retryn som snabba piltangentsbyten kan slå i) |
| **Omfattning** | 8 filer i `src/components/home/`, `src/styles/`, `scripts/` |
| **Risk** | Låg |
| **Komplexitet** | Låg |
| **Säker för junior** | Ja |
| **Konfliktrisk** | Låg (ingen annan öppen plan rör `PartyFilters.tsx`/`_home.scss`; #90 saknar plan men kommer att röra `RiksdagSection.tsx` och möjligen `home-select`-stilarna i `_home.scss`) |

### Triagemässiga noteringar

- Issuet är öppet utan etiketter, ansvarig, milstolpe eller kommentarer, och har inga projektposter (`projectItems.totalCount: 0` via GraphQL 2026-08-30). Inga blockerare nämns i texten.
- #86 är mergat (`77720ee`), så `valtyp: ''`/`valar: ''` i tillståndet och `valtyp`/`valar`/`valar=alla` i URL:en är den etablerade grunden. Den här planen rör inte `src/components/home/query.ts`, `scripts/home-query.test.js` eller `HomeContent.tsx`.
- #89 är öppet: `write()` i `HomeContent.tsx` har en retry för Safaris tak på 100 `replaceState`-anrop per 30 sekunder, och den vägen har aldrig körts i Safari. Piltangenter i en radio-grupp väljer vid varje tryck, så en nedhållen piltangent ger ändringar tätare än klick. Det gör inte #89 till blockerare — felläget är ett konsolfel och en fördröjd URL-skrivning, inte förlorat tillstånd — men verifieringen här ska köra just det fallet i Safari (fas 6), och utfallet är värt att anteckna i #89.
- #90 (valårsväljaren i riksdagssektionen) lämnas orörd här. Efter den här ändringen är filterradens valår en segmentrad och sektionens väljare fortfarande en dropdown, så de ser inte längre likadana ut — men båda heter fortfarande "Valår" för skärmläsare (filterradens `<legend>` respektive sektionens `aria-label`), så #90:s namngivning behövs fortfarande. Ordningen mellan #90 och #91 spelar ingen roll; rör de samma rader i `_home.scss` är det en trivial rebase.
- Issuet säger att `scripts/http-smoke.js` "still passes with the same expectations". Tre av dess assertions är bundna till chip-markupen (`aria-pressed`, rad 187, 205 och 240) och fyra till valårets `<option ... selected="">` (rad 178, 204, 232 och 239); de måste skrivas om till radio-semantik. Förväntningarna på *vilken vy varje länk ger* (rubrikräkning, gridets innehåll och ordning) står kvar oförändrade — det är så planen läser "same expectations" (se designbeslut 7).

## Angreppssätt

I dag ligger valtypen i `PartyFilters.tsx` rad 92–112 som en `role="group"` med tre `<button aria-pressed>`; `toggleKind` i `summary.ts` gör att ett klick på den valda chipen nollställer typen. Valåret på rad 43–55 är en `<select>` med `<option value="">Alla valår</option>` följt av datans år. Låsningen — riksdagsvalet gäller inte ett valt län, region- och riksdagsval gäller inte en vald kommun — räknas inline på rad 96 och blir `disabled` plus en `title`.

Planen ersätter båda med en gemensam komponent, `SegmentedControl`, som renderar

```html
<fieldset class="home-segments">
  <legend class="sr-only">Valtyp</legend>
  <label class="home-segment" title="…">
    <input class="sr-only" type="radio" name="«id»" value="" checked onChange … />
    <span class="home-segment__text">Alla</span>
  </label>
  …
  <label class="home-segment" title="Riksdagsval gäller inte …">
    <input class="sr-only" type="radio" name="«id»" value="riksdag" disabled aria-describedby="«id»-riksdag-note" … />
    <span class="home-segment__text">Riksdagsval</span>
  </label>
  <span id="«id»-riksdag-note" class="sr-only">Riksdagsval gäller inte …</span>
</fieldset>
```

Radioknapparna är styrda (`checked={value === segment.value}`) så att SSR och klient ger samma markup, och `onChange` skickar segmentets värde uppåt; `PartyFilters` mappar det till `onChange({ valtyp })` respektive `onChange({ valar })`, samma `patch`-form som i dag. Komponenten är generisk över värdetypen (`SegmentedControl<T extends string>`), så valtypens grupp får `T = HomeFilters['valtyp']` utan typpåstående. Eftersom "alla" är ett eget segment med värdet `''` finns alltid ett valt segment så länge `value` förekommer bland segmenten, och `toggleKind` har inget kvar att göra och tas bort tillsammans med sitt test.

Invarianten "exakt ett valt" vilar på att `value` finns i listan, och segmentbyggarna garanterar det. För valår håller det av sig självt: `stateFromQuery` släpper bara igenom år ur `data.valar`, som är samma lista som bygger segmenten. För valtyp bygger listan på `availableKinds(parties)` i `HomeContent.tsx` medan `stateFromQuery` godtar alla tre typerna oavsett data, så med ett delregister utan t.ex. regionval kan `?valtyp=region` ge ett tillstånd som `kinds` saknar. Därför tar `kindSegments` även emot `filters.valtyp` och går igenom den kanoniska ordningen `riksdag`, `region`, `kommun` och tar med varje typ som finns i `kinds` *eller* är den valda: det valda segmentet finns alltid, i rätt position, och sidan visar ärligt att "Regionval" är valt med en tom lista. Med det committade registret finns alla tre typerna, så listan är identisk med dagens chips; kantfallet testas i fas 1. `query.ts` lämnas orörd, som issuet ber om.

Native radio ger det issuet ber om utan egen tangentbordskod: gruppen är ett tabbstopp som landar på det valda segmentet, piltangenter flyttar valet inom gruppen, och `disabled`-radios hoppas över. En sak följer av det och ska vara känd: ett piltangentstryck *väljer* (det är radio-beteende, inte bara fokusflytt), så varje tryck kör `update()` i `HomeContent` och skriver URL:en — det är den serie av täta `replaceState`-anrop som #89 gäller. `write()` gör om skrivningen en sekund efter varje misslyckande och ger sig inte förrän den lyckas, men Safaris tak är 100 anrop per 30 sekunder, så under en lång nedhållen piltangent kan URL:en ligga efter tills fönstret rullat vidare — upp till ~30 sekunder efter sista ändringen. Verifieringen i fas 6 kör fallet i Safari och antecknar utfallet i #89.

Låsningen flyttar från JSX-raden till en ren modul, `segments.ts`, som bygger segmentlistorna (`{ value, label, disabled?, title? }`) för valtyp och valår ur `filters`, `kinds` och `valar`. Modulen testas med `node:test` på samma sätt som `summary.ts` och `query.ts` (relativa importer med `.ts`-ändelse, inga runtime-importer via `src/...`), så regeln "riksdagsval låses av län, region- och riksdagsval låses av kommun" får en test i stället för att bara läsas ur markupen. Det är lite mer struktur än vad tre rader inline kräver; motiveringen är acceptanskriteriet om låsningen (designbeslut 4).

Låstexten når två vägar: som `title` på `<label>` för hovern (som knappen i dag), och som accessible description på radion via `aria-describedby` till en visuellt dold `<span>` med samma text, placerad *efter* `<label>` i fältgruppen — inte inuti, för då blir texten del av segmentets namn. En skärmläsare som läser ett låst segment i browse-läge får då både "nedtonad" och *varför*. Piltangenter hoppar över låsta radios, så den vägen nås texten inte — det är samma begränsning som dagens `disabled` knappar har (designbeslut 10).

Det visuella: segmenten ligger kant i kant i en pillformad rad (yttre hörn `999px`, inre hörn raka, `margin-left: -1.5px` så kanterna sammanfaller), valt segment i navy med papper-text som `.home-chip--on` i dag, låst segment med `opacity: 0.45` och `cursor: not-allowed` som `.home-chip:disabled`. Radion döljs med Tailwinds `sr-only` (absolut positionerad, klippt, fortfarande fokuserbar — `display: none` skulle ta den ur tabbordningen), och fokusringen ritas på hela segmentet med `.home-segment:has(> input:focus-visible)`, samma gula 3px-ring som övriga kontroller. `fieldset` behöver `min-inline-size: 0`, `border: 0`, `padding: 0`, `margin: 0` (Tailwinds preflight nollar margin/padding men inte `min-inline-size`), och `flex-wrap: wrap` så raden bryter på smala skärmar som chipsen gör i dag. Vid radbrytning får den brutna raden raka hörn där den delas — det accepteras (designbeslut 6) men ska tittas på i verifieringen.

Stegen är ordnade så att bygget är grönt efter varje fas: nytt läggs till först (fas 1–2), filterraden byts (fas 3), och först därefter tas det gamla bort (fas 4).

## Steg

### Fas 1: Segmentmodellen med tester

1. Skapa `src/components/home/segments.ts`
   - `export interface Segment<T extends string = string> { value: T; label: string; disabled?: boolean; title?: string }`
   - `export const ALL_KINDS_LABEL = 'Alla'` och `export const ALL_YEARS_LABEL = 'Alla valår'`
   - `export function kindLocked (kind: ElectionKind, filters: Pick<HomeFilters, 'lan' | 'kommun'>): boolean` — samma regel som `PartyFilters.tsx` rad 96 i dag: `kind === 'riksdag' && Boolean(filters.lan)` eller `kind !== 'kommun' && Boolean(filters.kommun)`
   - `export const lockedTitle = (kind: ElectionKind) => \`${electionKindLabels[kind]} gäller inte ett valt område — välj Hela landet och Alla kommuner först\`` — texten flyttas oförändrad från `PartyFilters.tsx` rad 104
   - `export function kindSegments (kinds: ElectionKind[], filters: Pick<HomeFilters, 'valtyp' | 'lan' | 'kommun'>): Segment<HomeFilters['valtyp']>[]` — `{ value: '', label: 'Alla' }` först, sedan, i den kanoniska ordningen `riksdag`, `region`, `kommun`, ett segment för varje typ som finns i `kinds` eller är `filters.valtyp`, med `label: electionKindLabels[kind]`, `disabled: kindLocked(...)` och `title` bara när låst. Den valda typen är därmed alltid med (invarianten "exakt ett valt")
   - `export function yearSegments (valar: string[]): Segment[]` — `{ value: '', label: 'Alla valår' }` först, sedan åren i den ordning datan ger dem (stigande, som `<option>`-listan i dag)
   - Importer: `import type { ElectionKind, HomeFilters } from './filtering.ts'` och `import { electionKindLabels } from './filtering.ts'` — `.ts`-ändelse som i `query.ts`, så modulen går att `require` från `node:test` under Node 24
2. Skapa `scripts/home-segments.test.js` (mönster: `scripts/home-summary.test.js`)
   - "alla" är alltid första segmentet, aldrig låst, med värdet `''`
   - inget låst utan område; riksdagsval låst av `lan`; riksdagsval och regionval låsta av `kommun`; kommunval aldrig låst
   - `title` finns exakt på de låsta segmenten och nämner valtypens namn
   - `kindSegments(['riksdag'], { valtyp: '', … })` ger bara "Alla" och "Riksdagsval" — listan följer `kinds`, inte alla tre typerna
   - `kindSegments(['riksdag'], { valtyp: 'region', … })` ger "Alla", "Riksdagsval", "Regionval" — den valda typen finns alltid med, i kanonisk position (delregister-kantfallet i Angreppssätt)
   - `kindSegments(['riksdag', 'region', 'kommun'], …)` ger aldrig dubbletter
   - `yearSegments(['2018', '2022', '2026'])` ger fyra segment i ordningen "Alla valår", 2018, 2022, 2026; `yearSegments([])` ger bara "Alla valår" (gruppen visas ändå inte när `valar` är tom, se fas 3)

### Fas 2: Komponenten och de nya stilarna

3. Skapa `src/components/home/SegmentedControl.tsx`
   - `function SegmentedControl<T extends string> ({ legend, value, segments, onChange }: { legend: string; value: T; segments: Segment<T>[]; onChange: (value: T) => void })`
   - `const name = useId()` som `name` på alla radios i gruppen, så två grupper på sidan aldrig delar radio-grupp
   - Markup enligt Angreppssätt: `<fieldset className="home-segments">`, `<legend className="sr-only">{legend}</legend>`, ett `<label className="home-segment" title={segment.title}>` per segment med `<input className="sr-only" type="radio" name={name} value={segment.value} checked={value === segment.value} disabled={segment.disabled} aria-describedby={noteId} onChange={() => onChange(segment.value)} />` följt av `<span className="home-segment__text">{segment.label}</span>`; när `segment.title` finns renderas dessutom `<span id={noteId} className="sr-only">{segment.title}</span>` som syskon *efter* `<label>` (inte inuti — då blir texten del av namnet), där `noteId = \`${name}-${segment.value || 'alla'}-note\`` och `undefined` annars, så varken `aria-describedby` eller spannet finns för olåsta segment
   - Skriv attributen i just den ordningen (`type`, `name`, `value`, `checked`, `disabled`, `aria-describedby`) — SSR-markupen följer JSX-ordningen, och smoke-testet i fas 5 matchar med `[^>]*` mellan attributen så ordningen inte är bärande, men den ska vara stabil
   - `key={segment.value}` på ett `<Fragment>` runt `<label>` och det eventuella spannet; `''` är ett giltigt och unikt värde i båda grupperna
   - `title` på `<label>` är hovern; `undefined` när segmentet inte är låst, så attributet inte renderas alls
   - Spannen påverkar inte `:first-of-type`/`:last-of-type` på `.home-segment`, som räknar `label`-element
4. Lägg till segmentstilarna i `src/styles/_home.scss` (chip-stilarna står kvar tills fas 4)
   - `.home-segments { display: flex; flex-wrap: wrap; min-inline-size: 0; padding: 0; border: 0; margin: 0; }`
   - `.home-segment { position: relative; display: inline-flex; align-items: center; padding: 0.6875rem 1.25rem; border: 1.5px solid var(--partidata-chip-off-line); margin-left: -1.5px; background: var(--partidata-card); color: var(--partidata-ink); cursor: pointer; font-size: 1rem; }` (samma mått som `.home-chip`)
   - `.home-segment:first-of-type { margin-left: 0; border-radius: 999px 0 0 999px; }` och `.home-segment:last-of-type { border-radius: 0 999px 999px 0; }` — `<legend>` är inte en `label`, så `:first-of-type` träffar första segmentet
   - `.home-segment:hover { border-color: var(--partidata-navy); color: var(--partidata-navy); z-index: 1; }`
   - `.home-segment:has(> input:checked) { border-color: var(--partidata-navy); background: var(--partidata-navy); color: var(--partidata-paper); z-index: 1; }`
   - `.home-segment:has(> input:disabled) { cursor: not-allowed; opacity: 0.45; }` och `.home-segment:has(> input:disabled):hover { border-color: var(--partidata-chip-off-line); color: var(--partidata-ink); z-index: auto; }`
   - `.home-segment:has(> input:focus-visible) { outline: 3px solid var(--partidata-yellow); outline-offset: 3px; z-index: 2; }`
   - Den globala `input:focus-visible`-regeln i `app.scss` rad 125–128 träffar den dolda radion; det syns inte (den är klippt till 1px) och behöver ingen åtgärd
   - `.home-search__filters` (rad 44–50) behåller `gap: 0.75rem` och `flex-wrap: wrap`; segmentgrupperna är flex-barn där som `home-select`-spannen

### Fas 3: Koppla in i filterraden

5. Ändra `src/components/home/PartyFilters.tsx`
   - Byt `<span className="home-select">…<select aria-label="Valår">…</select>…</span>` (rad 43–55) mot `<SegmentedControl legend="Valår" value={filters.valar} segments={yearSegments(valar)} onChange={valar => onChange({ valar })} />`, fortfarande bakom `valar.length > 0`
   - Byt chip-blocket (rad 92–112) mot `<SegmentedControl legend="Valtyp" value={filters.valtyp} segments={kindSegments(kinds, filters)} onChange={valtyp => onChange({ valtyp })} />`, fortfarande bakom `kinds.length > 0`. `T` härleds till `HomeFilters['valtyp']` från `value` och `segments`, så inget typpåstående behövs
   - Behåll ordningen i raden: valår, län, kommun, valtyp, "Rensa filter" — samma som i dag
   - Ta bort importen av `toggleKind`; `ChevronDownIcon` används fortfarande av län- och kommunväljarna
   - `useMemo` för `municipalities` och `useId` för sökfältet står kvar
6. Kontrollera `HomeContent.tsx`: inga ändringar. `update()` prunar filtren som förr, så ett `valtyp`-byte till `riksdag` tömmer `lan`, och `onReset` ger senaste året plus `valtyp: ''`, vilket segmentraderna visar som "2026" respektive "Alla".
7. `npm run typecheck && npm run lint && npm run dev` — sidan renderar med de nya kontrollerna innan något gammalt tas bort.

### Fas 4: Ta bort det som ersatts

8. Ta bort `toggleKind` ur `src/components/home/summary.ts` (rad 59–65 inklusive docblocken) och testet på rad 70–74 i `scripts/home-summary.test.js` samt dess `require`-post på rad 10. Efter fas 3 använder inget annat funktionen (`grep -rn toggleKind src scripts` ska vara tomt).
9. Ta bort `.home-chips` och `.home-chip*` (rad 100–137 i `src/styles/_home.scss`) och `.home-chip:focus-visible` ur den gemensamma fokusregeln på rad 139–144. `grep -rn home-chip src` ska vara tomt.

### Fas 5: HTTP-smoke

10. Ändra `scripts/http-smoke.js`
    - Lägg till hjälpfunktionerna `segmentGroup(html, legend)` — klipper ut `<fieldset class="home-segments"><legend class="sr-only">{legend}</legend>…</fieldset>` för den givna legenden (klassordningen är den JSX:en skriver; matcha med `[^>]*` för säkerhets skull) — och `checkedSegment(groupHtml)` som returnerar `value` för den radio som bär `checked=""`. Assert att exakt en radio i gruppen är `checked`.
    - Rad 178 (`<option value="${latest}" selected="">`): ersätt med `assert.equal(checkedSegment(segmentGroup(homeBody, 'Valår')), latest, 'valårsfiltret står på det senaste valet')`
    - Rad 187 (`aria-pressed="false"`): ersätt med `assert.equal(checkedSegment(segmentGroup(homeBody, 'Valtyp')), '', 'valtypen står på alla')`
    - Rad 204–205: `checkedSegment(... 'Valår') === earlier` och `checkedSegment(... 'Valtyp') === 'riksdag'`
    - Rad 232: `checkedSegment(... 'Valår') === ''`
    - Rad 239–240: `checkedSegment(... 'Valår') === latest` och `checkedSegment(... 'Valtyp') === ''`
    - Nytt: hämta `/?valar=${earlier}&valtyp=region&lan=01` (kontrollera först att `01` finns bland länskoderna i `deltagande`-mappen, annars välj den första region-koden som förekommer) och assert att `Valtyp`-gruppens radio med `value="riksdag"` bär `disabled=""` och ett `aria-describedby` vars id finns på ett `<span class="sr-only">` i samma grupp med låstexten, och att `region` är `checked` — det är låsningen i acceptanskriterierna, renderad på servern
    - Sorteringens `<option ... selected="">`-assertions (rad 179, 180, 224) står kvar; sorteringen är fortfarande en `<select>`
    - Assertions på `countPattern` och `partyGridLinks` ändras inte

### Fas 6: Verifiering

11. `npm run precommit` (lint, typecheck, derived-data, validate:data, test, build:release, test:http)
12. Manuell kontroll i `npm run dev`:
    - Tab från sökfältet: ett stopp på valår (landar på valt segment), sedan län, kommun, ett stopp på valtyp, sedan "Rensa filter"; pil höger/vänster flyttar valet och hoppar över låsta segment; Shift+Tab bakåt
    - Välj län → "Riksdagsval" låses med titeln synlig vid hover; välj kommun → "Riksdagsval" och "Regionval" låsta; "Alla" och "Kommunval" alltid valbara
    - "Rensa filter" ger "2026" (senaste året) och "Alla"
    - Fönster ≈ 360px brett: raderna bryter utan horisontell scroll; titta på hörnen vid brytpunkten (designbeslut 6)
    - VoiceOver (Safari): gruppen presenteras som "Valtyp, grupp", varje segment som "Alla, radioknapp, 1 av 4, vald" och så vidare; ett låst segment, läst med VO-markören, presenteras som nedtonat *och* med låstexten som beskrivning (`aria-describedby`)
    - Safari, #89-fallet: fokusera valårsgruppen och håll pil höger nere i mer än 30 sekunder (radion cyklar 2018 → 2022 → 2026 → Alla valår → …, långt över 100 `replaceState`-anrop). Förväntat: antingen tyst konsol, eller `SecurityError` i konsolen medan taket gäller och därefter — retryn försöker om varje sekund, så senast ~30 sekunder efter sista tangenttrycket — en URL som stämmer med det valda segmentet. Allt annat (URL som aldrig kommer ikapp, ohanterat fel) är ett fynd för #89. Anteckna utfallet i #89, som ber om just en sådan körning
    - Bakåtknappen efter ett partiklick visar samma segment valda som innan (tillståndet kommer från URL:en, #86)

## Filöversikt

| Fil | Åtgärd | Syfte |
|-----|--------|-------|
| `src/components/home/segments.ts` | Skapa | Segmentlistor för valtyp och valår, låsregel och låstext |
| `scripts/home-segments.test.js` | Skapa | `node:test` för segmentlistorna, låsningen och delregister-fallet |
| `src/components/home/SegmentedControl.tsx` | Skapa | Generisk `<fieldset>`/`<legend>`/radio-komponent |
| `src/components/home/PartyFilters.tsx` | Ändra | Valår och valtyp renderas med `SegmentedControl`; chip-blocket och `toggleKind`-importen bort |
| `src/components/home/summary.ts` | Ändra | `toggleKind` tas bort |
| `scripts/home-summary.test.js` | Ändra | `toggleKind`-testet tas bort |
| `src/styles/_home.scss` | Ändra | `.home-chips`/`.home-chip*` ersätts av `.home-segments`/`.home-segment*` |
| `scripts/http-smoke.js` | Ändra | Radio-semantik i stället för `aria-pressed`/`<option selected>` för valår och valtyp; ny assertion för låsningen |

## Berörda kodområden

Lista de primära kataloger/områden som planen berör (för konfliktdetektering):
- `src/components/home/` (`PartyFilters.tsx`, `summary.ts`, nya `segments.ts` och `SegmentedControl.tsx`)
- `src/styles/` (`_home.scss`)
- `scripts/` (`http-smoke.js`, `home-summary.test.js`, nya `home-segments.test.js`)

## Designbeslut

> Icke-triviala val gjorda under planeringen. Feedback välkommen; annars implementeras enligt dessa.

### 1. Native radio i `<fieldset>`/`<legend>`, inte knappar med `role="radiogroup"`
**Alternativ:** A) `<input type="radio">` per segment, dolda visuellt, `<label>` som segment; B) `<button role="radio" aria-checked>` med egen piltangentshantering (roving tabindex).
**Beslut:** A
**Motivering:** Issuet anger A i scope och markerar det som agentens förslag, öppet att ifrågasätta (användarbeslut med reservation, issue #91). A ger tabbstopp, piltangenter, hopp över `disabled` och semantiken gratis; B kräver ~30 rader tangentbordskod som måste testas för hand. Priset för A är att ett piltangentstryck väljer direkt (och skriver URL:en), vilket är hur radio-grupper beter sig och vad en användare av dem förväntar sig; att det är den serie skrivningar #89 handlar om täcks av verifieringen.

### 2. Legenden döljs visuellt
**Alternativ:** A) `<legend className="sr-only">`; B) synlig legend ovanför eller före raden.
**Beslut:** A
**Motivering:** Ingen annan kontroll i filterraden har synlig etikett — valår, län, kommun och valtyp bär `aria-label` i dag, och första segmentets text ("Alla valår") säger vad raden väljer (befintlig konvention, `PartyFilters.tsx`). En synlig legend skulle ändra radens layout, vilket issuet inte ber om. Agentens bedömning; en synlig legend är en klassändring om designen vill ha den.

### 3. Segmenttexterna "Alla" och "Alla valår"
**Alternativ:** A) "Alla" för valtyp och "Alla valår" för valår, som issuet skriver; B) "Alla valtyper" och "Alla valår"; C) "Alla" för båda.
**Beslut:** A
**Motivering:** Issuets scope anger texterna (användarbeslut, issue #91). "Alla valår" behåller dropdownens nuvarande etikett, som smoke-testet också känner till. Valtypens "Alla" är kort nog att inte tränga raden; skulle "Alla" ensamt bli otydligt intill "Riksdagsval" är "Alla val" ett enords-byte i `segments.ts`.

### 4. Segmentlistorna byggs i en ren, testad modul
**Alternativ:** A) `segments.ts` med `kindSegments`/`yearSegments`/`kindLocked` och `node:test`; B) bygga listorna inline i `PartyFilters.tsx` som i dag.
**Beslut:** A
**Motivering:** Acceptanskriterierna nämner låsningen uttryckligen, och repot saknar komponenttester (ingen React-testmiljö; `node:test` kör `.ts`-moduler via Nodes type stripping, som `home-summary.test.js` och `home-query.test.js` gör). Att ha regeln i en ren funktion är det enda sättet att testa den automatiskt. Det ersätter samtidigt `toggleKind`-testet som försvinner. Agentens bedömning; B är helt godtagbar om man hellre håller filantalet nere.

### 5. Radion döljs med `sr-only`, fokusringen ritas på segmentet via `:has()`
**Alternativ:** A) `<input className="sr-only">` och `.home-segment:has(> input:focus-visible)`; B) `appearance: none` på radion och styla själva inputen som segmentet; C) `input:focus-visible + span` med ringen på textspannet.
**Beslut:** A
**Motivering:** `sr-only` finns redan (Tailwind-utility, används i `PartyResults.tsx` och profilsidan) och håller radion fokuserbar; `display: none` eller `visibility: hidden` skulle ta den ur tabbordningen. `:has()` är baseline i alla stödda webbläsare sedan 2023 och låter ringen, det valda läget och det låsta läget alla uttryckas på `<label>` utan klassväxling i React — en styrd `checked` räcker. B skulle kräva att texten ligger *i* inputen, vilket radio inte tillåter. Agentens bedömning.

### 6. Sammanfogad pillrad med yttre rundade hörn; radbrytning accepteras
**Alternativ:** A) `margin-left: -1.5px`, `999px` på första/sista segmentets ytterkanter, `flex-wrap: wrap`; B) varje segment fullt rundat med litet mellanrum (som chipsen i dag, men med "Alla"); C) förbjud radbrytning och låt raden scrolla horisontellt.
**Beslut:** A
**Motivering:** Issuet ber om "joined segments" som "wrap on narrow screens" (användarbeslut, issue #91). A är den läsning som ger både. Vid brytning får segmenten närmast brytpunkten raka hörn — det är ett kosmetiskt pris, inte ett funktionellt, och det inträffar bara under ~500px där valårsraden (fyra segment) bryter. C skulle strida mot issuet och B ger inte en sammanhållen rad. Agentens bedömning på hörnbehandlingen; om brytningen ser fel ut i verifieringen är B en ren SCSS-ändring utan påverkan på komponenten.

### 7. Smoke-testets assertions skrivs om till radio-semantik
**Alternativ:** A) Byt de sju markup-bundna assertions till `checkedSegment(segmentGroup(...))` och behåll alla vy-assertions; B) behåll `aria-pressed` genom att sätta attributet på `<label>` så gamla regex fortsätter matcha.
**Beslut:** A
**Motivering:** Issuet skriver att smoke-testet "still passes with the same expectations", men tre assertions matchar bokstavligen `aria-pressed` och fyra matchar valårets `<option selected>`; ingen av dem kan överleva att kontrollerna byts. B skulle lägga ett ARIA-attribut på ett element som inte får bära det, bara för testets skull. Planen läser "same expectations" som förväntningarna på vyn — rubrikräkningen, gridets innehåll och ordning för varje länk — och de ändras inte. Agentens tolkning; om det var meningen att smoke-testet skulle lämnas orört bör det sägas.

### 8. `RiksdagSection` och #90 lämnas orörda
**Alternativ:** A) Bara filterraden ändras; B) passa på att byta riksdagssektionens väljare eller dess namn.
**Beslut:** A
**Motivering:** Issuet avgränsar till filterraden och pekar på #90 för sektionens väljare (användarbeslut, issue #91). Att blanda in #90 här skulle ge två issues i en PR.

### 9. Inga ändringar i `query.ts`, `HomeContent.tsx` eller URL-formatet; "exakt ett valt" garanteras i `kindSegments`
**Alternativ:** A) Kontrollen är den enda ändringen, och `kindSegments` tar alltid med den valda typen; B) samtidigt införa t.ex. `valtyp=alla` i URL:en för symmetri med `valar=alla`; C) låta `stateFromQuery` klippa `valtyp` mot `availableKinds` så ett värde utan segment aldrig kan uppstå.
**Beslut:** A
**Motivering:** Issuets scope säger att tillstånd och URL är oförändrade och att `query.ts` och dess tester ska lämnas (användarbeslut, issue #91). `valtyp: ''` är redan förvalet och behöver ingen token; `valar` har sin `alla`-token för att förvalet där är senaste året. Kantfallet — ett delregister utan någon valtyp möter `?valtyp=<den typen>` — finns inte i committad data, men acceptanskriteriet "exakt ett segment valt i alla lägen" ska hålla utan förbehåll; A gör det på segmentsidan med en rad i en ren, testad funktion, medan C kräver ett `query.ts`-ingrepp. Att den valda typen då kan visas utan data är ärligt: listan är tom och rubriken räknar 0. Agentens bedömning.

### 10. Låstexten som `title` på `<label>` och som `aria-describedby` på radion
**Alternativ:** A) `title` på `<label>` (hover) plus `aria-describedby` från `<input>` till en visuellt dold `<span>` med samma text, som syskon efter `<label>`; B) bara `title` på `<label>`, som knappen i dag; C) `title` på både `<label>` och `<input>` och lita på att `title` blir accessible description.
**Beslut:** A
**Motivering:** Issuet ber om samma `title` som i dag (användarbeslut, issue #91), vilket B uppfyller för mus men inte för hjälpmedel: `title` på en `<label>` beskriver inte radion. C är kortast men `title`-uppläsning är inte pålitlig mellan skärmläsare, och en låst radio kan inte fokuseras med tangentbordet, så browse-läget är den enda vägen till texten — den ska då fungera. A kostar en id-koppling och ett dolt element per låst segment; texten kan inte ligga inuti `<label>`, då blir den del av namnet. Agentens bedömning.

## Verifieringschecklista

- [ ] Valtyp och valår är var sin segmentrad med exakt ett valt segment i alla lägen, "alla" inräknat (acceptanskriterium)
- [ ] Tab når varje grupp en gång och landar på det valda segmentet; piltangenter flyttar inom gruppen; låsta segment hoppas över (acceptanskriterium)
- [ ] Län låser "Riksdagsval", kommun låser "Riksdagsval" och "Regionval", med samma `title`-text som i dag (acceptanskriterium)
- [ ] URL:en och den renderade listan är oförändrade för varje val: `/`, `/?valar=2022&valtyp=riksdag`, `/?valar=alla`, `/?valar=1900&valtyp=eu`, `/?valar=2026` ger samma grid som före ändringen (acceptanskriterium; smoke-testets `partyGridLinks`/`countPattern`)
- [ ] `scripts/http-smoke.js` passerar med radio-assertions och den nya låsnings-assertionen
- [ ] `npm run precommit` grönt (acceptanskriterium)
- [ ] Bygget är grönt efter fas 3, före borttagningarna i fas 4
- [ ] `toggleKind` finns inte kvar någonstans (`grep -rn toggleKind src scripts` tomt)
- [ ] Inga `.home-chip`-klasser kvar i `src/`
- [ ] Inget `as HomeFilters['valtyp']`-påstående i `PartyFilters.tsx`; `T` härleds
- [ ] Kantfall: `valar` tom → ingen valårsgrupp renderas; `kinds` tom → ingen valtypsgrupp
- [ ] Kantfall: `kindSegments(['riksdag'], { valtyp: '' })` ger bara "Alla" och "Riksdagsval"; `kindSegments(['riksdag'], { valtyp: 'region' })` tar med "Regionval" så den valda typen alltid har ett segment (test)
- [ ] Kantfall: `/?valtyp=riksdag&lan=01` → `pruneFilters` släpper länet, "Riksdagsval" är valt och inte låst
- [ ] Kantfall: "Rensa filter" med kommun vald → "Alla" valt, alla segment upplåsta, kommun- och länväljarna på "Alla kommuner"/"Hela landet"
- [ ] Smal skärm (~360px): raderna bryter, ingen horisontell scroll; hörnen vid brytpunkten ser acceptabla ut (designbeslut 6)
- [ ] Hover på låst segment visar titeln
- [ ] Skärmläsare läser gruppnamn, segmenttext, "radioknapp", position och valt läge; låst segment läses som nedtonat med låstexten som beskrivning via `aria-describedby`
- [ ] Låst radio bär `aria-describedby` till ett dolt spann med låstexten; olåst radio bär inget `aria-describedby` (smoke-testet)
- [ ] Safari: nedhållen piltangent i valårsgruppen i >30 s — URL:en kommer ikapp senast ~30 s efter sista trycket, inget ohanterat fel; utfallet antecknat i #89
- [ ] Bakåtnavigering från en partisida visar samma segment valda
