/**
 * The allowlist behind `/data/<sökväg>`: the only place that decides which
 * files under `data/` the site hands out. It classifies URL segments into a
 * resource before any path is built, and `dataPath` builds the path back from
 * the resource rather than from the input, so nothing outside the table below
 * can be reached.
 */

/** The participation files an election year may carry, in the order they are listed. */
export const PARTICIPATION_FILES = ['partier', 'riksdag', 'region', 'kommun', 'landsting'] as const;

export type ParticipationFile = (typeof PARTICIPATION_FILES)[number];

export type DataResource =
  | { kind: 'registry' }
  | { kind: 'derived-parliament' }
  | { kind: 'regions' }
  | { kind: 'party'; filnamn: string }
  | { kind: 'participation'; valar: string; fil: ParticipationFile }
  | { kind: 'results'; valar: string };

const SEGMENT = /^[a-z0-9-]+$/;
const FILE = /^[a-z0-9-]+\.json$/;
const YEAR = /^\d{4}$/;

function participationFile (file: string): ParticipationFile | undefined {
  const name = file.slice(0, -'.json'.length);
  return PARTICIPATION_FILES.find(candidate => candidate === name);
}

/**
 * The resource the segments of a `/data/` address name, or `undefined` when
 * they name nothing that is published. Candidate lists, `profil.json`, party
 * symbols, the import's linking tables, directories, upper case and `..` all
 * fall here.
 */
export function classifyDataPath (segments: string[]): DataResource | undefined {
  if (segments.length < 2) return undefined;
  const file = segments[segments.length - 1];
  if (!FILE.test(file)) return undefined;
  const directories = segments.slice(0, -1);
  if (!directories.every(segment => SEGMENT.test(segment))) return undefined;
  const [head, ...rest] = directories;

  switch (head) {
    case 'derived':
      if (rest.length > 0) return undefined;
      if (file === 'parti.json') return { kind: 'registry' };
      if (file === 'riksdag.json') return { kind: 'derived-parliament' };
      return undefined;
    case 'regioner':
      return rest.length === 0 && file === 'index.json' ? { kind: 'regions' } : undefined;
    case 'parti':
      return rest.length === 1 && file === 'index.json' ? { kind: 'party', filnamn: rest[0] } : undefined;
    case 'val': {
      if (rest.length !== 2) return undefined;
      const [valar, katalog] = rest;
      if (!YEAR.test(valar)) return undefined;
      if (katalog === 'partideltagande') {
        const fil = participationFile(file);
        return fil ? { kind: 'participation', valar, fil } : undefined;
      }
      if (katalog === 'valresultat' && file === 'riksdag.json') return { kind: 'results', valar };
      return undefined;
    }
    default:
      return undefined;
  }
}

/** The path under `data/` the resource stands for, rebuilt from the resource. */
export function dataPath (resource: DataResource): string[] {
  switch (resource.kind) {
    case 'registry':
      return ['derived', 'parti.json'];
    case 'derived-parliament':
      return ['derived', 'riksdag.json'];
    case 'regions':
      return ['regioner', 'index.json'];
    case 'party':
      return ['parti', resource.filnamn, 'index.json'];
    case 'participation':
      return ['val', resource.valar, 'partideltagande', `${resource.fil}.json`];
    case 'results':
      return ['val', resource.valar, 'valresultat', 'riksdag.json'];
  }
}

/**
 * Whether an `If-None-Match` header carries the resource's entity tag. `304`
 * uses the weak comparison, so the `W/` prefix is stripped from both sides and
 * only the quoted tag is compared. An entry without quotes is not an entity tag
 * and never matches.
 */
export function matchesEtag (header: string | undefined, etag: string): boolean {
  if (!header) return false;
  if (header.trim() === '*') return true;
  const expected = etag.replace(/^W\//, '');
  return header.split(',').some(entry => {
    const candidate = entry.trim().replace(/^W\//, '');
    return /^"[^"]*"$/.test(candidate) && candidate === expected;
  });
}
