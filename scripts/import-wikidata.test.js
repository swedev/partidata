const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  applyWikidata,
  entityUrl,
  fetchEntity,
  foundingDateFromEntity,
  parseArgs,
  wikidataTargets
} = require('./import-wikidata.js');

const GREGORIAN = 'http://www.wikidata.org/entity/Q1985727';
const JULIAN = 'http://www.wikidata.org/entity/Q1985786';

/**
 * timeStatement
 * One P571 statement, in the shape Special:EntityData delivers it.
 */
function timeStatement ({
  time = '+1988-02-06T00:00:00Z',
  precision = 11,
  rank = 'normal',
  calendarmodel = GREGORIAN,
  before = 0,
  after = 0
} = {}) {
  return {
    rank,
    mainsnak: {
      snaktype: 'value',
      property: 'P571',
      datavalue: { type: 'time', value: { time, timezone: 0, before, after, precision, calendarmodel } }
    }
  };
}

/**
 * entity
 */
function entity (id, statements) {
  return { id, claims: statements ? { P571: statements } : {} };
}

/**
 * party
 * A registry party as loadParties() hands it over.
 */
function party (filnamn, wikidata, beteckning = filnamn) {
  return { filnamn, beteckning, uuid: `uuid-${filnamn}`, extra: wikidata ? { wikidata } : {} };
}

/**
 * response
 * A fetch response stub.
 */
function response (status, body, headers = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: String(status),
    headers: { get: name => headers[name] ?? null },
    text: async () => body
  };
}

test('parseArgs reads the optional party filter', () => {
  assert.deepEqual(parseArgs([]), { parti: null });
  assert.deepEqual(parseArgs(['--parti', 'testpartiet']), { parti: 'testpartiet' });
  assert.throws(() => parseArgs(['--parti']), /--parti kräver ett filnamn/);
  assert.throws(() => parseArgs(['--parti', '--file']), /--parti kräver ett filnamn/);
  assert.throws(() => parseArgs(['--file', 'x.json']), /Okänt argument: --file/);
});

test('foundingDateFromEntity stores the precision the source states', () => {
  const cases = [
    [{ time: '+1988-00-00T00:00:00Z', precision: 9 }, '1988'],
    [{ time: '+1988-02-00T00:00:00Z', precision: 10 }, '1988-02'],
    [{ time: '+1988-02-06T00:00:00Z', precision: 11 }, '1988-02-06'],
    [{ time: '+1988-02-06T00:00:00Z', precision: 14 }, '1988-02-06']
  ];
  for (const [value, expected] of cases) {
    assert.equal(foundingDateFromEntity(entity('Q1', [timeStatement(value)]), 'Test (Q1)', 2026), expected);
  }
});

test('foundingDateFromEntity follows the best-rank rule', () => {
  const statements = [
    timeStatement({ time: '+1917-05-13T00:00:00Z', rank: 'normal' }),
    timeStatement({ time: '+1988-02-06T00:00:00Z', rank: 'preferred' }),
    timeStatement({ time: '+1800-01-01T00:00:00Z', rank: 'deprecated' })
  ];
  assert.equal(foundingDateFromEntity(entity('Q1', statements), 'Test (Q1)', 2026), '1988-02-06');

  const normalOnly = [
    timeStatement({ time: '+1917-05-13T00:00:00Z', rank: 'normal' }),
    timeStatement({ time: '+1800-01-01T00:00:00Z', rank: 'deprecated' })
  ];
  assert.equal(foundingDateFromEntity(entity('Q1', normalOnly), 'Test (Q1)', 2026), '1917-05-13');
});

test('foundingDateFromEntity accepts several statements that agree', () => {
  const statements = [timeStatement(), timeStatement()];
  assert.equal(foundingDateFromEntity(entity('Q1', statements), 'Test (Q1)', 2026), '1988-02-06');
});

test('foundingDateFromEntity refuses to choose between competing dates', () => {
  const statements = [
    timeStatement({ time: '+1917-05-13T00:00:00Z' }),
    timeStatement({ time: '+1988-02-06T00:00:00Z' })
  ];
  assert.throws(
    () => foundingDateFromEntity(entity('Q1', statements), 'Test (Q1)', 2026),
    /flera datum \(1917-05-13, 1988-02-06\).*preferred-rank/s
  );
});

test('foundingDateFromEntity leaves the date out when the entity states none', () => {
  const noValue = [{ rank: 'normal', mainsnak: { snaktype: 'novalue', property: 'P571' } }];
  const someValue = [{ rank: 'normal', mainsnak: { snaktype: 'somevalue', property: 'P571' } }];
  const noDatavalue = [{ rank: 'normal', mainsnak: { snaktype: 'value', property: 'P571' } }];
  const wrongType = [{
    rank: 'normal',
    mainsnak: { snaktype: 'value', property: 'P571', datavalue: { type: 'string', value: '1988' } }
  }];
  const deprecatedOnly = [timeStatement({ rank: 'deprecated' })];

  for (const statements of [undefined, [], noValue, someValue, noDatavalue, wrongType, deprecatedOnly]) {
    assert.equal(foundingDateFromEntity(entity('Q1', statements), 'Test (Q1)', 2026), undefined);
  }
});

test('foundingDateFromEntity rejects values it must not interpret', () => {
  const cases = [
    [{ calendarmodel: JULIAN }, /kalendermodellen/],
    [{ before: 1 }, /osäkerhetsintervall/],
    [{ after: 2 }, /osäkerhetsintervall/],
    [{ precision: 8 }, /precisionen 8, grövre än år/],
    [{ time: '1988-02-06' }, /tidsvärdet 1988-02-06/],
    [{ time: '-0500-00-00T00:00:00Z', precision: 9 }, /tidsvärdet -0500-00-00T00:00:00Z/],
    [{ time: '+1712-02-30T00:00:00Z' }, /året 1712, utanför 1800–2026/],
    [{ time: '+2030-01-01T00:00:00Z' }, /året 2030, utanför 1800–2026/]
  ];
  for (const [value, message] of cases) {
    assert.throws(() => foundingDateFromEntity(entity('Q1', [timeStatement(value)]), 'Test (Q1)', 2026), message);
  }
});

test('fetchEntity asks for the entity with a descriptive User-Agent', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return response(200, JSON.stringify({ entities: { Q1: entity('Q1') } }));
  };
  const result = await fetchEntity('Q1', { fetchImpl, sleep: async () => {} });
  assert.equal(result.id, 'Q1');
  assert.equal(calls[0].url, entityUrl('Q1'));
  assert.match(calls[0].options.headers['User-Agent'], /^partidata\/\d+\.\d+\.\d+ \(https:\/\/github\.com\/swedev\/partidata\)$/);
});

test('fetchEntity waits the time a 429 asks for and then retries', async () => {
  const waits = [];
  let attempt = 0;
  const fetchImpl = async () => {
    attempt += 1;
    return attempt === 1
      ? response(429, '', { 'Retry-After': '2' })
      : response(200, JSON.stringify({ entities: { Q1: entity('Q1') } }));
  };
  const result = await fetchEntity('Q1', { fetchImpl, sleep: async ms => waits.push(ms) });
  assert.equal(result.id, 'Q1');
  assert.deepEqual(waits, [2000]);
});

test('fetchEntity gives up after the retry limit', async () => {
  let attempts = 0;
  const fetchImpl = async () => {
    attempts += 1;
    return response(503, '');
  };
  await assert.rejects(
    fetchEntity('Q1', { fetchImpl, sleep: async () => {}, retries: 3 }),
    /Hämtningen av Q1 misslyckades: 503/
  );
  assert.equal(attempts, 3);
});

test('fetchEntity rejects a response that is not the entity asked for', async () => {
  const cases = [
    ['{ not json', /inte giltig JSON/],
    [JSON.stringify({ entities: {} }), /innehåller inte entiteten/],
    [JSON.stringify({ entities: { Q1: entity('Q2') } }), /innehåller inte entiteten/],
    [JSON.stringify({ entities: { Q2: entity('Q2') } }), /innehåller inte entiteten/]
  ];
  for (const [body, message] of cases) {
    await assert.rejects(
      fetchEntity('Q1', { fetchImpl: async () => response(200, body), sleep: async () => {} }),
      message
    );
  }
});

test('fetchEntity reports a 404 rather than skipping the party', async () => {
  await assert.rejects(
    fetchEntity('Q1', { fetchImpl: async () => response(404, ''), sleep: async () => {} }),
    /Hämtningen av Q1 misslyckades: 404/
  );
});

test('wikidataTargets picks the parties carrying a Q-id', () => {
  const parties = [
    party('alfa', { id: 'Q1', hamtad: '2026-08-01' }),
    party('beta'),
    party('gamma', { id: 'Q2' })
  ];
  assert.deepEqual(wikidataTargets(parties).map(entry => entry.filnamn), ['alfa', 'gamma']);
  assert.deepEqual(wikidataTargets(parties, 'gamma').map(entry => entry.filnamn), ['gamma']);
  assert.throws(() => wikidataTargets(parties, 'delta'), /Okänt parti: delta/);
  assert.throws(() => wikidataTargets(parties, 'beta'), /beta saknar en wikidata-sektion/);
});

test('wikidataTargets rejects a section it must not rewrite', () => {
  assert.throws(() => wikidataTargets([party('alfa', { id: 'Q01' })]), /alfa\.wikidata\.id ska vara ett Wikidata-id/);
  assert.throws(() => wikidataTargets([party('alfa', { grundat: '1988' })]), /alfa\.wikidata\.id ska vara ett Wikidata-id/);
  assert.throws(() => wikidataTargets([party('alfa', { id: 'Q1', grundatt: '1988' })]), /alfa\.wikidata\.grundatt är inte en känd nyckel/);
  assert.throws(() => wikidataTargets([party('alfa', [])]), /alfa\.wikidata ska vara ett objekt/);
});

test('applyWikidata only touches the parties that were fetched', () => {
  const parties = [
    party('alfa', { id: 'Q1', grundat: '1900', hamtad: '2020-01-01' }),
    party('beta', { id: 'Q2', grundat: '1917-05-13', hamtad: '2020-01-01' }),
    party('gamma')
  ];
  const entities = new Map([['Q1', entity('Q1', [timeStatement()])]]);

  const changes = applyWikidata(parties, entities, '2026-08-29');

  assert.deepEqual(changes, [{
    filnamn: 'alfa',
    beteckning: 'alfa',
    id: 'Q1',
    fore: '1900',
    efter: '1988-02-06'
  }]);
  assert.deepEqual(parties[0].extra.wikidata, { id: 'Q1', grundat: '1988-02-06', hamtad: '2026-08-29' });
  assert.deepEqual(parties[1].extra.wikidata, { id: 'Q2', grundat: '1917-05-13', hamtad: '2020-01-01' });
  assert.deepEqual(parties[2].extra, {});
});

test('applyWikidata drops a founding date the entity no longer states', () => {
  const parties = [party('alfa', { id: 'Q1', grundat: '1900', hamtad: '2020-01-01' })];
  applyWikidata(parties, new Map([['Q1', entity('Q1')]]), '2026-08-29');
  assert.deepEqual(parties[0].extra.wikidata, { id: 'Q1', hamtad: '2026-08-29' });
});

test('applyWikidata writes the keys in a stable order', () => {
  const parties = [party('alfa', { hamtad: '2020-01-01', id: 'Q1' })];
  applyWikidata(parties, new Map([['Q1', entity('Q1', [timeStatement()])]]), '2026-08-29');
  assert.deepEqual(Object.keys(parties[0].extra.wikidata), ['id', 'grundat', 'hamtad']);
});

test('applyWikidata refuses a Q-id two parties claim', () => {
  const parties = [
    party('alfa', { id: 'Q1', hamtad: '2020-01-01' }),
    party('beta', { id: 'Q1', hamtad: '2020-01-01' })
  ];
  assert.throws(
    () => applyWikidata(parties, new Map([['Q1', entity('Q1', [timeStatement()])]]), '2026-08-29'),
    /beta\.wikidata\.id Q1 används redan av alfa/
  );
});

test('applyWikidata stops on a value it must not interpret', () => {
  const parties = [
    party('alfa', { id: 'Q1', grundat: '1900', hamtad: '2020-01-01' }),
    party('beta', { id: 'Q2', grundat: '1917', hamtad: '2020-01-01' })
  ];
  const entities = new Map([
    ['Q1', entity('Q1', [timeStatement()])],
    ['Q2', entity('Q2', [timeStatement({ calendarmodel: JULIAN })])]
  ]);
  assert.throws(() => applyWikidata(parties, entities, '2026-08-29'), /kalendermodellen/);
  assert.equal(parties[1].extra.wikidata.grundat, '1917');
});
