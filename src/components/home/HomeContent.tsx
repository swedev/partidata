import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { HomeData, HomeParty } from 'src/server/party-data';
import type { ElectionKind, HomeFilters } from './filtering';
import { PAGE_SIZE, defaultFilters, filterParties, pruneFilters } from './filtering';
import type { HomeState } from './query';
import { queryFromState } from './query';
import type { SortOrder } from './sorting';
import { sortParties } from './sorting';
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

export type HomeContentProps = HomeData & { initial: HomeState };

/**
 * Owns the filter state the controls write and the result grid reads, and keeps
 * the query string in step with it so the view is linkable and survives the
 * back button.
 */
function HomeContent ({ parties, valar, lan, kommuner, riksdag, outsideParliament, initial }: HomeContentProps) {
  const router = useRouter();
  const defaults = useMemo(() => defaultFilters(valar), [valar]);
  const [filters, setFilters] = useState<HomeFilters>(initial.filters);
  const [order, setOrder] = useState<SortOrder>(initial.order);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const requested = useRef<HomeState>(initial);
  const retry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const kinds = useMemo(() => availableKinds(parties), [parties]);
  const matches = useMemo(
    () => sortParties(filterParties(parties, filters), order, filters),
    [parties, filters, order],
  );

  useEffect(() => () => clearTimeout(retry.current), []);

  // Shallow so the page data is not fetched again for a change the client
  // already holds, and without scrolling so the list stays where it is read.
  // The hash comes from the address bar because the router does not track the
  // fragment links the header points at.
  function write (state: HomeState) {
    requested.current = state;
    const query = queryFromState(state, valar);
    if (new URLSearchParams(query).toString() === new URLSearchParams(window.location.search).toString()) return;

    router
      .replace({ pathname: '/', query, hash: window.location.hash || undefined }, undefined, { shallow: true, scroll: false })
      .catch((error: { cancelled?: boolean }) => {
        if (error?.cancelled) return;
        console.error(error);
        // Browsers cap how many times history.replaceState may be called in a
        // window of time and throw past it, so the latest state is written
        // again once the cap has moved on.
        clearTimeout(retry.current);
        retry.current = setTimeout(() => write(requested.current), 1000);
      });
  }

  // The reveal count belongs to the result set it was reached in, so every
  // change of the filters starts over at the first page. Clearing the filters
  // goes through the same path, and resets the count with them.
  function update (patch: Partial<HomeFilters>) {
    const next = pruneFilters({ ...filters, ...patch });
    setFilters(next);
    setVisible(PAGE_SIZE);
    write({ filters: next, order });
  }

  function changeOrder (next: SortOrder) {
    setOrder(next);
    write({ filters, order: next });
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
        onReset={() => update(defaults)}
      />

      <PartyResults
        matches={matches}
        total={parties.length}
        visible={visible}
        query={filters.query}
        valar={filters.valar}
        order={order}
        onOrderChange={changeOrder}
        onShowMore={() => setVisible(current => current + PAGE_SIZE)}
        onReset={() => update(defaults)}
      />
    </>
  );
}

export default HomeContent;
