import type { GetServerSideProps, NextPage } from 'next';
import Head from 'next/head';

import Footer from 'src/components/Footer';
import Header from 'src/components/Header';
import HomeContent from 'src/components/home/HomeContent';
import { partyData } from 'src/server/party-data';
import type { HomeData } from 'src/server/party-data';

const HomePage: NextPage<HomeData> = props => {
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

        <HomeContent {...props} />
      </main>

      <Footer />
    </div>
  );
};

export default HomePage;

export const getServerSideProps: GetServerSideProps<HomeData> = async () => {
  return { props: await partyData.readHomeData() };
};
