import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import type { Parti, PartiIndexEntry, PartiProfil } from '../types';

export type ElectionType = 'R' | 'L' | 'K';
export type CandidateLists = Record<string, ElectionType[]>;

export interface PartyPageData extends Parti {
  candidateLists: CandidateLists;
  profile?: PartiProfil;
  symbolSrc?: string;
}

export type PartyResolution =
  | { kind: 'party'; props: PartyPageData }
  | { kind: 'redirect'; destination: string }
  | { kind: 'notFound' };

export interface PartySymbolData {
  body: Buffer;
  contentType: string;
}

interface CandidateListFile {
  val?: unknown[];
  kandidatlistor?: Array<{ val?: unknown }>;
}

interface PartyIndex {
  current: Map<string, PartiIndexEntry>;
  redirects: Map<string, PartiIndexEntry>;
  parties: PartiIndexEntry[];
}

const contentTypes: Record<string, string> = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function isElectionType (value: unknown): value is ElectionType {
  return value === 'R' || value === 'L' || value === 'K';
}

async function readJson<T> (file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8')) as T;
}

async function readOptionalJson<T> (file: string): Promise<T | undefined> {
  try {
    return await readJson<T>(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

export function createPartyDataStore (dataRoot = path.join(process.cwd(), 'data')) {
  let partyIndexPromise: Promise<PartyIndex> | undefined;

  function getPartyIndex (): Promise<PartyIndex> {
    partyIndexPromise ??= readJson<PartiIndexEntry[]>(path.join(dataRoot, 'parti', 'index.json')).then(parties => ({
      parties,
      current: new Map(parties.map(party => [party.filnamn, party])),
      redirects: new Map(parties.flatMap(party => (party.tidigare_filnamn ?? []).map(slug => [slug, party] as const))),
    }));
    return partyIndexPromise;
  }

  async function readCandidateLists (slug: string): Promise<CandidateLists> {
    const electionRoot = path.join(dataRoot, 'val');
    const entries = await readdir(electionRoot, { withFileTypes: true });
    const years = (await Promise.all(entries
      .filter(entry => entry.isDirectory() && /^\d{4}$/.test(entry.name))
      .map(async entry => {
        const children = await readdir(path.join(electionRoot, entry.name), { withFileTypes: true });
        return children.some(child => child.isDirectory() && child.name === 'kandidatlistor') ? entry.name : undefined;
      })))
      .filter((year): year is string => year !== undefined);

    const lists = await Promise.all(years.map(async year => {
      const file = await readOptionalJson<CandidateListFile>(path.join(electionRoot, year, 'kandidatlistor', `${slug}.json`));
      if (!file) return undefined;
      const electionTypes = [...new Set([
        ...(file.val ?? []).filter(isElectionType),
        ...(file.kandidatlistor ?? []).map(list => list.val).filter(isElectionType),
      ])];
      return [year, electionTypes] as const;
    }));

    return Object.fromEntries(lists.filter((entry): entry is readonly [string, ElectionType[]] => entry !== undefined));
  }

  async function readCurrentParty (slug: string): Promise<PartyPageData> {
    const partyRoot = path.join(dataRoot, 'parti', slug);
    const party = await readJson<Parti>(path.join(partyRoot, 'index.json'));
    const [profile, candidateLists] = await Promise.all([
      readOptionalJson<PartiProfil>(path.join(partyRoot, 'profil.json')),
      readCandidateLists(slug),
    ]);
    const symbolSrc = party.partisymbol
      ? `/partisymbol/${encodeURIComponent(slug)}/${encodeURIComponent(party.partisymbol.filnamn)}`
      : undefined;

    return {
      ...party,
      candidateLists,
      ...(profile ? { profile } : {}),
      ...(symbolSrc ? { symbolSrc } : {}),
    };
  }

  return {
    async resolveParty (slug: string): Promise<PartyResolution> {
      const index = await getPartyIndex();
      if (index.current.has(slug)) return { kind: 'party', props: await readCurrentParty(slug) };
      const redirect = index.redirects.get(slug);
      if (redirect) return { kind: 'redirect', destination: `/parti/${redirect.filnamn}/` };
      return { kind: 'notFound' };
    },

    async readPartySymbol (slug: string, image: string): Promise<PartySymbolData | undefined> {
      const index = await getPartyIndex();
      if (!index.current.has(slug)) return undefined;
      const party = await readJson<Parti>(path.join(dataRoot, 'parti', slug, 'index.json'));
      if (!party.partisymbol || party.partisymbol.filnamn !== image) return undefined;
      if (path.basename(image) !== image) return undefined;
      const contentType = contentTypes[path.extname(image).toLowerCase()];
      if (!contentType) return undefined;
      return {
        body: await readFile(path.join(dataRoot, 'parti', slug, party.partisymbol.filnamn)),
        contentType,
      };
    },

    async listCurrentSlugs (): Promise<string[]> {
      return (await getPartyIndex()).parties.map(party => party.filnamn);
    },

    async assertHealthy (): Promise<void> {
      if ((await getPartyIndex()).parties.length === 0) throw new Error('Party index is empty');
    },
  };
}

export const partyData = createPartyDataStore();
