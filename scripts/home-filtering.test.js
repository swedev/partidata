const assert = require('node:assert/strict');
const test = require('node:test');

const {
  emptyFilters,
  filterParties,
  matchesQuery,
  normalise,
  pruneFilters
} = require('../src/components/home/filtering.ts');

const PARTIES = [
  {
    uuid: '11111111-1111-4111-8111-111111111111',
    beteckning: 'Östra folkpartiet',
    filnamn: 'ostra-folkpartiet',
    forkortning: 'ÖF',
    deltagande: {
      2018: { riksdag: true, regionLan: [], kommunLan: [] },
      2022: { riksdag: false, regionLan: ['01'], kommunLan: ['01', '12'] }
    }
  },
  {
    uuid: '22222222-2222-4222-8222-222222222222',
    beteckning: 'Skånepartiet',
    filnamn: 'skanepartiet',
    forkortning: 'SKP',
    omrade: 'Malmö',
    deltagande: {
      2022: { riksdag: false, regionLan: ['12'], kommunLan: ['12'] }
    }
  },
  {
    uuid: '33333333-3333-4333-8333-333333333333',
    beteckning: 'Rikspartiet',
    filnamn: 'rikspartiet',
    deltagande: {
      2018: { riksdag: true, regionLan: [], kommunLan: [] }
    }
  },
  {
    uuid: '44444444-4444-4444-8444-444444444444',
    beteckning: 'Vilande partiet',
    filnamn: 'vilande-partiet',
    deltagande: {}
  }
];

function slugs (filters) {
  return filterParties(PARTIES, { ...emptyFilters, ...filters }).map(party => party.filnamn);
}

test('normalisation folds diacritics, case and whitespace', () => {
  assert.equal(normalise('  Östra   Folkpartiet '), 'ostra folkpartiet');
  assert.equal(normalise('ÅÄÖ'), 'aao');
  assert.equal(normalise(''), '');
});

test('search matches name and abbreviation without diacritics', () => {
  const [ostra, skane] = PARTIES;
  assert.ok(matchesQuery(ostra, 'ostra'));
  assert.ok(matchesQuery(ostra, 'Östra'));
  assert.ok(matchesQuery(ostra, 'of'));
  assert.ok(matchesQuery(ostra, 'folk ostra'));
  assert.ok(matchesQuery(ostra, ''));
  assert.ok(matchesQuery(ostra, '   '));
  assert.ok(!matchesQuery(ostra, 'skane'));
  assert.ok(matchesQuery(skane, 'SKP'));
  assert.ok(matchesQuery(skane, 'malmo'));
  assert.ok(matchesQuery(PARTIES[2], 'riks'), 'a party without abbreviation is still searchable by name');
});

test('no filter leaves every party', () => {
  assert.deepEqual(slugs({}), PARTIES.map(party => party.filnamn));
});

test('a year alone requires participation in that year', () => {
  assert.deepEqual(slugs({ valar: '2018' }), ['ostra-folkpartiet', 'rikspartiet']);
  assert.deepEqual(slugs({ valar: '2022' }), ['ostra-folkpartiet', 'skanepartiet']);
  assert.deepEqual(slugs({ valar: '2026' }), []);
});

test('an election type alone requires participation in that type in some year', () => {
  assert.deepEqual(slugs({ valtyp: 'riksdag' }), ['ostra-folkpartiet', 'rikspartiet']);
  assert.deepEqual(slugs({ valtyp: 'region' }), ['ostra-folkpartiet', 'skanepartiet']);
  assert.deepEqual(slugs({ valtyp: 'kommun' }), ['ostra-folkpartiet', 'skanepartiet']);
});

test('year and election type combine as a single requirement', () => {
  assert.deepEqual(slugs({ valar: '2018', valtyp: 'riksdag' }), ['ostra-folkpartiet', 'rikspartiet']);
  assert.deepEqual(slugs({ valar: '2022', valtyp: 'riksdag' }), []);
  assert.deepEqual(slugs({ valar: '2022', valtyp: 'region' }), ['ostra-folkpartiet', 'skanepartiet']);
});

test('the county is tested against the facet of the chosen election type', () => {
  assert.deepEqual(slugs({ valtyp: 'region', lan: '01' }), ['ostra-folkpartiet']);
  assert.deepEqual(slugs({ valtyp: 'region', lan: '12' }), ['skanepartiet']);
  assert.deepEqual(slugs({ valtyp: 'kommun', lan: '12' }), ['ostra-folkpartiet', 'skanepartiet']);
  assert.deepEqual(slugs({ valar: '2018', valtyp: 'kommun', lan: '01' }), []);
});

test('a county left over from another election type is dropped', () => {
  assert.deepEqual(pruneFilters({ ...emptyFilters, valtyp: 'riksdag', lan: '12' }).lan, '');
  assert.deepEqual(pruneFilters({ ...emptyFilters, lan: '12' }).lan, '');
  assert.deepEqual(pruneFilters({ ...emptyFilters, valtyp: 'kommun', lan: '12' }).lan, '12');
  assert.deepEqual(slugs({ valtyp: 'riksdag', lan: '12' }), ['ostra-folkpartiet', 'rikspartiet']);
});

test('search and filters narrow together', () => {
  assert.deepEqual(slugs({ query: 'partiet', valtyp: 'region' }), ['ostra-folkpartiet', 'skanepartiet']);
  assert.deepEqual(slugs({ query: 'skane', valar: '2018' }), []);
});
