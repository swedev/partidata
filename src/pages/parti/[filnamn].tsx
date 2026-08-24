import type { GetStaticPaths, GetStaticProps, NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Footer from 'src/components/Footer';
import Header from 'src/components/Header';
import { isRedirect } from 'src/types';
import type { Parti, PartiIndexEntry, PartiRedirect } from 'src/types';

import partiIndex from 'data/parti/index.json';

const parties = partiIndex as PartiIndexEntry[];

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
function PartyPage ({ beteckning, forkortning, kod, valmyndigheten_registreringsdatum }: Parti) {
  const rows = [
    { label: 'Partikod hos Valmyndigheten', value: kod },
    { label: 'Förkortning', value: forkortning },
    { label: 'Registrerad hos Valmyndigheten', value: formatSwedishDate(valmyndigheten_registreringsdatum) },
  ].filter(row => row.value);

  return (
    <div className="page-shell">
      <Header />
      <main className="container">
        <Head>
          <title>{`${beteckning} – Partidata`}</title>
          <meta name="description" content={`Öppen data om det politiska partiet “${beteckning}”`} />
          <link rel="icon" href="/img/partidata/mark.svg" type="image/svg+xml" />
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
}

/**
 * RedirectPage
 * Served on a slug the party used to have. The static export cannot answer with
 * a 3xx, so the page refreshes to the current slug and points search engines at
 * it with a canonical link.
 */
function RedirectPage ({ filnamn, beteckning }: PartiRedirect['redirect']) {
  const href = `/parti/${filnamn}/`;

  return (
    <div className="page-shell">
      <Header />
      <main className="container">
        <Head>
          <title>{`${beteckning} – Partidata`}</title>
          <meta httpEquiv="refresh" content={`0; url=${href}`} />
          <meta name="robots" content="noindex" />
          <link rel="canonical" href={href} />
          <link rel="icon" href="/img/partidata/mark.svg" type="image/svg+xml" />
        </Head>

        <p className="mt-6">
          <Link href="/">← Alla partier</Link>
        </p>

        <h1>Partiet har bytt namn</h1>

        <p className="mt-10">
          Partiet heter numera {beteckning}.
        </p>
        <p className="mt-2">
          <Link href={href}>{beteckning}</Link>
        </p>

      </main>
      <Footer />
    </div>
  );
}

const PartiPage: NextPage<Parti | PartiRedirect> = props => (
  isRedirect(props)
    ? <RedirectPage {...props.redirect} />
    : <PartyPage {...props} />
);

export default PartiPage;

export const getStaticPaths: GetStaticPaths<{ filnamn: string }> = async () => {
  return {
    paths: parties.flatMap(party => [party.filnamn, ...(party.tidigare_filnamn ?? [])]
      .map(filnamn => ({ params: { filnamn } }))),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<Parti | PartiRedirect, { filnamn: string }> = async ({ params }) => {
  const filnamn = params?.filnamn;
  if (!filnamn) {
    return { notFound: true };
  }
  if (parties.some(entry => entry.filnamn === filnamn)) {
    const party = (await import(`data/parti/${filnamn}/index.json`)).default as Parti;
    return { props: party };
  }
  const entry = parties.find(party => (party.tidigare_filnamn ?? []).includes(filnamn));
  if (!entry) {
    return { notFound: true };
  }
  return {
    props: { redirect: { filnamn: entry.filnamn, beteckning: entry.beteckning } }
  };
};
