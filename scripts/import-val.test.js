const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { test } = require('node:test');

const { parseCsv, fetchText } = require('./utils.js');
const { parseRows, collectPartier, sortGrunder, parseArgs } = require('./import-val.js');
const { fixture, makeTree, removeTree, runImport, readJson, snapshot } = require('./fixtures/tree.js');

const CSV_2022 = fixture('val-2022.csv');
const CSV_2026 = fixture('val-2026.csv');

/**
 * readFixture
 */
function readFixture (file) {
  return fs.readFileSync(file, 'utf8');
}

test('parseCsv strips the BOM and reads the header', () => {
  const { header, rows } = parseCsv(readFixture(CSV_2022));
  assert.equal(header[0], 'VALTYP');
  assert.equal(header.length, 16);
  assert.equal(rows.length, 11);
});

test('parseCsv accepts the trailing separator the 2022 file carries', () => {
  const { rows } = parseCsv(readFixture(CSV_2022));
  assert.equal(rows[0].DELTAGANDEGRUND, 'K');
});

test('parseCsv turns a single space into an empty value', () => {
  const { rows } = parseCsv(readFixture(CSV_2022));
  const lokalpartiet = rows.find(row => row.PARTIKOD === '9002');
  assert.equal(lokalpartiet.PARTIFÖRKORTNING, '');
});

test('parseCsv rejects a row of the wrong width', () => {
  const text = readFixture(CSV_2026).replace('RD;00;Riket;01;', 'RD;00;Riket;');
  assert.throws(() => parseCsv(text), /row 2 has 15 values, expected 16/);
});

test('parseCsv rejects quotes and duplicate columns', () => {
  assert.throws(() => parseCsv('A;B\n"x";y\n'), /quote character/);
  assert.throws(() => parseCsv('A;A\nx;y\n'), /duplicate column name/);
});

test('parseRows rejects unknown column names', () => {
  const text = readFixture(CSV_2026).replace('VALTYP;', 'VALSLAG;');
  assert.throws(() => parseRows(text), /Unexpected columns/);
});

test('parseRows rejects invalid field values', () => {
  const cases = [
    ['RD;00;Riket', 'XX;00;Riket', /unknown VALTYP/],
    [';N;N;A\n', ';N;N;Z\n', /unknown DELTAGANDEGRUND/],
    [';9001;', ';901;', /invalid PARTIKOD/],
    [';J;N;A\n', ';X;N;A\n', /invalid REGISTRERADPARTIBETECKNING/],
    ['KF;0114;', 'KF;114;', /invalid VALOMRÅDESKOD/]
  ];
  for (const [from, to, expected] of cases) {
    const text = readFixture(CSV_2026).replace(from, to);
    assert.notEqual(text, readFixture(CSV_2026));
    assert.throws(() => parseRows(text), expected);
  }
});

test('collectPartier deduplicates on PARTIKOD and keeps a registered beteckning', () => {
  const partier = collectPartier(parseRows(readFixture(CSV_2022)));
  assert.deepEqual(partier.map(party => party.kod), ['9001', '9002', '9004', '9005', '9006', '9010', '9011']);
  const lokalpartiet = partier.find(party => party.kod === '9002');
  assert.equal(lokalpartiet.forkortning, '');
  assert.equal(lokalpartiet.registrerad_partibeteckning, true);
});

test('collectPartier rejects a code with two beteckningar', () => {
  const text = readFixture(CSV_2022).replace('Lokalpartiet; ;9002', 'Annat namn; ;9002');
  assert.throws(() => collectPartier(parseRows(text)), /two beteckningar/);
});

test('sortGrunder lists the grounds in the order Valmyndigheten uses', () => {
  assert.deepEqual(sortGrunder(new Set(['K', 'A'])), ['A', 'K']);
  assert.deepEqual(sortGrunder(new Set(['K', 'R'])), ['R', 'K']);
  assert.deepEqual(sortGrunder(new Set(['K', 'R', 'A'])), ['A', 'R', 'K']);
});

test('parseRows rejects a file with no rows or a missing valtyp', () => {
  const header = readFixture(CSV_2026).split('\n')[0];
  assert.throws(() => parseRows(header + '\n'), /no data rows/);

  const utanKF = readFixture(CSV_2026)
    .split('\n')
    .filter(line => !line.startsWith('KF;'))
    .join('\n');
  assert.throws(() => parseRows(utanKF), /no KF rows, so it is empty or truncated/);
});

test('parseArgs requires a four-digit year', () => {
  assert.deepEqual(parseArgs(['2026']), { year: '2026', file: null });
  assert.throws(() => parseArgs([]), /Usage/);
  assert.throws(() => parseArgs(['26']), /Usage/);
  assert.throws(() => parseArgs(['2026', '--file']), /--file requires a path/);
});

test('fetchText throws on a non-2xx response', async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(503);
    res.end('nope');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/deltagande-partier.csv`;
  await assert.rejects(fetchText(url), /503/);
  await new Promise(resolve => server.close(resolve));
});

test('an import writes the four year files, deduplicating the per-valkrets rows', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));

  const result = runImport(dir, '2022', CSV_2022);
  assert.equal(result.status, 0, result.stderr);

  const riksdag = readJson(dir, 'data/val/2022/partideltagande/riksdag.json');
  assert.deepEqual(riksdag.map(party => party.kod), ['9001']);
  assert.deepEqual(riksdag[0].grunder, ['A', 'K']);

  const region = readJson(dir, 'data/val/2022/partideltagande/region.json');
  assert.equal(region.length, 1);
  assert.equal(region[0].kod, '01');
  assert.deepEqual(region[0].partier.map(party => party.kod), ['9001', '9002']);
});

test('every kommun is listed, with an empty partier array when it has none', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);

  const regioner = readJson(dir, 'data/regioner/index.json');
  const antalKommuner = regioner.reduce((sum, region) => sum + region.kommuner.length, 0);
  const kommun = readJson(dir, 'data/val/2022/partideltagande/kommun.json');
  assert.equal(antalKommuner, 290);
  assert.equal(kommun.length, 290);
  assert.deepEqual(kommun.map(k => k.kod), [...kommun.map(k => k.kod)].sort());
  assert.deepEqual(kommun.find(k => k.kod === '0127').partier, []);
  assert.deepEqual(kommun.find(k => k.kod === '0114').partier.map(p => p.kod), ['9001', '9002']);
});

test('nothing is written when the CSV does not validate', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  const before = snapshot(dir);

  const broken = path.join(dir, 'broken.csv');
  fs.writeFileSync(broken, readFixture(CSV_2022).replace('RD;00;Riket;01;', 'XX;00;Riket;01;'));

  const result = runImport(dir, '2022', broken);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown VALTYP/);
  assert.deepEqual(snapshot(dir), before);
});

test('a second import of the same file changes nothing', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);
  assert.equal(runImport(dir, '2026', CSV_2026).status, 0);
  const before = snapshot(dir);

  assert.equal(runImport(dir, '2022', CSV_2022).status, 0);
  assert.equal(runImport(dir, '2026', CSV_2026).status, 0);
  assert.deepEqual(snapshot(dir), before);
});
