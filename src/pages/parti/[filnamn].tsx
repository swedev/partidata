import type { GetStaticPaths, GetStaticProps, NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Footer from 'src/components/Footer';
import type { Parti } from 'src/types';

import parties from 'data/parti/index.json';

const dateFormatter = new Intl.DateTimeFormat('sv-SE', { dateStyle: 'long', timeZone: 'UTC' });

function formatSwedishDate (iso?: string) {
  if (!iso) {
    return undefined;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return dateFormatter.format(date);
}

/**
 * PartyPage
 */
const PartyPage: NextPage<Parti> = ({ beteckning, forkortning, kod, valmyndigheten_registreringsdatum }) => {
  const rows = [
    { label: 'Partikod hos Valmyndigheten', value: kod },
    { label: 'Förkortning', value: forkortning },
    { label: 'Registrerad hos Valmyndigheten', value: formatSwedishDate(valmyndigheten_registreringsdatum) },
  ].filter(row => row.value);

  return (
    <div>
      <main className="container">
        <Head>
          <title>{beteckning} - Partidata 🇸🇪</title>
          <meta name="description" content={`Öppen data om det politiska partiet “${beteckning}”`} />
          <link rel="icon" href="/favicon.ico" />
        </Head>

        <p className="mt-6">
          <Link href="/">← Alla partier</Link>
        </p>

        <h1>
          {beteckning}
          {forkortning &&
            <span className="font-light"> ({forkortning})</span>
          }
        </h1>

        <div className="flex flex-col md:flex-row mt-10">
          <div className="flex-1">

          <table className="table table-striped">
            <thead>
              <tr>
                <th colSpan={2} className="text-left text-xl">Om partiet</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          </div>
          <div className="flex-1">

          </div>
        </div>

      </main>
      <Footer />
    </div>
  );
};

export default PartyPage;

export const getStaticPaths: GetStaticPaths<{ filnamn: string }> = async () => {
  return {
    paths: parties.map(party => ({ params: { filnamn: party.filnamn } })),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<Parti, { filnamn: string }> = async ({ params }) => {
  const filnamn = params?.filnamn;
  if (!filnamn) {
    return { notFound: true };
  }
  const party = (await import(`data/parti/${filnamn}/index.json`)).default as Parti;
  return {
    props: party
  };
};
