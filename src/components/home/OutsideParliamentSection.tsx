import PartyCard from 'src/components/PartyCard';
import type { OutsideParliamentData } from 'src/server/party-data';

const percentageFormatter = new Intl.NumberFormat('sv-SE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function OutsideParliamentSection ({ data }: { data: OutsideParliamentData }) {
  const sources = [...new Map(data.partier.map(party => [
    `${party.kalla.url}\0${party.valar}`,
    { ...party.kalla, valar: party.valar },
  ])).values()].toSorted((left, right) => left.valar - right.valar);

  return (
    <section className="home-section" aria-labelledby="outside-parliament-heading">
      <div className="home-section__header">
        <h2 id="outside-parliament-heading">Största partierna utanför riksdagen</h2>
        <p>Bästa resultat i riksdagsval {data.period.fran}–{data.period.till}</p>
      </div>

      <ul className="home-grid home-grid--outside">
        {data.partier.map(party => (
          <li key={party.uuid}>
            <PartyCard
              beteckning={party.beteckning}
              filnamn={party.filnamn}
              forkortning={party.forkortning}
              symbolSrc={party.symbolSrc}
              variant="medium"
              meta={`${percentageFormatter.format(party.rostandel)} %`}
              sub={`Riksdagsvalet ${party.valar}`}
            />
          </li>
        ))}
      </ul>

      <p className="home-facts home-facts--sources">
        <span>Endast individuellt särredovisade resultat med entydig partiidentitet.</span>
        <span>Källor: {sources.map((source, index) => (
          <span key={`${source.url}-${source.valar}`}>
            {index > 0 && ', '}
            <a href={source.url}>{source.namn} {source.valar}</a>
          </span>
        ))}</span>
      </p>
    </section>
  );
}

export default OutsideParliamentSection;
