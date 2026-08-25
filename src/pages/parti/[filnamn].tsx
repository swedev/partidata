import type { GetStaticPaths, GetStaticProps, NextPage } from 'next';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CSSProperties } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { BallotSection, type CandidateLists, type ElectionType, ElectionResultsSection, TurnoutSection } from 'src/components/party-profile/elections';
import { DocumentsSection, ProfileHero, RepresentativesSection } from 'src/components/party-profile/overview';
import { ExportSection, NewsSection, RegistrySection, WikipediaSection } from 'src/components/party-profile/sources';
import Footer from 'src/components/Footer';
import Header from 'src/components/Header';
import { isRedirect } from 'src/types';
import type { Parti, PartiIndexEntry, PartiProfil, PartiRedirect } from 'src/types';

import partyIndex from 'data/parti/index.json';

const parties = partyIndex as PartiIndexEntry[];

interface PartyPageProps extends Parti {
  candidateLists?: CandidateLists;
  profile?: PartiProfil;
  symbolSrc?: string;
}

interface CandidateListFile {
  val?: ElectionType[];
  kandidatlistor?: Array<{ val: ElectionType }>;
}

async function readPartyProfile (slug: string) {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), 'data', 'parti', slug, 'profil.json'), 'utf8')) as PartiProfil;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function readCandidateLists (slug: string) {
  const entries = await Promise.all([2018, 2022, 2026].map(async year => {
    try {
      const file = JSON.parse(await readFile(path.join(process.cwd(), 'data', 'val', String(year), 'kandidatlistor', `${slug}.json`), 'utf8')) as CandidateListFile;
      const electionTypes = [...new Set([...(file.val ?? []), ...(file.kandidatlistor?.map(list => list.val) ?? [])])];
      return [String(year), electionTypes] as const;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
  }));
  return Object.fromEntries(entries.filter((entry): entry is readonly [string, ElectionType[]] => entry !== undefined));
}

function PartyPage ({
  beteckning: registeredName,
  filnamn: slug,
  forkortning: abbreviation,
  kod: code,
  tidigare_beteckningar: previousNames,
  tidigare_koder: previousCodes,
  valmyndigheten_registreringsdatum: registrationDate,
  partisymbol: symbol,
  deltagande: participation,
  candidateLists = {},
  profile,
  symbolSrc,
}: PartyPageProps) {
  const displayName = profile?.namn ?? registeredName;
  const resolvedProfile: PartiProfil = profile ?? {
    namn: displayName,
    namn_kalla: { namn: 'Valmyndigheten', url: 'https://data.val.se/', hamtad: '2026-08-24' },
  };
  const participationYears = Object.entries(participation ?? {})
    .filter(([, value]) => value.riksdag || value.region.length > 0 || value.kommun.length > 0)
    .sort(([a], [b]) => Number(b) - Number(a));
  const latestResult = profile?.valresultat?.resultat.at(-1);
  const style = { '--profile-accent': profile?.accentfarg ?? '#082354' } as CSSProperties;

  return (
    <div className="page-shell">
      <Header />
      <main className="party-profile-v2" style={style}>
        <Head>
          <title>{`${displayName} – Partidata`}</title>
          <meta name="description" content={`Källhänvisad data om det politiska partiet ${displayName}.`} />
          <link rel="icon" href="/img/partidata/mark.svg" type="image/svg+xml" />
        </Head>
        <ProfileHero code={code} abbreviation={abbreviation} profile={resolvedProfile} symbol={symbol} symbolSrc={symbolSrc} latestResult={latestResult} latestParticipation={participationYears[0]} />
        <DocumentsSection profile={resolvedProfile} abbreviation={abbreviation} />
        <RepresentativesSection profile={resolvedProfile} abbreviation={abbreviation} mandateCount={latestResult?.mandat} />
        {profile?.valresultat && <ElectionResultsSection results={profile.valresultat} partyLabel={abbreviation} />}
        {profile?.valresultat && <TurnoutSection />}
        {participationYears.length > 0 && <BallotSection participationYears={participationYears} candidateLists={candidateLists} slug={slug} partyName={displayName} />}
        <WikipediaSection profile={resolvedProfile} />
        <NewsSection profile={resolvedProfile} />
        <RegistrySection registeredName={registeredName} abbreviation={abbreviation} code={code} registered={registrationDate} previousNames={previousNames} previousCodes={previousCodes} participation={participationYears[0]?.[1]} />
        <ExportSection slug={slug} hasProfile={Boolean(profile)} />
      </main>
      <Footer />
    </div>
  );
}

function RedirectPage ({ filnamn: slug, beteckning: registeredName }: PartiRedirect['redirect']) {
  const href = `/parti/${slug}/`;
  return (
    <div className="page-shell">
      <Header />
      <main className="container">
        <Head><title>{`${registeredName} – Partidata`}</title><meta httpEquiv="refresh" content={`0; url=${href}`} /><meta name="robots" content="noindex" /><link rel="canonical" href={href} /></Head>
        <p className="mt-6"><Link href="/">← Alla partier</Link></p>
        <h1>Partiet har bytt namn</h1>
        <p className="mt-10">Partiet heter numera {registeredName}.</p>
        <p className="mt-2"><Link href={href}>{registeredName}</Link></p>
      </main>
      <Footer />
    </div>
  );
}

const PartyRoute: NextPage<PartyPageProps | PartiRedirect> = props => isRedirect(props) ? <RedirectPage {...props.redirect} /> : <PartyPage {...props} />;
export default PartyRoute;

export const getStaticPaths: GetStaticPaths<{ filnamn: string }> = async () => ({
  paths: parties.flatMap(party => [party.filnamn, ...(party.tidigare_filnamn ?? [])].map(filnamn => ({ params: { filnamn } }))),
  fallback: false,
});

export const getStaticProps: GetStaticProps<PartyPageProps | PartiRedirect, { filnamn: string }> = async ({ params }) => {
  const slug = params?.filnamn;
  if (!slug) return { notFound: true };
  if (parties.some(entry => entry.filnamn === slug)) {
    const party = (await import(`data/parti/${slug}/index.json`)).default as Parti;
    const symbolSrc = party.partisymbol ? (await import(`data/parti/${slug}/${party.partisymbol.filnamn}`)).default.src as string : undefined;
    const [profile, candidateLists] = await Promise.all([readPartyProfile(slug), readCandidateLists(slug)]);
    return { props: { ...party, candidateLists, ...(profile ? { profile } : {}), ...(symbolSrc ? { symbolSrc } : {}) } };
  }
  const entry = parties.find(party => (party.tidigare_filnamn ?? []).includes(slug));
  return entry ? { props: { redirect: { filnamn: entry.filnamn, beteckning: entry.beteckning } } } : { notFound: true };
};
