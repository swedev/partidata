import type { ElectionKind, HomeFilters } from './filtering.ts';
import { electionKindLabels } from './filtering.ts';

export interface Segment<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
  title?: string;
}

export const ALL_KINDS_LABEL = 'Alla';
export const ALL_YEARS_LABEL = 'Alla valår';

/** The canonical order the election types are offered in. */
const kindOrder: ElectionKind[] = ['riksdag', 'region', 'kommun'];

/**
 * A chosen area rules out the elections it cannot narrow: the nationwide
 * parliamentary election has no county, and only the municipal election
 * belongs to a single municipality.
 */
export function kindLocked (kind: ElectionKind, filters: Pick<HomeFilters, 'lan' | 'kommun'>): boolean {
  return (kind === 'riksdag' && Boolean(filters.lan)) || (kind !== 'kommun' && Boolean(filters.kommun));
}

export const lockedTitle = (kind: ElectionKind): string =>
  `${electionKindLabels[kind]} gäller inte ett valt område — välj Hela landet och Alla kommuner först`;

/**
 * The election type segments: "every type" first, then the types the data
 * carries. The chosen type is always among them, so exactly one segment is
 * selected even when the registry holds no ballots of that type.
 */
export function kindSegments (
  kinds: ElectionKind[],
  filters: Pick<HomeFilters, 'valtyp' | 'lan' | 'kommun'>,
): Segment<HomeFilters['valtyp']>[] {
  const offered = kindOrder.filter(kind => kinds.includes(kind) || filters.valtyp === kind);
  return [
    { value: '', label: ALL_KINDS_LABEL },
    ...offered.map(kind => {
      const locked = kindLocked(kind, filters);
      return {
        value: kind,
        label: electionKindLabels[kind],
        ...(locked ? { disabled: true, title: lockedTitle(kind) } : {}),
      };
    }),
  ];
}

/** The election year segments: "every year" first, then the years the data carries. */
export function yearSegments (valar: string[]): Segment[] {
  return [
    { value: '', label: ALL_YEARS_LABEL },
    ...valar.map(year => ({ value: year, label: year })),
  ];
}
