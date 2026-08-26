import { useId, useState } from 'react';
import PartyCard from 'src/components/PartyCard';
import type { ParliamentYear } from 'src/server/party-data';

function RiksdagSection ({ years }: { years: ParliamentYear[] }) {
  const [valar, setValar] = useState(years[0]?.valar);
  const fieldId = useId();

  const year = years.find(entry => entry.valar === valar) ?? years[0];
  if (!year) return null;

  return (
    <section className="home-section" aria-labelledby={`${fieldId}-heading`}>
      <header className="home-section__header">
        <div>
          <h2 id={`${fieldId}-heading`}>Partier i riksdagen</h2>
          <p>Mandatfördelningen efter riksdagsvalet {year.valar}.</p>
        </div>
        {years.length > 1 && (
          <div className="home-search__field">
            <label htmlFor={`${fieldId}-valar`}>Valår</label>
            <select id={`${fieldId}-valar`} value={year.valar} onChange={event => setValar(Number(event.target.value))}>
              {years.map(entry => <option key={entry.valar} value={entry.valar}>{entry.valar}</option>)}
            </select>
          </div>
        )}
      </header>

      <ul className="home-grid home-grid--parliament">
        {year.partier.map(party => (
          <li key={party.forkortning}>
            {party.filnamn && party.beteckning ? (
              <PartyCard
                beteckning={party.beteckning}
                filnamn={party.filnamn}
                forkortning={party.forkortning}
                symbolSrc={party.symbolSrc}
                variant="medium"
                primaryMeta={`${party.mandat} av 349 mandat`}
              />
            ) : (
              <div className="home-unresolved">
                <span className="home-unresolved__abbreviation">{party.forkortning}</span>
                <span>{party.mandat} av 349 mandat</span>
                <span className="home-unresolved__note">Förkortningen går inte att knyta till ett enskilt parti i registret.</span>
              </div>
            )}
          </li>
        ))}
      </ul>

      <p className="home-source">
        Källa: <a href={year.kalla.url}>{year.kalla.namn}</a> · valresultat {year.valar} · hämtat {year.kalla.hamtad}
      </p>
    </section>
  );
}

export default RiksdagSection;
