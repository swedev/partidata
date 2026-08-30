import Image from 'next/image';
import Link from 'next/link';
import type { PartiDeltagande, PartiProfil } from 'src/types';
import { ExternalLink, formatSwedishDate, SectionHeader, SourceLine } from './shared';

export function WikipediaSection ({ profile }: { profile: PartiProfil }) {
  if (!profile.wikipedia) return null;
  const editUrl = new URL(profile.wikipedia.url);
  editUrl.searchParams.set('veaction', 'edit');
  const historyUrl = new URL(profile.wikipedia.url);
  historyUrl.searchParams.set('action', 'history');
  const discussionUrl = new URL(profile.wikipedia.url);
  discussionUrl.pathname = discussionUrl.pathname.replace('/wiki/', '/wiki/Diskussion:');
  const titlePrefix = `${profile.wikipedia.titel} `;
  const excerpt = profile.wikipedia.utdrag.toLocaleLowerCase('sv-SE').startsWith(titlePrefix.toLocaleLowerCase('sv-SE'))
    ? profile.wikipedia.utdrag.slice(titlePrefix.length)
    : profile.wikipedia.utdrag;

  return (
    <section className="profile-wikipedia" aria-labelledby="wikipedia-heading" id="wikipedia">
      <div className="profile-shell">
        <header className="profile-wikipedia__masthead">
          <div><Image src="/img/kallor/wikipedia-globe.jpeg" alt="" width={54} height={49} /><span><strong>Wikipedia</strong><small>Den fria encyklopedin</small></span></div>
          <nav aria-label="Wikipedia-flikar"><span>Artikel</span><a href={discussionUrl.toString()}>Diskussion</a><a href={editUrl.toString()}>Redigera</a><a href={historyUrl.toString()}>Visa historik</a></nav>
        </header>
        <h2 id="wikipedia-heading">{profile.wikipedia.titel}</h2>
        <p className="profile-wikipedia__origin">Från Wikipedia, den fria encyklopedin</p>
        <div className="profile-wikipedia__grid">
          <article>
            <p><strong>{profile.wikipedia.titel}</strong> {excerpt}</p>
            <p className="profile-wikipedia__note">Utdraget är hämtat i sin ursprungliga form från artikelns inledning. Partidata sammanfattar inte och redigerar inte texten.</p>
            <div className="profile-wikipedia__links"><ExternalLink href={profile.wikipedia.url}>Läs hela artikeln på Wikipedia</ExternalLink></div>
            <SourceLine>sv.wikipedia.org · hämtat {profile.wikipedia.hamtad} · CC BY-SA 4.0</SourceLine>
          </article>
          {(profile.wikipedia.fakta?.length ?? 0) > 0 && <aside><h3>{profile.wikipedia.titel}</h3><dl>{profile.wikipedia.fakta?.map(fact => <div key={fact.etikett}><dt>{fact.etikett}</dt><dd>{fact.varde}</dd></div>)}</dl>{profile.webbplats && <p><strong>Webbplats</strong><a href={profile.webbplats}>{new URL(profile.webbplats).hostname}</a></p>}</aside>}
        </div>
      </div>
    </section>
  );
}

export function NewsSection ({ profile }: { profile: PartiProfil }) {
  if (!profile.nyheter?.length) return null;

  return (
    <section className="profile-shell profile-section profile-news" aria-labelledby="news-heading" id="nyheter">
      <SectionHeader id="news-heading" title="Vad redaktionerna skriver" subtitle="Rubriker och tidsstämplar oredigerade ur respektive källa" aside={<div className="profile-news__source"><span>publika källor · klick går till originalet</span></div>} />
      <ul>
        {profile.nyheter.map(article => (
          <li key={article.url}>
            <time dateTime={article.datum}>{formatSwedishDate(article.datum)}</time>
            <span className="profile-news__publisher" style={{ background: article.kallfarg }}>{article.kallkod}</span>
            <div><ExternalLink href={article.url}>{article.titel}</ExternalLink><span>{article.kalla}{article.sektion && ` · ${article.sektion}`}</span></div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RegistrySection ({
  registeredName,
  abbreviation,
  code,
  registered,
  previousNames,
  previousCodes,
  participation,
}: {
  registeredName: string;
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
            <div><dt>Partibeteckning</dt><dd>{registeredName}</dd></div>
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

export function ExportSection ({ slug, hasProfile }: { slug: string; hasProfile: boolean }) {
  const dataUrl = `/data/parti/${encodeURIComponent(slug)}/index.json`;
  const profileUrl = `https://github.com/swedev/partidata/blob/main/data/parti/${slug}/profil.json`;

  return (
    <section className="profile-shell profile-export" aria-labelledby="export-heading" id="export">
      <h2 id="export-heading" className="sr-only">Använd datan</h2>
      <p>Källan står vid varje uppgift på sidan. Partiets registerdata finns som JSON på Partidata; alla datafiler är versionshanterade på GitHub.</p>
      <div><a href={dataUrl} className="profile-button">Registerdata (JSON)</a>{hasProfile && <a href={profileUrl} className="profile-button">Profildata (JSON)</a>}<a href="https://github.com/swedev/partidata" className="profile-button profile-button--outline">Projektet på GitHub</a></div>
      <p><Link href="/data/">Så använder du datan</Link></p>
    </section>
  );
}
