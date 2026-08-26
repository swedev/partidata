import PartyCard from 'src/components/PartyCard';
import type { HomeParty } from 'src/server/party-data';
import { ChevronDownIcon, SearchXIcon } from './icons';
import { cardMeta, cardSub, queryEcho } from './summary';

const numberFormatter = new Intl.NumberFormat('sv-SE');

export interface PartyResultsProps {
  matches: HomeParty[];
  total: number;
  visible: number;
  query: string;
  onShowMore: () => void;
  onReset: () => void;
}

function PartyResults ({ matches, total, visible, query, onShowMore, onReset }: PartyResultsProps) {
  const shown = matches.slice(0, visible);
  const remaining = matches.length - shown.length;
  const echo = queryEcho(query);

  return (
    <section className="home-section" aria-labelledby="alla-partier">
      <div className="home-section__header">
        <h2 id="alla-partier">
          Alla partier <span className="home-section__count">{numberFormatter.format(matches.length)}</span>
        </h2>
        <p>Sorterat A–Ö</p>
      </div>

      <p className="sr-only" aria-live="polite">
        {`${numberFormatter.format(matches.length)} av ${numberFormatter.format(total)} partier matchar, visar ${numberFormatter.format(shown.length)}`}
      </p>

      {shown.length > 0 ? (
        <>
          <ul className="home-grid">
            {shown.map(party => (
              <li key={party.filnamn}>
                <PartyCard
                  beteckning={party.beteckning}
                  filnamn={party.filnamn}
                  forkortning={party.forkortning}
                  symbolSrc={party.symbolSrc}
                  variant="small"
                  meta={cardMeta(party)}
                  sub={cardSub(party)}
                />
              </li>
            ))}
          </ul>

          {remaining > 0 && (
            <div className="home-more">
              <button type="button" className="home-pill" onClick={onShowMore}>
                <ChevronDownIcon className="home-pill__icon" />
                Visa fler partier ({numberFormatter.format(remaining)} kvar)
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="home-empty">
          <SearchXIcon className="home-empty__icon" />
          <h3>Inga partier matchar {echo}</h3>
          <p>Kontrollera stavningen, prova en förkortning eller bredda filtren.</p>
          <button type="button" className="home-pill home-pill--filled" onClick={onReset}>
            Rensa sökning och filter
          </button>
        </div>
      )}
    </section>
  );
}

export default PartyResults;
