import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import parties from 'data/parti/index.json';
import Footer from 'src/components/Footer';
import Header from 'src/components/Header';
import type { PartiIndexEntry } from 'src/types';

const groupedParties = new Map<string, PartiIndexEntry[]>();
parties.forEach(parti => {
  const key = parti.beteckning.substr(0, 1).toUpperCase();
  const group = groupedParties.get(key);
  if (group) {
    group.push(parti);
  } else {
    groupedParties.set(key, [parti]);
  }
});

const charGroups = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ'
  .split('')
  .filter(char => groupedParties.has(char));

/**
 * HomePage
 */
const HomePage: NextPage = () => {
  return (
    <div className="page-shell">
      <Head>
        <title>Partidata</title>
        <meta name="description" content="Öppen data om politiska partier i Sverige" />
        <link rel="icon" href="/img/partidata/mark.svg" type="image/svg+xml" />
      </Head>

      <Header />
      <main className="container main-index">

        <div className="home-intro">
          <h1>Alla registrerade partier i Sverige, på ett ställe.</h1>
          <p className="description">
            Partidata samlar uppgifter från Valmyndigheten om partibeteckningar,
            tidigare namn och anmält deltagande i riksdags-, region- och kommunval.
            Ingen värdering, ingen rangordning — bara källhänvisad data.
          </p>

          <div className="w-full md:w-3/5 mt-8">
            <input
              type="text"
              placeholder="Sök parti, kandidater, regioner, m.m."
              className="text-3xl border-2 border-solid rounded-lg px-5 py-2 w-full"
            />
          </div>
        </div>

        <ul className="party-index my-24">
          {charGroups.map(char => (
            <li key={char} className="flex-1">
              <h3>{char}</h3>
              <ul>
              {(groupedParties.get(char) ?? []).map(party => (
                <li key={party.filnamn}>
                  <Link href={`/parti/${party.filnamn}`}>{party.beteckning}</Link>
                </li>
              ))}
              </ul>
            </li>
          ))}
        </ul>
      </main>

      <Footer />

    </div>
  );
};

export default HomePage;
