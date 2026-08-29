const assert = require('node:assert/strict');
const test = require('node:test');

const { defaultFilters, emptyFilters } = require('../src/components/home/filtering.ts');
const { ALL_YEARS, queryFromState, stateFromQuery } = require('../src/components/home/query.ts');

const DATA = {
  valar: ['2018', '2022'],
  lan: [
    { kod: '01', namn: 'Stockholms län' },
    { kod: '12', namn: 'Skåne län' }
  ],
  kommuner: [
    { kod: '0114', namn: 'Upplands Väsby', lan: '01' },
    { kod: '1280', namn: 'Malmö', lan: '12' }
  ]
};

const YEARLESS = { valar: [], lan: DATA.lan, kommuner: DATA.kommuner };

function filters (values) {
  return { ...emptyFilters, valar: '2022', ...values };
}

function state (values, order = 'namn') {
  return { filters: filters(values), order };
}

test('an empty query opens on the defaults', () => {
  assert.deepEqual(stateFromQuery({}, DATA), { filters: defaultFilters(DATA.valar), order: 'namn' });
});

test('the year parameter names a year, every year or nothing', () => {
  assert.equal(stateFromQuery({ valar: ALL_YEARS }, DATA).filters.valar, '');
  assert.equal(stateFromQuery({ valar: '2018' }, DATA).filters.valar, '2018');
  assert.equal(stateFromQuery({ valar: '1900' }, DATA).filters.valar, '2022', 'ett år datan saknar faller tillbaka');
  assert.equal(stateFromQuery({ valar: '' }, DATA).filters.valar, '2022');
});

test('unknown values fall back to the defaults', () => {
  assert.deepEqual(
    stateFromQuery({ valtyp: 'eu', lan: '99', kommun: '9999', sortering: 'storlek' }, DATA),
    { filters: defaultFilters(DATA.valar), order: 'namn' }
  );
});

test('an inherited property name is not an election type', () => {
  for (const value of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    assert.equal(stateFromQuery({ valtyp: value }, DATA).filters.valtyp, '', `${value} är ingen valtyp`);
  }
});

test('known values pass through', () => {
  assert.deepEqual(
    stateFromQuery({ valar: '2018', valtyp: 'region', lan: '12', sortering: 'senaste' }, DATA),
    state({ valar: '2018', valtyp: 'region', lan: '12' }, 'senaste')
  );
});

test('a municipality carries its county even when the link leaves it out', () => {
  assert.deepEqual(stateFromQuery({ kommun: '1280' }, DATA).filters, filters({ lan: '12', kommun: '1280' }));
  assert.deepEqual(
    stateFromQuery({ kommun: '1280', lan: '99' }, DATA).filters,
    filters({ lan: '12', kommun: '1280' }),
    'ett ogiltigt län ersätts av kommunens'
  );
});

test('pruning drops values the rest of the filters leave without meaning', () => {
  assert.deepEqual(
    stateFromQuery({ kommun: '1280', lan: '01' }, DATA).filters,
    filters({ lan: '01' }),
    'en kommun utanför det valda länet släpps'
  );
  assert.deepEqual(
    stateFromQuery({ valtyp: 'riksdag', lan: '01' }, DATA).filters,
    filters({ valtyp: 'riksdag' }),
    'riksdagsvalet är rikstäckande och har inget län'
  );
});

test('a repeated parameter takes its first value and unknown ones are ignored', () => {
  assert.equal(stateFromQuery({ valar: ['2018', '2022'] }, DATA).filters.valar, '2018');
  assert.deepEqual(stateFromQuery({ utm_source: 'x', sida: '3' }, DATA), {
    filters: defaultFilters(DATA.valar),
    order: 'namn'
  });
});

test('the search term is kept as written', () => {
  assert.equal(stateFromQuery({ q: '  nya  partiet ' }, DATA).filters.query, '  nya  partiet ');
});

test('the defaults serialise to no query at all', () => {
  assert.deepEqual(queryFromState({ filters: defaultFilters(DATA.valar), order: 'namn' }, DATA.valar), {});
  assert.deepEqual(queryFromState({ filters: emptyFilters, order: 'namn' }, YEARLESS.valar), {});
});

test('every year is an active choice only where the data has years', () => {
  assert.deepEqual(queryFromState(state({ valar: '' }), DATA.valar), { valar: ALL_YEARS });
  assert.deepEqual(queryFromState({ filters: emptyFilters, order: 'namn' }, YEARLESS.valar), {});
});

test('the sort order is written only when it differs from the default', () => {
  assert.deepEqual(queryFromState(state({}, 'namn'), DATA.valar), {});
  assert.deepEqual(queryFromState(state({}, 'kommuner'), DATA.valar), { sortering: 'kommuner' });
});

test('a search term of nothing but whitespace is left out', () => {
  assert.deepEqual(queryFromState(state({ query: '   ' }), DATA.valar), {});
  assert.deepEqual(queryFromState(state({ query: 'nya partiet' }), DATA.valar), { q: 'nya partiet' });
});

test('the keys come out in a fixed order', () => {
  assert.deepEqual(
    Object.keys(queryFromState(state({ valar: '', valtyp: 'kommun', lan: '12', kommun: '1280', query: 'p' }, 'kommuner'), DATA.valar)),
    ['valar', 'valtyp', 'lan', 'kommun', 'q', 'sortering']
  );
});

test('a canonical state survives the round trip', () => {
  const canonical = [
    { filters: defaultFilters(DATA.valar), order: 'namn' },
    state({ valar: '' }, 'kommuner'),
    state({ valar: '2018', valtyp: 'riksdag' }),
    state({ valtyp: 'kommun', lan: '12', kommun: '1280' }, 'senaste'),
    state({ lan: '01' }),
    state({ query: 'nya partiet' })
  ];
  for (const original of canonical) {
    assert.deepEqual(stateFromQuery(queryFromState(original, DATA.valar), DATA), original);
  }
});
