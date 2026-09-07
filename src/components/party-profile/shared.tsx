import type { ReactNode } from 'react';
import PartySymbol from 'src/components/PartySymbol';
import type { SymbolFrame } from 'src/server/party-data';
import type { PartiProfilKalla } from 'src/types';
import { sourceMark } from './source-mark';

const shortMonthNames = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

export function formatSwedishDate (iso?: string) {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${String(date.getUTCDate()).padStart(2, '0')} ${shortMonthNames[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * A date in the precision it is stated in: a year, a year and month, or a full
 * date. Only the parts the source gives are rendered, so a year never turns
 * into a day it does not claim.
 */
export function formatPrecisionDate (value?: string) {
  if (!value) return undefined;
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  const monthName = month ? shortMonthNames[Number(month) - 1] : undefined;
  if (!monthName) return year;
  return day ? `${day} ${monthName} ${year}` : `${monthName} ${year}`;
}

export function ExternalLink ({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} className={className}>
      {children}<span className="profile-external" aria-hidden="true">↗</span>
      <span className="sr-only">, extern länk</span>
    </a>
  );
}

export function SourceLine ({ source, children }: { source?: PartiProfilKalla; children?: ReactNode }) {
  return (
    <p className="profile-source">
      {children}
      {source && <><a href={source.url}>{source.namn}</a> · hämtat {source.hamtad}</>}
    </p>
  );
}

/**
 * A label for content that comes from the party itself, marked with the party's
 * own symbol. The mark is decorative: the label beside it already says whose
 * content it is.
 */
export function SourceBrand ({ symbolSrc, symbolFrame, abbreviation, small, children }: {
  symbolSrc?: string;
  symbolFrame?: SymbolFrame;
  abbreviation?: string;
  small?: boolean;
  children: ReactNode;
}) {
  const mark = sourceMark({ symbolSrc, abbreviation });

  return (
    <div className={`profile-source-brand${small ? ' profile-source-brand--small' : ''}`}>
      {mark?.kind === 'symbol' && (
        <span className="profile-source-brand__mark"><PartySymbol src={mark.src} frame={symbolFrame} sizes="96px" /></span>
      )}
      {mark?.kind === 'text' && (
        <span className="profile-source-brand__mark profile-source-brand__mark--text" aria-hidden="true">{mark.text}</span>
      )}
      {children}
    </div>
  );
}

export function SectionHeader ({ id, title, subtitle, aside }: { id: string; title: string; subtitle?: string; aside?: ReactNode }) {
  return (
    <header className="profile-section-header">
      <div>
        <h2 id={id}>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {aside}
    </header>
  );
}
