import type { GetStaticPaths, GetStaticProps, NextPage } from 'next';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import Image from 'next/image';
import Head from 'next/head';
import Link from 'next/link';
import Footer from 'src/components/Footer';
import Header from 'src/components/Header';
import { isRedirect } from 'src/types';
import type {
  Parti,
  PartiDeltagande,
  PartiIndexEntry,
  PartiProfil,
  PartiProfilDokument,
  PartiProfilForetradare,
  PartiProfilKalla,
  PartiProfilValresultat,
  PartiProfilValresultatPost,
  PartiRedirect,
} from 'src/types';

import partiIndex from 'data/parti/index.json';
import regionIndex from 'data/regioner/index.json';

const parties = partiIndex as PartiIndexEntry[];

interface RegionEntry {
  kod: string;
  namn: string;
  kommuner: Array<{ kod: string; namn: string }>;
}

interface PartyPageProps extends Parti {
  kandidatlistAr?: number[];
  profil?: PartiProfil;
  symbolSrc?: string;
}

const regions = regionIndex as RegionEntry[];
const regionNames = new Map(regions.map(region => [region.kod, region.namn]));
const municipalityNames = new Map(regions.flatMap(region => (
  region.kommuner.map(municipality => [municipality.kod, municipality.namn] as const)
)));
const percentageFormatter = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortMonthNames = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

const parliamentComposition = [
  { label: 'S', seats: 107, color: '#df2538' },
  { label: 'SD', seats: 73, color: '#d8b500' },
  { label: 'M', seats: 68, color: '#4d86c5' },
  { label: 'V', seats: 24, color: '#b51f36' },
  { label: 'C', seats: 24, color: '#55a045' },
  { label: 'KD', seats: 19, color: '#275ca7' },
  { label: 'MP', seats: 18, color: '#53a045' },
  { label: 'L', seats: 16, color: '#168bd2' },
];

const nationalTurnout = [
  { year: 1994, value: 86.8 },
  { year: 1998, value: 81.4 },
  { year: 2002, value: 80.1 },
  { year: 2006, value: 82.0 },
  { year: 2010, value: 84.63 },
  { year: 2014, value: 85.81 },
  { year: 2018, value: 87.18 },
  { year: 2022, value: 84.21 },
];

const chamberComposition = [
  { label: 'V', seats: 24 },
  { label: 'S', seats: 107 },
  { label: 'MP', seats: 18 },
  { label: 'C', seats: 24 },
  { label: 'L', seats: 16 },
  { label: 'KD', seats: 19 },
  { label: 'M', seats: 68 },
  { label: 'SD', seats: 73 },
];

const chamberSeats = (() => {
  const parties = chamberComposition.flatMap(party => Array.from({ length: party.seats }, () => party.label));
  const rows = 9;
  const radii = Array.from({ length: rows }, (_, row) => 0.4 + ((0.97 - 0.4) * row) / (rows - 1));
  const radiusTotal = radii.reduce((total, radius) => total + radius, 0);
  const counts = radii.map(radius => Math.floor((parties.length * radius) / radiusTotal));
  let remaining = parties.length - counts.reduce((total, count) => total + count, 0);
  for (let index = 0; remaining > 0; index += 1, remaining -= 1) counts[rows - 1 - (index % rows)] += 1;

  const points = radii.flatMap((radius, row) => Array.from({ length: counts[row] }, (_, seat) => {
    const position = counts[row] > 1 ? (seat + 0.5) / counts[row] : 0.5;
    const angle = Math.PI * (1 - position);
    return { position, radius, angle };
  })).sort((a, b) => a.position - b.position || a.radius - b.radius);

  return points.map((point, index) => ({
    id: index,
    party: parties[index],
    x: 50 + 50 * point.radius * Math.cos(point.angle),
    y: 100 - 100 * point.radius * Math.sin(point.angle),
  }));
})();

function formatSwedishDate (iso?: string) {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${String(date.getUTCDate()).padStart(2, '0')} ${shortMonthNames[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function formatCount (count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function placeNames (codes: string[], names: Map<string, string>) {
  return codes.map(code => names.get(code) ?? code).sort((a, b) => a.localeCompare(b, 'sv'));
}

async function readPartyProfile (filnamn: string) {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), 'data', 'parti', filnamn, 'profil.json'), 'utf8')) as PartiProfil;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function readCandidateListYears (filnamn: string) {
  const years = await Promise.all([2018, 2022, 2026].map(async year => {
    try {
      await access(path.join(process.cwd(), 'data', 'val', String(year), 'kandidatlistor', `${filnamn}.json`));
      return year;
    } catch {
      return undefined;
    }
  }));
  return years.filter((year): year is number => year !== undefined);
}

function ExternalLink ({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} className={className}>
      {children}<span className="profile-external" aria-hidden="true">↗</span>
      <span className="sr-only">, extern länk</span>
    </a>
  );
}

function SourceLine ({ source, children }: { source?: PartiProfilKalla; children?: ReactNode }) {
  return (
    <p className="profile-source">
      {children}
      {source && <><a href={source.url}>{source.namn}</a> · hämtat {source.hamtad}</>}
    </p>
  );
}

function SectionHeader ({ id, title, subtitle, aside }: { id: string; title: string; subtitle?: string; aside?: ReactNode }) {
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

function OfficialChannels ({ profile, abbreviation }: { profile: PartiProfil; abbreviation?: string }) {
  if (!profile.kanaler?.length) return null;

  return (
    <section className="profile-channels" aria-labelledby="channels-heading">
      <div className="profile-channels__intro">
        <div className="profile-source-brand">
          <span style={{ background: profile.accentfarg }}>{abbreviation ?? profile.namn.slice(0, 2).toUpperCase()}</span>
          <h2 id="channels-heading">Partiets egna kanaler</h2>
        </div>
        <p>Länkarna går till partiets egna webbplatser. Innehållet publiceras och ansvaras för av partiet.</p>
        <SourceLine source={profile.namn_kalla} />
      </div>
      <div className="profile-channel-links">
        {profile.kanaler.map(channel => (
          <ExternalLink href={channel.url} key={channel.url}>
            <span><strong>{channel.etikett}</strong>{channel.detalj && <small>{channel.detalj}</small>}</span>
          </ExternalLink>
        ))}
      </div>
    </section>
  );
}

function ProfileHero ({
  code,
  abbreviation,
  profile,
  symbol,
  symbolSrc,
  latestResult,
  latestParticipation,
}: {
  code: string;
  abbreviation?: string;
  profile: PartiProfil;
  symbol?: Parti['partisymbol'];
  symbolSrc?: string;
  latestResult?: PartiProfilValresultatPost;
  latestParticipation?: [string, PartiDeltagande];
}) {
  const participation = latestParticipation?.[1];

  return (
    <div className="profile-shell profile-hero">
      <Link href="/" className="profile-back"><span aria-hidden="true">←</span> Alla partier</Link>
      <div className={`profile-hero__grid${symbolSrc ? '' : ' profile-hero__grid--without-logo'}`}>
        <div className="profile-hero__copy">
          <h1>{profile.namn}</h1>
          <p>{profile.beskrivning ?? 'Registrerad partibeteckning och anmält valdeltagande enligt Valmyndighetens öppna data.'}</p>
        </div>
        {symbolSrc && symbol && (
          <figure className={`profile-logo${profile.symbolvisning === 'mark' ? ' profile-logo--mark' : ''}`}>
            <div><Image src={symbolSrc} alt={`${profile.namn}s logotyp`} fill sizes="(max-width: 800px) 80vw, 26vw" loading="eager" unoptimized /></div>
            <figcaption>Partisymbol från <a href={symbol.kallurl}>{symbol.kalla}</a>, återgiven för identifiering.</figcaption>
          </figure>
        )}
      </div>

      <dl className="profile-keyfacts">
        {latestResult ? <>
          <div>
            <dt>Mandat i riksdagen</dt>
            <dd>{latestResult.mandat} <span>av 349</span></dd>
            <dd className="profile-source">Valresultat {latestResult.valar}</dd>
          </div>
          <div>
            <dt>Riksdagsvalet {latestResult.valar}</dt>
            <dd>{percentageFormatter.format(latestResult.rostandel)} <span>%</span></dd>
            <dd className="profile-source">Valmyndigheten · slutligt resultat</dd>
          </div>
        </> : (
          <div>
            <dt>Partikod</dt>
            <dd className="profile-mono">{code}</dd>
            <dd className="profile-source">Valmyndighetens partiregister</dd>
          </div>
        )}
        {participation && (
          <div>
            <dt>Anmält deltagande {latestParticipation?.[0]}</dt>
            <dd>{participation.kommun.length} <span>kommuner</span></dd>
            <dd className="profile-source">{participation.region.length} regioner · Valmyndigheten</dd>
          </div>
        )}
      </dl>

      <OfficialChannels profile={profile} abbreviation={abbreviation} />
    </div>
  );
}

function DocumentLink ({ document }: { document: PartiProfilDokument }) {
  const detail = document.valar
    ? `valår ${document.valar}`
    : document.utgivet
      ? `utgivet ${document.utgivet}`
      : document.sidor
        ? `${document.sidor} sidor`
        : 'original hos utgivaren';

  return <li><ExternalLink href={document.url}>{document.titel}</ExternalLink><span>{detail}</span></li>;
}

function DocumentsSection ({ profile, abbreviation }: { profile: PartiProfil; abbreviation?: string }) {
  if (!profile.utdrag && !profile.dokument?.length) return null;

  return (
    <section className="profile-shell profile-section" aria-labelledby="documents-heading" id="dokument">
      <SectionHeader
        id="documents-heading"
        title="Vad partiet själv har skrivit"
        subtitle="Utdrag och länkar går till utgivarens original"
      />
      <div className={`profile-documents${profile.utdrag ? '' : ' profile-documents--list-only'}`}>
        {profile.utdrag && (
          <blockquote className="profile-excerpt">
            <p className="profile-eyebrow">{profile.utdrag.etikett}</p>
            <h3>”{profile.utdrag.rubrik}”</h3>
            {profile.utdrag.ingress && <p className="profile-excerpt__intro">{profile.utdrag.ingress}</p>}
            <ol>
              {profile.utdrag.punkter.map((point, index) => (
                <li key={point.rubrik}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div><strong>{point.rubrik}</strong><p>{point.text}</p></div>
                </li>
              ))}
            </ol>
            <footer>
              <ExternalLink href={profile.utdrag.url}>Läs originalet</ExternalLink>
              <cite>{profile.utdrag.kalla.namn} · citerat {profile.utdrag.kalla.hamtad}</cite>
            </footer>
          </blockquote>
        )}
        {profile.dokument?.length && (
          <aside className="profile-document-list">
            <div className="profile-source-brand profile-source-brand--small">
              <span style={{ background: profile.accentfarg }}>{abbreviation ?? profile.namn.slice(0, 2).toUpperCase()}</span>
              <div><strong>Från partiet</strong><small>Dokument hos utgivaren</small></div>
            </div>
            <ul>{profile.dokument.map(document => <DocumentLink document={document} key={document.url} />)}</ul>
          </aside>
        )}
      </div>
      <div className="profile-riksdag-documents">
        <div className="profile-source-brand profile-source-brand--small">
          <span className="profile-source-brand__riksdag">R</span>
          <div><strong>Från riksdagen</strong><small>data.riksdagen.se/dokumentlista</small></div>
        </div>
        <p>Riksdagsdokument från partiets ledamöter är ännu inte inlästa i profilen.</p>
        <ExternalLink href="https://data.riksdagen.se/dokumentlista/">Sök dokument hos Riksdagen</ExternalLink>
      </div>
    </section>
  );
}

function FeaturedRepresentative ({ person }: { person: PartiProfilForetradare }) {
  return (
    <figure className="profile-featured-representative">
      {person.bild && <div className="profile-featured-representative__image"><Image src={person.bild} alt={person.namn} fill sizes="(max-width: 700px) 72vw, 24vw" /></div>}
      <figcaption>
        <p className="profile-eyebrow">Språkrör</p>
        <h3>{person.namn}</h3>
        <p>{person.uppdrag}</p>
        <ExternalLink href={person.url}>Profil på mp.se</ExternalLink>
      </figcaption>
    </figure>
  );
}

function CompactRepresentative ({ person, label }: { person: PartiProfilForetradare; label?: string }) {
  return (
    <article className="profile-compact-representative">
      {person.bild && <div className="profile-compact-representative__image"><Image src={person.bild} alt={person.namn} fill sizes="118px" /></div>}
      <div>
        {label && <p className="profile-eyebrow">{label}</p>}
        <h3><a href={person.url}>{person.namn}</a></h3>
        <p>{person.uppdrag}</p>
      </div>
    </article>
  );
}

function RepresentativesSection ({ profile, abbreviation, mandateCount }: { profile: PartiProfil; abbreviation?: string; mandateCount?: number }) {
  if (!profile.foretradare?.length) return null;
  const featured = profile.foretradare.filter(person => person.framlyft);
  const remaining = profile.foretradare.filter(person => !person.framlyft);
  const groupLeadership = remaining.slice(0, 3);
  const otherRepresentatives = remaining.slice(3);
  const leadershipLabels = ['Gruppledare', 'Vice gruppledare', 'Utskottsordförande'];

  return (
    <section className="profile-shell profile-section" aria-labelledby="representatives-heading" id="representanter">
      <SectionHeader
        id="representatives-heading"
        title="Vilka som företräder partiet"
        subtitle={`${profile.namn}s riksdagsgrupp${mandateCount ? ` · ${mandateCount} mandat` : ''}`}
        aside={<div className="profile-source-brand profile-source-brand--small"><span style={{ background: profile.accentfarg }}>{abbreviation}</span><div><strong>Partiets egen webbplats</strong><small>mp.se/om/riksdagspolitiker</small></div></div>}
      />
      <div className="profile-representative-lead">
        {featured.map(person => <FeaturedRepresentative key={person.url} person={person} />)}
        <aside>
          <p>Partiet leds av två språkrör, ett kvinnligt och ett manligt, valda av kongressen. Riksdagsgruppen leds av en gruppledare med vice gruppledare.</p>
          <p>Uppdragen är hämtade ordagrant från partiets egen presentation av riksdagsgruppen. Pressfoton kommer från samma sidor och tillhör respektive fotograf.</p>
          <ExternalLink href="https://www.mp.se/om/riksdagspolitiker/">Hela riksdagsgruppen på mp.se</ExternalLink>
        </aside>
      </div>
      {groupLeadership.length > 0 && <div className="profile-group-leadership">{groupLeadership.map((person, index) => <CompactRepresentative key={person.url} person={person} label={leadershipLabels[index]} />)}</div>}
      {otherRepresentatives.length > 0 && (
        <div className="profile-other-representatives">
          <p className="profile-eyebrow">Övriga {otherRepresentatives.length} i riksdagsgruppen</p>
          <div>{otherRepresentatives.map(person => <CompactRepresentative key={person.url} person={person} />)}</div>
        </div>
      )}
      <SourceLine><a href="https://www.mp.se/om/riksdagspolitiker/">Uppdrag och foto: mp.se/om/riksdagspolitiker</a> · foto tillhör respektive fotograf</SourceLine>
    </section>
  );
}

function ElectionChart ({ results, selected, onSelect }: { results: PartiProfilValresultatPost[]; selected: number; onSelect: (index: number) => void }) {
  const maximum = 8;
  const points = results.map((result, index) => ({
    x: 6.25 + (index / Math.max(1, results.length - 1)) * 87.5,
    y: 100 - (result.rostandel / maximum) * 100,
  }));
  const line = points.map(point => `${point.x},${point.y}`).join(' ');
  const area = `${line} ${points.at(-1)?.x},100 ${points[0]?.x},100`;
  return (
    <div className="profile-election-chart">
      <div className="profile-chart-threshold"><span />4 % riksdagsspärr</div>
      <div className="profile-election-plot">
        <span className="profile-election-plot__threshold" aria-hidden="true" />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polygon points={area} />
          <polyline points={line} />
        </svg>
        {results.map((result, index) => (
          <button type="button" key={result.valar} onClick={() => onSelect(index)} aria-pressed={selected === index} aria-label={`Riksdagsvalet ${result.valar}: ${percentageFormatter.format(result.rostandel)} procent`}>
            <span className="profile-election-plot__value" style={{ bottom: `${(result.rostandel / maximum) * 100}%` }}>{percentageFormatter.format(result.rostandel)}</span>
            <span className="profile-election-plot__point" style={{ bottom: `${(result.rostandel / maximum) * 100}%` }} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="profile-election-mandates">
        {results.map((result, index) => (
          <button type="button" key={result.valar} onClick={() => onSelect(index)} className={selected === index ? 'is-selected' : undefined}>
            <strong>{result.mandat}</strong><span>{result.valar}</span>
          </button>
        ))}
      </div>
      <p className="profile-source">Mandat per val · klicka på en punkt för detaljer</p>
    </div>
  );
}

function ChamberDiagram ({ mandates, partyLabel }: { mandates: number; partyLabel?: string }) {
  return (
    <div className="profile-chamber" role="img" aria-label={`${mandates} av riksdagens 349 mandat`}>
      {chamberSeats.map(seat => <span key={seat.id} style={{ left: `${seat.x}%`, top: `${seat.y}%`, background: seat.party === partyLabel ? '#f1eee4' : '#2c4a7c' }} />)}
    </div>
  );
}

function ElectionResultsSection ({ results, partyLabel }: { results: PartiProfilValresultat; partyLabel?: string }) {
  const [selected, setSelected] = useState(results.resultat.length - 1);
  const result = results.resultat[selected];
  const latestResult = results.resultat.at(-1);
  const previousResult = selected > 0 ? results.resultat[selected - 1] : undefined;
  if (!result) return null;

  return (
    <section className="profile-results" aria-labelledby="results-heading" id="resultat">
      <div className="profile-shell">
        <SectionHeader
          id="results-heading"
          title="Vad partiet har fått i val"
          subtitle={`Riksdagsval ${results.resultat[0]?.valar}–${latestResult?.valar}, andel av giltiga röster i hela riket`}
          aside={<div className="profile-authority-brand"><Image src="/img/kallor/valmyndigheten.png" alt="" width={38} height={38} /><div><strong>Valmyndigheten</strong><small>valresultat · slutlig rösträkning</small></div></div>}
        />
        <div className="profile-results__top">
          <div className="profile-results__intro">
            <p>Diagrammet visar partiets andel av de giltiga rösterna och antal mandat i varje riksdagsval.</p>
            <SourceLine>Valmyndigheten · slutlig rösträkning</SourceLine>
          </div>
          <div>
            <ElectionChart results={results.resultat} selected={selected} onSelect={setSelected} />
            <div className="profile-selected-result">
              <header><strong>Riksdagsvalet {result.valar}</strong><span>Valmyndigheten · slutligt resultat</span></header>
              <dl>
                <div><dt>Andel giltiga röster</dt><dd>{percentageFormatter.format(result.rostandel)} %</dd></div>
                <div><dt>Röster</dt><dd>{result.roster ? new Intl.NumberFormat('sv-SE').format(result.roster) : '—'}</dd></div>
                <div><dt>Mandat</dt><dd>{result.mandat}</dd></div>
                <div><dt>Mot föregående val</dt><dd>{previousResult ? `${result.rostandel - previousResult.rostandel > 0 ? '+' : ''}${percentageFormatter.format(result.rostandel - previousResult.rostandel)}` : '—'}</dd></div>
              </dl>
            </div>
          </div>
        </div>
        {latestResult && <div className="profile-results__bottom">
          <div>
            <h3>Partiets {latestResult.mandat} platser i kammaren</h3>
            <ChamberDiagram mandates={latestResult.mandat} partyLabel={partyLabel} />
            <p className="profile-source">349 mandat efter valet {latestResult.valar} · data.riksdagen.se</p>
          </div>
          <div className="profile-composition">
            <h3>Riksdagens sammansättning 2022</h3>
            <ul>{parliamentComposition.map(party => <li key={party.label} className={party.label === partyLabel ? 'is-current' : undefined}><span>{party.label}</span><i><b style={{ width: `${(party.seats / parliamentComposition[0].seats) * 100}%` }} /></i><strong>{party.seats}</strong></li>)}</ul>
          </div>
        </div>}
        <div className="profile-results__sources">{results.kallor.map(source => <SourceLine source={source} key={source.url} />)}</div>
      </div>
    </section>
  );
}

function TurnoutSection () {
  const plotPoints = nationalTurnout.map((result, index) => ({
    ...result,
    x: (index / (nationalTurnout.length - 1)) * 100,
    y: ((90 - result.value) / 12) * 100,
  }));
  const points = plotPoints.map(point => `${point.x},${point.y}`).join(' ');

  return (
    <section className="profile-shell profile-turnout" aria-labelledby="turnout-heading" id="deltagande">
      <div className="profile-turnout__intro">
        <h2 id="turnout-heading">Valdeltagande som jämförelse</h2>
        <p>Valdeltagandet är en egenskap hos valet, inte hos partiet. Det visas för att kunna läsa röstetalen mot antalet röstande.</p>
        <div className="profile-source-brand profile-source-brand--small"><span className="profile-source-brand__scb">SCB</span><div><small>Historisk valstatistik · hämtat 2026-08-25</small></div></div>
      </div>
      <div className="profile-turnout__chart">
        <div>
          {[90, 85, 80].map(value => <span key={value} style={{ top: `${((90 - value) / 12) * 100}%` }}>{value} %</span>)}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Valdeltagande i riksdagsval 1994 till 2022"><polyline points={points} /></svg>
          <ul className="profile-turnout__values">
            {plotPoints.map((point, index) => <li className={index === 0 ? 'is-first' : index === plotPoints.length - 1 ? 'is-last' : undefined} key={point.year} style={{ left: `${point.x}%`, top: `${point.y}%` }} aria-label={`${point.year}: ${point.value.toFixed(2).replace(/0$/, '').replace('.', ',')} procent`}>{point.value.toFixed(2).replace(/0$/, '').replace('.', ',')} %</li>)}
          </ul>
        </div>
        <ol>{nationalTurnout.map(result => <li key={result.year}>{result.year}</li>)}</ol>
      </div>
    </section>
  );
}

function BallotSection ({ participationYears, candidateYears, filnamn, partyName }: { participationYears: Array<[string, PartiDeltagande]>; candidateYears: number[]; filnamn: string; partyName: string }) {
  const [electionType, setElectionType] = useState<'R' | 'L' | 'K'>('R');
  const latest = participationYears[0];
  const participation = latest?.[1];
  const labels = { R: 'Riksdagsval', L: 'Regionval', K: 'Kommunval' };
  const ballotClasses = { R: 'profile-ballot-card--national', L: 'profile-ballot-card--region', K: 'profile-ballot-card--municipal' };
  const hasCandidateList = candidateYears.includes(Number(latest?.[0]));
  return (
    <section className="profile-shell profile-section" aria-labelledby="ballot-heading" id="rosta">
      <SectionHeader
        id="ballot-heading"
        title="Var du kan rösta på partiet"
        subtitle={`Anmälda valsedlar och kandidater i valen ${latest?.[0] ?? ''}`}
        aside={<div className="profile-authority-brand profile-authority-brand--light"><Image src="/img/kallor/valmyndigheten.png" alt="" width={38} height={38} /><div><strong>Valmyndigheten</strong><small>valsedlar och anmält deltagande</small></div></div>}
      />
      <div className="profile-ballot-tabs" role="tablist" aria-label="Valtyp">
        {(Object.keys(labels) as Array<keyof typeof labels>).map(type => <button type="button" role="tab" aria-selected={electionType === type} key={type} onClick={() => setElectionType(type)}>{labels[type]}</button>)}
      </div>
      <div className="profile-ballot-layout">
        <article className={`profile-ballot-card ${ballotClasses[electionType]}`}>
          <p className="profile-eyebrow">Valsedel · {labels[electionType]} {latest?.[0]}</p>
          <p>Importerad kandidatlista</p>
          <h3>{partyName}</h3>
          {hasCandidateList
            ? <p>Kandidatlistan finns i Partidatas data och kan visas här.</p>
            : <div className="profile-ballot-empty"><strong>Ingen kandidatlista inläst</strong><p>Partiet har anmält deltagande, men kandidatnamn och listnummer saknas ännu i Partidata.</p></div>}
          <p className="profile-ballot-card__note">När listan finns återges kandidaterna i samma ordning och med samma yrkes- och ortsangivelser som hos Valmyndigheten.</p>
        </article>

        <div className="profile-ballot-map">
          <div className="profile-ballot-map__tabs"><span className="is-selected">Valsedlar</span><span>Mandat</span></div>
          <svg viewBox="0 0 290 660" role="img" aria-label={`Karta över de ${participation?.kommun.length ?? 0} kommuner där partiet anmält deltagande`}>
            <image href="/img/kallor/sverige-kommuner.svg" width="290" height="660" />
            {participation?.kommun.map(code => <use href={`/img/kallor/sverige-kommuner.svg#${code}`} key={code} />)}
          </svg>
          <ul><li><span />Anmält deltagande</li><li><span />Ingen kandidatlista inläst</li></ul>
          <SourceLine>Kommunindelning · SCB</SourceLine>
        </div>

        <aside className="profile-ballot-summary">
          <p>Valsedlar ska visas som de är beställda hos Valmyndigheten: samma ordning, samma yrkes- och ortsangivelser och samma listnummer.</p>
          <p>Partiet har anmält deltagande i</p>
          <dl>
            <div><dt>Riksdagsval</dt><dd>{participation?.riksdag ? 'Ja' : 'Nej'}</dd></div>
            <div><dt>Regioner</dt><dd>{participation?.region.length ?? 0}</dd></div>
            <div><dt>Kommuner</dt><dd>{participation?.kommun.length ?? 0} av 290</dd></div>
          </dl>
          <SourceLine><a href="https://data.val.se/">Valmyndigheten</a> · anmält deltagande {latest?.[0]}</SourceLine>
          <a href={`https://github.com/swedev/partidata/tree/main/data/parti/${filnamn}`}>Komplettera kandidatlistor på GitHub <span aria-hidden="true">→</span></a>
        </aside>
      </div>
    </section>
  );
}

function WikipediaSection ({ profile }: { profile: PartiProfil }) {
  if (!profile.wikipedia) return null;
  return (
    <section className="profile-wikipedia" aria-labelledby="wikipedia-heading" id="wikipedia">
      <div className="profile-shell">
        <header className="profile-wikipedia__masthead">
          <div><Image src="/img/kallor/wikipedia-globe.jpeg" alt="" width={54} height={49} /><span><strong>Wikipedia</strong><small>Den fria encyklopedin</small></span></div>
          <nav aria-label="Wikipedia-flikar"><span>Artikel</span><a href={profile.wikipedia.url}>Diskussion</a><a href={profile.wikipedia.url}>Redigera</a><a href={profile.wikipedia.url}>Visa historik</a></nav>
        </header>
        <h2 id="wikipedia-heading">{profile.wikipedia.titel}</h2>
        <p className="profile-wikipedia__origin">Från Wikipedia, den fria encyklopedin</p>
        <div className="profile-wikipedia__grid">
          <article>
            <p><strong>{profile.wikipedia.titel}</strong> {profile.wikipedia.utdrag.replace(new RegExp(`^${profile.wikipedia.titel} `, 'i'), '')}</p>
            <div className="profile-wikipedia__contents"><strong>Innehåll</strong><ol><li>Historia</li><li>Ideologi och politik</li><li>Valresultat</li><li>Organisation</li><li>Referenser</li></ol></div>
            <p className="profile-wikipedia__note">Utdraget är hämtat i sin ursprungliga form från artikelns inledning. Partidata sammanfattar inte och redigerar inte texten.</p>
            <div className="profile-wikipedia__links"><ExternalLink href={profile.wikipedia.url}>Läs hela artikeln på Wikipedia</ExternalLink>{profile.namn === 'Miljöpartiet de gröna' && <a href="https://www.wikidata.org/wiki/Q193230">Wikidata Q193230</a>}</div>
            <SourceLine>sv.wikipedia.org · hämtat {profile.wikipedia.hamtad} · CC BY-SA 4.0</SourceLine>
          </article>
          {profile.wikipedia.fakta?.length && <aside><h3>{profile.wikipedia.titel}</h3><dl>{profile.wikipedia.fakta.map(fact => <div key={fact.etikett}><dt>{fact.etikett}</dt><dd>{fact.varde}</dd></div>)}</dl>{profile.webbplats && <p><strong>Webbplats</strong><a href={profile.webbplats}>{new URL(profile.webbplats).hostname}</a></p>}</aside>}
        </div>
      </div>
    </section>
  );
}

function NewsSection ({ profile }: { profile: PartiProfil }) {
  if (!profile.nyheter?.length) return null;

  return (
    <section className="profile-shell profile-section profile-news" aria-labelledby="news-heading" id="nyheter">
      <SectionHeader
        id="news-heading"
        title="Vad redaktionerna skriver"
        subtitle="Rubriker och tidsstämplar oredigerade ur respektive källa"
        aside={<div className="profile-news__source"><a href="#export">RSS för det här partiet</a><span>publika flöden · klick går till originalet</span></div>}
      />
      <ul>
        {profile.nyheter.map(article => (
          <li key={article.url}>
            <time dateTime={article.datum}>{formatSwedishDate(article.datum)}</time>
            <span className="profile-news__publisher" style={{ background: article.kallfarg }}>{article.kallkod}</span>
            <div>
              <ExternalLink href={article.url}>{article.titel}</ExternalLink>
              <span>{article.kalla}{article.sektion && ` · ${article.sektion}`}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RegistrySection ({
  displayName,
  abbreviation,
  code,
  registered,
  previousNames,
  previousCodes,
  participation,
}: {
  displayName: string;
  abbreviation?: string;
  code: string;
  registered?: string;
  previousNames?: string[];
  previousCodes?: string[];
  participation?: PartiDeltagande;
}) {
  return (
    <section className="profile-shell profile-section profile-register" aria-labelledby="registry-heading" id="register">
      <SectionHeader id="registry-heading" title="Så står partiet skrivet i registret" aside={<div className="profile-authority-brand profile-authority-brand--light"><Image src="/img/kallor/valmyndigheten.png" alt="" width={38} height={38} /><div><strong>Valmyndigheten</strong><small>partiregister · importerad data</small></div></div>} />
      <div className="profile-register__grid">
        <article>
          <p className="profile-eyebrow">Beteckning</p>
          <dl>
            <div><dt>Partibeteckning</dt><dd>{displayName}</dd></div>
            {previousNames?.map(name => <div key={name}><dt>Tidigare beteckning</dt><dd>{name}</dd></div>)}
            <div><dt>Förkortning</dt><dd>{abbreviation ?? '—'}</dd></div>
          </dl>
        </article>
        <article>
          <p className="profile-eyebrow">Registrering</p>
          <dl>
            <div><dt>Registernummer</dt><dd className="profile-mono">{code}</dd></div>
            {registered && <div><dt>Registrerad</dt><dd className="profile-mono">{registered}</dd></div>}
            <div><dt>Anmäld för val till</dt><dd>{[participation?.riksdag ? 'riksdag' : undefined, participation?.region.length ? 'region' : undefined, participation?.kommun.length ? 'kommun' : undefined].filter(Boolean).join(', ') || '—'}</dd></div>
            <div><dt>Status</dt><dd>Aktiv i importerad data</dd></div>
          </dl>
        </article>
        <article>
          <p className="profile-eyebrow">Registerhistorik</p>
          <dl>
            {previousCodes?.map(previousCode => <div key={previousCode}><dt>Tidigare partikod</dt><dd className="profile-mono">{previousCode}</dd></div>)}
            <div><dt>Datakälla</dt><dd>Valmyndigheten</dd></div>
            <div><dt>Format</dt><dd className="profile-mono">JSON</dd></div>
            <div><dt>Licens</dt><dd>CC0</dd></div>
          </dl>
        </article>
      </div>
      <SourceLine><a href="https://data.val.se/">Valmyndigheten</a> · importerad registerdata</SourceLine>
    </section>
  );
}

function ExportSection ({ filnamn }: { filnamn: string }) {
  const dataUrl = `https://github.com/swedev/partidata/blob/main/data/parti/${filnamn}/index.json`;
  return (
    <section className="profile-shell profile-export" aria-labelledby="export-heading" id="export">
      <h2 id="export-heading" className="sr-only">Använd datan</h2>
      <p>Källan står vid varje uppgift på sidan. Samma data finns maskinläsbar och versionshanterad i Partidatas öppna databas.</p>
      <div><a href={dataUrl} className="profile-button">JSON</a><a href="https://github.com/swedev/partidata" className="profile-button">CSV</a><a href="https://github.com/swedev/partidata" className="profile-button profile-button--outline">API-dokumentation</a><a href="https://github.com/swedev/partidata" className="profile-button profile-button--outline">RSS</a></div>
    </section>
  );
}

function PartyPage ({
  beteckning,
  filnamn,
  forkortning,
  kod,
  tidigare_beteckningar,
  tidigare_koder,
  valmyndigheten_registreringsdatum,
  partisymbol,
  deltagande,
  kandidatlistAr = [],
  profil,
  symbolSrc,
}: PartyPageProps) {
  const displayName = profil?.namn ?? beteckning;
  const resolvedProfile: PartiProfil = profil ?? {
    namn: displayName,
    namn_kalla: { namn: 'Valmyndigheten', url: 'https://data.val.se/', hamtad: '2026-08-24' },
  };
  const participationYears = Object.entries(deltagande ?? {})
    .filter(([, value]) => value.riksdag || value.region.length > 0 || value.kommun.length > 0)
    .sort(([a], [b]) => Number(b) - Number(a));
  const latestResult = profil?.valresultat?.resultat.at(-1);
  const style = { '--profile-accent': profil?.accentfarg ?? '#082354' } as CSSProperties;

  return (
    <div className="page-shell">
      <Header partyProfile />
      <main className="party-profile-v2" style={style}>
        <Head>
          <title>{`${displayName} – Partidata`}</title>
          <meta name="description" content={`Källhänvisad data om det politiska partiet ${displayName}.`} />
          <link rel="icon" href="/img/partidata/mark.svg" type="image/svg+xml" />
        </Head>
        <ProfileHero code={kod} abbreviation={forkortning} profile={resolvedProfile} symbol={partisymbol} symbolSrc={symbolSrc} latestResult={latestResult} latestParticipation={participationYears[0]} />
        <DocumentsSection profile={resolvedProfile} abbreviation={forkortning} />
        <RepresentativesSection profile={resolvedProfile} abbreviation={forkortning} mandateCount={latestResult?.mandat} />
        {profil?.valresultat && <ElectionResultsSection results={profil.valresultat} partyLabel={forkortning} />}
        {profil?.valresultat && <TurnoutSection />}
        <BallotSection participationYears={participationYears} candidateYears={kandidatlistAr} filnamn={filnamn} partyName={displayName} />
        <WikipediaSection profile={resolvedProfile} />
        <NewsSection profile={resolvedProfile} />
        <RegistrySection displayName={displayName} abbreviation={forkortning} code={kod} registered={valmyndigheten_registreringsdatum} previousNames={tidigare_beteckningar} previousCodes={tidigare_koder} participation={participationYears[0]?.[1]} />
        <ExportSection filnamn={filnamn} />
      </main>
      <Footer />
    </div>
  );
}

function RedirectPage ({ filnamn, beteckning }: PartiRedirect['redirect']) {
  const href = `/parti/${filnamn}/`;
  return (
    <div className="page-shell">
      <Header />
      <main className="container">
        <Head><title>{`${beteckning} – Partidata`}</title><meta httpEquiv="refresh" content={`0; url=${href}`} /><meta name="robots" content="noindex" /><link rel="canonical" href={href} /></Head>
        <p className="mt-6"><Link href="/">← Alla partier</Link></p>
        <h1>Partiet har bytt namn</h1>
        <p className="mt-10">Partiet heter numera {beteckning}.</p>
        <p className="mt-2"><Link href={href}>{beteckning}</Link></p>
      </main>
      <Footer />
    </div>
  );
}

const PartiPage: NextPage<PartyPageProps | PartiRedirect> = props => isRedirect(props) ? <RedirectPage {...props.redirect} /> : <PartyPage {...props} />;
export default PartiPage;

export const getStaticPaths: GetStaticPaths<{ filnamn: string }> = async () => ({
  paths: parties.flatMap(party => [party.filnamn, ...(party.tidigare_filnamn ?? [])].map(filnamn => ({ params: { filnamn } }))),
  fallback: false,
});

export const getStaticProps: GetStaticProps<PartyPageProps | PartiRedirect, { filnamn: string }> = async ({ params }) => {
  const filnamn = params?.filnamn;
  if (!filnamn) return { notFound: true };
  if (parties.some(entry => entry.filnamn === filnamn)) {
    const party = (await import(`data/parti/${filnamn}/index.json`)).default as Parti;
    const symbolSrc = party.partisymbol ? (await import(`data/parti/${filnamn}/${party.partisymbol.filnamn}`)).default.src as string : undefined;
    const [profil, kandidatlistAr] = await Promise.all([readPartyProfile(filnamn), readCandidateListYears(filnamn)]);
    return { props: { ...party, kandidatlistAr, ...(profil ? { profil } : {}), ...(symbolSrc ? { symbolSrc } : {}) } };
  }
  const entry = parties.find(party => (party.tidigare_filnamn ?? []).includes(filnamn));
  return entry ? { props: { redirect: { filnamn: entry.filnamn, beteckning: entry.beteckning } } } : { notFound: true };
};
