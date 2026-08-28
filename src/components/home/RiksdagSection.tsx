import { useId, useState } from 'react';
import PartyCard from 'src/components/PartyCard';
import type { ParliamentYear } from 'src/server/party-data';
import { ChevronDownIcon } from './icons';

function RiksdagSection ({ years }: { years: ParliamentYear[] }) {
  const [valar, setValar] = useState(years[0]?.valar);
  const fieldId = useId();

  const year = years.find(entry => entry.valar === valar) ?? years[0];
  if (!year) return null;

  return (
    <section className="home-section" aria-labelledby={`${fieldId}-heading`}>
      <div className="home-section__header">
        <h2 id={`${fieldId}-heading`}>Riksdagspartier</h2>
        {years.length > 1 ? (
          <span className="home-select">
            <select aria-label="Valår" value={year.valar} onChange={event => setValar(Number(event.target.value))}>
              {years.map(entry => <option key={entry.valar} value={entry.valar}>Mandat efter valet {entry.valar}</option>)}
            </select>
            <ChevronDownIcon className="home-select__chevron" />
          </span>
        ) : (
          <p>Mandat efter valet {year.valar}</p>
        )}
      </div>

      <ul className="home-grid home-grid--parliament">
        {year.partier.map(party => (
          <li key={party.uuid}>
            {party.filnamn && party.beteckning ? (
              <PartyCard
                beteckning={party.beteckning}
                filnamn={party.filnamn}
                forkortning={party.forkortning}
                symbolSrc={party.symbolSrc}
                symbolFrame={party.symbolFrame}
                variant="large"
                meta={`${party.mandat} mandat`}
              />
            ) : (
              <div className="home-unresolved">
                <span className="home-unresolved__abbreviation">{party.forkortning}</span>
                <span className="home-unresolved__meta">{party.mandat} mandat</span>
                <span className="home-unresolved__note">Förkortningen går inte att knyta till ett enskilt parti i registret.</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default RiksdagSection;
