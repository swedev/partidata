import type { HomeParty } from 'src/server/party-data';
import type { ElectionKind, HomeFilters } from './filtering';

const levelLabels: Record<ElectionKind, string> = {
  riksdag: 'Riksdag',
  region: 'Region',
  kommun: 'Kommun',
};

/**
 * The levels a party has stood in, across every year it took part in.
 */
export function participationLevels (party: HomeParty): string[] {
  const facets = Object.values(party.deltagande);
  const levels: string[] = [];
  if (facets.some(facet => facet.riksdag)) levels.push(levelLabels.riksdag);
  if (facets.some(facet => facet.regionLan.length > 0)) levels.push(levelLabels.region);
  if (facets.some(facet => facet.kommunLan.length > 0)) levels.push(levelLabels.kommun);
  return levels;
}

export function participationYears (party: HomeParty): string[] {
  return Object.keys(party.deltagande).sort((a, b) => Number(b) - Number(a));
}

/**
 * The card footer states what the party has stood in. A party the registry
 * carries without any recorded ballot says so rather than showing an empty bar.
 */
export function cardMeta (party: HomeParty): string {
  const levels = participationLevels(party);
  return levels.length > 0 ? levels.join(' · ') : 'Inget anmält deltagande';
}

export function cardSub (party: HomeParty): string | undefined {
  const years = participationYears(party);
  return years.length > 0 ? `Valår ${years.join(', ')}` : undefined;
}

/**
 * Seats needed to carry a vote alone: more than half the chamber.
 */
export function ownMajority (seats: number): number {
  return Math.floor(seats / 2) + 1;
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
