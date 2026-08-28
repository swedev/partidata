import type { HomeParty, ParticipationFacet } from 'src/server/party-data';
import type { ElectionKind, HomeFilters } from './filtering';

export const levelLabels: Record<ElectionKind, string> = {
  riksdag: 'Riksdag',
  region: 'Region',
  kommun: 'Kommun',
};

export const noBallotLabel = 'Inget anmält deltagande';

export interface Ballot {
  valtyp: ElectionKind;
  antal?: number;
}

/**
 * The years a reading covers: the chosen one alone when the filters name a
 * year, otherwise every year the party took part in.
 */
export function yearFacets (party: HomeParty, valar: HomeFilters['valar']): ParticipationFacet[] {
  return valar
    ? [party.deltagande[valar]].filter(Boolean)
    : Object.values(party.deltagande);
}

/**
 * The ballots a party stands on, with the number of regions and municipalities
 * each covers. Across several years the widest year counts.
 */
export function ballots (party: HomeParty, valar: HomeFilters['valar'] = ''): Ballot[] {
  const facets = yearFacets(party, valar);
  const widest = (read: (facet: ParticipationFacet) => number) => Math.max(0, ...facets.map(read));
  const region = widest(facet => facet.regionLan.length);
  const kommun = widest(facet => facet.kommunKoder.length);

  return [
    ...(facets.some(facet => facet.riksdag) ? [{ valtyp: 'riksdag' as const }] : []),
    ...(region > 0 ? [{ valtyp: 'region' as const, antal: region }] : []),
    ...(kommun > 0 ? [{ valtyp: 'kommun' as const, antal: kommun }] : []),
  ];
}

export function participationYears (party: HomeParty): string[] {
  return Object.keys(party.deltagande).sort((a, b) => Number(b) - Number(a));
}

export function cardSub (party: HomeParty): string | undefined {
  const years = participationYears(party);
  return years.length > 0 ? `Valår ${years.join(', ')}` : undefined;
}

export function partyLabel (party: Pick<HomeParty, 'beteckning' | 'duplicateName' | 'omrade'>): string {
  return party.duplicateName && party.omrade
    ? `${party.beteckning} (${party.omrade})`
    : party.beteckning;
}

/**
 * The chips are a single choice shown as a group, so pressing the active one
 * clears the election type rather than leaving it stuck on.
 */
export function toggleKind (current: HomeFilters['valtyp'], kind: ElectionKind): HomeFilters['valtyp'] {
  return current === kind ? '' : kind;
}

/**
 * The quoted term the empty state echoes back, or the filters when the search
 * box is empty.
 */
export function queryEcho (query: string): string {
  const trimmed = query.trim();
  return trimmed ? `”${trimmed}”` : 'dina filter';
}
