import PartyCard from 'src/components/PartyCard';
import type { HomeParty } from 'src/server/party-data';
import { ChevronDownIcon, SearchXIcon } from './icons';
import type { SortOrder } from './sorting';
import { isSortOrder, sortLabels, sortOrders } from './sorting';
import { ballots, cardSub, levelLabels, noBallotLabel, partyLabel, queryEcho } from './summary';

const numberFormatter = new Intl.NumberFormat('sv-SE');

/**
 * The elections a party stands in, each on the colour of the ballot paper it is
 * voted with: yellow for parliament, blue for the region and white for the
 * municipality. The regional and municipal ballots carry how many areas they
 * cover.
 */
function BallotBadges ({ party, valar }: { party: HomeParty; valar: string }) {
  const ballotList = ballots(party, valar);
  if (ballotList.length === 0) return <>{noBallotLabel}</>;

  return (
    <span className="party-card__ballots">
      {ballotList.map(ballot => (
        <span key={ballot.valtyp} className={`party-card__ballot party-card__ballot--${ballot.valtyp}`}>
          {levelLabels[ballot.valtyp]}
          {ballot.antal !== undefined && <span className="party-card__ballot-count">{numberFormatter.format(ballot.antal)}</span>}
        </span>
      ))}
    </span>
  );
}

export interface PartyResultsProps {
  matches: HomeParty[];
  total: number;
  visible: number;
  query: string;
  valar: string;
  order: SortOrder;
  onOrderChange: (order: SortOrder) => void;
  onShowMore: () => void;
  onReset: () => void;
}

function PartyResults ({ matches, total, visible, query, valar, order, onOrderChange, onShowMore, onReset }: PartyResultsProps) {
  const shown = matches.slice(0, visible);
  const remaining = matches.length - shown.length;
  const echo = queryEcho(query);

  return (
    <section className="home-section" aria-labelledby="alla-partier">
      <div className="home-section__header">
        <h2 id="alla-partier">
          Alla partier <span className="home-section__count">{numberFormatter.format(matches.length)} av {numberFormatter.format(total)}</span>
        </h2>
        <span className="home-select">
          <select
            aria-label="Sortering"
            value={order}
            onChange={event => isSortOrder(event.target.value) && onOrderChange(event.target.value)}
          >
            {sortOrders.map(value => <option key={value} value={value}>Sorterat {sortLabels[value]}</option>)}
          </select>
          <ChevronDownIcon className="home-select__chevron" />
        </span>
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
                  beteckning={partyLabel(party)}
                  filnamn={party.filnamn}
                  forkortning={party.forkortning}
                  symbolSrc={party.symbolSrc}
                  symbolFrame={party.symbolFrame}
                  variant="small"
                  meta={<BallotBadges party={party} valar={valar} />}
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
