import type { NextPage } from 'next';
import Head from 'next/head';
import Image from 'next/image';

import parties from 'data/parti/index.json';
import Footer from 'src/components/Footer';
import SverigesRiksdagSvg from 'public/img/sveriges_riksdag.svg';

const groupedParties = new Map<string, Array<any>>();
parties.forEach(parti => {
  const key = parti.beteckning.substr(0, 1).toUpperCase();
  if (!groupedParties.has(key)) {
    groupedParties.set(key, []);
  }
  (groupedParties.get(key) as Array<any>).push(parti);
});

const charGroups = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ'
  .split('')
  .filter(char => groupedParties.has(char));

/**
 * HomePage
 */
const HomePage: NextPage = () => {
  return (
    <div>
      <Head>
        <title>Partidata 🇸🇪</title>
        <meta name="description" content="Öppen data om politiska partier i Sverige" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container main-index">

        <div className="text-left my-24">
          <h1>
            Partidata 🇸🇪
          </h1>
          <p className="description">
            Öppen data om politiska partier i Sverige<br/>
            <strong>OBS! Work In Progress</strong>
          </p>

          <div className="w-3/5 mt-8">
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
              {(groupedParties.get(char) as Array<any>).map((party, k) => (
                <li key={party.filnamn}>
                  <a href={`/parti/${party.filnamn}`}>{party.beteckning}</a>
                </li>
              ))}
              </ul>
            </li>
          ))}
        </ul>

        <div className="grid">
          <a href="https://nextjs.org/docs" className="card">
            <h3>Documentation &rarr;</h3>
            <p>Find in-depth information about Next.js features and API.</p>
          </a>

          <a href="https://nextjs.org/learn" className="card">
            <h3>Learn &rarr;</h3>
            <p>Learn about Next.js in an interactive course with quizzes!</p>
          </a>

          <a
            href="https://github.com/vercel/next.js/tree/master/examples"
            className="card"
          >
            <h3>Examples &rarr;</h3>
            <p>Discover and deploy boilerplate example Next.js projects.</p>
          </a>

          <a
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
            className="card"
          >
            <h3>Deploy &rarr;</h3>
            <p>
              Instantly deploy your Next.js site to a public URL with Vercel.
            </p>
          </a>
        </div>
      </main>

      <Footer />

    </div>
  );
};

export default HomePage;
