const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

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
 * identity
 * The registry reduced to what must not depend on import order.
 * @param  {String} dir
 * @return {Object[]}
 */
function identity (dir) {
  const index = readJson(dir, 'data/parti/index.json');
  return index.map(entry => {
    const data = parti(dir, entry.filnamn);
    return {
      filnamn: data.filnamn,
      kod: data.kod,
      tidigare_koder: data.tidigare_koder || [],
      beteckning: data.beteckning,
      tidigare_beteckningar: data.tidigare_beteckningar || [],
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

  const entry = readJson(dir, 'data/parti/index.json').find(p => p.uuid === PARTIER[0].uuid);
  assert.equal(entry.filnamn, 'nya-testpartiet');
  assert.deepEqual(entry.tidigare_filnamn, ['testpartiet']);
  assert.match(result.stdout, /9001 Testpartiet → Nya Testpartiet \(testpartiet → nya-testpartiet\)/);
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

test('index.json is sorted by filnamn and covers every party file', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);

  const index = readJson(dir, 'data/parti/index.json');
  const filnamn = index.map(entry => entry.filnamn);
  assert.deepEqual(filnamn, [...filnamn].sort());
  const dirs = fs.readdirSync(path.join(dir, 'data/parti'), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
  assert.deepEqual(filnamn.slice().sort(), dirs.sort());
});

test('index.json carries the forkortning of the party file', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);

  const index = readJson(dir, 'data/parti/index.json');
  const entry = index.find(party => party.filnamn === 'testpartiet');
  assert.equal(entry.forkortning, 'TP');
  assert.equal(entry.forkortning, parti(dir, 'testpartiet').forkortning);
  assert.ok(index.every(party => !('forkortning' in party) || typeof party.forkortning === 'string'));
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
