import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRightIcon } from 'src/components/home/icons';

export type PartyCardVariant = 'large' | 'medium' | 'small';

export interface PartyCardProps {
  beteckning: string;
  filnamn: string;
  forkortning?: string;
  symbolSrc?: string;
  variant?: PartyCardVariant;
  meta?: ReactNode;
  sub?: ReactNode;
}

const symbolSizes: Record<PartyCardVariant, string> = {
  large: '(max-width: 700px) 60vw, 210px',
  medium: '(max-width: 700px) 50vw, 160px',
  small: '(max-width: 700px) 45vw, 128px',
};

/**
 * The abbreviation stands in for a symbol the registry does not have. It is
 * never shown next to one, since the symbol already carries that identity.
 */
function SymbolSlot ({ beteckning, forkortning, symbolSrc, variant }: {
  beteckning: string;
  forkortning?: string;
  symbolSrc?: string;
  variant: PartyCardVariant;
}) {
  if (symbolSrc) {
    return (
      <span className="party-card__symbol">
        <Image src={symbolSrc} alt="" aria-hidden="true" fill sizes={symbolSizes[variant]} unoptimized />
      </span>
    );
  }

  return (
    <span className="party-card__symbol party-card__symbol--empty">
      <span className="party-card__abbreviation" aria-hidden="true">
        {forkortning ?? beteckning.trim().slice(0, 3).toUpperCase()}
      </span>
    </span>
  );
}

function PartyCard ({
  beteckning,
  filnamn,
  forkortning,
  symbolSrc,
  variant = 'small',
  meta,
  sub,
}: PartyCardProps) {
  return (
    <Link href={`/parti/${filnamn}`} className={`party-card party-card--${variant}`}>
      <SymbolSlot beteckning={beteckning} forkortning={forkortning} symbolSrc={symbolSrc} variant={variant} />

      <span className="party-card__body">
        <span className="party-card__name">{beteckning}</span>
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
