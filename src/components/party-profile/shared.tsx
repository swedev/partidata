import type { ReactNode } from 'react';
import type { PartiProfilKalla } from 'src/types';

const shortMonthNames = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

export function formatSwedishDate (iso?: string) {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${String(date.getUTCDate()).padStart(2, '0')} ${shortMonthNames[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
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
