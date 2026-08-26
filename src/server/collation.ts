const collator = new Intl.Collator('sv');

/** Compares two strings under Swedish collation: A–Z, then Å, Ä, Ö. */
export function compareSv (a: string, b: string): number {
  return collator.compare(a, b);
}

/**
 * `Intl.Collator('sv')` falls back to root collation without throwing when the
 * runtime's ICU data omits Swedish, which would sort Å/Ä/Ö among A and O. The
 * comparisons below distinguish the two collations, so a runtime built without
 * Swedish locale data fails loudly instead of serving a misordered list.
 */
export function assertSwedishCollation (): void {
  const invariants: Array<[string, string]> = [
    ['z', 'å'],
    ['å', 'ä'],
    ['ä', 'ö'],
    ['Jarl', 'Jämtlands'],
  ];
  for (const [first, second] of invariants) {
    if (compareSv(first, second) >= 0) {
      throw new Error(`Runtime saknar svensk kollation: "${first}" sorteras inte före "${second}"`);
    }
  }
}
