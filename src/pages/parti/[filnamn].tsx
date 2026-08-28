import type { GetServerSideProps, NextPage } from 'next';
import type { CSSProperties } from 'react';
import Head from 'next/head';
import { BallotSection, ElectionResultsSection, TurnoutSection } from 'src/components/party-profile/elections';
import { DocumentsSection, ProfileHero, RepresentativesSection } from 'src/components/party-profile/overview';
import { ExportSection, NewsSection, RegistrySection, WikipediaSection } from 'src/components/party-profile/sources';
import Footer from 'src/components/Footer';
import Header from 'src/components/Header';
import { partyData } from 'src/server/party-data';
import type { PartyPageData } from 'src/server/party-data';
import type { PartiProfil } from 'src/types';

type PartyPageProps = PartyPageData;

function PartyPage ({
  beteckning: registeredName,
  filnamn: slug,
  omrade: area,
  duplicateName,
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
  symbolFrame,
}: PartyPageProps) {
  const displayName = profile?.namn ?? registeredName;
  const pageName = duplicateName && area ? `${displayName} (${area})` : displayName;
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
          <title>{`${pageName} – Partidata`}</title>
          <meta name="description" content={`Källhänvisad data om det politiska partiet ${pageName}.`} />
          <link rel="icon" href="/img/partidata/mark.svg" type="image/svg+xml" />
          <link rel="canonical" href={`https://www.partidata.se/parti/${slug}/`} />
        </Head>
        <ProfileHero code={code} abbreviation={abbreviation} profile={resolvedProfile} displayName={pageName} symbol={symbol} symbolSrc={symbolSrc} symbolFrame={symbolFrame} latestResult={latestResult} latestParticipation={participationYears[0]} />
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

const PartyRoute: NextPage<PartyPageProps> = props => <PartyPage {...props} />;
export default PartyRoute;

export const getServerSideProps: GetServerSideProps<PartyPageProps, { filnamn: string }> = async ({ params }) => {
  const slug = params?.filnamn;
  if (!slug) return { notFound: true };
  const result = await partyData.resolveParty(slug);
  if (result.kind === 'party') return { props: result.props };
  if (result.kind === 'redirect') return { redirect: { destination: result.destination, permanent: true } };
  return { notFound: true };
};
