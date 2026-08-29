import type { GetServerSideProps, NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

import Footer from 'src/components/Footer';
import Header from 'src/components/Header';
import HomeContent from 'src/components/home/HomeContent';
import type { HomeState } from 'src/components/home/query';
import { stateFromQuery } from 'src/components/home/query';
import { partyData } from 'src/server/party-data';
import type { HomeData } from 'src/server/party-data';

type HomePageProps = HomeData & { initial: HomeState };

const HomePage: NextPage<HomePageProps> = props => {
  const router = useRouter();
  // The start page writes its own URL shallowly, which leaves the mounted
  // component in place. A route change Next made itself brings new props that
  // the existing state would otherwise outlive, so the counter remounts on
  // those and only those.
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    function onRouteChange (_url: string, { shallow }: { shallow: boolean }) {
      if (!shallow) setGeneration(current => current + 1);
    }
    router.events.on('routeChangeComplete', onRouteChange);
    return () => router.events.off('routeChangeComplete', onRouteChange);
  }, [router.events]);

  return (
    <div className="page-shell">
      <Head>
        <title>Partidata</title>
        <meta name="description" content="Öppen data om politiska partier i Sverige" />
        <link rel="icon" href="/img/partidata/mark.svg" type="image/svg+xml" />
        <link rel="canonical" href="https://www.partidata.se/" />
      </Head>

      <Header />
      <main className="container home">
        <div className="home-intro">
          <h1>Alla registrerade partier i Sverige, på ett ställe.</h1>
          <p className="description">
            Partidata samlar uppgifter från Valmyndigheten om partibeteckningar,
            tidigare namn och anmält deltagande i riksdags-, region- och kommunval.
            Ingen partipolitisk värdering — bara källhänvisad data.
          </p>
        </div>

        <HomeContent key={generation} {...props} />
      </main>

      <Footer />
    </div>
  );
};

export default HomePage;

export const getServerSideProps: GetServerSideProps<HomePageProps> = async context => {
  const data = await partyData.readHomeData();
  return { props: { ...data, initial: stateFromQuery(context.query, data) } };
};
