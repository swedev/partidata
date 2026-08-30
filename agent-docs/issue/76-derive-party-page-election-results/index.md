# Issue #76: Derive the party page's election results from the imported results

**Baserad på:** main

## Sammanfattning

Partisidans valresultat (hero-blocken, sektionen "Vad partiet har fått i val" och valdeltagandesektionen) läses i dag ur det handkurerade `profil.valresultat`, som bara två partier har, medan samma siffror redan finns validerade och källspårade i `data/val/<år>/valresultat/riksdag.json` för 106 partier 1994–2022. Planen härleder resultaten vid request i `src/server/party-data.ts` — samma filer, samma memoiserade läsning som startsidans riksdagssektion — som en ny `PartiValresultat` på `PartyPageData`, med `mandat` (0 utan mandatrad), `forandring` mot föregående importerade val, källa per rad och ett `kammare`-fält som bara finns när partiet har mandat i det senaste valet med mandatfördelning. Komponenterna byter till den typen: mandatblocket i heron och kammarblocket i sektionen visas bara för kammarpartier, källraderna står per valår (SCB för 1994–1998), och underrubriken klarar ett enda valår. `profil.valresultat` tas bort ur typ, validering (som nu avvisar nyckeln) och de två profilfilerna — de kurerade värdena stämmer siffra för siffra med importen, så inget går förlorat. Smoke-testet knyter partisidans mandat till `data/derived/riksdag.json` och kontrollerar att ett parti utan resultat får ingen sektion; `docs/riksdagsvalresultat.md` får härledningsreglerna.

## Triageringsstatus

| Fält | Värde |
|------|-------|
| **Redo att arbeta** | Ja |
| **Risk** | Låg–Medel |
| **Säker för junior** | Ja |

## Plangranskning

**Status:** Granskad
**Granskad:** 2026-08-30
**Feedback:** Två granskningsrundor (codex). Första rundan: planen antog att preliminära resultatfiler utan mandatfördelning kunde förekomma, men `validate.js` kräver `status: "slutligt"` och 349 mandat per fil (statusfältet och kantfallet togs bort, kammaråret är det senaste importerade valet); testfixturen `makeHomeData()` gör 2026 till kammarår så det föreslagna Alfapartiet-testet var omöjligt (testerna skrevs om: `betapartiet` via store, kantfallen direkt mot `partyElectionResults()` i minnet); det valda indexet i resultatsektionen kan bli stale vid klientnavigering (`key={slug}`); två hårdkodade "Valmyndigheten · slutlig rösträkning" var fel för SCB-åren (seriens källnamn, efter `turnoutSourceNames`-mönstret); stigande/fallande sortering mellan den delade läsningen och startsidans projektion gjordes explicit; smoke-testet fick valdeltagande-assertions, en datakontroll av partiet utan resultat och en avgränsad mandatregex; villkorad spridning och `toSorted()` som implementationskrav; konfliktrisken höjdes till Medel om #21/#77 startar parallellt. Andra rundan: tom fil-lista kraschade kammarårsuppslaget (guard), navigeringstestet gick via startsidan och bevisade inget (fallet är inte nåbart i dagens UI, noterat), och en oanvänd `latestResult` på sidan (borttagen).

## Relaterade filer

- [plan.md](plan.md) — Fullständig implementationsplan
- [progress.md](progress.md) — Implementationsframsteg
- [research.md](research.md) — Forskningsresultat (om finns)

## Relaterade issues

- #68 — Paraplyet "Fill the party profile modules with sourced content"; #76 är dess resultatmodul ("Part of")
- #21 — Historiskt deltagande per valår på partisidan; samma sida, annan data, ingen plan ännu
- #35 — Omkörning av 2026-importen; härledningen ska ta ett nytt valår (och en eventuell preliminär status) utan kodändring
- #77 — Presentationsfält i `profil.json`; rör samma typ, validering och filer, ingen plan ännu
- #26 — Publicerat JSON-gränssnitt; `profil.json` bär inte längre `valresultat`
