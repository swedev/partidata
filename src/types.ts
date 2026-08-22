/**
 * A political party as stored in `data/parti/<filnamn>/index.json`.
 */
export interface Parti {
  uuid: string;
  beteckning: string;
  filnamn: string;
  kod: string;
  tidigare_koder?: string[];
  tidigare_beteckningar?: string[];
  forkortning?: string;
  registrerad_partibeteckning?: boolean;
  valmyndigheten_registreringsdatum?: string;
  deltagande?: Record<string, PartiDeltagande>;
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

/**
 * An entry in `data/parti/index.json`, a subset of the full party record.
 */
export type PartiIndexEntry = Pick<Parti, 'uuid' | 'beteckning' | 'filnamn'>;
