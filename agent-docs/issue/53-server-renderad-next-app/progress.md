# Implementation Progress: Issue #53

**Started:** 2026-08-25
**Last updated:** 2026-08-26
**Status:** Implemented locally

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
- [x] Implementerat servermodul och tester för party-, redirect-, symbol- och
      kandidatlistedata
- [x] Konverterat partisidan till `getServerSideProps` med riktiga 308 och 404
- [x] Implementerat API-routes för symboler, sitemap och health
- [x] Byggt komplett standalone-artefakt och HTTP-smoke mot den körbara releasen
- [x] Uppdaterat CI, deployworkflow, nginx, systemd-mall och deploydokumentation
- [x] Verifierat desktop och 390 px mobil i Chrome utan konsol- eller assetfel

## Current Work

Implementation och lokal verifiering är klara. Ingen serverändring är gjord.

## Remaining Steps

- [ ] Skapa PR
- [ ] Installera/verifiera Node och systemd-tjänsten på Saga efter merge
- [ ] Genomföra produktionsväxlingen efter merge
