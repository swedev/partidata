import type { GetServerSideProps, NextPage } from 'next';
import Head from 'next/head';

import Footer from 'src/components/Footer';
import Header from 'src/components/Header';
import PartySearch from 'src/components/home/PartySearch';
import RiksdagSection from 'src/components/home/RiksdagSection';
import { partyData } from 'src/server/party-data';
import type { HomeData } from 'src/server/party-data';

const numberFormatter = new Intl.NumberFormat('sv-SE');

const HomePage: NextPage<HomeData> = ({ parties, valar, lan, riksdag }) => {
  return (
    <div className="page-shell">
      <Head>
        <title>Partidata</title>
        <meta name="description" content="Öppen data om politiska partier i Sverige" />
        <link rel="icon" href="/img/partidata/mark.svg" type="image/svg+xml" />
      </Head>

      <Header />
      <main className="container home">
        <div className="home-intro">
          <h1>Alla registrerade partier i Sverige, på ett ställe.</h1>
          <p className="description">
            Partidata samlar uppgifter från Valmyndigheten om partibeteckningar,
            tidigare namn och anmält deltagande i riksdags-, region- och kommunval.
            Ingen värdering, ingen rangordning — bara källhänvisad data.
          </p>
          <p className="home-count">
            <strong>{numberFormatter.format(parties.length)} partier</strong> i registret
            {valar.length > 0 && `, med anmält valdeltagande från ${valar[0]} till ${valar[valar.length - 1]}`}.
          </p>
        </div>

        <PartySearch parties={parties} valar={valar} lan={lan} />
        <RiksdagSection years={riksdag} />
      </main>

      <Footer />
    </div>
  );
};

export default HomePage;

export const getServerSideProps: GetServerSideProps<HomeData> = async () => {
  return { props: await partyData.readHomeData() };
};
