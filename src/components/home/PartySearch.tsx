import { useId, useMemo, useState } from 'react';
import PartyCard from 'src/components/PartyCard';
import type { HomeCounty, HomeParty } from 'src/server/party-data';
import type { ElectionKind, HomeFilters } from './filtering';
import {
  PAGE_SIZE,
  countyApplies,
  electionKindLabels,
  emptyFilters,
  filterKey,
  filterParties,
  isActive,
  pruneFilters,
} from './filtering';

const numberFormatter = new Intl.NumberFormat('sv-SE');

function participationYears (party: HomeParty) {
  return Object.keys(party.deltagande).sort((a, b) => Number(b) - Number(a));
}

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

function PartySearch ({ parties, valar, lan }: { parties: HomeParty[]; valar: string[]; lan: HomeCounty[] }) {
  const [filters, setFilters] = useState<HomeFilters>(emptyFilters);
  const [paging, setPaging] = useState({ key: filterKey(emptyFilters), count: PAGE_SIZE });
  const fieldId = useId();

  // Paging belongs to one result set: a new search or filter shows the first
  // page again rather than carrying the previous set's reveal count over.
  const key = filterKey(filters);
  const visible = paging.key === key ? paging.count : PAGE_SIZE;

  const kinds = useMemo(() => availableKinds(parties), [parties]);
  const matches = useMemo(() => filterParties(parties, filters), [parties, filters]);
  const shown = matches.slice(0, visible);

  function update (patch: Partial<HomeFilters>) {
    setFilters(current => pruneFilters({ ...current, ...patch }));
  }

  return (
    <section className="home-search" aria-labelledby={`${fieldId}-heading`}>
      <h2 id={`${fieldId}-heading`} className="sr-only">Sök och filtrera partier</h2>

      <div className="home-search__query">
        <label htmlFor={`${fieldId}-query`}>Sök parti</label>
        <input
          id={`${fieldId}-query`}
          type="search"
          value={filters.query}
          placeholder="Sök parti på namn eller förkortning"
          autoComplete="off"
          onChange={event => update({ query: event.target.value })}
        />
      </div>

      <fieldset className="home-search__filters">
        <legend>Avgränsa till anmält valdeltagande</legend>

        {valar.length > 0 && (
          <div className="home-search__field">
            <label htmlFor={`${fieldId}-valar`}>Valår</label>
            <select
              id={`${fieldId}-valar`}
              value={filters.valar}
              onChange={event => update({ valar: event.target.value })}
            >
              <option value="">Alla valår</option>
              {valar.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
        )}

        {kinds.length > 0 && (
          <div className="home-search__field">
            <label htmlFor={`${fieldId}-valtyp`}>Valtyp</label>
            <select
              id={`${fieldId}-valtyp`}
              value={filters.valtyp}
              onChange={event => update({ valtyp: event.target.value as HomeFilters['valtyp'] })}
            >
              <option value="">Alla valtyper</option>
              {kinds.map(kind => <option key={kind} value={kind}>{electionKindLabels[kind]}</option>)}
            </select>
          </div>
        )}

        {countyApplies(filters.valtyp) && lan.length > 0 && (
          <div className="home-search__field">
            <label htmlFor={`${fieldId}-lan`}>Län</label>
            <select
              id={`${fieldId}-lan`}
              value={filters.lan}
              onChange={event => update({ lan: event.target.value })}
            >
              <option value="">Hela landet</option>
              {lan.map(county => <option key={county.kod} value={county.kod}>{county.namn}</option>)}
            </select>
          </div>
        )}
      </fieldset>

      <div className="home-search__status">
        <p aria-live="polite">
          {matches.length === parties.length
            ? `Visar ${numberFormatter.format(shown.length)} av ${numberFormatter.format(parties.length)} partier`
            : `${numberFormatter.format(matches.length)} av ${numberFormatter.format(parties.length)} partier matchar, visar ${numberFormatter.format(shown.length)}`}
        </p>
        {isActive(filters) && (
          <button type="button" className="home-button" onClick={() => setFilters(emptyFilters)}>
            Rensa sökning och filter
          </button>
        )}
      </div>

      {shown.length > 0 ? (
        <ul className="home-grid">
          {shown.map(party => {
            const years = participationYears(party);
            return (
              <li key={party.filnamn}>
                <PartyCard
                  beteckning={party.beteckning}
                  filnamn={party.filnamn}
                  forkortning={party.forkortning}
                  symbolSrc={party.symbolSrc}
                  variant="small"
                  secondaryMeta={years.length > 0 ? `Anmält deltagande ${years.join(', ')}` : undefined}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="home-empty">
          Inget parti matchar sökningen. Prova ett kortare sökord, eller rensa filtren för att se alla {numberFormatter.format(parties.length)} partier.
        </p>
      )}

      {shown.length < matches.length && (
        <button
          type="button"
          className="home-button home-button--more"
          onClick={() => setPaging({ key, count: visible + PAGE_SIZE })}
        >
          Visa fler partier
        </button>
      )}
    </section>
  );
}

export default PartySearch;
