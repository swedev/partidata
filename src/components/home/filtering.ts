import type { HomeParty, ParticipationFacet } from 'src/server/party-data';

export type ElectionKind = 'riksdag' | 'region' | 'kommun';

export interface HomeFilters {
  query: string;
  valar: string;
  valtyp: ElectionKind | '';
  lan: string;
}

export const PAGE_SIZE = 48;

export const emptyFilters: HomeFilters = { query: '', valar: '', valtyp: '', lan: '' };

export const electionKindLabels: Record<ElectionKind, string> = {
  riksdag: 'Riksdagsval',
  region: 'Regionval',
  kommun: 'Kommunval',
};

/**
 * Folds a string to the form searches compare on: decomposed, stripped of
 * diacritics, lowercased and with runs of whitespace collapsed, so "ostra"
 * reaches "Östra".
 */
export function normalise (value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function matchesQuery (party: HomeParty, query: string): boolean {
  const needle = normalise(query);
  if (!needle) return true;
  const haystack = normalise(`${party.beteckning} ${party.forkortning ?? ''} ${party.omrade ?? ''}`);
  return needle.split(' ').every(term => haystack.includes(term));
}

/**
 * The county filter narrows a ballot to its area, which only regional and
 * municipal ballots have.
 */
export function countyApplies (valtyp: HomeFilters['valtyp']): boolean {
  return valtyp === 'region' || valtyp === 'kommun';
}

/**
 * Drops filter values the current election type leaves without meaning, so a
 * county chosen for a municipal election does not survive a switch to the
 * parliamentary one.
 */
export function pruneFilters (filters: HomeFilters): HomeFilters {
  return countyApplies(filters.valtyp) ? filters : { ...filters, lan: '' };
}

function participated (facet: ParticipationFacet): boolean {
  return facet.riksdag || facet.regionLan.length > 0 || facet.kommunLan.length > 0;
}

function matchesKind (facet: ParticipationFacet, valtyp: ElectionKind, lan: string): boolean {
  if (valtyp === 'riksdag') return facet.riksdag;
  const counties = valtyp === 'region' ? facet.regionLan : facet.kommunLan;
  return lan ? counties.includes(lan) : counties.length > 0;
}

export function matchesParticipation (party: HomeParty, filters: HomeFilters): boolean {
  if (!filters.valar && !filters.valtyp) return true;

  const facets = filters.valar
    ? [party.deltagande[filters.valar]].filter(Boolean)
    : Object.values(party.deltagande);

  if (!filters.valtyp) return facets.some(participated);
  const valtyp = filters.valtyp;
  return facets.some(facet => matchesKind(facet, valtyp, filters.lan));
}

export function filterParties (parties: HomeParty[], filters: HomeFilters): HomeParty[] {
  const pruned = pruneFilters(filters);
  return parties.filter(party => matchesQuery(party, pruned.query) && matchesParticipation(party, pruned));
}
