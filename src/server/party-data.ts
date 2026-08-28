import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import type { Parti, PartiIndexEntry, PartiProfil, PartiProfilKalla, PartiSymbol } from '../types';
import { assertSwedishCollation, compareSv } from './collation.ts';

/**
 * The election a candidate list belongs to, as `val/<år>/kandidatlistor/` names
 * it: riksdag, landsting (region) and kommun. `R` and `K` are also
 * DELTAGANDEGRUND values in `val/<år>/partideltagande/`, where they mean
 * something else entirely.
 */
export type ElectionType = 'R' | 'L' | 'K';
export type CandidateLists = Record<string, ElectionType[]>;

export interface PartyPageData extends Parti {
  candidateLists: CandidateLists;
  duplicateName: boolean;
  profile?: PartiProfil;
  symbolSrc?: string;
  symbolFrame?: SymbolFrame;
}

export type PartyResolution =
  | { kind: 'party'; props: PartyPageData }
  | { kind: 'redirect'; destination: string }
  | { kind: 'notFound' };

/**
 * A symbol's drawing measured in its own widths and heights: the aspect ratio
 * of the drawing, the sheet it was delivered on as a multiple of the drawing,
 * and the drawing's offset within that sheet. Symbols arrive on a fixed canvas
 * with the mark placed anywhere inside it, so these are the multiples a
 * renderer scales and shifts the file by to show every symbol at the same
 * optical size. `bildbredd` and `bildhojd` are the sheet in pixels.
 */
export interface SymbolFrame {
  ratio: number;
  bredd: number;
  hojd: number;
  x: number;
  y: number;
  bildbredd: number;
  bildhojd: number;
}

export interface PartySymbolData {
  body: Buffer;
  contentType: string;
}

/**
 * A party's participation in one election year, reduced to what the start page
 * filters and sorts on: whether it stood for parliament, the counties its
 * regional ballots fall in, and the municipalities its municipal ballots cover.
 * Municipal codes carry their county in their first two digits.
 */
export interface ParticipationFacet {
  riksdag: boolean;
  regionLan: string[];
  kommunKoder: string[];
}

export interface HomeParty {
  uuid: string;
  beteckning: string;
  filnamn: string;
  forkortning?: string;
  omrade?: string;
  duplicateName?: boolean;
  symbolSrc?: string;
  symbolFrame?: SymbolFrame;
  deltagande: Record<string, ParticipationFacet>;
}

export interface HomeCounty {
  kod: string;
  namn: string;
}

export interface HomeMunicipality {
  kod: string;
  namn: string;
  lan: string;
}

export interface ParliamentParty {
  uuid: string;
  forkortning: string;
  mandat: number;
  beteckning?: string;
  filnamn?: string;
  symbolSrc?: string;
  symbolFrame?: SymbolFrame;
}

export interface ParliamentYear {
  valar: number;
  partier: ParliamentParty[];
  kalla: PartiProfilKalla;
}

export interface OutsideParliamentParty {
  uuid: string;
  beteckning: string;
  filnamn: string;
  forkortning?: string;
  symbolSrc?: string;
  symbolFrame?: SymbolFrame;
  valar: number;
  roster: number;
  rostandel: number;
  kalla: PartiProfilKalla;
}

export interface OutsideParliamentData {
  period: { fran: number; till: number };
  metod: string;
  partier: OutsideParliamentParty[];
}

export interface HomeData {
  parties: HomeParty[];
  valar: string[];
  lan: HomeCounty[];
  kommuner: HomeMunicipality[];
  riksdag: ParliamentYear[];
  outsideParliament?: OutsideParliamentData;
}

interface RegionFile {
  kod: string;
  namn: string;
  kommuner?: Array<{ kod: string; namn: string }>;
}

interface ParliamentResultFile {
  schema_version: 2;
  valar: number;
  kallor: Array<PartiProfilKalla & { id: string }>;
  mandatfordelning: {
    partier: Array<{ parti_uuid: string; kallkod?: string; partibeteckning: string; mandat: number; kallreferens: string }>;
  };
}

interface DerivedParliamentFile {
  storsta_utanfor_riksdagen: {
    period: { fran: number; till: number };
    metod: string;
    partier: Array<{
      parti_uuid: string;
      valar: number;
      roster: number;
      rostandel: number;
      kalla: PartiProfilKalla;
    }>;
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

export function symbolFrame (symbol?: PartiSymbol): SymbolFrame | undefined {
  const { bild, bildyta } = symbol ?? {};
  if (!bild || !bildyta || bild.bredd <= 0 || bild.hojd <= 0 || bildyta.bredd <= 0 || bildyta.hojd <= 0) {
    return undefined;
  }
  return {
    ratio: bildyta.bredd / bildyta.hojd,
    bredd: bild.bredd / bildyta.bredd,
    hojd: bild.hojd / bildyta.hojd,
    x: bildyta.x / bildyta.bredd,
    y: bildyta.y / bildyta.hojd,
    bildbredd: bild.bredd,
    bildhojd: bild.hojd,
  };
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
      kommunKoder: [...new Set(entry.kommun ?? [])].sort(),
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
    const frame = symbolFrame(party.partisymbol);

    return {
      ...party,
      candidateLists,
      duplicateName,
      ...(profile ? { profile } : {}),
      ...(symbolSrc ? { symbolSrc } : {}),
      ...(frame ? { symbolFrame: frame } : {}),
    };
  }

  async function electionYears (): Promise<string[]> {
    const entries = await readdir(path.join(dataRoot, 'val'), { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory() && /^\d{4}$/.test(entry.name))
      .map(entry => entry.name)
      .sort();
  }

  async function readParliamentYears (byUuid: Map<string, PartiIndexEntry>): Promise<ParliamentYear[]> {
    const years = await electionYears();
    const results = await Promise.all(years.map(year =>
      readOptionalJson<ParliamentResultFile>(path.join(dataRoot, 'val', year, 'valresultat', 'riksdag.json'))));

    return results
      .filter((result): result is ParliamentResultFile => result?.schema_version === 2)
      .map(result => ({
        valar: result.valar,
        kalla: result.kallor.find(source => source.id === result.mandatfordelning.partier[0]?.kallreferens)!,
        partier: result.mandatfordelning.partier.map(entry => {
          const party = byUuid.get(entry.parti_uuid);
          const symbolSrc = party ? symbolSource(party) : undefined;
          const frame = symbolFrame(party?.partisymbol);
          return {
            uuid: entry.parti_uuid,
            forkortning: party?.forkortning ?? entry.kallkod ?? entry.partibeteckning,
            mandat: entry.mandat,
            ...(party ? { beteckning: party.beteckning, filnamn: party.filnamn } : {}),
            ...(symbolSrc ? { symbolSrc } : {}),
            ...(frame ? { symbolFrame: frame } : {}),
          };
        }),
      }))
      .sort((a, b) => b.valar - a.valar);
  }

  async function readOutsideParliament (byUuid: Map<string, PartiIndexEntry>): Promise<OutsideParliamentData | undefined> {
    const derived = await readOptionalJson<DerivedParliamentFile>(path.join(dataRoot, 'derived', 'riksdag.json'));
    if (!derived?.storsta_utanfor_riksdagen?.partier.length) return undefined;
    const partier = derived.storsta_utanfor_riksdagen.partier.map(result => {
      const party = byUuid.get(result.parti_uuid);
      if (!party) return undefined;
      const symbolSrc = symbolSource(party);
      const frame = symbolFrame(party.partisymbol);
      return {
        uuid: party.uuid,
        beteckning: party.beteckning,
        filnamn: party.filnamn,
        ...(party.forkortning ? { forkortning: party.forkortning } : {}),
        ...(symbolSrc ? { symbolSrc } : {}),
        ...(frame ? { symbolFrame: frame } : {}),
        valar: result.valar,
        roster: result.roster,
        rostandel: result.rostandel,
        kalla: result.kalla,
      };
    });
    if (partier.some(party => party === undefined)) return undefined;
    return {
      period: derived.storsta_utanfor_riksdagen.period,
      metod: derived.storsta_utanfor_riksdagen.metod,
      partier: partier as OutsideParliamentParty[],
    };
  }

  async function buildHomeData (): Promise<HomeData> {
    const index = await getPartyIndex();

    const parties: HomeParty[] = (await Promise.all(index.parties.map(async entry => {
      const party = await readJson<Parti>(path.join(dataRoot, 'parti', entry.filnamn, 'index.json'));
      const symbolSrc = symbolSource(entry);
      const frame = symbolFrame(entry.partisymbol);
      return {
        uuid: entry.uuid,
        beteckning: entry.beteckning,
        filnamn: entry.filnamn,
        ...(entry.forkortning ? { forkortning: entry.forkortning } : {}),
        ...(entry.omrade ? { omrade: entry.omrade } : {}),
        ...(index.duplicateNames.has(partyNameKey(entry.beteckning)) ? { duplicateName: true } : {}),
        ...(symbolSrc ? { symbolSrc } : {}),
        ...(frame ? { symbolFrame: frame } : {}),
        deltagande: facet(party.deltagande),
      };
    }))).sort((a, b) => compareSv(a.beteckning, b.beteckning) || compareSv(a.filnamn, b.filnamn));

    const valar = [...new Set(parties.flatMap(party => Object.keys(party.deltagande)))].sort();

    const regions = await readJson<RegionFile[]>(path.join(dataRoot, 'regioner', 'index.json'));
    const lan = regions
      .map(region => ({ kod: region.kod, namn: region.namn }))
      .sort((a, b) => compareSv(a.namn, b.namn));
    const kommuner = regions
      .flatMap(region => (region.kommuner ?? []).map(kommun => ({ kod: kommun.kod, namn: kommun.namn, lan: region.kod })))
      .sort((a, b) => compareSv(a.namn, b.namn));

    const byUuid = new Map(index.parties.map(party => [party.uuid, party]));
    const [riksdag, outsideParliament] = await Promise.all([
      readParliamentYears(byUuid),
      readOutsideParliament(byUuid),
    ]);

    return { parties, valar, lan, kommuner, riksdag, ...(outsideParliament ? { outsideParliament } : {}) };
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
