import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRightIcon } from 'src/components/home/icons';
import PartySymbol from 'src/components/PartySymbol';
import type { SymbolFrame } from 'src/server/party-data';

export type PartyCardVariant = 'large' | 'medium' | 'small';

export interface PartyCardProps {
  beteckning: string;
  filnamn: string;
  forkortning?: string;
  symbolSrc?: string;
  symbolFrame?: SymbolFrame;
  variant?: PartyCardVariant;
  meta?: ReactNode;
  sub?: ReactNode;
}

const symbolSizes: Record<PartyCardVariant, string> = {
  large: '(max-width: 700px) 60vw, 210px',
  medium: '(max-width: 700px) 55vw, 208px',
  small: '(max-width: 700px) 55vw, 208px',
};

function PartyCard ({
  beteckning,
  filnamn,
  forkortning,
  symbolSrc,
  symbolFrame,
  variant = 'small',
  meta,
  sub,
}: PartyCardProps) {
  return (
    <Link href={`/parti/${filnamn}`} className={`party-card party-card--${variant}`}>
      <span className="party-card__symbol">
        {symbolSrc
          ? <PartySymbol src={symbolSrc} frame={symbolFrame} sizes={symbolSizes[variant]} />
          : <span className="party-card__symbol-missing">Partisymbol saknas</span>}
      </span>

      <span className="party-card__body">
        <span className="party-card__heading">
          <span className="party-card__name">{beteckning}</span>
          {forkortning && <span className="party-card__abbreviation">{forkortning}</span>}
        </span>
        {sub && <span className="party-card__sub">{sub}</span>}
      </span>

      <span className="party-card__foot">
        <span className="party-card__meta">{meta}</span>
        <ArrowUpRightIcon className="party-card__arrow" />
      </span>
    </Link>
  );
}

export default PartyCard;
