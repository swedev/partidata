import type { HomeData } from 'src/server/party-data';
import type { ElectionKind, HomeFilters } from './filtering.ts';
import { defaultFilters, electionKindLabels, pruneFilters } from './filtering.ts';
import type { SortOrder } from './sorting.ts';
import { defaultOrder, isSortOrder } from './sorting.ts';

export interface HomeState {
  filters: HomeFilters;
  order: SortOrder;
}

export type HomeQuery = Record<string, string | string[] | undefined>;

/** The value the year parameter takes for "every election year". */
export const ALL_YEARS = 'alla';

export type HomeQueryData = Pick<HomeData, 'valar' | 'lan' | 'kommuner'>;

/** A repeated parameter names one value, so the first one is the answer. */
function single (value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function readYear (value: string, valar: string[], fallback: string): string {
  if (value === ALL_YEARS) return '';
  return valar.includes(value) ? value : fallback;
}

function readKind (value: string): HomeFilters['valtyp'] {
  return Object.hasOwn(electionKindLabels, value) ? value as ElectionKind : '';
}

/**
 * Reads a link back into the state the controls hold. Every value is checked
 * against the data the page carries, so a year, county or municipality the
 * registry does not know falls back to the default rather than reaching
 * `filterParties`.
 */
export function stateFromQuery (query: HomeQuery, data: HomeQueryData): HomeState {
  const defaults = defaultFilters(data.valar);
  const kommunKod = single(query.kommun);
  const kommun = data.kommuner.find(entry => entry.kod === kommunKod);
  const lanKod = single(query.lan);
  const lan = data.lan.some(entry => entry.kod === lanKod) ? lanKod : '';
  const order = single(query.sortering);

  return {
    // A municipality names its county, so a link that carries only the
    // municipality opens with the county selector on it as well.
    filters: pruneFilters({
      query: single(query.q),
      valar: readYear(single(query.valar), data.valar, defaults.valar),
      valtyp: readKind(single(query.valtyp)),
      lan: kommun && !lan ? kommun.lan : lan,
      kommun: kommun ? kommun.kod : '',
    }),
    order: isSortOrder(order) ? order : defaultOrder,
  };
}

/**
 * Writes the state as the shortest link that reproduces it: everything equal to
 * what the page opens on is left out, so the unfiltered start page stays `/`.
 * The keys come out in a fixed order, so the same view always has the same URL.
 */
export function queryFromState (state: HomeState, valar: string[]): Record<string, string> {
  const defaults = defaultFilters(valar);
  const { filters, order } = state;
  const query: Record<string, string> = {};

  // No year is the default when the data carries none, and an active choice
  // when it carries some — only then does it need a value of its own.
  if (filters.valar !== defaults.valar) query.valar = filters.valar || ALL_YEARS;
  if (filters.valtyp) query.valtyp = filters.valtyp;
  if (filters.lan) query.lan = filters.lan;
  if (filters.kommun) query.kommun = filters.kommun;
  if (filters.query.trim()) query.q = filters.query;
  if (order !== defaultOrder) query.sortering = order;

  return query;
}
