const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { writePartyProfileParliamentView } = require('./build-derived-data.js');
const { validateData } = require('./validate.js');

const PARTY = {
  uuid: '11111111-1111-4111-8111-111111111111',
  kod: '9001',
  beteckning: 'Testpartiet',
  filnamn: 'testpartiet'
};
const REGION = {
  kod: '01',
  namn: 'Testlän',
  uuid: '22222222-2222-4222-8222-222222222222'
};
const MUNICIPALITIES = [
  { kod: '0101', namn: 'Testköping', uuid: '33333333-3333-4333-8333-333333333333' },
  { kod: '0102', namn: 'Provstad', uuid: '44444444-4444-4444-8444-444444444444' }
];

function writeJson (root, relativePath, value) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

function makeData () {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'partidata-validation-'));
  writeJson(root, 'parti/index.json', [{
    uuid: PARTY.uuid,
    beteckning: PARTY.beteckning,
    filnamn: PARTY.filnamn
  }]);
  writeJson(root, 'parti/testpartiet/index.json', PARTY);
  writeJson(root, 'regioner/index.json', [{ ...REGION, kommuner: MUNICIPALITIES }]);
  writeJson(root, 'val/2026/partideltagande/partier.json', [PARTY]);
  writeJson(root, 'val/2026/partideltagande/riksdag.json', [PARTY]);
  writeJson(root, 'val/2026/partideltagande/region.json', [{ ...REGION, partier: [PARTY] }]);
  writeJson(root, 'val/2026/partideltagande/kommun.json', MUNICIPALITIES.map(municipality => ({
    ...municipality,
    partier: [PARTY]
  })));
  return root;
}

test('validateData accepts a consistent data tree', t => {
  const root = makeData();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  assert.deepEqual(validateData(root), {
    parties: 1,
    regions: 1,
    municipalities: 2,
    years: 1,
    referenceCount: 5,
    candidateListCount: 0
  });
});

test('validateData rejects inconsistencies with useful errors', async t => {
  await t.test('missing party files', t => {
    const root = makeData();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.rmSync(path.join(root, 'parti/testpartiet'), { recursive: true });
    assert.throws(() => validateData(root), /Partikatalogerna ska motsvara/);
  });

  await t.test('duplicate UUIDs across entity types', t => {
    const root = makeData();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const regions = readJson(root, 'regioner/index.json');
    regions[0].uuid = PARTY.uuid;
    writeJson(root, 'regioner/index.json', regions);
    const electionRegions = readJson(root, 'val/2026/partideltagande/region.json');
    electionRegions[0].uuid = PARTY.uuid;
    writeJson(root, 'val/2026/partideltagande/region.json', electionRegions);
    assert.throws(() => validateData(root), /partier, regioner och kommuner innehåller dubbelt uuid/);
  });

  await t.test('unknown party references', t => {
    const root = makeData();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const records = readJson(root, 'val/2026/partideltagande/riksdag.json');
    records[0].uuid = '55555555-5555-4555-8555-555555555555';
    writeJson(root, 'val/2026/partideltagande/riksdag.json', records);
    assert.throws(() => validateData(root), /okänt parti-UUID/);
  });

  await t.test('incomplete municipality files for imported years', t => {
    const root = makeData();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    writeJson(root, 'val/2026/partideltagande/kommun.json', [{ ...MUNICIPALITIES[0], partier: [] }]);
    assert.throws(() => validateData(root), /ska innehålla samtliga områden/);
  });

  await t.test('index entries that omit a field of the party file', t => {
    const root = makeData();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    writeJson(root, 'parti/testpartiet/index.json', { ...PARTY, forkortning: 'TP' });
    assert.throws(() => validateData(root), /forkortning saknas i index.json/);
  });

  await t.test('invalid curated party profiles', t => {
    const root = makeData();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    writeJson(root, 'parti/testpartiet/profil.json', {
      namn: 'Testpartiet',
      namn_kalla: { namn: 'Testpartiet', url: 'inte-en-url', hamtad: '2026-08-24' }
    });
    assert.throws(() => validateData(root), /namn_kalla.url ska vara en giltig URL/);
  });

  await t.test('invalid curated election results', t => {
    const root = makeData();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    writeJson(root, 'parti/testpartiet/profil.json', {
      namn: 'Testpartiet',
      namn_kalla: { namn: 'Testpartiet', url: 'https://example.com', hamtad: '2026-08-24' },
      valresultat: {
        valtyp: 'riksdag',
        kallor: [{ namn: 'Valmyndigheten', url: 'https://www.val.se', hamtad: '2026-08-24' }],
        resultat: [
          { valar: 2022, rostandel: 5, mandat: 18 },
          { valar: 2018, rostandel: 4, mandat: 14 }
        ]
      }
    });
    assert.throws(() => validateData(root), /ska vara sorterat på valår/);
  });

  await t.test('invalid parliamentary election result', t => {
    const root = makeData();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    writeJson(root, 'val/2022/valresultat/riksdag.json', {
      valar: 2022,
      valdeltagande: {
        procent: 84,
        kalla: { namn: 'SCB', url: 'https://www.scb.se/', hamtad: '2026-08-25' }
      },
      mandatfordelning: {
        partier: [{ forkortning: 'T', mandat: 1 }],
        kalla: { namn: 'Riksdagen', url: 'https://data.riksdagen.se/', hamtad: '2026-08-25' }
      }
    });
    assert.throws(() => validateData(root), /ska innehålla 349 mandat/);
  });

  await t.test('stale derived parliamentary data', t => {
    const root = makeData();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    writeJson(root, 'val/2022/valresultat/riksdag.json', {
      valar: 2022,
      valdeltagande: {
        procent: 84,
        kalla: { namn: 'SCB', url: 'https://www.scb.se/', hamtad: '2026-08-25' }
      },
      mandatfordelning: {
        partier: [{ forkortning: 'T', mandat: 349 }],
        kalla: { namn: 'Riksdagen', url: 'https://data.riksdagen.se/', hamtad: '2026-08-25' }
      }
    });
    writePartyProfileParliamentView(root);
    const derived = readJson(root, 'derived/partiprofil/riksdag.json');
    derived.senast_uppdaterad = '2026-08-24';
    writeJson(root, 'derived/partiprofil/riksdag.json', derived);
    assert.throws(() => validateData(root), /är inaktuell/);
  });
});

function readJson (root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}
