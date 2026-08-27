import PartyCard from 'src/components/PartyCard';
import type { OutsideParliamentData } from 'src/server/party-data';

const percentageFormatter = new Intl.NumberFormat('sv-SE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function OutsideParliamentSection ({ data }: { data: OutsideParliamentData }) {
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
    </section>
  );
}

export default OutsideParliamentSection;
