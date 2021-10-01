import type { NextPage } from 'next';
import Head from 'next/head';
import Footer from 'src/components/Footer';

interface PartyPageProps {
  beteckning: string;
  forkortning?: string;
}

/**
 * PartyPage
 */
const PartyPage: NextPage<PartyPageProps> = ({ beteckning, forkortning }) => {
  return (
    <div>
      <main className="container">
        <Head>
          <title>{beteckning} - Partidata 🇸🇪</title>
          <meta name="description" content={`Öppen data om det politiska partiet “${beteckning}”`} />
          <link rel="icon" href="/favicon.ico" />
        </Head>

        <h1>
          {beteckning}
          {forkortning &&
            <span className="font-light"> ({forkortning})</span>
          }
        </h1>

        <div className="flex flex-row mt-10">
          <div className="flex-1">

          <table className="table table-striped">
            <thead>
              <tr>
                <th colSpan={2} className="text-left text-xl">Om partiet</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Grundat</td>
                <td>12 Juni, 19XX</td>
              </tr>
              <tr>
                <td>Key</td>
                <td>Value</td>
              </tr>
              <tr>
                <td>Key</td>
                <td>Value</td>
              </tr>
              <tr>
                <td>Key</td>
                <td>Value</td>
              </tr>
              <tr>
                <td>Key</td>
                <td>Value</td>
              </tr>
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

export async function getServerSideProps (context:any) {
  const filnamn = context.params.filnamn;
  const party = (await import(`data/parti/${filnamn}/index.json`)).default;
  return {
    props: party
  };
}
