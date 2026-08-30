const assert = require('node:assert/strict');
const test = require('node:test');

const { classifyDataPath, dataPath, matchesEtag } = require('../src/server/data-resources.ts');

const ACCEPTED = [
  [['derived', 'parti.json'], { kind: 'registry' }],
  [['derived', 'riksdag.json'], { kind: 'derived-parliament' }],
  [['regioner', 'index.json'], { kind: 'regions' }],
  [['parti', 'moderaterna', 'index.json'], { kind: 'party', filnamn: 'moderaterna' }],
  [['val', '2026', 'partideltagande', 'kommun.json'], { kind: 'participation', valar: '2026', fil: 'kommun' }],
  [['val', '2018', 'partideltagande', 'landsting.json'], { kind: 'participation', valar: '2018', fil: 'landsting' }],
  [['val', '2022', 'valresultat', 'riksdag.json'], { kind: 'results', valar: '2022' }]
];

const REJECTED = [
  [],
  [''],
  ['derived'],
  ['derived', 'parti.json', 'x'],
  ['parti', 'moderaterna'],
  ['parti', 'moderaterna', 'profil.json'],
  ['parti', 'moderaterna', '0001-moderaterna.png'],
  ['parti', 'kodbyten.json'],
  ['val', '2018', 'kandidatlistor', 'gotenes-framtid.json'],
  ['val', '2022', 'valresultat', 'scb-tabeller.json'],
  ['val', '22', 'partideltagande', 'partier.json'],
  ['val', '2022', 'partideltagande', 'ovrigt.json'],
  ['valresultat', 'riksdag-partikopplingar.json'],
  ['..', 'package.json'],
  ['parti', '..', 'kodbyten.json'],
  ['Derived', 'parti.json'],
  ['derived', 'parti.JSON'],
  ['derived', 'parti.json/']
];

test('the allowlist names every published resource', () => {
  for (const [segments, resource] of ACCEPTED) {
    assert.deepEqual(classifyDataPath(segments), resource, segments.join('/'));
  }
});

test('the path is rebuilt from the resource, not from the input', () => {
  for (const [segments] of ACCEPTED) {
    assert.deepEqual(dataPath(classifyDataPath(segments)), segments, segments.join('/'));
  }
});

test('everything outside the allowlist names no resource', () => {
  for (const segments of REJECTED) {
    assert.equal(classifyDataPath(segments), undefined, JSON.stringify(segments));
  }
});

test('an entity tag matches through a weakening proxy but never unquoted', () => {
  const etag = '"abc"';
  for (const header of ['"abc"', 'W/"abc"', '"x", "abc"', ' "abc" ', '*']) {
    assert.equal(matchesEtag(header, etag), true, header);
  }
  for (const header of [undefined, '', '"abd"', 'abc', '"ab', 'W/abc']) {
    assert.equal(matchesEtag(header, etag), false, String(header));
  }
});
