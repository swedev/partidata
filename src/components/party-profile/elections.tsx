import Image from 'next/image';
import { useState } from 'react';
import parliamentView from 'data/derived/partiprofil/riksdag.json';
import type { PartiDeltagande, PartiProfilValresultat, PartiProfilValresultatPost } from 'src/types';
import { SectionHeader, SourceLine } from './shared';

export type ElectionType = 'R' | 'L' | 'K';
export type CandidateLists = Record<string, ElectionType[]>;

const percentageFormatter = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const chamberComposition = parliamentView.kammare.partier.map(party => ({ label: party.forkortning, seats: party.mandat }));
const parliamentComposition = chamberComposition.toSorted((a, b) => b.seats - a.seats);
const nationalTurnout = parliamentView.valdeltagande.resultat.map(result => ({ year: result.valar, value: result.procent }));

const chamberSeats = (() => {
  const parties = chamberComposition.flatMap(party => Array.from({ length: party.seats }, () => party.label));
  const rows = 9;
  const radii = Array.from({ length: rows }, (_, row) => 0.4 + ((0.97 - 0.4) * row) / (rows - 1));
  const radiusTotal = radii.reduce((total, radius) => total + radius, 0);
  const counts = radii.map(radius => Math.floor((parties.length * radius) / radiusTotal));
  let remaining = parties.length - counts.reduce((total, count) => total + count, 0);
  for (let index = 0; remaining > 0; index += 1, remaining -= 1) counts[rows - 1 - (index % rows)] += 1;

  const points = radii.flatMap((radius, row) => Array.from({ length: counts[row] }, (_, seat) => {
    const position = counts[row] > 1 ? (seat + 0.5) / counts[row] : 0.5;
    const angle = Math.PI * (1 - position);
    return { position, radius, angle };
  })).sort((a, b) => a.position - b.position || a.radius - b.radius);

  return points.map((point, index) => ({
    id: index,
    party: parties[index],
    x: 50 + 50 * point.radius * Math.cos(point.angle),
    y: 100 - 100 * point.radius * Math.sin(point.angle),
  }));
})();

function ElectionChart ({ results, selected, onSelect }: { results: PartiProfilValresultatPost[]; selected: number; onSelect: (index: number) => void }) {
  const highestResult = Math.max(4, ...results.map(result => result.rostandel));
  const maximum = Math.max(8, Math.ceil((highestResult * 1.15) / 2) * 2);
  const thresholdPosition = (4 / maximum) * 100;
  const points = results.map((result, index) => ({
    x: 6.25 + (index / Math.max(1, results.length - 1)) * 87.5,
    y: 100 - (result.rostandel / maximum) * 100,
  }));
  const line = points.map(point => `${point.x},${point.y}`).join(' ');
  const area = `${line} ${points.at(-1)?.x},100 ${points[0]?.x},100`;

  return (
    <div className="profile-election-chart">
      <div className="profile-chart-threshold"><span />4 % riksdagsspärr</div>
      <div className="profile-election-plot">
        <span className="profile-election-plot__threshold" style={{ bottom: `${thresholdPosition}%` }} aria-hidden="true" />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polygon points={area} />
          <polyline points={line} />
        </svg>
        {results.map((result, index) => (
          <button type="button" key={result.valar} onClick={() => onSelect(index)} aria-pressed={selected === index} aria-label={`Riksdagsvalet ${result.valar}: ${percentageFormatter.format(result.rostandel)} procent`}>
            <span className="profile-election-plot__value" style={{ bottom: `${(result.rostandel / maximum) * 100}%` }}>{percentageFormatter.format(result.rostandel)}</span>
            <span className="profile-election-plot__point" style={{ bottom: `${(result.rostandel / maximum) * 100}%` }} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="profile-election-mandates">
        {results.map((result, index) => (
          <button type="button" key={result.valar} onClick={() => onSelect(index)} className={selected === index ? 'is-selected' : undefined}>
            <strong>{result.mandat}</strong><span>{result.valar}</span>
          </button>
        ))}
      </div>
      <p className="profile-source">Mandat per val · klicka på en punkt för detaljer</p>
    </div>
  );
}

function ChamberDiagram ({ mandates, partyLabel }: { mandates: number; partyLabel?: string }) {
  return (
    <div className="profile-chamber" role="img" aria-label={`${mandates} av riksdagens 349 mandat`}>
      {chamberSeats.map(seat => <span key={seat.id} style={{ left: `${seat.x}%`, top: `${seat.y}%`, background: seat.party === partyLabel ? '#f1eee4' : '#2c4a7c' }} />)}
    </div>
  );
}

export function ElectionResultsSection ({ results, partyLabel }: { results: PartiProfilValresultat; partyLabel?: string }) {
  const [selected, setSelected] = useState(results.resultat.length - 1);
  const result = results.resultat[selected];
  const latestResult = results.resultat.at(-1);
  const previousResult = selected > 0 ? results.resultat[selected - 1] : undefined;
  if (!result) return null;

  return (
    <section className="profile-results" aria-labelledby="results-heading" id="resultat">
      <div className="profile-shell">
        <SectionHeader
          id="results-heading"
          title="Vad partiet har fått i val"
          subtitle={`Riksdagsval ${results.resultat[0]?.valar}–${latestResult?.valar}, andel av giltiga röster i hela riket`}
          aside={<div className="profile-authority-brand"><Image src="/img/kallor/valmyndigheten.png" alt="" width={38} height={38} /><div><strong>Valmyndigheten</strong><small>valresultat · slutlig rösträkning</small></div></div>}
        />
        <div className="profile-results__top">
          <div className="profile-results__intro"><p>Diagrammet visar partiets andel av de giltiga rösterna och antal mandat i varje riksdagsval.</p><SourceLine>Valmyndigheten · slutlig rösträkning</SourceLine></div>
          <div>
            <ElectionChart results={results.resultat} selected={selected} onSelect={setSelected} />
            <div className="profile-selected-result">
              <header><strong>Riksdagsvalet {result.valar}</strong><span>Valmyndigheten · slutligt resultat</span></header>
              <dl>
                <div><dt>Andel giltiga röster</dt><dd>{percentageFormatter.format(result.rostandel)} %</dd></div>
                <div><dt>Röster</dt><dd>{result.roster !== undefined ? new Intl.NumberFormat('sv-SE').format(result.roster) : '—'}</dd></div>
                <div><dt>Mandat</dt><dd>{result.mandat}</dd></div>
                <div><dt>Mot föregående val</dt><dd>{previousResult ? `${result.rostandel - previousResult.rostandel > 0 ? '+' : ''}${percentageFormatter.format(result.rostandel - previousResult.rostandel)}` : '—'}</dd></div>
              </dl>
            </div>
          </div>
        </div>
        {latestResult && <div className="profile-results__bottom">
          <div>
            <h3>Partiets {latestResult.mandat} platser i kammaren</h3>
            <ChamberDiagram mandates={latestResult.mandat} partyLabel={partyLabel} />
            <SourceLine source={parliamentView.kammare.kalla}>349 mandat efter valet {parliamentView.kammare.valar} · </SourceLine>
          </div>
          <div className="profile-composition">
            <h3>Riksdagens sammansättning {parliamentView.kammare.valar}</h3>
            <ul>{parliamentComposition.map(party => <li key={party.label} className={party.label === partyLabel ? 'is-current' : undefined}><span>{party.label}</span><i><b style={{ width: `${(party.seats / parliamentComposition[0].seats) * 100}%` }} /></i><strong>{party.seats}</strong></li>)}</ul>
          </div>
        </div>}
        <div className="profile-results__sources">{results.kallor.map(source => <SourceLine source={source} key={source.url} />)}</div>
      </div>
    </section>
  );
}

export function TurnoutSection () {
  const plotPoints = nationalTurnout.map((result, index) => ({
    ...result,
    x: (index / (nationalTurnout.length - 1)) * 100,
    y: ((90 - result.value) / 12) * 100,
  }));
  const points = plotPoints.map(point => `${point.x},${point.y}`).join(' ');

  return (
    <section className="profile-shell profile-turnout" aria-labelledby="turnout-heading" id="deltagande">
      <div className="profile-turnout__intro">
        <h2 id="turnout-heading">Valdeltagande som jämförelse</h2>
        <p>Valdeltagandet är en egenskap hos valet, inte hos partiet. Det visas för att kunna läsa röstetalen mot antalet röstande.</p>
        <div className="profile-source-brand profile-source-brand--small"><span className="profile-source-brand__scb">SCB</span><div><small>Historisk valstatistik · hämtat {parliamentView.senast_uppdaterad}</small></div></div>
      </div>
      <div className="profile-turnout__chart">
        <div>
          {[90, 85, 80].map(value => <span key={value} style={{ top: `${((90 - value) / 12) * 100}%` }}>{value} %</span>)}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Valdeltagande i riksdagsval 1994 till 2022"><polyline points={points} /></svg>
          <ul className="profile-turnout__values">
            {plotPoints.map((point, index) => <li className={index === 0 ? 'is-first' : index === plotPoints.length - 1 ? 'is-last' : undefined} key={point.year} style={{ left: `${point.x}%`, top: `${point.y}%` }} aria-label={`${point.year}: ${point.value.toFixed(2).replace(/0$/, '').replace('.', ',')} procent`}>{point.value.toFixed(2).replace(/0$/, '').replace('.', ',')} %</li>)}
          </ul>
        </div>
        <ol>{nationalTurnout.map(result => <li key={result.year}>{result.year}</li>)}</ol>
        {parliamentView.valdeltagande.kallor.map(source => <SourceLine source={source} key={`${source.url}-${source.hamtad}`} />)}
      </div>
    </section>
  );
}

export function BallotSection ({ participationYears, candidateLists, slug, partyName }: { participationYears: Array<[string, PartiDeltagande]>; candidateLists: CandidateLists; slug: string; partyName: string }) {
  const latest = participationYears[0];
  const participation = latest[1];
  const labels = { R: 'Riksdagsval', L: 'Regionval', K: 'Kommunval' };
  const ballotClasses = { R: 'profile-ballot-card--national', L: 'profile-ballot-card--region', K: 'profile-ballot-card--municipal' };
  const applicableElectionTypes = ([
    participation.riksdag ? 'R' : undefined,
    participation.region.length > 0 ? 'L' : undefined,
    participation.kommun.length > 0 ? 'K' : undefined,
  ] as const).filter((type): type is ElectionType => type !== undefined);
  const [electionType, setElectionType] = useState<ElectionType>(applicableElectionTypes[0]);
  const hasCandidateList = candidateLists[latest[0]]?.includes(electionType) ?? false;
  const historicalCandidateYear = Object.keys(candidateLists).toSorted((a, b) => Number(b) - Number(a)).find(year => candidateLists[year].includes(electionType));
  const linkedCandidateYear = hasCandidateList ? latest[0] : historicalCandidateYear;
  const candidateListHref = linkedCandidateYear
    ? `https://github.com/swedev/partidata/blob/main/data/val/${linkedCandidateYear}/kandidatlistor/${slug}.json`
    : `https://github.com/swedev/partidata/tree/main/data/val/${latest[0]}/kandidatlistor`;
  const candidateListLabel = hasCandidateList
    ? 'Öppna kandidatlistan'
    : historicalCandidateYear
      ? `Öppna kandidatlistan ${historicalCandidateYear}`
      : 'Komplettera kandidatlistor';

  return (
    <section className="profile-shell profile-section" aria-labelledby="ballot-heading" id="rosta">
      <SectionHeader id="ballot-heading" title="Var du kan rösta på partiet" subtitle={`Anmälda valsedlar och kandidater i valen ${latest[0]}`} aside={<div className="profile-authority-brand profile-authority-brand--light"><Image src="/img/kallor/valmyndigheten.png" alt="" width={38} height={38} /><div><strong>Valmyndigheten</strong><small>valsedlar och anmält deltagande</small></div></div>} />
      <div className="profile-ballot-tabs" role="tablist" aria-label="Valtyp">
        {applicableElectionTypes.map(type => <button type="button" role="tab" aria-selected={electionType === type} key={type} onClick={() => setElectionType(type)}>{labels[type]}</button>)}
      </div>
      <div className="profile-ballot-layout">
        <article className={`profile-ballot-card ${ballotClasses[electionType]}`}>
          <p className="profile-eyebrow">Valsedel · {labels[electionType]} {latest[0]}</p>
          <p>Importerad kandidatlista</p>
          <h3>{partyName}</h3>
          {hasCandidateList
            ? <p>Kandidatlistan finns i Partidatas data och kan visas här.</p>
            : <div className="profile-ballot-empty"><strong>Ingen kandidatlista inläst för {latest[0]}</strong><p>Partiet har anmält deltagande i {labels[electionType].toLowerCase()}, men kandidatnamn och listnummer saknas ännu i Partidata.</p></div>}
          <p className="profile-ballot-card__note">När listan finns återges kandidaterna i samma ordning och med samma yrkes- och ortsangivelser som hos Valmyndigheten.</p>
        </article>

        <div className="profile-ballot-map">
          <div className="profile-ballot-map__tabs"><span className="is-selected">Valsedlar</span><span>Mandat</span></div>
          <svg viewBox="0 0 290 660" role="img" aria-label={`Karta över de ${participation.kommun.length} kommuner där partiet anmält deltagande`}>
            <image href="/img/kallor/sverige-kommuner.svg" width="290" height="660" />
            {participation.kommun.map(code => <use href={`/img/kallor/sverige-kommuner.svg#${code}`} key={code} />)}
          </svg>
          <ul><li><span />Anmält deltagande</li><li><span />Ingen kandidatlista inläst {latest[0]}</li></ul>
          <SourceLine>Kommunindelning · SCB</SourceLine>
        </div>

        <aside className="profile-ballot-summary">
          <p>Valsedlar ska visas som de är beställda hos Valmyndigheten: samma ordning, samma yrkes- och ortsangivelser och samma listnummer.</p>
          <p>Partiet har anmält deltagande i</p>
          <dl>
            <div><dt>Riksdagsval</dt><dd>{participation.riksdag ? 'Ja' : 'Nej'}</dd></div>
            <div><dt>Regioner</dt><dd>{participation.region.length}</dd></div>
            <div><dt>Kommuner</dt><dd>{participation.kommun.length} av 290</dd></div>
          </dl>
          <SourceLine><a href="https://data.val.se/">Valmyndigheten</a> · anmält deltagande {latest[0]}</SourceLine>
          <a href={candidateListHref}>{candidateListLabel} på GitHub <span aria-hidden="true">→</span></a>
        </aside>
      </div>
    </section>
  );
}
