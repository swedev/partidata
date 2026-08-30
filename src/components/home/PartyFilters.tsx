import { useId, useMemo } from 'react';
import type { HomeCounty, HomeMunicipality } from 'src/server/party-data';
import type { ElectionKind, HomeFilters } from './filtering';
import { countyApplies, municipalityApplies } from './filtering';
import { ChevronDownIcon, RotateCcwIcon, SearchIcon } from './icons';
import SegmentedControl from './SegmentedControl';
import { kindSegments, yearSegments } from './segments';

export interface PartyFiltersProps {
  filters: HomeFilters;
  valar: string[];
  lan: HomeCounty[];
  kommuner: HomeMunicipality[];
  kinds: ElectionKind[];
  onChange: (patch: Partial<HomeFilters>) => void;
  onReset: () => void;
}

function PartyFilters ({ filters, valar, lan, kommuner, kinds, onChange, onReset }: PartyFiltersProps) {
  const fieldId = useId();
  // A chosen county is the shorter way into its municipalities; without one the
  // whole country is on offer.
  const municipalities = useMemo(
    () => filters.lan ? kommuner.filter(kommun => kommun.lan === filters.lan) : kommuner,
    [kommuner, filters.lan],
  );

  return (
    <section className="home-search" aria-label="Sök och filtrera partier">
      <label className="home-search__label" htmlFor={`${fieldId}-query`}>Sök parti</label>
      <div className="home-search__query">
        <SearchIcon className="home-search__query-icon" />
        <input
          id={`${fieldId}-query`}
          type="search"
          value={filters.query}
          placeholder="Sök parti på namn eller förkortning"
          autoComplete="off"
          onChange={event => onChange({ query: event.target.value })}
        />
      </div>

      <div className="home-search__filters">
        {valar.length > 0 && (
          <SegmentedControl
            legend="Valår"
            value={filters.valar}
            segments={yearSegments(valar)}
            onChange={valar => onChange({ valar })}
          />
        )}

        {lan.length > 0 && (
          <span className="home-select home-select--wide">
            <select
              aria-label="Län"
              value={filters.lan}
              disabled={!countyApplies(filters.valtyp)}
              title={countyApplies(filters.valtyp) ? undefined : 'Riksdagsvalet är rikstäckande och har inget län'}
              onChange={event => onChange({ lan: event.target.value })}
            >
              <option value="">Hela landet</option>
              {lan.map(county => <option key={county.kod} value={county.kod}>{county.namn}</option>)}
            </select>
            <ChevronDownIcon className="home-select__chevron" />
          </span>
        )}

        {municipalities.length > 0 && (
          <span className="home-select home-select--wide">
            <select
              aria-label="Kommun"
              value={filters.kommun}
              disabled={!municipalityApplies(filters.valtyp)}
              title={municipalityApplies(filters.valtyp) ? undefined : 'Bara kommunvalet gäller en enskild kommun'}
              onChange={event => onChange({
                kommun: event.target.value,
                ...(event.target.value ? { lan: event.target.value.slice(0, 2) } : {}),
              })}
            >
              <option value="">Alla kommuner</option>
              {municipalities.map(kommun => <option key={kommun.kod} value={kommun.kod}>{kommun.namn}</option>)}
            </select>
            <ChevronDownIcon className="home-select__chevron" />
          </span>
        )}

        {kinds.length > 0 && (
          <SegmentedControl
            legend="Valtyp"
            value={filters.valtyp}
            segments={kindSegments(kinds, filters)}
            onChange={valtyp => onChange({ valtyp })}
          />
        )}

        <button type="button" className="home-reset" onClick={onReset}>
          <RotateCcwIcon className="home-reset__icon" />
          <span>Rensa filter</span>
        </button>
      </div>
    </section>
  );
}

export default PartyFilters;
