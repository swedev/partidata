import type { GetServerSideProps, NextPage } from 'next';
import Head from 'next/head';
import { Fragment } from 'react';

import { FIELD_DOCS } from 'src/components/data/fields';
import Footer from 'src/components/Footer';
import Header from 'src/components/Header';
import { partyData } from 'src/server/party-data';
import type { DataCatalog } from 'src/server/party-data';

const version = process.env.PARTIDATA_VERSION;
const ref = version ? `v${version}` : 'main';
const repo = 'https://github.com/swedev/partidata';

/** Backtick-delimited spans in the copy are code, as they are in the README. */
function Kod ({ text }: { text: string }) {
  return (
    <>
      {text.split('`').map((part, index) => (
        index % 2 === 1 ? <code key={index}>{part}</code> : <Fragment key={index}>{part}</Fragment>
      ))}
    </>
  );
}

function AddressRow ({ adress, innehall }: { adress: string; innehall: string }) {
  return (
    <tr>
      <td><a href={adress}><code>{adress}</code></a></td>
      <td>{innehall}</td>
    </tr>
  );
}

const DataPage: NextPage<DataCatalog> = ({ antalPartier, exempel, valar }) => {
  const exempelAdress = `/data/parti/${encodeURIComponent(exempel.filnamn)}/index.json`;
  const senasteForst = [...valar].reverse();

  return (
    <div className="page-shell">
      <Head>
        <title>Data – Partidata</title>
        <meta name="description" content="Partidatas data som JSON: adresser, fält, källor, versionering och licens." />
        <link rel="icon" href="/img/partidata/mark.svg" type="image/svg+xml" />
        <link rel="canonical" href="https://www.partidata.se/data/" />
      </Head>

      <Header current="data" />

      <main className="container data-page">
        <div className="home-intro">
          <h1>Datan som JSON</h1>
          <p className="description">
            Partidata serverar samma filer som sajten själv läser. Adressen är en enda regel:{' '}
            <code>https://www.partidata.se/data/&lt;sökväg&gt;</code> är filen <code>data/&lt;sökväg&gt;</code> i
            repot, byte för byte. Nedan står adresserna, fälten, huvudena, versioneringen och villkoren.
          </p>
        </div>

        <section id="adresser" aria-labelledby="adresser-heading">
          <h2 id="adresser-heading">Adresser</h2>
          <p className="description">
            Registret håller {antalPartier} partier. Ett parti som har bytt <code>filnamn</code> svarar 308 på sin
            gamla adress och pekar på den nuvarande, precis som partisidorna gör.
          </p>

          <table>
            <caption>Register, partier och områdeskoder</caption>
            <thead>
              <tr><th scope="col">Adress</th><th scope="col">Innehåll</th></tr>
            </thead>
            <tbody>
              <AddressRow adress="/data/derived/parti.json" innehall={`Registret: ${antalPartier} partier med uuid, beteckning och filnamn.`} />
              <AddressRow adress={exempelAdress} innehall={`Ett partis registerdata — här ${exempel.beteckning}. Byt ut filnamnet mot partiets filnamn ur registret.`} />
              <AddressRow adress="/data/derived/riksdag.json" innehall="Härledningen startsidan bygger på: den sittande kammaren, valdeltagandet och de största partierna utanför riksdagen." />
              <AddressRow adress="/data/regioner/index.json" innehall="SCB:s läns- och kommunkoder, som deltagandet och partideltagandefilerna refererar till." />
            </tbody>
          </table>

          <table>
            <caption>Valår</caption>
            <thead>
              <tr><th scope="col">Adress</th><th scope="col">Innehåll</th></tr>
            </thead>
            <tbody>
              {senasteForst.map(year => (
                <Fragment key={year.valar}>
                  {year.partideltagande.map(fil => (
                    <AddressRow
                      key={fil}
                      adress={`/data/val/${year.valar}/partideltagande/${fil}.json`}
                      innehall={`Partideltagande ${year.valar}: ${fil}.json`}
                    />
                  ))}
                  {year.valresultat && (
                    <AddressRow
                      adress={`/data/val/${year.valar}/valresultat/riksdag.json`}
                      innehall={`Slutligt riksdagsresultat ${year.valar}.`}
                    />
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </section>

        <section id="falt" aria-labelledby="falt-heading">
          <h2 id="falt-heading">Fält</h2>
          <p className="description">
            Fälten nedan är det en läsare kan räkna med. Ett fält som står som valfritt kan saknas i en enskild post.
            Nästlade fält skrivs med punktnotation, och <code>[]</code> markerar att föräldern är en lista.
          </p>
          <p className="description">
            Identiteterna hänger ihop på tre ställen: <code>uuid</code> i registret är samma <code>uuid</code> som i
            partifilen och samma <code>parti_uuid</code> som i valresultaten; <code>kod</code> är Valmyndighetens{' '}
            <code>PARTIKOD</code> och binder partifilen till partideltagandet; läns- och kommunkoderna är SCB:s och
            slås upp i <code>regioner/index.json</code>.
          </p>
          <p className="description">
            2018 års filer ligger kvar som de samlades in och avviker: <code>landsting.json</code> i stället för{' '}
            <code>region.json</code>, inget <code>partier.json</code>, 208 av 290 kommuner, inga{' '}
            <code>grunder</code>, och region- och kommunfilerna listar bara partier som inte står i{' '}
            <code>riksdag.json</code>.
          </p>

          {FIELD_DOCS.map(resource => (
            <div key={resource.id} className="data-resource">
              <h3 id={`falt-${resource.id}`}>{resource.rubrik}</h3>
              <p>
                {resource.form}{' '}
                <a href={`${repo}/blob/${ref}/README.md#${resource.readme}`}>Bakgrunden står i README</a>.
              </p>
              {resource.id === 'party' && (
                <p>
                  Fält som inte står i tabellen är handlagda extrafält — snake_case, valfritt JSON-värde — och är lika
                  publika som de övriga.
                </p>
              )}
              <table>
                <thead>
                  <tr>
                    <th scope="col">Fält</th>
                    <th scope="col">Typ</th>
                    <th scope="col">Obligatoriskt</th>
                    <th scope="col">Beskrivning</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.falt.map(falt => (
                    <tr key={falt.namn}>
                      <td><code>{falt.namn}</code></td>
                      <td>{falt.typ}</td>
                      <td>{falt.obligatoriskt ? 'ja' : 'nej'}</td>
                      <td><Kod text={falt.beskrivning} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>

        <section id="hamta" aria-labelledby="hamta-heading">
          <h2 id="hamta-heading">Hämta</h2>
          <pre>{`curl -i https://www.partidata.se${exempelAdress}`}</pre>
          <pre>{`fetch('https://www.partidata.se${exempelAdress}')\n  .then(response => response.json())\n  .then(parti => console.log(parti.beteckning));`}</pre>

          <h3>Huvuden</h3>
          <ul>
            <li><code>Cache-Control: public, max-age=3600</code> — datan ändras bara när en ny version driftsätts, så ett svar är som mest en timme gammalt.</li>
            <li><code>ETag</code> — <code>W/</code> följt av filens SHA-256. Etaggen är svag därför att samma fil levereras både komprimerad och okomprimerad; det är samma representation, och det är precis vad en svag etagg säger. Skicka tillbaka den oförändrad i <code>If-None-Match</code> och få 304 utan kropp när filen är densamma.</li>
            <li><code>Vary: Accept-Encoding</code> — kroppen varierar med komprimeringen.</li>
            <li><code>X-Partidata-Version</code> — den version som svarade, samma nummer som i sidfoten och i <code>/api/health</code>.</li>
            <li><code>Access-Control-Allow-Origin: *</code> på varje svar, och <code>Access-Control-Expose-Headers: ETag, X-Partidata-Version</code>, så att en webbläsarklient kan läsa båda.</li>
          </ul>

          <h3>Statuskoder</h3>
          <ul>
            <li><strong>200</strong> — filens byte, som <code>application/json; charset=utf-8</code>.</li>
            <li><strong>304</strong> — <code>If-None-Match</code> matchar; ingen kropp.</li>
            <li><strong>308</strong> — adressen använder ett tidigare <code>filnamn</code>; följ <code>Location</code>.</li>
            <li><strong>404</strong> — adressen betecknar ingen publicerad resurs. Kroppen är <code>{'{"fel":"Okänd resurs"}'}</code>.</li>
            <li><strong>405</strong> — bara <code>GET</code>, <code>HEAD</code> och <code>OPTIONS</code> är tillåtna; svaret bär <code>Allow</code>.</li>
            <li><strong>204</strong> — svaret på <code>OPTIONS</code>, med de tillåtna metoderna.</li>
          </ul>
        </section>

        <section id="versionering" aria-labelledby="versionering-heading">
          <h2 id="versionering-heading">Versionering</h2>
          <ul>
            <li>Adresser och fältnamn är stabila. Nya fält kan tillkomma utan förvarning — en läsare ska ignorera fält den inte känner igen.</li>
            <li>
              Datan ändras bara när en ny version driftsätts. Versionen står i <code>X-Partidata-Version</code>, i
              sidfoten och i <code>/api/health</code>, och samma filer finns på{' '}
              <a href={`${repo}/tree/${ref}/data/`}>GitHub under taggen</a>.
            </li>
            <li>
              Ett fält eller en adress som tas bort eller döps om görs i en version som noteras här, och en flyttad
              adress vidarebefordras med 308 när det går — som ett parti som har bytt <code>filnamn</code>.
            </li>
          </ul>
        </section>

        <section id="licens" aria-labelledby="licens-heading">
          <h2 id="licens-heading">Licens och villkor</h2>
          <p className="description">
            Partidatas egen sammanställning — strukturen, <code>uuid</code>, <code>filnamn</code>, de härledda fälten
            och allt under <code>derived/</code> — är{' '}
            <a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0 1.0</a>. Uppgifterna kommer från källor
            med egna villkor, och <code>kalla</code>, <code>kallurl</code> och <code>kallor</code> i filerna anger
            källan per post. Villkoren nedan är kontrollerade 2026-08-30.
          </p>
          <ul>
            <li>
              <strong>Valmyndigheten</strong> — partibeteckningar, deltagande och valresultat. All data är fri att
              använda, förutsatt att du anger Valmyndigheten som källa.{' '}
              <a href="https://www.val.se/valresultat-och-statistik/statistik-och-data/om-var-oppna-data">Om Valmyndighetens öppna data</a>
            </li>
            <li>
              <strong>SCB</strong> — läns- och kommunkoder samt valdeltagande. CC0, utan krav på källhänvisning, men
              SCB rekommenderar ändå &quot;Källa: SCB&quot;.{' '}
              <a href="https://www.scb.se/vara-tjanster/oppna-data/">SCB:s öppna data</a>
            </li>
            <li>
              <strong>Wikidata</strong> — <code>wikidata.grundat</code>. CC0.{' '}
              <a href="https://www.wikidata.org/wiki/Wikidata:Licensing">Wikidatas licensvillkor</a>
            </li>
          </ul>
          <p className="description">
            Partisymbolerna serveras inte under <code>/data/</code>. De kommer från Valmyndighetens symbolpaket och
            kan vara varumärkesskyddade — villkoren för att använda dem är partiets, inte Partidatas.
          </p>
        </section>

        <section id="utanfor" aria-labelledby="utanfor-heading">
          <h2 id="utanfor-heading">Det som inte finns här</h2>
          <ul>
            <li>
              <strong>Kandidatlistor</strong> — <code>val/&lt;år&gt;/kandidatlistor/</code> innehåller personuppgifter
              och serveras inte. Hur de ska hanteras avgörs i{' '}
              <a href={`${repo}/issues/33`}>issue 33</a>.
            </li>
            <li>
              <strong>Partisymboler</strong> — PNG-filerna ligger i partiets katalog och serveras på{' '}
              <code>/partisymbol/&lt;filnamn&gt;/&lt;partisymbol.filnamn&gt;</code>, inte under <code>/data/</code>.
            </li>
            <li>
              <strong>Profildata</strong> — <code>parti/&lt;filnamn&gt;/profil.json</code> bär utdrag ur Wikipedia
              under CC BY-SA 4.0 och nyhetsrubriker, och finns bara på{' '}
              <a href={`${repo}/tree/${ref}/data/parti`}>GitHub</a>.
            </li>
            <li>
              <strong>Kopplingstabeller</strong> — <code>parti/kodbyten.json</code>,{' '}
              <code>valresultat/riksdag-partikopplingar.json</code> och{' '}
              <code>val/&lt;år&gt;/valresultat/scb-tabeller.json</code> är arbetsmaterial för importen och finns på{' '}
              <a href={`${repo}/tree/${ref}/data`}>GitHub</a>.
            </li>
          </ul>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default DataPage;

export const getServerSideProps: GetServerSideProps<DataCatalog> = async () => ({
  props: await partyData.readDataCatalog(),
});
