const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createPartyDataStore } = require('../src/server/party-data.ts');

function writeJson (root, relativePath, value) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

function makeData () {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'partidata-server-'));
  const dataRoot = path.join(root, 'data');
  const testParty = {
    uuid: '11111111-1111-4111-8111-111111111111',
    kod: '9001',
    beteckning: 'Testpartiet',
    filnamn: 'testpartiet',
    tidigare_filnamn: ['gamla-testpartiet'],
    partisymbol: {
      filnamn: '9001-testpartiet.png',
      kalla: 'Test',
      kallurl: 'https://example.com/symbol.png',
      valar: 2026,
      partikod: '9001'
    }
  };
  const plainParty = {
    uuid: '22222222-2222-4222-8222-222222222222',
    kod: '9002',
    beteckning: 'Utan profil',
    filnamn: 'utan-profil'
  };

  writeJson(dataRoot, 'parti/index.json', [testParty, plainParty].map(({ kod, ...party }) => party));
  writeJson(dataRoot, 'parti/testpartiet/index.json', testParty);
  writeJson(dataRoot, 'parti/testpartiet/profil.json', {
    namn: 'Testpartiet',
    namn_kalla: { namn: 'Test', url: 'https://example.com', hamtad: '2026-08-26' }
  });
  writeJson(dataRoot, 'parti/utan-profil/index.json', plainParty);
  fs.writeFileSync(path.join(dataRoot, 'parti/testpartiet/9001-testpartiet.png'), Buffer.from([1, 2, 3]));
  writeJson(dataRoot, 'val/2018/kandidatlistor/testpartiet.json', {
    val: ['R'],
    kandidatlistor: [{ val: 'K' }, { val: 'R' }, { val: 'invalid' }]
  });
  fs.mkdirSync(path.join(dataRoot, 'val/2022/partideltagande'), { recursive: true });
  fs.mkdirSync(path.join(dataRoot, 'val/partideltagande'), { recursive: true });

  return { root, dataRoot };
}

test('party data resolves current, previous and unknown slugs', async t => {
  const { root, dataRoot } = makeData();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createPartyDataStore(dataRoot);

  const current = await store.resolveParty('testpartiet');
  assert.equal(current.kind, 'party');
  assert.equal(current.props.profile.namn, 'Testpartiet');
  assert.deepEqual(current.props.candidateLists, { 2018: ['R', 'K'] });
  assert.equal(current.props.symbolSrc, '/partisymbol/testpartiet/9001-testpartiet.png');
  assert.deepEqual(await store.resolveParty('gamla-testpartiet'), {
    kind: 'redirect',
    destination: '/parti/testpartiet/'
  });
  assert.deepEqual(await store.resolveParty('okant-parti'), { kind: 'notFound' });
});

test('optional profile and candidate lists may be absent', async t => {
  const { root, dataRoot } = makeData();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const result = await createPartyDataStore(dataRoot).resolveParty('utan-profil');
  assert.equal(result.kind, 'party');
  assert.equal(result.props.profile, undefined);
  assert.deepEqual(result.props.candidateLists, {});
});

test('party symbols require an exact registered slug and filename', async t => {
  const { root, dataRoot } = makeData();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createPartyDataStore(dataRoot);

  const symbol = await store.readPartySymbol('testpartiet', '9001-testpartiet.png');
  assert.equal(symbol.contentType, 'image/png');
  assert.deepEqual(symbol.body, Buffer.from([1, 2, 3]));
  assert.equal(await store.readPartySymbol('testpartiet', '../index.json'), undefined);
  assert.equal(await store.readPartySymbol('../parti/testpartiet', '9001-testpartiet.png'), undefined);
  assert.equal(await store.readPartySymbol('gamla-testpartiet', '9001-testpartiet.png'), undefined);
});

test('health and sitemap data use the indexed current parties', async t => {
  const { root, dataRoot } = makeData();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createPartyDataStore(dataRoot);

  await store.assertHealthy();
  assert.deepEqual(await store.listCurrentSlugs(), ['testpartiet', 'utan-profil']);
});

test('health fails when the party index is unavailable', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'partidata-server-missing-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  await assert.rejects(createPartyDataStore(path.join(root, 'data')).assertHealthy(), /ENOENT/);
});

test('health fails when the runtime collation guard rejects the runtime', async t => {
  const { root, dataRoot } = makeData();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createPartyDataStore(dataRoot, {
    assertCollation () { throw new Error('Runtime saknar svensk kollation'); }
  });

  await assert.rejects(store.assertHealthy(), /saknar svensk kollation/);
});

function makeHomeData () {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'partidata-home-'));
  const dataRoot = path.join(root, 'data');
  // Deliberately unordered, and picked so root collation would place
  // Jämtlands Väl before Jarl and the Å/Ä/Ö parties among A and O.
  const parties = [
    {
      uuid: '55555555-5555-4555-8555-555555555555',
      kod: '9005',
      beteckning: 'Östra partiet',
      filnamn: 'ostra-partiet'
    },
    {
      uuid: '99999999-9999-4999-8999-999999999999',
      kod: '9009',
      beteckning: 'Kommunens Väl',
      filnamn: 'kommunens-val-beta'
    },
    {
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      kod: '9010',
      beteckning: 'Jämtlands Väl',
      filnamn: 'jamtlands-val'
    },
    {
      uuid: '22222222-2222-4222-8222-222222222222',
      kod: '9002',
      beteckning: 'Betapartiet',
      filnamn: 'betapartiet',
      forkortning: 'B',
      deltagande: {
        2022: { riksdag: false, region: ['14'], kommun: [] }
      }
    },
    {
      uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      kod: '9011',
      beteckning: 'Åkerpartiet',
      filnamn: 'akerpartiet'
    },
    {
      uuid: '44444444-4444-4444-8444-444444444444',
      kod: '9004',
      beteckning: 'Duplikatpartiet två',
      filnamn: 'duplikatpartiet-tva',
      forkortning: 'd'
    },
    {
      uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      kod: '9012',
      beteckning: 'Zebrapartiet',
      filnamn: 'zebrapartiet'
    },
    {
      uuid: '11111111-1111-4111-8111-111111111111',
      kod: '9001',
      beteckning: 'Alfapartiet',
      filnamn: 'alfapartiet',
      forkortning: 'A',
      partisymbol: {
        filnamn: '9001-alfapartiet.png',
        kalla: 'Test',
        kallurl: 'https://example.com/symbol.png',
        valar: 2026,
        partikod: '9001'
      },
      deltagande: {
        2022: { riksdag: true, region: ['01', '12'], kommun: ['0114', '1280', '1281'] },
        2026: { riksdag: false, region: [], kommun: [] }
      }
    },
    {
      uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      kod: '9013',
      beteckning: 'Ängspartiet',
      filnamn: 'angspartiet'
    },
    {
      uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      kod: '9014',
      beteckning: 'Jarl',
      filnamn: 'jarl'
    },
    {
      uuid: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      kod: '9015',
      beteckning: 'Kommunens Väl',
      filnamn: 'kommunens-val-alfa'
    },
    {
      uuid: '33333333-3333-4333-8333-333333333333',
      kod: '9003',
      beteckning: 'Duplikatpartiet ett',
      filnamn: 'duplikatpartiet-ett',
      forkortning: 'D'
    }
  ];

  writeJson(dataRoot, 'parti/index.json', parties.map(({ kod, deltagande, ...entry }) => entry));
  parties.forEach(party => writeJson(dataRoot, `parti/${party.filnamn}/index.json`, party));
  writeJson(dataRoot, 'regioner/index.json', [
    { kod: '18', namn: 'Örebro län', uuid: '10101010-1010-4010-8010-101010101010', kommuner: [] },
    { kod: '12', namn: 'Skåne län', uuid: '66666666-6666-4666-8666-666666666666', kommuner: [] },
    { kod: '05', namn: 'Östergötlands län', uuid: '20202020-2020-4020-8020-202020202020', kommuner: [] },
    { kod: '14', namn: 'Västra Götalands län', uuid: '88888888-8888-4888-8888-888888888888', kommuner: [] },
    { kod: '01', namn: 'Stockholms län', uuid: '77777777-7777-4777-8777-777777777777', kommuner: [] }
  ]);

  const source = { namn: 'Riksdagen', url: 'https://data.riksdagen.se/', hamtad: '2026-08-25' };
  writeJson(dataRoot, 'val/2018/valresultat/riksdag.json', { valar: 2018, valdeltagande: { procent: 87 } });
  writeJson(dataRoot, 'val/2022/valresultat/riksdag.json', {
    valar: 2022,
    mandatfordelning: {
      partier: [
        { forkortning: 'A', mandat: 200 },
        { forkortning: 'D', mandat: 100 },
        { forkortning: 'X', mandat: 49 }
      ],
      kalla: source
    }
  });
  writeJson(dataRoot, 'val/2026/valresultat/riksdag.json', {
    valar: 2026,
    mandatfordelning: { partier: [{ forkortning: 'B', mandat: 349 }], kalla: source }
  });

  return { root, dataRoot };
}

test('home data lists parties in Swedish alphabetical order with participation facets', async t => {
  const { root, dataRoot } = makeHomeData();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const home = await createPartyDataStore(dataRoot).readHomeData();

  assert.deepEqual(home.parties.map(party => party.filnamn), [
    'alfapartiet',
    'betapartiet',
    'duplikatpartiet-ett',
    'duplikatpartiet-tva',
    'jarl',
    'jamtlands-val',
    'kommunens-val-alfa',
    'kommunens-val-beta',
    'zebrapartiet',
    'akerpartiet',
    'angspartiet',
    'ostra-partiet'
  ]);
  assert.deepEqual(home.parties[0], {
    uuid: '11111111-1111-4111-8111-111111111111',
    beteckning: 'Alfapartiet',
    filnamn: 'alfapartiet',
    forkortning: 'A',
    symbolSrc: '/partisymbol/alfapartiet/9001-alfapartiet.png',
    deltagande: {
      2022: { riksdag: true, regionLan: ['01', '12'], kommunLan: ['01', '12'] },
      2026: { riksdag: false, regionLan: [], kommunLan: [] }
    }
  });
  assert.equal(home.parties[1].symbolSrc, undefined);
  assert.equal(home.parties.at(-1).forkortning, undefined);
  assert.deepEqual(home.parties.at(-1).deltagande, {});
  assert.deepEqual(home.valar, ['2022', '2026']);
  assert.deepEqual(home.lan.map(lan => lan.namn), [
    'Skåne län',
    'Stockholms län',
    'Västra Götalands län',
    'Örebro län',
    'Östergötlands län'
  ]);
});

test('mandate records resolve to a party only on an unambiguous abbreviation', async t => {
  const { root, dataRoot } = makeHomeData();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const home = await createPartyDataStore(dataRoot).readHomeData();

  assert.deepEqual(home.riksdag.map(year => year.valar), [2026, 2022]);
  const [twentyTwo] = home.riksdag.filter(year => year.valar === 2022);
  assert.equal(twentyTwo.kalla.namn, 'Riksdagen');
  assert.deepEqual(twentyTwo.partier, [
    {
      forkortning: 'A',
      mandat: 200,
      beteckning: 'Alfapartiet',
      filnamn: 'alfapartiet',
      symbolSrc: '/partisymbol/alfapartiet/9001-alfapartiet.png'
    },
    { forkortning: 'D', mandat: 100 },
    { forkortning: 'X', mandat: 49 }
  ]);
});

test('home data is read once per store', async t => {
  const { root, dataRoot } = makeHomeData();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createPartyDataStore(dataRoot);

  assert.equal(await store.readHomeData(), await store.readHomeData());
});
