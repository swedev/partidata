export type SourceMark =
  | { kind: 'symbol'; src: string }
  | { kind: 'text'; text: string };

/**
 * The mark that identifies the party next to a source label: its symbol when
 * one exists, otherwise the abbreviation the registry records, otherwise
 * nothing. The party name is never an input, so no mark is ever a shortening
 * of it.
 */
export function sourceMark ({ symbolSrc, abbreviation }: { symbolSrc?: string; abbreviation?: string }): SourceMark | undefined {
  if (symbolSrc) return { kind: 'symbol', src: symbolSrc };
  if (abbreviation) return { kind: 'text', text: abbreviation };
  return undefined;
}
