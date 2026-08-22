/**
 * A political party as stored in `data/parti/<filnamn>/index.json`.
 */
export interface Parti {
  uuid: string;
  beteckning: string;
  filnamn: string;
  kod: string;
  forkortning?: string;
  valmyndigheten_registreringsdatum?: string;
}

/**
 * An entry in `data/parti/index.json`, a subset of the full party record.
 */
export type PartiIndexEntry = Pick<Parti, 'uuid' | 'beteckning' | 'filnamn'>;
