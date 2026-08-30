/**
 * A political party as stored in `data/parti/<filnamn>/index.json`.
 */
export interface Parti {
  uuid: string;
  beteckning: string;
  filnamn: string;
  tidigare_filnamn?: string[];
  omrade?: string;
  kod: string;
  tidigare_koder?: string[];
  tidigare_beteckningar?: string[];
  forkortning?: string;
  registrerad_partibeteckning?: boolean;
  valmyndigheten_registreringsdatum?: string;
  partisymbol?: PartiSymbol;
  deltagande?: Record<string, PartiDeltagande>;
  wikidata?: PartiWikidata;
}

/**
 * A party's link to Wikidata and what has been read from that entity. `id` is
 * the Q-id a person confirmed refers to this party; `grundat` is P571 in the
 * precision Wikidata states it (`"1988"`, `"1988-02"` or `"1988-02-06"`), left
 * out when the entity states no founding date, and `hamtad` is the day it was
 * last read.
 */
export interface PartiWikidata {
  id: string;
  grundat?: string;
  hamtad: string;
}

/**
 * The best known symbol for a party and its provenance. `bild` is the sheet the
 * symbol file measures, and `bildyta` the box its drawing occupies inside that
 * sheet, both in pixels; a symbol delivered in a format the importer leaves
 * unmeasured carries neither.
 */
export interface PartiSymbol {
  filnamn: string;
  kalla: string;
  kallurl: string;
  valar: number;
  partikod: string;
  bild?: PartiSymbolBild;
  bildyta?: PartiSymbolBildyta;
}

export interface PartiSymbolBild {
  bredd: number;
  hojd: number;
}

export interface PartiSymbolBildyta {
  x: number;
  y: number;
  bredd: number;
  hojd: number;
}

/**
 * Where a party takes part in one election year, as recorded in
 * `data/val/<år>/partideltagande/`.
 */
export interface PartiDeltagande {
  riksdag: boolean;
  region: string[];
  kommun: string[];
}

export interface PartiProfilKalla {
  namn: string;
  url: string;
  hamtad: string;
}

export interface PartiProfilDokumentdel {
  nummer: number;
  titel: string;
  url?: string;
}

export interface PartiProfilDokument {
  typ: 'valmanifest' | 'partiprogram';
  titel: string;
  url: string;
  valar?: number;
  utgivet?: number;
  sidor?: number;
  kalla: PartiProfilKalla;
  delar?: PartiProfilDokumentdel[];
}

export interface PartiProfilValresultatPost {
  valar: number;
  rostandel: number;
  mandat: number;
  roster?: number;
}

export interface PartiProfilValresultat {
  valtyp: 'riksdag';
  kallor: PartiProfilKalla[];
  resultat: PartiProfilValresultatPost[];
}

export interface PartiProfilKanal {
  etikett: string;
  detalj?: string;
  url: string;
}

export interface PartiProfilUtdragspunkt {
  rubrik: string;
  text: string;
}

export interface PartiProfilUtdrag {
  etikett: string;
  rubrik: string;
  ingress?: string;
  url: string;
  kalla: PartiProfilKalla;
  punkter: PartiProfilUtdragspunkt[];
}

export interface PartiProfilForetradare {
  namn: string;
  uppdrag: string;
  url: string;
  bild?: string;
  framlyft?: boolean;
}

export interface PartiProfilWikipedia {
  titel: string;
  url: string;
  utdrag: string;
  fakta?: Array<{ etikett: string; varde: string }>;
  hamtad: string;
}

export interface PartiProfilNyhet {
  datum: string;
  kalla: string;
  kallkod: string;
  kallfarg: string;
  sektion?: string;
  titel: string;
  url: string;
}

/**
 * Curated, source-attributed profile data stored separately from imported
 * election authority data.
 */
export interface PartiProfil {
  namn: string;
  webbplats?: string;
  symbolvisning?: 'mark';
  accentfarg?: string;
  beskrivning?: string;
  namn_kalla: PartiProfilKalla;
  profiltext?: {
    text: string;
    kalla: PartiProfilKalla;
  };
  kanaler?: PartiProfilKanal[];
  utdrag?: PartiProfilUtdrag;
  foretradare?: PartiProfilForetradare[];
  nyheter?: PartiProfilNyhet[];
  wikipedia?: PartiProfilWikipedia;
  valresultat?: PartiProfilValresultat;
  dokument?: PartiProfilDokument[];
}

/**
 * An entry in `data/derived/parti.json`, a subset of the full party record.
 */
export type PartiIndexEntry = Pick<Parti, 'uuid' | 'beteckning' | 'filnamn' | 'tidigare_filnamn' | 'omrade' | 'forkortning' | 'partisymbol'>;
