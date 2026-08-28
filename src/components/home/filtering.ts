import type { HomeParty, ParticipationFacet } from 'src/server/party-data';

export type ElectionKind = 'riksdag' | 'region' | 'kommun';

export interface HomeFilters {
  query: string;
  valar: string;
  valtyp: ElectionKind | '';
  lan: string;
  kommun: string;
}

export const PAGE_SIZE = 48;

export const emptyFilters: HomeFilters = { query: '', valar: '', valtyp: '', lan: '', kommun: '' };

/**
 * The filters the start page opens on: the latest election year the data
 * carries, or no year at all when it carries none.
 */
export function defaultFilters (valar: string[]): HomeFilters {
  const latest = valar.at(-1);
  return latest ? { ...emptyFilters, valar: latest } : emptyFilters;
}

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
 * The county filter narrows a ballot to its area, which the regional and
 * municipal ballots have and the nationwide parliamentary one does not.
 */
export function countyApplies (valtyp: HomeFilters['valtyp']): boolean {
  return valtyp !== 'riksdag';
}

/**
 * A municipality names one municipal ballot, so it is the municipal election it
 * narrows and no other.
 */
export function municipalityApplies (valtyp: HomeFilters['valtyp']): boolean {
  return valtyp === '' || valtyp === 'kommun';
}

/**
 * Drops filter values the rest of the filters leave without meaning: an area
 * does not survive a switch to the nationwide election, and a municipality
 * survives neither the regional election nor a county it lies outside.
 */
export function pruneFilters (filters: HomeFilters): HomeFilters {
  const lan = countyApplies(filters.valtyp) ? filters.lan : '';
  const keepsKommun = municipalityApplies(filters.valtyp) && (!lan || filters.kommun.startsWith(lan));
  const kommun = keepsKommun ? filters.kommun : '';
  return lan === filters.lan && kommun === filters.kommun ? filters : { ...filters, lan, kommun };
}

function participated (facet: ParticipationFacet): boolean {
  return facet.riksdag || facet.regionLan.length > 0 || facet.kommunKoder.length > 0;
}

function inCounty (codes: string[], lan: string): boolean {
  return codes.some(kod => kod.startsWith(lan));
}

function matchesKind (facet: ParticipationFacet, valtyp: ElectionKind, lan: string): boolean {
  if (valtyp === 'riksdag') return facet.riksdag;
  if (valtyp === 'region') return lan ? facet.regionLan.includes(lan) : facet.regionLan.length > 0;
  return lan ? inCounty(facet.kommunKoder, lan) : facet.kommunKoder.length > 0;
}

/**
 * A county on its own asks where a party is on the ballot at all, which the
 * regional and the municipal election both answer.
 */
function inCountyArea (facet: ParticipationFacet, lan: string): boolean {
  return facet.regionLan.includes(lan) || inCounty(facet.kommunKoder, lan);
}

export function matchesParticipation (party: HomeParty, filters: HomeFilters): boolean {
  if (!filters.valar && !filters.valtyp && !filters.lan && !filters.kommun) return true;

  const facets = filters.valar
    ? [party.deltagande[filters.valar]].filter(Boolean)
    : Object.values(party.deltagande);

  if (filters.kommun) return facets.some(facet => facet.kommunKoder.includes(filters.kommun));
  const valtyp = filters.valtyp;
  if (!valtyp) {
    return filters.lan ? facets.some(facet => inCountyArea(facet, filters.lan)) : facets.some(participated);
  }
  return facets.some(facet => matchesKind(facet, valtyp, filters.lan));
}

export function filterParties (parties: HomeParty[], filters: HomeFilters): HomeParty[] {
  const pruned = pruneFilters(filters);
  return parties.filter(party => matchesQuery(party, pruned.query) && matchesParticipation(party, pruned));
}
