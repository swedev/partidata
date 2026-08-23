const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const { zipSync } = require('fflate');

const {
  LEGACY_BASE_URL,
  assertStoredSymbolFileName,
  parseArgs,
  normalizeCode,
  readZipSymbols,
  symbolFileName,
  symbolUrl
} = require('./import-partisymboler.js');
const {
  makeTree,
  removeTree,
  runParti,
  runSymbolImport,
  readJson
} = require('./fixtures/tree.js');

const PNG_A = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);
const PNG_B = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x02]);

function writeZip (dir, files) {
  const file = path.join(dir, 'symbols.zip');
  fs.writeFileSync(file, Buffer.from(zipSync(files)));
  return file;
}

test('parseArgs validates the year and optional paths', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  const zip = writeZip(dir, { '9001_Val 2026.png': PNG_A });

  assert.deepEqual(parseArgs(['2026']), { year: '2026', file: null, legacyDir: null });
  assert.deepEqual(parseArgs(['2026', '--file', zip, '--legacy-dir', dir]), {
    year: '2026',
    file: zip,
    legacyDir: dir
  });
  assert.throws(() => parseArgs([]), /Usage/);
  assert.throws(() => parseArgs(['26']), /Usage/);
  assert.throws(() => parseArgs(['2026', '--file']), /--file requires a path/);
  assert.throws(() => parseArgs(['2026', '--legacy-dir', path.join(dir, 'missing')]), /No such directory/);
});

test('readZipSymbols normalizes codes and validates the archive', () => {
  const zip = Buffer.from(zipSync({
    '1_Val 2026.png': PNG_A,
    '1430_Val 2026.png': PNG_B
  }));
  const symbols = readZipSymbols(zip, '2026');

  assert.deepEqual(symbols.map(symbol => symbol.code), ['0001', '1430']);
  assert.deepEqual(symbols[0].data, PNG_A);
  assert.equal(normalizeCode('68'), '0068');
  assert.equal(symbolFileName('0001', 'Moderaterna'), '0001-moderaterna.png');
  assert.doesNotThrow(() => assertStoredSymbolFileName('0001-moderaterna.png'));
  assert.throws(() => assertStoredSymbolFileName('../0001-moderaterna.png'), /Invalid stored/);
  assert.throws(() => normalizeCode('12345'), /Invalid partikod/);
  assert.throws(
    () => readZipSymbols(Buffer.from(zipSync({ '1_Val 2022.png': PNG_A })), '2026'),
    /Unexpected file/
  );
  assert.throws(
    () => readZipSymbols(Buffer.from(zipSync({ '1_Val 2026.png': Buffer.from('not png') })), '2026'),
    /not a PNG/
  );
});

test('current symbols win and a legacy symbol fills a missing party', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  const zip = writeZip(dir, { '9001_Val 2026.png': PNG_A });
  const legacy = path.join(dir, 'legacy');
  fs.mkdirSync(legacy);
  fs.writeFileSync(path.join(legacy, '9001.png'), PNG_B);
  fs.writeFileSync(path.join(legacy, '9005.png'), PNG_B);

  const result = runSymbolImport(dir, '2026', zip, legacy);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Aktuella symboler: 1/);
  assert.match(result.stdout, /Äldre symboler: 1/);
  assert.match(result.stdout, /Överhoppade äldre symboler: 1/);

  const current = readJson(dir, 'data/parti/testpartiet/index.json');
  assert.deepEqual(current.partisymbol, {
    filnamn: '9001-testpartiet.png',
    kalla: 'Valmyndigheten',
    kallurl: symbolUrl('2026'),
    valar: 2026,
    partikod: '9001'
  });
  assert.deepEqual(fs.readFileSync(path.join(dir, 'data/parti/testpartiet/9001-testpartiet.png')), PNG_A);

  const fallback = readJson(dir, 'data/parti/gamla-partiet/index.json');
  assert.deepEqual(fallback.partisymbol, {
    filnamn: '9005-gamla-partiet.png',
    kalla: 'Valmyndigheten',
    kallurl: `${LEGACY_BASE_URL}/9005.png`,
    valar: 2019,
    partikod: '9005'
  });
  assert.deepEqual(fs.readFileSync(path.join(dir, 'data/parti/gamla-partiet/9005-gamla-partiet.png')), PNG_B);

  const indexEntry = readJson(dir, 'data/parti/index.json').find(entry => entry.uuid === current.uuid);
  assert.deepEqual(indexEntry.partisymbol, current.partisymbol);

  const rebuilt = runParti(dir);
  assert.equal(rebuilt.status, 0, rebuilt.stderr);
  assert.deepEqual(readJson(dir, 'data/parti/testpartiet/index.json').partisymbol, current.partisymbol);
});

test('an unknown symbol code stops the import before writing', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  const zip = writeZip(dir, { '9999_Val 2026.png': PNG_A });

  const result = runSymbolImport(dir, '2026', zip);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No party found for symbol code 9999/);
  assert.equal(fs.existsSync(path.join(dir, 'data/parti/testpartiet/9999-testpartiet.png')), false);
  assert.equal(readJson(dir, 'data/parti/testpartiet/index.json').partisymbol, undefined);
});

test('a changed code or name filename replaces the previous symbol file', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  const zip = writeZip(dir, { '9001_Val 2026.png': PNG_A });
  assert.equal(runSymbolImport(dir, '2026', zip).status, 0);

  const partyDir = path.join(dir, 'data/parti/testpartiet');
  const oldName = '9001-gammalt-namn.png';
  fs.renameSync(path.join(partyDir, '9001-testpartiet.png'), path.join(partyDir, oldName));
  const party = readJson(partyDir, 'index.json');
  party.partisymbol.filnamn = oldName;
  fs.writeFileSync(path.join(partyDir, 'index.json'), JSON.stringify(party, null, 2) + '\n');

  const result = runSymbolImport(dir, '2026', zip);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(partyDir, oldName)), false);
  assert.deepEqual(fs.readFileSync(path.join(partyDir, '9001-testpartiet.png')), PNG_A);
});
