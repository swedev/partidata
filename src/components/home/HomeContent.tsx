import { useMemo, useState } from 'react';
import type { HomeData, HomeParty } from 'src/server/party-data';
import type { ElectionKind, HomeFilters } from './filtering';
import { PAGE_SIZE, emptyFilters, filterParties, isActive, pruneFilters } from './filtering';
import PartyFilters from './PartyFilters';
import PartyResults from './PartyResults';
import RiksdagSection from './RiksdagSection';
import OutsideParliamentSection from './OutsideParliamentSection';

function availableKinds (parties: HomeParty[]): ElectionKind[] {
  const kinds = new Set<ElectionKind>();
  for (const party of parties) {
    for (const facet of Object.values(party.deltagande)) {
      if (facet.riksdag) kinds.add('riksdag');
      if (facet.regionLan.length > 0) kinds.add('region');
      if (facet.kommunLan.length > 0) kinds.add('kommun');
    }
  }
  return (['riksdag', 'region', 'kommun'] as const).filter(kind => kinds.has(kind));
}

/**
 * Owns the filter state the controls write and the result grid reads, so the
 * parliament section can sit between them.
 */
function HomeContent ({ parties, valar, lan, riksdag, outsideParliament }: HomeData) {
  const [filters, setFilters] = useState<HomeFilters>(emptyFilters);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const kinds = useMemo(() => availableKinds(parties), [parties]);
  const matches = useMemo(() => filterParties(parties, filters), [parties, filters]);

  // The reveal count belongs to the result set it was reached in, so every
  // change of the filters starts over at the first page. Clearing the filters
  // goes through the same path, and resets the count with them.
  function update (patch: Partial<HomeFilters>) {
    setFilters(current => pruneFilters({ ...current, ...patch }));
    setVisible(PAGE_SIZE);
  }

  return (
    <>
      <PartyFilters
        filters={filters}
        valar={valar}
        lan={lan}
        kinds={kinds}
        onChange={update}
        onReset={() => update(emptyFilters)}
      />

      {!isActive(filters) && <RiksdagSection years={riksdag} />}
      {!isActive(filters) && outsideParliament && <OutsideParliamentSection data={outsideParliament} />}

      <PartyResults
        matches={matches}
        total={parties.length}
        visible={visible}
        query={filters.query}
        onShowMore={() => setVisible(current => current + PAGE_SIZE)}
        onReset={() => update(emptyFilters)}
      />
    </>
  );
}

export default HomeContent;
