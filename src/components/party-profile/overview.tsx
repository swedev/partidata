import Image from 'next/image';
import Link from 'next/link';
import type {
  Parti,
  PartiDeltagande,
  PartiProfil,
  PartiProfilDokument,
  PartiProfilForetradare,
  PartiProfilValresultatPost,
} from 'src/types';
import { ExternalLink, SectionHeader, SourceLine } from './shared';

const percentageFormatter = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

export function ProfileHero ({
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
  const description = profile.beskrivning ?? profile.profiltext?.text ?? 'Registrerad partibeteckning och anmält valdeltagande enligt Valmyndighetens öppna data.';
  const descriptionSource = profile.profiltext?.kalla ?? profile.namn_kalla;

  return (
    <div className="profile-shell profile-hero">
      <Link href="/" className="profile-back"><span aria-hidden="true">←</span> Alla partier</Link>
      <div className={`profile-hero__grid${symbolSrc ? '' : ' profile-hero__grid--without-logo'}`}>
        <div className="profile-hero__copy">
          <h1>{profile.namn}</h1>
          <div className="profile-hero__description">
            <p>{description}</p>
            <SourceLine source={descriptionSource} />
          </div>
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

  return (
    <li>
      <div className="profile-document-list__document"><ExternalLink href={document.url}>{document.titel}</ExternalLink><span>{detail}</span></div>
      {(document.delar?.length ?? 0) > 0 && (
        <ol className="profile-document-list__parts">
          {document.delar?.map(part => (
            <li key={part.nummer}>
              <span>{String(part.nummer).padStart(2, '0')}</span>
              {part.url ? <ExternalLink href={part.url}>{part.titel}</ExternalLink> : <strong>{part.titel}</strong>}
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

export function DocumentsSection ({ profile, abbreviation }: { profile: PartiProfil; abbreviation?: string }) {
  if (!profile.utdrag && !profile.dokument?.length) return null;

  return (
    <section className="profile-shell profile-section" aria-labelledby="documents-heading" id="dokument">
      <SectionHeader id="documents-heading" title="Vad partiet själv har skrivit" subtitle="Utdrag och länkar går till utgivarens original" />
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
        {(profile.dokument?.length ?? 0) > 0 && (
          <aside className="profile-document-list">
            <div className="profile-source-brand profile-source-brand--small">
              <span style={{ background: profile.accentfarg }}>{abbreviation ?? profile.namn.slice(0, 2).toUpperCase()}</span>
              <div><strong>Från partiet</strong><small>Dokument hos utgivaren</small></div>
            </div>
            <ul>{profile.dokument?.map(document => <DocumentLink document={document} key={document.url} />)}</ul>
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
        <p className="profile-eyebrow">{person.uppdrag}</p>
        <h3>{person.namn}</h3>
        <ExternalLink href={person.url}>Profil hos partiet</ExternalLink>
      </figcaption>
    </figure>
  );
}

function CompactRepresentative ({ person }: { person: PartiProfilForetradare }) {
  return (
    <article className="profile-compact-representative">
      {person.bild && <div className="profile-compact-representative__image"><Image src={person.bild} alt={person.namn} fill sizes="118px" /></div>}
      <div><h3><a href={person.url}>{person.namn}</a></h3><p>{person.uppdrag}</p></div>
    </article>
  );
}

export function RepresentativesSection ({ profile, abbreviation, mandateCount }: { profile: PartiProfil; abbreviation?: string; mandateCount?: number }) {
  if (!profile.foretradare?.length) return null;
  const featured = profile.foretradare.filter(person => person.framlyft);
  const remaining = profile.foretradare.filter(person => !person.framlyft);
  const primaryRepresentatives = remaining.slice(0, 3);
  const otherRepresentatives = remaining.slice(3);
  const sourceUrl = profile.kanaler?.find(channel => /politiker|företrädare|riksdag/i.test(channel.etikett))?.url ?? profile.foretradare[0]?.url;
  const sourceHost = sourceUrl ? new URL(sourceUrl).hostname.replace(/^www\./, '') : undefined;

  return (
    <section className="profile-shell profile-section" aria-labelledby="representatives-heading" id="representanter">
      <SectionHeader
        id="representatives-heading"
        title="Vilka som företräder partiet"
        subtitle={`${profile.namn}s företrädare${mandateCount ? ` · partiet har ${mandateCount} mandat` : ''}`}
        aside={<div className="profile-source-brand profile-source-brand--small"><span style={{ background: profile.accentfarg }}>{abbreviation ?? profile.namn.slice(0, 2).toUpperCase()}</span><div><strong>Partiets egen webbplats</strong>{sourceHost && <small>{sourceHost}</small>}</div></div>}
      />
      <div className="profile-representative-lead">
        {featured.map(person => <FeaturedRepresentative key={person.url} person={person} />)}
        <aside>
          <p>Uppdrag och presentationer återges från partiets egna profilsidor.</p>
          <p>Följ länkarna till originalkällan för partiets fullständiga presentation och aktuella uppgifter.</p>
          {sourceUrl && <ExternalLink href={sourceUrl}>Öppna partiets presentation</ExternalLink>}
        </aside>
      </div>
      {primaryRepresentatives.length > 0 && <div className="profile-group-leadership">{primaryRepresentatives.map(person => <CompactRepresentative key={person.url} person={person} />)}</div>}
      {otherRepresentatives.length > 0 && (
        <div className="profile-other-representatives">
          <p className="profile-eyebrow">Övriga {otherRepresentatives.length} företrädare</p>
          <div>{otherRepresentatives.map(person => <CompactRepresentative key={person.url} person={person} />)}</div>
        </div>
      )}
      {sourceUrl && <SourceLine><a href={sourceUrl}>Uppdrag och presentationer: partiets webbplats</a></SourceLine>}
    </section>
  );
}
