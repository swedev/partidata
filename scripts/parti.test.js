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

  const alias = parti(dir, 'aliaspartiet');
  assert.equal(alias.uuid, PARTIER[2].uuid);
  assert.equal(alias.kod, '9106');
  assert.deepEqual(alias.tidigare_koder, ['9006']);
  assert.equal(alias.beteckning, 'Omdöpt via alias');
  assert.deepEqual(alias.tidigare_beteckningar, ['Aliaspartiet']);
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

test('a renamed party keeps its filnamn and lists the old name', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);
  assert.equal(runImport(dir, '2026', CSV_2026).status, 0);

  const testpartiet = parti(dir, 'testpartiet');
  assert.equal(testpartiet.beteckning, 'Nya Testpartiet');
  assert.deepEqual(testpartiet.tidigare_beteckningar, ['Testpartiet']);
  assert.equal(testpartiet.forkortning, 'NTP');
  assert.equal(readJson(dir, 'data/parti/index.json').find(p => p.filnamn === 'testpartiet').beteckning, 'Nya Testpartiet');
});

test('deltagande is derived per year from the val files', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);
  assert.equal(runImport(dir, '2026', CSV_2026).status, 0);

  assert.deepEqual(parti(dir, 'testpartiet').deltagande, {
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
