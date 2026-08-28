import type { HomeParty } from 'src/server/party-data';
import type { HomeFilters } from './filtering';
import { yearFacets } from './summary.ts';

export type SortOrder = 'namn' | 'kommuner' | 'senaste';

export const defaultOrder: SortOrder = 'namn';

export const sortLabels: Record<SortOrder, string> = {
  namn: 'A–Ö',
  kommuner: 'Flest kommuner',
  senaste: 'Senast anmält',
};

export const sortOrders = Object.keys(sortLabels) as SortOrder[];

export function isSortOrder (value: string): value is SortOrder {
  return sortOrders.includes(value as SortOrder);
}

function municipalities (party: HomeParty, valar: HomeFilters['valar']): number {
  return Math.max(0, ...yearFacets(party, valar).map(facet => facet.kommunKoder.length));
}

function latestYear (party: HomeParty): number {
  return Math.max(0, ...Object.keys(party.deltagande).map(Number));
}

const rankings: Record<Exclude<SortOrder, 'namn'>, (party: HomeParty, valar: HomeFilters['valar']) => number> = {
  kommuner: municipalities,
  senaste: latestYear,
};

/**
 * Ranks the matches for the chosen order. The parties arrive in Swedish name
 * order and the sort is stable, so every ranking keeps that order within a tie
 * and 'namn' is the list as it came.
 */
export function sortParties (parties: HomeParty[], order: SortOrder, filters: HomeFilters): HomeParty[] {
  if (order === 'namn') return parties;
  const rank = rankings[order];
  return parties.toSorted((a, b) => rank(b, filters.valar) - rank(a, filters.valar));
}
