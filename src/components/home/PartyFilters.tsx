import { useId } from 'react';
import type { HomeCounty } from 'src/server/party-data';
import type { ElectionKind, HomeFilters } from './filtering';
import { countyApplies, electionKindLabels } from './filtering';
import { ChevronDownIcon, RotateCcwIcon, SearchIcon } from './icons';
import { toggleKind } from './summary';

export interface PartyFiltersProps {
  filters: HomeFilters;
  valar: string[];
  lan: HomeCounty[];
  kinds: ElectionKind[];
  onChange: (patch: Partial<HomeFilters>) => void;
  onReset: () => void;
}

function PartyFilters ({ filters, valar, lan, kinds, onChange, onReset }: PartyFiltersProps) {
  const fieldId = useId();

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
          <span className="home-select">
            <select
              aria-label="Valår"
              value={filters.valar}
              onChange={event => onChange({ valar: event.target.value })}
            >
              <option value="">Alla valår</option>
              {valar.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
            <ChevronDownIcon className="home-select__chevron" />
          </span>
        )}

        {lan.length > 0 && (
          <span className="home-select home-select--wide">
            <select
              aria-label="Län"
              value={filters.lan}
              disabled={!countyApplies(filters.valtyp)}
              onChange={event => onChange({ lan: event.target.value })}
            >
              <option value="">Hela landet</option>
              {lan.map(county => <option key={county.kod} value={county.kod}>{county.namn}</option>)}
            </select>
            <ChevronDownIcon className="home-select__chevron" />
          </span>
        )}

        {kinds.length > 0 && (
          <div className="home-chips" role="group" aria-label="Valtyp">
            {kinds.map(kind => {
              const pressed = filters.valtyp === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  className={`home-chip${pressed ? ' home-chip--on' : ''}`}
                  aria-pressed={pressed}
                  onClick={() => onChange({ valtyp: toggleKind(filters.valtyp, kind) })}
                >
                  {electionKindLabels[kind]}
                </button>
              );
            })}
          </div>
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
