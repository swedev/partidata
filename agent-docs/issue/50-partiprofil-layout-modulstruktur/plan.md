# Implementation Plan: Partiprofilens layout och datamodell

## Mål

Implementera partiprofilen med provarkets redaktionella rytm och tydliga
källidentiteter. Designen ska kunna bli innehållsrik när mer data finns, utan
att grundsidan kräver genererade texter eller exempeldata.

## Datagräns

- `index.json` fortsätter vara importerad register- och valdeltagandedata.
- `profil.json` är en valfri, manuellt underhållen och källmärkt komplettering.
- Sidans publika namn kan komma från `profil.json` utan att importdatan skrivs om.
- Profiltext, dokument och dokumentdelar måste ha källa och hämtdatum.
- Profilfiler valideras av `npm run validate:data`.

## Sidans komposition

1. Hero med publikt namn, partisymbol, tydlig källa och reproducerbara nyckeltal.
2. Identitetssektion där partiets egen källa och Valmyndigheten har olika uttryck.
3. Valdeltagande per år med kompletta, expanderbara region- och kommunlistor.
4. Villkorlig dokumentsektion som återger partiets egen dokumentstruktur.
5. Provenienssektion där varje källslag behåller en tydlig identitet.

Sektionerna har olika layout och undviker ett genomgående kortsystem. Om en
profilfil eller innehållstyp saknas renderas inte en tom platshållarmodul.

## Verifiering

- Liberalerna med kompletterad profil och dokument.
- Ett parti utan profilfil.
- Desktop och 390 px mobil i Chrome DevTools.
- Ingen horisontell scroll, hydration-varning eller konsolfel.
- Lint, typkontroll, datavalidering, tester och statiskt bygge.
