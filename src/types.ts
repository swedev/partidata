/**
 * A political party as stored in `data/parti/<filnamn>/index.json`.
 */
export interface Parti {
  uuid: string;
  beteckning: string;
  filnamn: string;
  tidigare_filnamn?: string[];
  kod: string;
  tidigare_koder?: string[];
  tidigare_beteckningar?: string[];
  forkortning?: string;
  registrerad_partibeteckning?: boolean;
  valmyndigheten_registreringsdatum?: string;
  partisymbol?: PartiSymbol;
  deltagande?: Record<string, PartiDeltagande>;
}

/**
 * The best known symbol for a party and its provenance.
 */
export interface PartiSymbol {
  filnamn: string;
  kalla: string;
  kallurl: string;
  valar: number;
  partikod: string;
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
export type PartiIndexEntry = Pick<Parti, 'uuid' | 'beteckning' | 'filnamn' | 'tidigare_filnamn' | 'partisymbol'>;

/**
 * The props of a page served on a slug a party used to have, pointing at the
 * slug it has now.
 */
export interface PartiRedirect {
  redirect: {
    filnamn: string;
    beteckning: string;
  };
}

/**
 * isRedirect
 * @param props The props of a page under `/parti/`
 */
export function isRedirect (props: Parti | PartiRedirect): props is PartiRedirect {
  return 'redirect' in props;
}
