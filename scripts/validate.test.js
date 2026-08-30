const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { writePartyProfileParliamentView } = require('./build-derived-data.js');
const { validateData, validateWikidataSection } = require('./validate.js');

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
  writeJson(root, 'derived/parti.json', [{
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

function parliamentResult (mandates = 349) {
  const source = {
    id: 'resultat',
    namn: 'Valmyndigheten',
    titel: 'Testresultat',
    url: 'https://example.com/resultat.json',
    version: 'Slutligt resultat',
    format: 'application/json',
    hamtad: '2026-08-25',
    sha256: 'a'.repeat(64)
  };
  return {
    schema_version: 2,
    valtyp: 'riksdag',
    valar: 2022,
    status: 'slutligt',
    kallor: [source],
    valdeltagande: { procent: 84, kallreferens: 'resultat' },
    rostresultat: {
      giltiga_roster: 1,
      kallreferenser: ['resultat'],
      partier: [{
        parti_uuid: PARTY.uuid,
        kallkod: 'T',
        partibeteckning: PARTY.beteckning,
        roster: 1,
        rostandel: 100,
        kallreferens: 'resultat'
      }],
      ej_kopplade: [],
      aggregat: []
    },
    mandatfordelning: {
      antal_mandat: mandates,
      kallreferenser: ['resultat'],
      partier: [{
        parti_uuid: PARTY.uuid,
        kallkod: 'T',
        partibeteckning: PARTY.beteckning,
        mandat: mandates,
        kallreferens: 'resultat'
      }]
    }
  };
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

test('validateData accepts an extension field with a snake_case name', t => {
  const root = makeData();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  writeJson(root, 'parti/testpartiet/index.json', { ...PARTY, grundad: '1988-02-04', wikidata_id: 'Q123' });

  assert.equal(validateData(root).parties, 1);
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
    assert.throws(() => validateData(root), /forkortning saknas i derived\/parti.json/);
  });

  await t.test('an invalid extension field name', t => {
    const root = makeData();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    writeJson(root, 'parti/testpartiet/index.json', { ...PARTY, 'founded-date': '1988-02-04' });
    assert.throws(() => validateData(root), /fältet "founded-date" har inte ett giltigt fältnamn/);
  });

  await t.test('an extension field name with a capital', t => {
    const root = makeData();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    writeJson(root, 'parti/testpartiet/index.json', { ...PARTY, Grundad: '1988-02-04' });
    assert.throws(() => validateData(root), /fältet "Grundad" har inte ett giltigt fältnamn/);
  });

  await t.test('a party registry left behind at parti/index.json', t => {
    const root = makeData();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    writeJson(root, 'parti/index.json', readJson(root, 'derived/parti.json'));
    assert.throws(() => validateData(root), /parti\/index\.json ska inte finnas/);
  });

  await t.test('a registry entry with a field the generator does not write', t => {
    const root = makeData();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    writeJson(root, 'parti/testpartiet/index.json', { ...PARTY, grundad: '1988-02-04' });
    const index = readJson(root, 'derived/parti.json');
    writeJson(root, 'derived/parti.json', [{ ...index[0], grundad: '1988-02-04' }]);
    assert.throws(() => validateData(root), /fältet "grundad" skrivs inte av scripts\/parti\.js/);
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
    writeJson(root, 'val/2022/valresultat/riksdag.json', parliamentResult(1));
    assert.throws(() => validateData(root), /antal_mandat ska vara 349/);
  });

  await t.test('duplicate party identities in one result', t => {
    const root = makeData();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const result = parliamentResult();
    result.rostresultat.partier.push({ ...result.rostresultat.partier[0], kallkod: 'T2', roster: 0, rostandel: 0 });
    writeJson(root, 'val/2022/valresultat/riksdag.json', result);
    assert.throws(() => validateData(root), /dubbelt parti_uuid/);
  });

  await t.test('unknown source codes are explicit instead of fake party UUIDs', t => {
    const root = makeData();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const result = parliamentResult();
    result.rostresultat.giltiga_roster = 2;
    result.rostresultat.partier[0].rostandel = 50;
    result.rostresultat.ej_kopplade.push({
      kallkod: 'XYZ',
      partibeteckning: 'Historiskt parti utan koppling',
      roster: 1,
      rostandel: 50,
      kallreferens: 'resultat'
    });
    writeJson(root, 'val/2022/valresultat/riksdag.json', result);
    writePartyProfileParliamentView(root);
    assert.doesNotThrow(() => validateData(root));

    result.rostresultat.partier.push({
      parti_uuid: '55555555-5555-4555-8555-555555555555',
      kallkod: 'XYZ',
      partibeteckning: 'Historiskt parti utan koppling',
      roster: 0,
      rostandel: 0,
      kallreferens: 'resultat'
    });
    result.rostresultat.ej_kopplade = [];
    writeJson(root, 'val/2022/valresultat/riksdag.json', result);
    assert.throws(() => validateData(root), /okänt parti-UUID/);
  });

  await t.test('stale derived parliamentary data', t => {
    const root = makeData();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    writeJson(root, 'val/2022/valresultat/riksdag.json', parliamentResult());
    writePartyProfileParliamentView(root);
    const derived = readJson(root, 'derived/riksdag.json');
    derived.senast_uppdaterad = '2026-08-24';
    writeJson(root, 'derived/riksdag.json', derived);
    assert.throws(() => validateData(root), /är inaktuell/);
  });
});

test('validateData accepts a wikidata section in every precision', t => {
  const root = makeData();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  for (const grundat of ['1988', '1988-02', '1988-02-29', undefined]) {
    writeJson(root, 'parti/testpartiet/index.json', {
      ...PARTY,
      wikidata: { id: 'Q10613549', ...(grundat ? { grundat } : {}), hamtad: '2026-08-29' }
    });
    assert.equal(validateData(root).parties, 1, `grundat ${grundat ?? 'saknas'} ska passera`);
  }
});

test('validateData rejects a malformed wikidata section', async t => {
  const cases = [
    ['a Q-id that is not one', { id: 'Q01', hamtad: '2026-08-29' }, /wikidata\.id ska vara ett Wikidata-id/],
    ['an empty Q-id', { id: '', hamtad: '2026-08-29' }, /wikidata\.id får inte vara tom/],
    ['a missing Q-id', { hamtad: '2026-08-29' }, /wikidata\.id ska vara en sträng/],
    ['a missing hamtad', { id: 'Q1' }, /wikidata\.hamtad saknas/],
    ['a hamtad without day precision', { id: 'Q1', hamtad: '2026-08' }, /wikidata\.hamtad ska vara ÅÅÅÅ-MM-DD/],
    ['a day that month does not have', { id: 'Q1', grundat: '1988-02-30', hamtad: '2026-08-29' }, /wikidata\.grundat är inte ett verkligt datum: 1988-02-30/],
    ['month zero', { id: 'Q1', grundat: '1988-00', hamtad: '2026-08-29' }, /wikidata\.grundat är inte ett verkligt datum: 1988-00/],
    ['an impossible date', { id: 'Q1', grundat: '2026-99-99', hamtad: '2026-08-29' }, /wikidata\.grundat är inte ett verkligt datum: 2026-99-99/],
    ['an empty grundat', { id: 'Q1', grundat: '', hamtad: '2026-08-29' }, /wikidata\.grundat får inte vara tom/],
    ['a misspelled key', { id: 'Q1', grundatt: '1988', hamtad: '2026-08-29' }, /wikidata\.grundatt är inte en känd nyckel/],
    ['an array', [], /wikidata ska vara ett objekt/],
    ['null', null, /wikidata ska vara ett objekt/]
  ];

  for (const [name, wikidata, message] of cases) {
    await t.test(name, t => {
      const root = makeData();
      t.after(() => fs.rmSync(root, { recursive: true, force: true }));
      writeJson(root, 'parti/testpartiet/index.json', { ...PARTY, wikidata });
      assert.throws(() => validateData(root), message);
    });
  }
});

test('validateData rejects a Q-id claimed by two parties', t => {
  const root = makeData();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const second = {
    uuid: '55555555-5555-4555-8555-555555555555',
    kod: '9002',
    beteckning: 'Provpartiet',
    filnamn: 'provpartiet'
  };
  writeJson(root, 'derived/parti.json', [
    { uuid: second.uuid, beteckning: second.beteckning, filnamn: second.filnamn },
    { uuid: PARTY.uuid, beteckning: PARTY.beteckning, filnamn: PARTY.filnamn }
  ]);
  const wikidata = { id: 'Q10613549', grundat: '1988-02-29', hamtad: '2026-08-29' };
  writeJson(root, 'parti/provpartiet/index.json', { ...second, wikidata });
  writeJson(root, 'parti/testpartiet/index.json', { ...PARTY, wikidata: { ...wikidata, id: 'Q9999' } });
  assert.equal(validateData(root).parties, 2);

  writeJson(root, 'parti/testpartiet/index.json', { ...PARTY, wikidata });
  assert.throws(
    () => validateData(root),
    /testpartiet\.wikidata\.id Q10613549 används redan av provpartiet/
  );
});

function readJson (root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

test('validateWikidataSection points at the import when only the Q-id is there', () => {
  assert.throws(
    () => validateWikidataSection({ id: 'Q504069' }, 'sverigedemokraterna.wikidata'),
    /hamtad saknas.*npm run import-wikidata/s
  );
});
