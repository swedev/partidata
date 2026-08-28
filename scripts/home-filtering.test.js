const assert = require('node:assert/strict');
const test = require('node:test');

const {
  defaultFilters,
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
      2018: { riksdag: true, regionLan: [], kommunKoder: [] },
      2022: { riksdag: false, regionLan: ['01'], kommunKoder: ['0114', '1280'] }
    }
  },
  {
    uuid: '22222222-2222-4222-8222-222222222222',
    beteckning: 'Skånepartiet',
    filnamn: 'skanepartiet',
    forkortning: 'SKP',
    omrade: 'Malmö',
    deltagande: {
      2022: { riksdag: false, regionLan: ['12'], kommunKoder: ['1233', '1280'] }
    }
  },
  {
    uuid: '33333333-3333-4333-8333-333333333333',
    beteckning: 'Rikspartiet',
    filnamn: 'rikspartiet',
    deltagande: {
      2018: { riksdag: true, regionLan: [], kommunKoder: [] }
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

test('the default filters open on the latest year the data carries', () => {
  assert.deepEqual(defaultFilters(['2018', '2022', '2026']), { ...emptyFilters, valar: '2026' });
  assert.deepEqual(defaultFilters([]), emptyFilters);
  assert.deepEqual(slugs(defaultFilters(['2018', '2022'])), ['ostra-folkpartiet', 'skanepartiet']);
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

test('a county survives every election type but the nationwide one', () => {
  assert.deepEqual(pruneFilters({ ...emptyFilters, valtyp: 'riksdag', lan: '12' }).lan, '');
  assert.deepEqual(pruneFilters({ ...emptyFilters, lan: '12' }).lan, '12');
  assert.deepEqual(pruneFilters({ ...emptyFilters, valtyp: 'kommun', lan: '12' }).lan, '12');
  assert.deepEqual(slugs({ valtyp: 'riksdag', lan: '12' }), ['ostra-folkpartiet', 'rikspartiet']);
});

test('a municipality asks for the municipal ballot in that municipality alone', () => {
  assert.deepEqual(slugs({ kommun: '1280' }), ['ostra-folkpartiet', 'skanepartiet']);
  assert.deepEqual(slugs({ kommun: '1233' }), ['skanepartiet']);
  assert.deepEqual(slugs({ kommun: '0114' }), ['ostra-folkpartiet']);
  assert.deepEqual(slugs({ kommun: '1233', valar: '2018' }), [], 'året gäller före kommunen');
});

test('a municipality outside the chosen county, or under another election type, is dropped', () => {
  assert.deepEqual(pruneFilters({ ...emptyFilters, lan: '12', kommun: '0114' }).kommun, '');
  assert.deepEqual(pruneFilters({ ...emptyFilters, lan: '12', kommun: '1280' }).kommun, '1280');
  assert.deepEqual(pruneFilters({ ...emptyFilters, kommun: '1280' }).kommun, '1280');
  assert.deepEqual(pruneFilters({ ...emptyFilters, valtyp: 'region', kommun: '1280' }).kommun, '');
  assert.deepEqual(pruneFilters({ ...emptyFilters, valtyp: 'kommun', kommun: '1280' }).kommun, '1280');
  assert.deepEqual(pruneFilters({ ...emptyFilters, valtyp: 'riksdag', lan: '12', kommun: '1280' }), { ...emptyFilters, valtyp: 'riksdag' });
});

test('a county on its own asks for either ballot in that county', () => {
  assert.deepEqual(slugs({ lan: '12' }), ['ostra-folkpartiet', 'skanepartiet']);
  assert.deepEqual(slugs({ lan: '01' }), ['ostra-folkpartiet']);
  assert.deepEqual(slugs({ lan: '14' }), []);
  assert.deepEqual(slugs({ lan: '01', valar: '2018' }), [], 'året gäller före länet');
});

test('search and filters narrow together', () => {
  assert.deepEqual(slugs({ query: 'partiet', valtyp: 'region' }), ['ostra-folkpartiet', 'skanepartiet']);
  assert.deepEqual(slugs({ query: 'skane', valar: '2018' }), []);
});
