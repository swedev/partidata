const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const { png, sheet, CLEAR } = require('./fixtures/png.js');
const { measureParties } = require('./measure-partisymboler.js');
const { makeTree, removeTree, runMeasureSymbols, readJson } = require('./fixtures/tree.js');

const SYMBOL = png(sheet(CLEAR));
const UNREADABLE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);

function registry (partisymbol) {
  return { parties: [{ filnamn: 'testpartiet', partisymbol }] };
}

test('measureParties records the sheet and the box the drawing occupies', () => {
  const provenance = {
    filnamn: '9001-testpartiet.png',
    kalla: 'Valmyndigheten',
    kallurl: 'https://data.val.se/filer/val2026/parti/partisymboler.zip',
    valar: 2026,
    partikod: '9001'
  };
  const parties = registry({ ...provenance });
  const result = measureParties(parties, () => SYMBOL);

  assert.deepEqual(result, { measured: ['testpartiet'], unmeasured: [] });
  assert.deepEqual(parties.parties[0].partisymbol, {
    ...provenance,
    bild: { bredd: 10, hojd: 6 },
    bildyta: { x: 3, y: 1, bredd: 4, hojd: 2 }
  });
});

test('an unmeasurable symbol keeps its provenance and loses a stale measurement', () => {
  const parties = registry({
    filnamn: '9001-testpartiet.png',
    kalla: 'Valmyndigheten',
    kallurl: 'https://example.com/symbol.png',
    valar: 2026,
    partikod: '9001',
    bild: { bredd: 100, hojd: 20 },
    bildyta: { x: 0, y: 0, bredd: 100, hojd: 20 }
  });
  const result = measureParties(parties, () => UNREADABLE);

  assert.deepEqual(result, { measured: [], unmeasured: ['testpartiet'] });
  assert.deepEqual(parties.parties[0].partisymbol, {
    filnamn: '9001-testpartiet.png',
    kalla: 'Valmyndigheten',
    kallurl: 'https://example.com/symbol.png',
    valar: 2026,
    partikod: '9001'
  });
});

test('a party without a symbol is left alone', () => {
  const parties = registry(undefined);
  assert.deepEqual(measureParties(parties, () => {
    throw new Error('should not read a symbol');
  }), { measured: [], unmeasured: [] });
  assert.equal(parties.parties[0].partisymbol, undefined);
});

test('the script writes measurements into the committed registry', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  const partyDir = path.join(dir, 'data/parti/testpartiet');
  fs.writeFileSync(path.join(partyDir, '9001-testpartiet.png'), SYMBOL);
  const party = readJson(partyDir, 'index.json');
  party.partisymbol = {
    filnamn: '9001-testpartiet.png',
    kalla: 'Valmyndigheten',
    kallurl: 'https://data.val.se/filer/val2026/parti/partisymboler.zip',
    valar: 2026,
    partikod: '9001'
  };
  fs.writeFileSync(path.join(partyDir, 'index.json'), JSON.stringify(party, null, 2) + '\n');

  const result = runMeasureSymbols(dir);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Mätta symboler: 1/);
  assert.match(result.stdout, /Omätta symboler: 0/);

  const measured = readJson(partyDir, 'index.json').partisymbol;
  assert.deepEqual(measured.bild, { bredd: 10, hojd: 6 });
  assert.deepEqual(measured.bildyta, { x: 3, y: 1, bredd: 4, hojd: 2 });

  const indexEntry = readJson(dir, 'data/derived/parti.json').find(entry => entry.filnamn === 'testpartiet');
  assert.deepEqual(indexEntry.partisymbol, measured);
});

test('a hand-added field survives the symbol measurement', t => {
  const dir = makeTree();
  t.after(() => removeTree(dir));
  const partyDir = path.join(dir, 'data/parti/testpartiet');
  fs.writeFileSync(path.join(partyDir, '9001-testpartiet.png'), SYMBOL);
  const party = readJson(partyDir, 'index.json');
  party.partisymbol = {
    filnamn: '9001-testpartiet.png',
    kalla: 'Valmyndigheten',
    kallurl: 'https://data.val.se/filer/val2026/parti/partisymboler.zip',
    valar: 2026,
    partikod: '9001'
  };
  party.grundad = '1988-02-04';
  fs.writeFileSync(path.join(partyDir, 'index.json'), JSON.stringify(party, null, 2) + '\n');

  const result = runMeasureSymbols(dir);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readJson(partyDir, 'index.json').grundad, '1988-02-04');
});
