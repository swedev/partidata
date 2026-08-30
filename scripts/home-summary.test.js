const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ballots,
  cardSub,
  participationYears,
  partyLabel,
  queryEcho
} = require('../src/components/home/summary.ts');

function party (deltagande) {
  return { uuid: 'u', beteckning: 'Testpartiet', filnamn: 'testpartiet', deltagande };
}

const ALL_LEVELS = party({
  2018: { riksdag: true, regionLan: [], kommunKoder: [] },
  2022: { riksdag: false, regionLan: ['01'], kommunKoder: ['1214', '1230', '1231', '1233'] }
});
const NOTHING = party({});

test('the ballots collapse every year the party stood in', () => {
  assert.deepEqual(ballots(ALL_LEVELS), [
    { valtyp: 'riksdag' },
    { valtyp: 'region', antal: 1 },
    { valtyp: 'kommun', antal: 4 }
  ]);
  assert.deepEqual(ballots(party({ 2022: { riksdag: true, regionLan: [], kommunKoder: [] } })), [{ valtyp: 'riksdag' }]);
  assert.deepEqual(ballots(NOTHING), []);
});

test('a chosen year is the only one the ballots count', () => {
  assert.deepEqual(ballots(ALL_LEVELS, '2018'), [{ valtyp: 'riksdag' }]);
  assert.deepEqual(ballots(ALL_LEVELS, '2022'), [
    { valtyp: 'region', antal: 1 },
    { valtyp: 'kommun', antal: 4 }
  ]);
  assert.deepEqual(ballots(ALL_LEVELS, '2026'), [], 'ett år partiet inte deltog i räknar ingenting');
});

test('the widest year sets the count when no year is chosen', () => {
  const growing = party({
    2018: { riksdag: false, regionLan: ['01'], kommunKoder: ['0114', '0115'] },
    2022: { riksdag: false, regionLan: ['01', '12'], kommunKoder: ['0114', '0115', '0117', '0120', '0123', '0125', '0126', '0127', '0128'] }
  });
  assert.deepEqual(ballots(growing), [
    { valtyp: 'region', antal: 2 },
    { valtyp: 'kommun', antal: 9 }
  ]);
});

test('participation years are listed newest first', () => {
  assert.deepEqual(participationYears(ALL_LEVELS), ['2022', '2018']);
  assert.deepEqual(participationYears(NOTHING), []);
});

test('the card footer never renders empty', () => {
  assert.deepEqual(ballots(NOTHING), [], 'ett parti utan valsedlar får ingen bricka');
  assert.equal(cardSub(ALL_LEVELS), 'Valår 2022, 2018');
  assert.equal(cardSub(NOTHING), undefined);
});

test('equal party names get an area suffix only when one is available', () => {
  assert.equal(partyLabel({ beteckning: 'Kommunens Väl', duplicateName: true, omrade: 'Hylte' }), 'Kommunens Väl (Hylte)');
  assert.equal(partyLabel({ beteckning: 'Kommunens Väl', duplicateName: true }), 'Kommunens Väl');
  assert.equal(partyLabel({ beteckning: 'Eget namn', duplicateName: false, omrade: 'Hylte' }), 'Eget namn');
});

test('the empty state echoes the search term, or the filters', () => {
  assert.equal(queryEcho('  moderat '), '”moderat”');
  assert.equal(queryEcho(''), 'dina filter');
  assert.equal(queryEcho('   '), 'dina filter');
});
