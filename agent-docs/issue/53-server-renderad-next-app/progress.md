# Implementation Progress: Issue #53

**Started:** 2026-08-25
**Last updated:** 2026-08-26
**Status:** Planned

## Completed Steps

- [x] Skapat branch `issue/53-server-renderad-next-app`
- [x] Inventerat befintlig statisk route, exportvalidering och deployworkflow
- [x] Verifierat Next.js-stöd för `getServerSideProps`, permanenta redirects,
      caching och standalone-output
- [x] Bestämt målarkitektur och enkel deployordning
- [x] Dokumenterat filnivå, testmatris och produktionsväxling
- [x] Arbetat in planreview för direkt körbara Node-tester och korrekta API-routes
- [x] Förenklat deployen efter beställarens förtydligande: en målkatalog, vanlig
      rsync och systemd-omstart; kort driftstörning accepteras

## Current Work

Planen är uppdaterad efter granskning och klar för implementation. Ingen
implementation eller serverändring är påbörjad.

## Remaining Steps

- [ ] Implementera servermodul och route-upplösning
- [ ] Konvertera partiprofilen till request-rendering
- [ ] Implementera symbolroute, sitemap och health
- [ ] Bygga och verifiera standalone-release
- [ ] Implementera enkel taggbaserad deploy och systemd-omstart
- [ ] Genomföra full kod-, HTTP- och visuell verifiering
- [ ] Skapa PR
- [ ] Genomföra separat, godkänd produktionsväxling efter merge
