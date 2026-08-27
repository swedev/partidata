const assert = require('node:assert/strict');
const test = require('node:test');

const {
  cardMeta,
  cardSub,
  participationLevels,
  participationYears,
  partyLabel,
  queryEcho,
  toggleKind
} = require('../src/components/home/summary.ts');

function party (deltagande) {
  return { uuid: 'u', beteckning: 'Testpartiet', filnamn: 'testpartiet', deltagande };
}

const ALL_LEVELS = party({
  2018: { riksdag: true, regionLan: [], kommunLan: [] },
  2022: { riksdag: false, regionLan: ['01'], kommunLan: ['12'] }
});
const NOTHING = party({});

test('participation levels collapse every year the party stood in', () => {
  assert.deepEqual(participationLevels(ALL_LEVELS), ['Riksdag', 'Region', 'Kommun']);
  assert.deepEqual(participationLevels(party({ 2022: { riksdag: false, regionLan: [], kommunLan: ['12'] } })), ['Kommun']);
  assert.deepEqual(participationLevels(party({ 2022: { riksdag: true, regionLan: [], kommunLan: [] } })), ['Riksdag']);
  assert.deepEqual(participationLevels(NOTHING), []);
});

test('participation years are listed newest first', () => {
  assert.deepEqual(participationYears(ALL_LEVELS), ['2022', '2018']);
  assert.deepEqual(participationYears(NOTHING), []);
});

test('the card footer never renders empty', () => {
  assert.equal(cardMeta(ALL_LEVELS), 'Riksdag · Region · Kommun');
  assert.equal(cardMeta(NOTHING), 'Inget anmält deltagande');
  assert.equal(cardSub(ALL_LEVELS), 'Valår 2022, 2018');
  assert.equal(cardSub(NOTHING), undefined);
});

test('equal party names get an area suffix only when one is available', () => {
  assert.equal(partyLabel({ beteckning: 'Kommunens Väl', duplicateName: true, omrade: 'Hylte' }), 'Kommunens Väl (Hylte)');
  assert.equal(partyLabel({ beteckning: 'Kommunens Väl', duplicateName: true }), 'Kommunens Väl');
  assert.equal(partyLabel({ beteckning: 'Eget namn', duplicateName: false, omrade: 'Hylte' }), 'Eget namn');
});

test('a chip toggles its election type off when it is already the chosen one', () => {
  assert.equal(toggleKind('', 'kommun'), 'kommun');
  assert.equal(toggleKind('riksdag', 'kommun'), 'kommun');
  assert.equal(toggleKind('kommun', 'kommun'), '');
});

test('the empty state echoes the search term, or the filters', () => {
  assert.equal(queryEcho('  moderat '), '”moderat”');
  assert.equal(queryEcho(''), 'dina filter');
  assert.equal(queryEcho('   '), 'dina filter');
});
