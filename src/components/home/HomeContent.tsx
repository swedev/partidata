import { useMemo, useState } from 'react';
import type { HomeData, HomeParty } from 'src/server/party-data';
import type { ElectionKind, HomeFilters } from './filtering';
import { PAGE_SIZE, defaultFilters, filterParties, pruneFilters } from './filtering';
import type { SortOrder } from './sorting';
import { defaultOrder, sortParties } from './sorting';
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
      if (facet.kommunKoder.length > 0) kinds.add('kommun');
    }
  }
  return (['riksdag', 'region', 'kommun'] as const).filter(kind => kinds.has(kind));
}

/**
 * Owns the filter state the controls write and the result grid reads.
 */
function HomeContent ({ parties, valar, lan, kommuner, riksdag, outsideParliament }: HomeData) {
  const initialFilters = useMemo(() => defaultFilters(valar), [valar]);
  const [filters, setFilters] = useState<HomeFilters>(initialFilters);
  const [order, setOrder] = useState<SortOrder>(defaultOrder);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const kinds = useMemo(() => availableKinds(parties), [parties]);
  const matches = useMemo(
    () => sortParties(filterParties(parties, filters), order, filters),
    [parties, filters, order],
  );

  // The reveal count belongs to the result set it was reached in, so every
  // change of the filters starts over at the first page. Clearing the filters
  // goes through the same path, and resets the count with them.
  function update (patch: Partial<HomeFilters>) {
    setFilters(current => pruneFilters({ ...current, ...patch }));
    setVisible(PAGE_SIZE);
  }

  return (
    <>
      <RiksdagSection years={riksdag} />
      {outsideParliament && <OutsideParliamentSection data={outsideParliament} />}

      <PartyFilters
        filters={filters}
        valar={valar}
        lan={lan}
        kommuner={kommuner}
        kinds={kinds}
        onChange={update}
        onReset={() => update(initialFilters)}
      />

      <PartyResults
        matches={matches}
        total={parties.length}
        visible={visible}
        query={filters.query}
        valar={filters.valar}
        order={order}
        onOrderChange={setOrder}
        onShowMore={() => setVisible(current => current + PAGE_SIZE)}
        onReset={() => update(initialFilters)}
      />
    </>
  );
}

export default HomeContent;
