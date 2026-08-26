const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  buildCanonicalResult,
  parseHtmlTables,
  parseSourceFiles,
  serializeResult,
  sourceMetadata
} = require('./riksdag-results.js');

const UUID = '11111111-1111-4111-8111-111111111111';

function makeRegistry () {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'partidata-riksdagsval-'));
  const party = {
    uuid: UUID,
    kod: '0532',
    beteckning: 'Enad Röst',
    tidigare_beteckningar: ['Feministiskt initiativ'],
    filnamn: 'enad-rost',
    forkortning: 'ER'
  };
  fs.mkdirSync(path.join(root, 'parti', party.filnamn), { recursive: true });
  fs.mkdirSync(path.join(root, 'valresultat'), { recursive: true });
  fs.writeFileSync(path.join(root, 'parti', 'index.json'), JSON.stringify([{ ...party, kod: undefined }]));
  fs.writeFileSync(path.join(root, 'parti', party.filnamn, 'index.json'), JSON.stringify(party));
  fs.writeFileSync(path.join(root, 'valresultat', 'riksdag-partikopplingar.json'), JSON.stringify({
    schema_version: 1,
    kopplingar: [{ parti_uuid: UUID, kallbeteckningar: ['Feministiskt initiativ'], kallkoder: ['FI'] }],
    blockerade_kallbeteckningar: []
  }));
  return root;
}

test('the table parser keeps nested source tables separate', () => {
  const tables = parseHtmlTables('<table><tr><td>yttre<table><tr><th>Parti</th><td>Röster</td></tr></table></td></tr></table>');
  assert.deepEqual(tables, [
    [['Parti', 'Röster']],
    [['yttre']],
  ]);
});

test('the 2022 adapter removes summary duplicates but retains the residual aggregate', () => {
  const source = {
    valdeltagande: '84,21 %',
    rosterPaverkaMandat: {
      antalRoster: 100,
      partiroster: [
        { partikod: '0532', partibeteckning: 'Feministiskt initiativ', antalRoster: 90, visa: 0 },
        { partikod: null, partibeteckning: 'Övriga anmälda partier', antalRoster: 10, visa: 2 },
        { partikod: null, partibeteckning: 'Övriga ej särredovisade partier', antalRoster: 10, visa: 6 },
      ]
    },
    partiMandat: [{ partikod: '0532', partibeteckning: 'Feministiskt initiativ', antalMandat: 349 }]
  };
  const parsed = parseSourceFiles(2022, { resultat: Buffer.from(JSON.stringify(source)) });
  assert.deepEqual(parsed.rows.map(row => [row.partibeteckning, row.roster]), [
    ['Feministiskt initiativ', 90],
    ['Övriga ej särredovisade partier', 10],
  ]);
  assert.equal(parsed.giltigaRoster, 100);
  assert.equal(parsed.mandates[0].mandat, 349);
});

test('the same parsed input produces byte-identical canonical JSON and an explicit unresolved row', t => {
  const dataRoot = makeRegistry();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));
  const bytes = Buffer.from('official-source-bytes');
  const sources = sourceMetadata(2022, { resultat: bytes }, '2026-08-26');
  const raw = {
    valar: 2022,
    valdeltagande: 84.21,
    giltigaRoster: 100,
    rows: [
      { kallkod: '0532', partibeteckning: 'Feministiskt initiativ', roster: 90, kallreferens: 'resultat' },
      { kallkod: '9999', partibeteckning: 'Okänt historiskt parti', roster: 10, kallreferens: 'resultat' },
    ],
    mandates: [{ kallkod: '0532', partibeteckning: 'Feministiskt initiativ', mandat: 349 }]
  };
  const first = serializeResult(buildCanonicalResult(raw, sources, dataRoot));
  const second = serializeResult(buildCanonicalResult(structuredClone(raw), structuredClone(sources), dataRoot));
  assert.equal(first, second);
  const result = JSON.parse(first);
  assert.equal(result.rostresultat.partier[0].parti_uuid, UUID);
  assert.deepEqual(result.rostresultat.ej_kopplade.map(row => row.kallkod), ['9999']);
  assert.equal(result.kallor[0].sha256, '2d3f5c42b11ca15a77af1f8cb0f078d4c5b4ec24302b10feda2542b9cf84c0c7');
});

test('a scanned source records both the publication and transcription checksums', () => {
  const sources = sourceMetadata(1994, {
    publikation: Buffer.from('scanned publication'),
    transkribering: Buffer.from('reviewed transcription')
  }, '2026-08-26');

  assert.match(sources[0].sha256, /^[0-9a-f]{64}$/);
  assert.match(sources[0].transkribering_sha256, /^[0-9a-f]{64}$/);
  assert.notEqual(sources[0].sha256, sources[0].transkribering_sha256);
});
