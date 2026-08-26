import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

export type PartyCardVariant = 'large' | 'medium' | 'small';

export interface PartyCardProps {
  beteckning: string;
  filnamn: string;
  forkortning?: string;
  symbolSrc?: string;
  variant?: PartyCardVariant;
  primaryMeta?: ReactNode;
  secondaryMeta?: ReactNode;
}

const symbolSizes: Record<PartyCardVariant, string> = {
  large: '(max-width: 700px) 30vw, 11rem',
  medium: '(max-width: 700px) 24vw, 7rem',
  small: '(max-width: 700px) 18vw, 4rem',
};

function initial (beteckning: string) {
  return [...beteckning.trim()].find(character => /\p{L}|\p{N}/u.test(character))?.toUpperCase() ?? '?';
}

function PartyCard ({
  beteckning,
  filnamn,
  forkortning,
  symbolSrc,
  variant = 'small',
  primaryMeta,
  secondaryMeta,
}: PartyCardProps) {
  return (
    <Link href={`/parti/${filnamn}`} className={`party-card party-card--${variant}`}>
      <span className="party-card__symbol">
        {symbolSrc
          ? <Image src={symbolSrc} alt="" aria-hidden="true" fill sizes={symbolSizes[variant]} unoptimized />
          : <span className="party-card__placeholder" aria-hidden="true">{forkortning ?? initial(beteckning)}</span>}
      </span>
      <span className="party-card__body">
        <span className="party-card__name">{beteckning}</span>
        {forkortning && <span className="party-card__abbreviation">{forkortning}</span>}
        {primaryMeta && <span className="party-card__meta">{primaryMeta}</span>}
        {secondaryMeta && <span className="party-card__meta party-card__meta--secondary">{secondaryMeta}</span>}
      </span>
    </Link>
  );
}

export default PartyCard;
