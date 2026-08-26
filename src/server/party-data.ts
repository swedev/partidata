import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import type { Parti, PartiIndexEntry, PartiProfil, PartiProfilKalla } from '../types';
import { assertSwedishCollation, compareSv } from './collation.ts';

export type ElectionType = 'R' | 'L' | 'K';
export type CandidateLists = Record<string, ElectionType[]>;

export interface PartyPageData extends Parti {
  candidateLists: CandidateLists;
  duplicateName: boolean;
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

/**
 * A party's participation in one election year, reduced to what the start page
 * filters on: whether it stood for parliament, and the counties its regional
 * and municipal ballots fall in. Municipal codes carry their county in their
 * first two digits.
 */
export interface ParticipationFacet {
  riksdag: boolean;
  regionLan: string[];
  kommunLan: string[];
}

export interface HomeParty {
  uuid: string;
  beteckning: string;
  filnamn: string;
  forkortning?: string;
  omrade?: string;
  duplicateName?: boolean;
  symbolSrc?: string;
  deltagande: Record<string, ParticipationFacet>;
}

export interface HomeCounty {
  kod: string;
  namn: string;
}

export interface ParliamentParty {
  forkortning: string;
  mandat: number;
  beteckning?: string;
  filnamn?: string;
  symbolSrc?: string;
}

export interface ParliamentYear {
  valar: number;
  partier: ParliamentParty[];
  kalla: PartiProfilKalla;
}

export interface HomeData {
  parties: HomeParty[];
  valar: string[];
  lan: HomeCounty[];
  riksdag: ParliamentYear[];
}

interface RegionFile {
  kod: string;
  namn: string;
}

interface ParliamentResultFile {
  valar: number;
  mandatfordelning?: {
    partier: Array<{ forkortning: string; mandat: number }>;
    kalla: PartiProfilKalla;
  };
}

interface CandidateListFile {
  val?: unknown[];
  kandidatlistor?: Array<{ val?: unknown }>;
}

interface PartyIndex {
  current: Map<string, PartiIndexEntry>;
  redirects: Map<string, PartiIndexEntry>;
  duplicateNames: Set<string>;
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

function symbolSource (party: Pick<Parti, 'filnamn' | 'partisymbol'>): string | undefined {
  return party.partisymbol
    ? `/partisymbol/${encodeURIComponent(party.filnamn)}/${encodeURIComponent(party.partisymbol.filnamn)}`
    : undefined;
}

function partyNameKey (name: string): string {
  return name.trim().toLocaleLowerCase('sv-SE').replace(/\s+/g, ' ');
}

function facet (participation: Parti['deltagande']): Record<string, ParticipationFacet> {
  const facets: Record<string, ParticipationFacet> = {};
  for (const [year, entry] of Object.entries(participation ?? {})) {
    facets[year] = {
      riksdag: Boolean(entry.riksdag),
      regionLan: [...new Set(entry.region ?? [])].sort(),
      kommunLan: [...new Set((entry.kommun ?? []).map(kod => kod.slice(0, 2)))].sort(),
    };
  }
  return facets;
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

export interface PartyDataStoreOptions {
  assertCollation?: () => void;
}

export function createPartyDataStore (
  dataRoot = path.join(process.cwd(), 'data'),
  { assertCollation = assertSwedishCollation }: PartyDataStoreOptions = {},
) {
  let partyIndexPromise: Promise<PartyIndex> | undefined;
  let homeDataPromise: Promise<HomeData> | undefined;

  function getPartyIndex (): Promise<PartyIndex> {
    partyIndexPromise ??= readJson<PartiIndexEntry[]>(path.join(dataRoot, 'parti', 'index.json')).then(parties => {
      const nameCounts = new Map<string, number>();
      for (const party of parties) {
        const key = partyNameKey(party.beteckning);
        nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
      }
      return {
        parties,
        current: new Map(parties.map(party => [party.filnamn, party])),
        redirects: new Map(parties.flatMap(party => (party.tidigare_filnamn ?? []).map(slug => [slug, party] as const))),
        duplicateNames: new Set([...nameCounts].filter(([, count]) => count > 1).map(([name]) => name)),
      };
    });
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

  async function readCurrentParty (slug: string, duplicateName: boolean): Promise<PartyPageData> {
    const partyRoot = path.join(dataRoot, 'parti', slug);
    const party = await readJson<Parti>(path.join(partyRoot, 'index.json'));
    const [profile, candidateLists] = await Promise.all([
      readOptionalJson<PartiProfil>(path.join(partyRoot, 'profil.json')),
      readCandidateLists(slug),
    ]);
    const symbolSrc = symbolSource(party);

    return {
      ...party,
      candidateLists,
      duplicateName,
      ...(profile ? { profile } : {}),
      ...(symbolSrc ? { symbolSrc } : {}),
    };
  }

  async function electionYears (): Promise<string[]> {
    const entries = await readdir(path.join(dataRoot, 'val'), { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory() && /^\d{4}$/.test(entry.name))
      .map(entry => entry.name)
      .sort();
  }

  async function readParliamentYears (byAbbreviation: Map<string, PartiIndexEntry | null>): Promise<ParliamentYear[]> {
    const years = await electionYears();
    const results = await Promise.all(years.map(year =>
      readOptionalJson<ParliamentResultFile>(path.join(dataRoot, 'val', year, 'valresultat', 'riksdag.json'))));

    return results
      .filter((result): result is ParliamentResultFile & Required<Pick<ParliamentResultFile, 'mandatfordelning'>> =>
        result?.mandatfordelning !== undefined)
      .map(result => ({
        valar: result.valar,
        kalla: result.mandatfordelning.kalla,
        partier: result.mandatfordelning.partier.map(entry => {
          const party = byAbbreviation.get(entry.forkortning.toLowerCase());
          const symbolSrc = party ? symbolSource(party) : undefined;
          return {
            forkortning: entry.forkortning,
            mandat: entry.mandat,
            ...(party ? { beteckning: party.beteckning, filnamn: party.filnamn } : {}),
            ...(symbolSrc ? { symbolSrc } : {}),
          };
        }),
      }))
      .sort((a, b) => b.valar - a.valar);
  }

  async function buildHomeData (): Promise<HomeData> {
    const index = await getPartyIndex();

    const parties: HomeParty[] = (await Promise.all(index.parties.map(async entry => {
      const party = await readJson<Parti>(path.join(dataRoot, 'parti', entry.filnamn, 'index.json'));
      const symbolSrc = symbolSource(entry);
      return {
        uuid: entry.uuid,
        beteckning: entry.beteckning,
        filnamn: entry.filnamn,
        ...(entry.forkortning ? { forkortning: entry.forkortning } : {}),
        ...(entry.omrade ? { omrade: entry.omrade } : {}),
        ...(index.duplicateNames.has(partyNameKey(entry.beteckning)) ? { duplicateName: true } : {}),
        ...(symbolSrc ? { symbolSrc } : {}),
        deltagande: facet(party.deltagande),
      };
    }))).sort((a, b) => compareSv(a.beteckning, b.beteckning) || compareSv(a.filnamn, b.filnamn));

    const valar = [...new Set(parties.flatMap(party => Object.keys(party.deltagande)))].sort();

    const regions = await readJson<RegionFile[]>(path.join(dataRoot, 'regioner', 'index.json'));
    const lan = regions
      .map(region => ({ kod: region.kod, namn: region.namn }))
      .sort((a, b) => compareSv(a.namn, b.namn));

    // A mandate record names its party by abbreviation only, so an abbreviation
    // that no party or several parties carry resolves to nothing rather than to
    // a guess.
    const byAbbreviation = new Map<string, PartiIndexEntry | null>();
    for (const entry of index.parties) {
      if (!entry.forkortning) continue;
      const key = entry.forkortning.toLowerCase();
      byAbbreviation.set(key, byAbbreviation.has(key) ? null : entry);
    }

    return { parties, valar, lan, riksdag: await readParliamentYears(byAbbreviation) };
  }

  return {
    async readHomeData (): Promise<HomeData> {
      homeDataPromise ??= buildHomeData();
      return await homeDataPromise;
    },

    async resolveParty (slug: string): Promise<PartyResolution> {
      const index = await getPartyIndex();
      const party = index.current.get(slug);
      if (party) {
        return {
          kind: 'party',
          props: await readCurrentParty(slug, index.duplicateNames.has(partyNameKey(party.beteckning))),
        };
      }
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
      assertCollation();
      if ((await getPartyIndex()).parties.length === 0) throw new Error('Party index is empty');
    },
  };
}

export const partyData = createPartyDataStore();
