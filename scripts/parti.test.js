const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const {
  PARTY_KEY_ORDER,
  buildParties,
  deriveArea,
  normalisePartyName,
  normalisedNameCollisions,
  upsertParties
} = require('./parti.js');

const {
  PARTIER,
  fixture,
  makeTree,
  removeTree,
  runImport,
  runParti,
  readJson,
  snapshot
} = require('./fixtures/tree.js');

const CSV_2022 = fixture('val-2022.csv');
const CSV_2026 = fixture('val-2026.csv');
const CSV_2030 = fixture('val-2030.csv');
const CSV_TVETYDIG = fixture('val-2026-tvetydig.csv');

/**
 * parti
 * @param  {String} dir
 * @param  {String} filnamn
 * @return {Object}
 */
function parti (dir, filnamn) {
  return readJson(dir, 'data/parti', filnamn, 'index.json');
}

/**
 * editParti
 * Edits a party file the way a contributor would, by hand.
 * @param  {String} dir
 * @param  {String} filnamn
 * @param  {Object} fields Fields to add or replace
 */
function editParti (dir, filnamn, fields) {
  const file = path.join(dir, 'data/parti', filnamn, 'index.json');
  const data = { ...readJson(file), ...fields };
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

/**
 * identity
 * The registry reduced to what must not depend on import order.
 * @param  {String} dir
 * @return {Object[]}
 */
function identity (dir) {
  const index = readJson(dir, 'data/derived/parti.json');
  return index.map(entry => {
    const data = parti(dir, entry.filnamn);
    return {
      filnamn: data.filnamn,
      kod: data.kod,
      tidigare_koder: data.tidigare_koder || [],
      beteckning: data.beteckning,
      tidigare_beteckningar: data.tidigare_beteckningar || [],
      omrade: data.omrade,
      deltagande: data.deltagande || {}
    };
  });
}

test('a party keeps its uuid and filnamn when its code is imported again', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);

  const testpartiet = parti(dir, 'testpartiet');
  assert.equal(testpartiet.uuid, PARTIER[0].uuid);
  assert.equal(testpartiet.kod, '9001');
  assert.equal(testpartiet.forkortning, 'TP');
  assert.equal(testpartiet.registrerad_partibeteckning, true);
});

test('a new party gets a slug, and a taken slug gets a -kod suffix', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);

  assert.equal(parti(dir, 'lokalpartiet').kod, '9002');
  assert.equal(parti(dir, 'testpartiet-9004').kod, '9004');
  assert.equal(parti(dir, 'testpartiet').uuid, PARTIER[0].uuid);
});

test('two new parties sharing a slug are both suffixed', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);

  assert.equal(parti(dir, 'delad-9010').beteckning, 'Delad');
  assert.equal(parti(dir, 'delad-9011').beteckning, 'Delad');
  assert.equal(fs.existsSync(path.join(dir, 'data/parti/delad')), false);
});

test('a re-coded party is matched on its name and records the old code', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);
  const result = runImport(dir, '2026', CSV_2026);
  assert.equal(result.status, 0, result.stderr);

  const gamla = parti(dir, 'gamla-partiet');
  assert.equal(gamla.uuid, PARTIER[1].uuid);
  assert.equal(gamla.kod, '9105');
  assert.deepEqual(gamla.tidigare_koder, ['9005']);
  assert.match(result.stdout, /9005 → 9105 Gamla partiet/);
});

test('a re-coded party is matched after harmless name normalisation', () => {
  const party = {
    uuid: '11111111-1111-4111-8111-111111111111',
    filnamn: 'fn-parti-art-27',
    koder: ['1425'],
    beteckning: 'FN Parti art: 27',
    tidigare_beteckningar: [],
    tidigare_filnamn: []
  };
  const result = upsertParties(
    { parties: [party], kodbyten: {} },
    '2022',
    [{ kod: '1631', beteckning: ' FN Parti art.27 ' }]
  );

  assert.deepEqual(party.koder, ['1425', '1631']);
  assert.equal(result.created.length, 0);
  assert.equal(result.merged.length, 1);
  assert.equal(result.merged[0].via, 'beteckning');
  assert.equal(normalisePartyName('Rädda! Håbo'), 'rädda håbo');
});

test('every diacritic stays distinct while equivalent Unicode stays equal', () => {
  const parties = [
    { filnamn: 'habodemokraterna', koder: ['1287'], beteckning: 'Habodemokraterna', tidigare_beteckningar: [], tidigare_filnamn: [] },
    { filnamn: 'habodemokraterna-1532', koder: ['1532'], beteckning: 'HåboDemokraterna', tidigare_beteckningar: [], tidigare_filnamn: [] }
  ];
  const result = upsertParties(
    { parties, kodbyten: {} },
    '2030',
    [{ kod: '2000', beteckning: 'HaboDemokraterna!' }]
  );

  assert.equal(result.merged.length, 1);
  assert.equal(result.merged[0].party.beteckning, 'Habodemokraterna');
  assert.deepEqual(parties[0].koder, ['1287', '2000']);
  assert.deepEqual(parties[1].koder, ['1532']);
  assert.notEqual(normalisePartyName('Sámelistu'), normalisePartyName('Samelistu'));
  assert.notEqual(normalisePartyName('Parti Ü'), normalisePartyName('Parti U'));
  assert.notEqual(normalisePartyName('Parti Ï'), normalisePartyName('Parti I'));
  assert.equal(normalisePartyName('Sa\u0301melistu'), normalisePartyName('Sámelistu'));
});

test('normalised ambiguity is rejected when a merge is possible', () => {
  const parties = [
    { filnamn: 'kommunens-val', koder: ['1111'], beteckning: 'Kommunens Väl' },
    { filnamn: 'kommunens-val-2222', koder: ['2222'], beteckning: 'Kommunens väl!' }
  ];

  assert.throws(
    () => upsertParties(
      { parties, kodbyten: {} },
      '2030',
      [{ kod: '3000', beteckning: 'Kommunens Väl' }]
    ),
    /Ambiguous match for 3000 "Kommunens Väl".*2 registry candidate/
  );
});

test('a new party with a recurring name is created when every namesake already has its code in the year', () => {
  const parties = [
    { filnamn: 'kommunens-val', koder: ['1111'], beteckning: 'Kommunens Väl', tidigare_beteckningar: [], tidigare_filnamn: [] },
    { filnamn: 'kommunens-val-2222', koder: ['2222'], beteckning: 'Kommunens väl!', tidigare_beteckningar: [], tidigare_filnamn: [] }
  ];
  const result = upsertParties(
    { parties, kodbyten: {} },
    '2030',
    [
      { kod: '1111', beteckning: 'Kommunens Väl' },
      { kod: '2222', beteckning: 'Kommunens väl!' },
      { kod: '3000', beteckning: 'Kommunens Väl' }
    ]
  );

  assert.equal(result.merged.length, 0);
  assert.equal(result.created.length, 1);
  assert.equal(result.created[0].beteckning, 'Kommunens Väl');
  assert.deepEqual(result.created[0].koder, ['3000']);
  assert.deepEqual(parties[0].koder, ['1111']);
  assert.deepEqual(parties[1].koder, ['2222']);
});

test('the collision report finds equal normalised names without changing files', t => {
  const parties = [
    { uuid: '11111111-1111-4111-8111-111111111111', kod: '1111', beteckning: 'Kommunens Väl', filnamn: 'kommunens-val' },
    { uuid: '22222222-2222-4222-8222-222222222222', kod: '2222', beteckning: 'Kommunens väl!', filnamn: 'kommunens-val-2222' },
    { uuid: '33333333-3333-4333-8333-333333333333', kod: '1287', beteckning: 'Habodemokraterna', filnamn: 'habodemokraterna' },
    { uuid: '44444444-4444-4444-8444-444444444444', kod: '1532', beteckning: 'HåboDemokraterna', filnamn: 'habodemokraterna-1532' }
  ];
  const collisions = normalisedNameCollisions(parties.map(party => ({ ...party, koder: [party.kod] })));
  assert.equal(collisions.length, 1);
  assert.equal(collisions[0].name, 'kommunens väl');
  assert.deepEqual(collisions[0].parties.map(party => party.koder[0]), ['1111', '2222']);

  const dir = makeTree({ parties });
  t.after(() => removeTree(dir));
  const before = snapshot(dir);
  const result = runParti(dir, ['--report-name-collisions']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /kommunens väl: 1111 "Kommunens Väl".*2222 "Kommunens väl!"/);
  assert.doesNotMatch(result.stdout, /habodemokraterna/);
  assert.deepEqual(snapshot(dir), before);
});

test('historical-only records do not replace current registry identity', () => {
  const party = {
    uuid: '11111111-1111-4111-8111-111111111111',
    filnamn: 'kommunens-rost',
    koder: ['1302', '1395'],
    beteckning: 'Kommunens Röst',
    tidigare_beteckningar: ['Kommunens Röst '],
    tidigare_filnamn: ['kommunens-rost-']
  };
  const historical = {
    kod: '1395',
    beteckning: 'Kommunens Röst ',
    uuid: party.uuid
  };
  const build = buildParties(
    { parties: [party], kodbyten: { 1302: '1395' } },
    { 2018: { partier: null, riksdag: [], region: [], kommun: [{ kod: '1293', partier: [historical] }] } }
  );

  assert.equal(build.parties[0].data.kod, '1302');
  assert.equal(build.parties[0].data.beteckning, 'Kommunens Röst');
  assert.deepEqual(build.parties[0].data.tidigare_koder, ['1395']);
  assert.deepEqual(build.parties[0].data.tidigare_beteckningar, ['Kommunens Röst ']);
  assert.deepEqual(build.parties[0].data.deltagande, {
    2018: { riksdag: false, region: [], kommun: ['1293'] }
  });
});

test('an area is the narrowest geography containing the latest participation', () => {
  const areas = {
    regioner: new Map([['01', 'Stockholms län'], ['12', 'Skåne län']]),
    kommuner: new Map([['0114', 'Upplands Väsby'], ['0115', 'Vallentuna'], ['1280', 'Malmö']])
  };

  assert.equal(deriveArea({}, areas), undefined);
  assert.equal(deriveArea({ 2022: { riksdag: true, region: [], kommun: ['0114'] } }, areas), undefined);
  assert.equal(deriveArea({ 2022: { riksdag: false, region: ['01'], kommun: ['0114'] } }, areas), 'Upplands Väsby');
  assert.equal(deriveArea({ 2022: { riksdag: false, region: [], kommun: ['0114', '0115'] } }, areas), 'Stockholms län');
  assert.equal(deriveArea({ 2022: { riksdag: false, region: ['12'], kommun: [] } }, areas), 'Skåne län');
  assert.equal(deriveArea({ 2022: { riksdag: false, region: [], kommun: ['0114', '1280'] } }, areas), undefined);
  assert.equal(deriveArea({
    2018: { riksdag: false, region: [], kommun: ['0114', '1280'] },
    2022: { riksdag: false, region: [], kommun: ['0114'] }
  }, areas), 'Upplands Väsby');
});

test('kodbyten.json binds a re-coded party that also changed its name', t => {
  const dir = makeTree({ kodbyten: { 9106: '9006' } });
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);
  assert.equal(runImport(dir, '2026', CSV_2026).status, 0);

  const alias = parti(dir, 'omdopt-via-alias');
  assert.equal(alias.uuid, PARTIER[2].uuid);
  assert.equal(alias.kod, '9106');
  assert.deepEqual(alias.tidigare_koder, ['9006']);
  assert.equal(alias.beteckning, 'Omdöpt via alias');
  assert.deepEqual(alias.tidigare_beteckningar, ['Aliaspartiet']);
  assert.deepEqual(alias.tidigare_filnamn, ['aliaspartiet']);
  assert.equal(fs.existsSync(path.join(dir, 'data/parti/aliaspartiet')), false);
});

test('without an alias a renamed re-code becomes a separate party', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);
  assert.equal(runImport(dir, '2026', CSV_2026).status, 0);

  assert.equal(parti(dir, 'aliaspartiet').kod, '9006');
  assert.equal(parti(dir, 'omdopt-via-alias').kod, '9106');
});

test('an ambiguous name stops the import and writes nothing', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);
  const before = snapshot(dir);

  const result = runImport(dir, '2026', CSV_TVETYDIG);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Ambiguous match for 9107 "Dubbelnamn"/);
  assert.match(result.stderr, /kodbyten\.json/);
  assert.deepEqual(snapshot(dir), before);
});

test('a renamed party moves to a new filnamn and keeps the old one as tidigare_filnamn', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);
  const result = runImport(dir, '2026', CSV_2026);
  assert.equal(result.status, 0, result.stderr);

  const testpartiet = parti(dir, 'nya-testpartiet');
  assert.equal(testpartiet.uuid, PARTIER[0].uuid);
  assert.equal(testpartiet.beteckning, 'Nya Testpartiet');
  assert.deepEqual(testpartiet.tidigare_beteckningar, ['Testpartiet']);
  assert.deepEqual(testpartiet.tidigare_filnamn, ['testpartiet']);
  assert.equal(testpartiet.forkortning, 'NTP');
  assert.equal(fs.existsSync(path.join(dir, 'data/parti/testpartiet')), false);

  const entry = readJson(dir, 'data/derived/parti.json').find(p => p.uuid === PARTIER[0].uuid);
  assert.equal(entry.filnamn, 'nya-testpartiet');
  assert.deepEqual(entry.tidigare_filnamn, ['testpartiet']);
  assert.match(result.stdout, /9001 Testpartiet → Nya Testpartiet \(testpartiet → nya-testpartiet\)/);
});

test('a malformed filnamn is cleaned without a name change', t => {
  const parties = PARTIER.map(party => (party.filnamn === 'testpartiet'
    ? { ...party, beteckning: 'Test partiet', filnamn: 'test--partiet-' }
    : party));
  const dir = makeTree({ parties });
  t.after(() => removeTree(dir));
  const result = runParti(dir);
  assert.equal(result.status, 0, result.stderr);

  const testpartiet = parti(dir, 'test-partiet');
  assert.equal(testpartiet.beteckning, 'Test partiet');
  assert.deepEqual(testpartiet.tidigare_filnamn, ['test--partiet-']);
  assert.equal(fs.existsSync(path.join(dir, 'data/parti/test--partiet-')), false);
  assert.match(result.stdout, /data\/parti\/test--partiet- → data\/parti\/test-partiet/);
});

test('a name change with the same slug moves nothing', t => {
  const parties = PARTIER.map(party => (party.filnamn === 'testpartiet'
    ? { ...party, beteckning: 'nya testpartiet', filnamn: 'nya-testpartiet' }
    : party));
  const dir = makeTree({ parties });
  t.after(() => removeTree(dir));
  const result = runImport(dir, '2026', CSV_2026);
  assert.equal(result.status, 0, result.stderr);

  const testpartiet = parti(dir, 'nya-testpartiet');
  assert.equal(testpartiet.beteckning, 'Nya Testpartiet');
  assert.deepEqual(testpartiet.tidigare_beteckningar, ['nya testpartiet']);
  assert.equal(testpartiet.tidigare_filnamn, undefined);
  assert.match(result.stdout, /9001 nya testpartiet → Nya Testpartiet$/m);
});

test('an old filnamn is never given to a new party', t => {
  const parties = PARTIER.map(party => (party.filnamn === 'testpartiet'
    ? { ...party, tidigare_filnamn: ['lokalpartiet'] }
    : party));
  const dir = makeTree({ parties });
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);

  assert.equal(parti(dir, 'lokalpartiet-9002').beteckning, 'Lokalpartiet');
  assert.equal(fs.existsSync(path.join(dir, 'data/parti/lokalpartiet')), false);
});

test('a renamed party and a new party sharing a slug are both suffixed', t => {
  const parties = PARTIER.map(party => (party.filnamn === 'testpartiet'
    ? { ...party, beteckning: 'Gammalt testparti', filnamn: 'gammalt-testparti' }
    : party));
  const dir = makeTree({ parties });
  t.after(() => removeTree(dir));
  const result = runImport(dir, '2022', CSV_2022);
  assert.equal(result.status, 0, result.stderr);

  assert.equal(parti(dir, 'testpartiet-9001').uuid, PARTIER[0].uuid);
  assert.deepEqual(parti(dir, 'testpartiet-9001').tidigare_filnamn, ['gammalt-testparti']);
  assert.equal(parti(dir, 'testpartiet-9004').kod, '9004');
  assert.equal(fs.existsSync(path.join(dir, 'data/parti/testpartiet')), false);
});

test('two renamed parties sharing a slug are both suffixed', t => {
  const parties = [
    ...PARTIER,
    { uuid: '66666666-6666-4666-8666-666666666666', kod: '9010', beteckning: 'Delad ett', filnamn: 'delad-ett' },
    { uuid: '77777777-7777-4777-8777-777777777777', kod: '9011', beteckning: 'Delad två', filnamn: 'delad-tva' }
  ];
  const dir = makeTree({ parties });
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);

  assert.deepEqual(parti(dir, 'delad-9010').tidigare_filnamn, ['delad-ett']);
  assert.deepEqual(parti(dir, 'delad-9011').tidigare_filnamn, ['delad-tva']);
  assert.equal(fs.existsSync(path.join(dir, 'data/parti/delad')), false);
});

test('a party renamed back reclaims its old filnamn', t => {
  const parties = PARTIER.map(party => (party.filnamn === 'testpartiet'
    ? { ...party, tidigare_filnamn: ['nya-testpartiet'] }
    : party));
  const dir = makeTree({ parties });
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2026', CSV_2026).status, 0);

  const testpartiet = parti(dir, 'nya-testpartiet');
  assert.equal(testpartiet.uuid, PARTIER[0].uuid);
  assert.deepEqual(testpartiet.tidigare_filnamn, ['testpartiet']);
  assert.equal(fs.existsSync(path.join(dir, 'data/parti/testpartiet')), false);
});

test('a tidigare_filnamn that equals another party filnamn stops the import', t => {
  const parties = PARTIER.map(party => (party.filnamn === 'gamla-partiet'
    ? { ...party, tidigare_filnamn: ['testpartiet'] }
    : party));
  const dir = makeTree({ parties });
  t.after(() => removeTree(dir));
  const before = snapshot(dir);

  const result = runImport(dir, '2022', CSV_2022);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Duplicate filnamn "testpartiet"/);
  assert.deepEqual(snapshot(dir), before);
});

test('a rename moves the party kandidatlista', t => {
  const dir = makeTree({ kandidatlistor: [{ year: '2022', filnamn: 'testpartiet' }] });
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);
  const result = runImport(dir, '2026', CSV_2026);
  assert.equal(result.status, 0, result.stderr);

  assert.equal(fs.existsSync(path.join(dir, 'data/val/2022/kandidatlistor/nya-testpartiet.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'data/val/2022/kandidatlistor/testpartiet.json')), false);
  assert.equal(readJson(dir, 'data/val/2022/kandidatlistor/nya-testpartiet.json').filnamn, 'nya-testpartiet');
  assert.match(result.stdout, /kandidatlistor\/testpartiet\.json → data\/val\/2022\/kandidatlistor\/nya-testpartiet\.json/);
});

test('a rename whose kandidatlista target already exists stops the import before anything is written', t => {
  const dir = makeTree({
    kandidatlistor: [
      { year: '2022', filnamn: 'testpartiet' },
      { year: '2022', filnamn: 'nya-testpartiet' }
    ]
  });
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);
  const before = snapshot(dir);

  const result = runImport(dir, '2026', CSV_2026);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /kandidatlistor\/nya-testpartiet\.json already exists/);
  assert.deepEqual(snapshot(dir), before);
});

test('tidigare_filnamn records the slugs the registry has carried, in the order they were imported', t => {
  const chronological = makeTree();
  const newestFirst = makeTree();
  t.after(() => {
    removeTree(chronological);
    removeTree(newestFirst);
  });

  assert.equal(runImport(chronological, '2022', CSV_2022).status, 0);
  assert.equal(runImport(chronological, '2026', CSV_2026).status, 0);
  assert.equal(runImport(chronological, '2030', CSV_2030).status, 0);
  assert.equal(runImport(newestFirst, '2030', CSV_2030).status, 0);
  assert.equal(runImport(newestFirst, '2026', CSV_2026).status, 0);
  assert.equal(runImport(newestFirst, '2022', CSV_2022).status, 0);

  assert.deepEqual(parti(chronological, 'tredje-testpartiet').tidigare_filnamn, ['testpartiet', 'nya-testpartiet']);
  assert.deepEqual(parti(newestFirst, 'tredje-testpartiet').tidigare_filnamn, ['testpartiet']);
  assert.deepEqual(identity(newestFirst), identity(chronological));
});

test('deltagande is derived per year from the val files', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);
  assert.equal(runImport(dir, '2026', CSV_2026).status, 0);

  assert.deepEqual(parti(dir, 'nya-testpartiet').deltagande, {
    2022: { riksdag: true, region: ['01'], kommun: ['0114'] },
    2026: { riksdag: true, region: [], kommun: ['0114'] }
  });
  assert.deepEqual(parti(dir, 'testpartiet-9004').deltagande, {
    2022: { riksdag: false, region: [], kommun: ['0115'] }
  });
});

test('importing the years in either order gives the same registry', t => {
  const forward = makeTree();
  const reverse = makeTree();
  t.after(() => {
    removeTree(forward);
    removeTree(reverse);
  });

  assert.equal(runImport(forward, '2022', CSV_2022).status, 0);
  assert.equal(runImport(forward, '2026', CSV_2026).status, 0);
  assert.equal(runImport(reverse, '2026', CSV_2026).status, 0);
  assert.equal(runImport(reverse, '2022', CSV_2022).status, 0);

  assert.deepEqual(identity(reverse), identity(forward));
});

test('rebuilding from the committed data changes nothing', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);
  assert.equal(runImport(dir, '2026', CSV_2026).status, 0);
  const before = snapshot(dir);

  const result = runParti(dir);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(snapshot(dir), before);
});

test('derived/parti.json is sorted by filnamn and covers every party file', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);

  const index = readJson(dir, 'data/derived/parti.json');
  const filnamn = index.map(entry => entry.filnamn);
  assert.deepEqual(filnamn, [...filnamn].sort());
  const dirs = fs.readdirSync(path.join(dir, 'data/parti'), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
  assert.deepEqual(filnamn.slice().sort(), dirs.sort());
  assert.equal(fs.existsSync(path.join(dir, 'data/parti/index.json')), false);
});

test('derived/parti.json carries the forkortning and omrade of the party file', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);

  const index = readJson(dir, 'data/derived/parti.json');
  const entry = index.find(party => party.filnamn === 'testpartiet');
  assert.equal(entry.forkortning, 'TP');
  assert.equal(entry.forkortning, parti(dir, 'testpartiet').forkortning);
  assert.ok(index.every(party => !('forkortning' in party) || typeof party.forkortning === 'string'));
  const lokalpartiet = index.find(party => party.filnamn === 'lokalpartiet');
  assert.equal(lokalpartiet.omrade, 'Upplands Väsby');
  assert.equal(lokalpartiet.omrade, parti(dir, 'lokalpartiet').omrade);
});

test('a duplicate uuid in the registry stops the import', t => {
  const parties = PARTIER.map(party => ({ ...party, uuid: PARTIER[0].uuid }));
  const dir = makeTree({ parties });
  t.after(() => removeTree(dir));
  const before = snapshot(dir);

  const result = runImport(dir, '2022', CSV_2022);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Duplicate uuid/);
  assert.deepEqual(snapshot(dir), before);
});

test('a duplicate kod in the registry stops the import', t => {
  const parties = PARTIER.map((party, i) => (i === 1 ? { ...party, kod: PARTIER[0].kod } : party));
  const dir = makeTree({ parties });
  t.after(() => removeTree(dir));

  const result = runImport(dir, '2022', CSV_2022);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Duplicate kod "9001"/);
});

test('a hand-added field survives a rebuild', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);
  editParti(dir, 'testpartiet', { grundad: '1988-02-04' });

  const result = runParti(dir);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(parti(dir, 'testpartiet').grundad, '1988-02-04');
});

test('a hand-added field survives a re-import of the same year', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);
  editParti(dir, 'testpartiet', { grundad: '1988-02-04' });

  const result = runImport(dir, '2022', CSV_2022);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(parti(dir, 'testpartiet').grundad, '1988-02-04');
});

test('the first rebuild normalises a hand-added field and the next is byte-identical', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);
  const file = path.join(dir, 'data/parti/testpartiet/index.json');
  const handWritten = JSON.stringify({ ...readJson(file), grundad: '1988-02-04' }, null, 4) + '\n';
  fs.writeFileSync(file, handWritten);

  assert.equal(runParti(dir).status, 0);
  const normalised = snapshot(dir);
  assert.notEqual(normalised['parti/testpartiet/index.json'], handWritten);
  assert.match(normalised['parti/testpartiet/index.json'], /^ {2}"grundad": "1988-02-04"$/m);

  assert.equal(runParti(dir).status, 0);
  assert.deepEqual(snapshot(dir), normalised);
});

test('hand-added fields are written after the managed ones, in alphabetical order', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);
  editParti(dir, 'testpartiet', { wikidata: 'Q123', grundad: '1988-02-04', arkiv_id: 'A7' });

  assert.equal(runParti(dir).status, 0);
  const keys = Object.keys(parti(dir, 'testpartiet'));
  const managed = keys.filter(key => PARTY_KEY_ORDER.includes(key));
  assert.deepEqual(keys.slice(managed.length), ['arkiv_id', 'grundad', 'wikidata']);
});

test('every JSON value type is preserved in a hand-added field', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);
  const values = {
    v_null: null,
    v_false: false,
    v_zero: 0,
    v_tom_strang: '',
    v_tom_array: [],
    v_tomt_objekt: {},
    v_nastlat: { b: [1, { c: 'två' }], a: null }
  };
  editParti(dir, 'testpartiet', values);

  assert.equal(runParti(dir).status, 0);
  const data = parti(dir, 'testpartiet');
  for (const [key, value] of Object.entries(values)) {
    assert.deepEqual(data[key], value, `${key} bevaras inte`);
  }
  assert.deepEqual(Object.keys(data.v_nastlat), ['b', 'a']);
});

test('derived/parti.json does not take up hand-added fields', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);
  editParti(dir, 'testpartiet', { grundad: '1988-02-04' });

  assert.equal(runParti(dir).status, 0);
  const entry = readJson(dir, 'data/derived/parti.json').find(party => party.filnamn === 'testpartiet');
  assert.equal('grundad' in entry, false);
});

test('a hand-edited value in a derived field is still rebuilt from the year files', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);
  editParti(dir, 'testpartiet', { forkortning: 'XX', grundad: '1988-02-04' });

  assert.equal(runParti(dir).status, 0);
  const data = parti(dir, 'testpartiet');
  assert.equal(data.forkortning, 'TP');
  assert.equal(data.grundad, '1988-02-04');
});

test('a hand-added field follows the party to its new filnamn', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);
  editParti(dir, 'testpartiet', { grundad: '1988-02-04' });

  const result = runImport(dir, '2026', CSV_2026);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(dir, 'data/parti/testpartiet')), false);
  assert.equal(parti(dir, 'nya-testpartiet').grundad, '1988-02-04');
});

test('an invalid field name stops the rebuild and writes nothing', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);
  editParti(dir, 'testpartiet', { Grundad: '1988-02-04' });
  const before = snapshot(dir);

  const result = runParti(dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /has field "Grundad", which is not a valid field name/);
  assert.deepEqual(snapshot(dir), before);
});

test('an invalid field name stops the import and writes nothing', t => {
  const parties = PARTIER.map(party => (party.filnamn === 'testpartiet'
    ? { ...party, 'founded-date': '1988-02-04' }
    : party));
  const dir = makeTree({ parties });
  t.after(() => removeTree(dir));
  const before = snapshot(dir);

  const result = runImport(dir, '2022', CSV_2022);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /has field "founded-date", which is not a valid field name/);
  assert.deepEqual(snapshot(dir), before);
});
