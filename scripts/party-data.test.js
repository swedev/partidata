const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createPartyDataStore, partyElectionResults } = require('../src/server/party-data.ts');

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

  writeJson(dataRoot, 'derived/parti.json', [testParty, plainParty].map(({ kod, ...party }) => party));
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

/**
 * Writes the files the `/data/` allowlist serves on top of makeData(), which
 * the older tests read as a tree without election results.
 */
function withDataFiles (dataRoot) {
  writeJson(dataRoot, 'val/2018/partideltagande/riksdag.json', [
    { beteckning: 'Testpartiet', kod: '9001', uuid: '11111111-1111-4111-8111-111111111111' }
  ]);
  writeJson(dataRoot, 'val/2022/valresultat/riksdag.json', {
    schema_version: 2,
    valtyp: 'riksdag',
    valar: 2022,
    status: 'slutligt',
    kallor: [{ id: 'resultat', namn: 'Valmyndigheten', url: 'https://example.com/resultat', hamtad: '2026-08-30' }],
    rostresultat: {
      giltiga_roster: 100,
      partier: [{
        parti_uuid: '11111111-1111-4111-8111-111111111111',
        roster: 100,
        rostandel: 100,
        kallreferens: 'resultat'
      }]
    },
    mandatfordelning: {
      partier: [{
        parti_uuid: '11111111-1111-4111-8111-111111111111',
        partibeteckning: 'Testpartiet',
        mandat: 349,
        kallreferens: 'resultat'
      }]
    }
  });
  writeJson(dataRoot, 'regioner/index.json', [{ kod: '01', namn: 'Stockholms län', kommuner: [] }]);
  writeJson(dataRoot, 'derived/riksdag.json', { schema_version: 2, kammare: { valar: 2022, partier: [] } });
  return dataRoot;
}

test('the allowlisted resources are served as the bytes on disk, with a sha256 tag', async t => {
  const { root, dataRoot } = makeData();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createPartyDataStore(withDataFiles(dataRoot));

  const registry = await store.resolveDataResource(['derived', 'parti.json']);
  assert.equal(registry.kind, 'file');
  const file = fs.readFileSync(path.join(dataRoot, 'derived/parti.json'));
  assert.ok(registry.body.equals(file), 'kroppen är filens byte');
  assert.equal(registry.etag, `"${crypto.createHash('sha256').update(file).digest('hex')}"`);

  assert.equal((await store.resolveDataResource(['parti', 'testpartiet', 'index.json'])).kind, 'file');
  assert.equal((await store.resolveDataResource(['val', '2018', 'partideltagande', 'riksdag.json'])).kind, 'file');
  assert.equal((await store.resolveDataResource(['val', '2022', 'valresultat', 'riksdag.json'])).kind, 'file');
  assert.equal((await store.resolveDataResource(['regioner', 'index.json'])).kind, 'file');
  assert.equal((await store.resolveDataResource(['derived', 'riksdag.json'])).kind, 'file');
});

test('a previous party filename forwards and an unknown one is not found', async t => {
  const { root, dataRoot } = makeData();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createPartyDataStore(withDataFiles(dataRoot));

  assert.deepEqual(await store.resolveDataResource(['parti', 'gamla-testpartiet', 'index.json']), {
    kind: 'redirect',
    destination: '/data/parti/testpartiet/index.json'
  });
  assert.deepEqual(await store.resolveDataResource(['parti', 'okant', 'index.json']), { kind: 'notFound' });
});

test('candidate lists, profiles and symbols are not served even when the file is there', async t => {
  const { root, dataRoot } = makeData();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createPartyDataStore(withDataFiles(dataRoot));

  assert.ok(fs.existsSync(path.join(dataRoot, 'val/2018/kandidatlistor/testpartiet.json')));
  assert.ok(fs.existsSync(path.join(dataRoot, 'parti/testpartiet/profil.json')));
  for (const segments of [
    ['val', '2018', 'kandidatlistor', 'testpartiet.json'],
    ['parti', 'testpartiet', 'profil.json'],
    ['parti', 'testpartiet', '9001-testpartiet.png'],
    ['parti', '..', 'kodbyten.json']
  ]) {
    assert.deepEqual(await store.resolveDataResource(segments), { kind: 'notFound' }, segments.join('/'));
  }
});

test('a year without one of the participation files is not found', async t => {
  const { root, dataRoot } = makeData();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createPartyDataStore(withDataFiles(dataRoot));

  assert.deepEqual(await store.resolveDataResource(['val', '2022', 'partideltagande', 'landsting.json']), {
    kind: 'notFound'
  });
  assert.deepEqual(await store.resolveDataResource(['val', '2018', 'valresultat', 'riksdag.json']), {
    kind: 'notFound'
  });
});

test('the data catalog lists the files each year carries and an example party', async t => {
  const { root, dataRoot } = makeData();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createPartyDataStore(withDataFiles(dataRoot));

  const catalog = await store.readDataCatalog();
  assert.equal(catalog.antalPartier, 2);
  assert.deepEqual(catalog.exempel, { filnamn: 'testpartiet', beteckning: 'Testpartiet' });
  assert.deepEqual(catalog.valar, [
    { valar: '2018', partideltagande: ['riksdag'], valresultat: false },
    { valar: '2022', partideltagande: [], valresultat: true }
  ]);
  assert.equal(await store.readDataCatalog(), catalog, 'katalogen byggs en gång per lager');
});

test('party data resolves current, previous and unknown slugs', async t => {
  const { root, dataRoot } = makeData();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createPartyDataStore(dataRoot);

  const current = await store.resolveParty('testpartiet');
  assert.equal(current.kind, 'party');
  assert.equal(current.props.profile.namn, 'Testpartiet');
  assert.deepEqual(current.props.candidateLists, { 2018: ['R', 'K'] });
  assert.equal(current.props.symbolSrc, '/partisymbol/testpartiet/9001-testpartiet.png');
  assert.equal(current.props.valresultat, undefined, 'utan resultatfiler härleds inga valresultat');
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
  assert.equal(result.props.valresultat, undefined);
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
      filnamn: 'kommunens-val-beta',
      omrade: 'Hylte'
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
      filnamn: 'kommunens-val-alfa',
      omrade: 'Skurup'
    },
    {
      uuid: '33333333-3333-4333-8333-333333333333',
      kod: '9003',
      beteckning: 'Duplikatpartiet ett',
      filnamn: 'duplikatpartiet-ett',
      forkortning: 'D'
    }
  ];

  writeJson(dataRoot, 'derived/parti.json', parties.map(({ kod, deltagande, ...entry }) => entry));
  parties.forEach(party => writeJson(dataRoot, `parti/${party.filnamn}/index.json`, party));
  writeJson(dataRoot, 'regioner/index.json', [
    { kod: '18', namn: 'Örebro län', uuid: '10101010-1010-4010-8010-101010101010', kommuner: [] },
    { kod: '12', namn: 'Skåne län', uuid: '66666666-6666-4666-8666-666666666666', kommuner: [] },
    { kod: '05', namn: 'Östergötlands län', uuid: '20202020-2020-4020-8020-202020202020', kommuner: [] },
    { kod: '14', namn: 'Västra Götalands län', uuid: '88888888-8888-4888-8888-888888888888', kommuner: [] },
    { kod: '01', namn: 'Stockholms län', uuid: '77777777-7777-4777-8777-777777777777', kommuner: [] }
  ]);

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
  // A row without `mandat` stood in the election without winning a seat.
  function writeResult (year, rows) {
    writeJson(dataRoot, `val/${year}/valresultat/riksdag.json`, {
      schema_version: 2,
      valtyp: 'riksdag',
      valar: year,
      status: 'slutligt',
      kallor: [source],
      valdeltagande: { procent: 84, kallreferens: 'resultat' },
      rostresultat: {
        giltiga_roster: rows.length,
        kallreferenser: ['resultat'],
        partier: rows.map(entry => ({
          parti_uuid: entry.uuid,
          kallkod: entry.forkortning,
          partibeteckning: entry.forkortning,
          roster: 1,
          rostandel: Number((100 / rows.length).toFixed(2)),
          kallreferens: 'resultat'
        })),
        ej_kopplade: [],
        aggregat: []
      },
      mandatfordelning: {
        antal_mandat: 349,
        kallreferenser: ['resultat'],
        partier: rows.filter(entry => entry.mandat !== undefined).map(entry => ({
          parti_uuid: entry.uuid,
          kallkod: entry.forkortning,
          partibeteckning: entry.forkortning,
          mandat: entry.mandat,
          kallreferens: 'resultat'
        }))
      }
    });
  }
  writeResult(2022, [
    { uuid: parties.find(party => party.filnamn === 'alfapartiet').uuid, forkortning: 'A', mandat: 200 },
    { uuid: parties.find(party => party.filnamn === 'duplikatpartiet-ett').uuid, forkortning: 'D', mandat: 100 },
    { uuid: '12121212-1212-4212-8212-121212121212', forkortning: 'X', mandat: 49 },
    { uuid: parties.find(party => party.filnamn === 'zebrapartiet').uuid, forkortning: 'Z' }
  ]);
  writeResult(2026, [
    { uuid: parties.find(party => party.filnamn === 'betapartiet').uuid, forkortning: 'B', mandat: 349 }
  ]);

  return { root, dataRoot, source };
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
      2022: { riksdag: true, regionLan: ['01', '12'], kommunKoder: ['0114', '1280', '1281'] },
      2026: { riksdag: false, regionLan: [], kommunKoder: [] }
    }
  });
  assert.equal(home.parties[1].symbolSrc, undefined);
  assert.equal(home.parties.at(-1).forkortning, undefined);
  assert.deepEqual(home.parties.at(-1).deltagande, {});
  assert.deepEqual(
    home.parties.filter(party => party.beteckning === 'Kommunens Väl').map(party => ({
      filnamn: party.filnamn,
      omrade: party.omrade,
      duplicateName: party.duplicateName
    })),
    [
      { filnamn: 'kommunens-val-alfa', omrade: 'Skurup', duplicateName: true },
      { filnamn: 'kommunens-val-beta', omrade: 'Hylte', duplicateName: true }
    ]
  );
  assert.deepEqual(home.valar, ['2022', '2026']);
  assert.deepEqual(home.lan.map(lan => lan.namn), [
    'Skåne län',
    'Stockholms län',
    'Västra Götalands län',
    'Örebro län',
    'Östergötlands län'
  ]);
});

test('party pages know when their registered name is duplicated', async t => {
  const { root, dataRoot } = makeHomeData();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const duplicate = await createPartyDataStore(dataRoot).resolveParty('kommunens-val-alfa');
  assert.equal(duplicate.kind, 'party');
  assert.equal(duplicate.props.duplicateName, true);
  assert.equal(duplicate.props.omrade, 'Skurup');

  const unique = await createPartyDataStore(dataRoot).resolveParty('alfapartiet');
  assert.equal(unique.kind, 'party');
  assert.equal(unique.props.duplicateName, false);
});

test('mandate records resolve by stable uuid and leave an unknown uuid unlinked', async t => {
  const { root, dataRoot } = makeHomeData();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const home = await createPartyDataStore(dataRoot).readHomeData();

  assert.deepEqual(home.riksdag.map(year => year.valar), [2026, 2022]);
  const [twentyTwo] = home.riksdag.filter(year => year.valar === 2022);
  assert.equal(twentyTwo.kalla.namn, 'Valmyndigheten');
  assert.deepEqual(twentyTwo.partier, [
    {
      uuid: '11111111-1111-4111-8111-111111111111',
      forkortning: 'A',
      mandat: 200,
      beteckning: 'Alfapartiet',
      filnamn: 'alfapartiet',
      symbolSrc: '/partisymbol/alfapartiet/9001-alfapartiet.png'
    },
    {
      uuid: '33333333-3333-4333-8333-333333333333',
      forkortning: 'D',
      mandat: 100,
      beteckning: 'Duplikatpartiet ett',
      filnamn: 'duplikatpartiet-ett'
    },
    { uuid: '12121212-1212-4212-8212-121212121212', forkortning: 'X', mandat: 49 }
  ]);
});

test('party pages derive their election results from the imported result files', async t => {
  const { root, dataRoot, source } = makeHomeData();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createPartyDataStore(dataRoot);

  const chamberParty = await store.resolveParty('betapartiet');
  assert.deepEqual(chamberParty.props.valresultat, {
    valtyp: 'riksdag',
    resultat: [{ valar: 2026, roster: 1, rostandel: 100, mandat: 349, kalla: source }],
    kammare: { valar: 2026, mandat: 349 }
  });

  // Seats in 2022 but no row in the chamber year, so no chamber claim.
  const former = await store.resolveParty('alfapartiet');
  assert.deepEqual(former.props.valresultat.resultat, [
    { valar: 2022, roster: 1, rostandel: 25, mandat: 200, kalla: source }
  ]);
  assert.equal(former.props.valresultat.kammare, undefined);

  // A vote row without a seat row is a result of zero mandates, not a gap.
  const withoutSeats = await store.resolveParty('zebrapartiet');
  assert.deepEqual(withoutSeats.props.valresultat.resultat, [
    { valar: 2022, roster: 1, rostandel: 25, mandat: 0, kalla: source }
  ]);
  assert.equal(withoutSeats.props.valresultat.kammare, undefined);

  const withoutResults = await store.resolveParty('jarl');
  assert.equal(withoutResults.props.valresultat, undefined);
});

const voteSource = { id: 'resultat', namn: 'Valmyndigheten', url: 'https://example.com/roster', hamtad: '2026-08-26' };
const seatSource = { id: 'mandat', namn: 'Valmyndigheten', url: 'https://example.com/mandat', hamtad: '2026-08-26' };

/** One result file in the shape `val/<år>/valresultat/riksdag.json` carries. */
function resultFile (valar, rows, kallor = [voteSource]) {
  return {
    schema_version: 2,
    valar,
    status: 'slutligt',
    kallor,
    rostresultat: {
      giltiga_roster: 1000,
      partier: rows.map(row => ({
        parti_uuid: row.uuid,
        roster: row.roster,
        rostandel: row.rostandel,
        kallreferens: 'resultat'
      }))
    },
    mandatfordelning: {
      partier: rows.filter(row => row.mandat !== undefined).map(row => ({
        parti_uuid: row.uuid,
        partibeteckning: 'P',
        mandat: row.mandat,
        kallreferens: row.mandatreferens ?? 'resultat'
      }))
    }
  };
}

const derivedUuid = '11111111-1111-4111-8111-111111111111';

test('the derivation names the seat source separately and measures change against the previous election', () => {
  const files = [
    resultFile(2018, [{ uuid: derivedUuid, roster: 44, rostandel: 4.41, mandat: 16, mandatreferens: 'mandat' }], [voteSource, seatSource]),
    resultFile(2022, [{ uuid: derivedUuid, roster: 51, rostandel: 5.08, mandat: 18 }])
  ];

  assert.deepEqual(partyElectionResults(files, derivedUuid), {
    valtyp: 'riksdag',
    resultat: [
      { valar: 2018, roster: 44, rostandel: 4.41, mandat: 16, kalla: voteSource, mandatkalla: seatSource },
      { valar: 2022, roster: 51, rostandel: 5.08, mandat: 18, forandring: 0.67, kalla: voteSource }
    ],
    kammare: { valar: 2022, mandat: 18 }
  });
});

test('the derivation leaves out change across a gap in the series and reads the same in any file order', () => {
  const files = [
    resultFile(2018, [{ uuid: derivedUuid, roster: 44, rostandel: 4.41, mandat: 16 }]),
    resultFile(2022, [{ uuid: 'abababab-abab-4bab-8bab-abababababab', roster: 1, rostandel: 0.01 }]),
    resultFile(2026, [{ uuid: derivedUuid, roster: 51, rostandel: 5.08, mandat: 18 }])
  ];

  const derived = partyElectionResults(files, derivedUuid);
  assert.deepEqual(derived.resultat.map(post => post.valar), [2018, 2026]);
  assert.ok(!('forandring' in derived.resultat[0]), 'den första posten bär ingen förändring');
  assert.ok(!('forandring' in derived.resultat[1]), 'ett överhoppat val ger ingen förändring');
  assert.ok(!('mandatkalla' in derived.resultat[0]), 'en gemensam källa nämns inte två gånger');
  assert.deepEqual(partyElectionResults(files.toReversed(), derivedUuid), derived);
});

test('the derivation claims no chamber seats when the last row is not the chamber year', () => {
  const files = [
    resultFile(2018, [{ uuid: derivedUuid, roster: 44, rostandel: 4.41, mandat: 16 }]),
    resultFile(2022, [{ uuid: 'abababab-abab-4bab-8bab-abababababab', roster: 1, rostandel: 0.01, mandat: 349 }])
  ];

  const derived = partyElectionResults(files, derivedUuid);
  assert.equal(derived.resultat.at(-1).valar, 2018);
  assert.equal(derived.kammare, undefined);
});

test('the derivation skips a party without rows and rejects an unknown source reference', () => {
  const files = [resultFile(2022, [{ uuid: derivedUuid, roster: 51, rostandel: 5.08, mandat: 18 }])];
  assert.equal(partyElectionResults(files, 'abababab-abab-4bab-8bab-abababababab'), undefined);
  assert.equal(partyElectionResults([], derivedUuid), undefined);

  const broken = [resultFile(2022, [{ uuid: derivedUuid, roster: 51, rostandel: 5.08, mandat: 18, mandatreferens: 'saknas' }])];
  assert.throws(() => partyElectionResults(broken, derivedUuid), /Riksdagsvalet 2022 saknar källan saknas/);
});

test('home data enriches the derived outside-parliament ranking by stable uuid', async t => {
  const { root, dataRoot } = makeHomeData();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  writeJson(dataRoot, 'derived/riksdag.json', {
    storsta_utanfor_riksdagen: {
      period: { fran: 1994, till: 2026 },
      metod: 'Exakt testmetod',
      partier: [{
        parti_uuid: '11111111-1111-4111-8111-111111111111',
        valar: 2022,
        roster: 1234,
        rostandel: 1.23,
        kalla: { namn: 'Valmyndigheten', url: 'https://example.com/resultat.json', hamtad: '2026-08-25' }
      }]
    }
  });

  const outside = (await createPartyDataStore(dataRoot).readHomeData()).outsideParliament;
  assert.equal(outside.metod, 'Exakt testmetod');
  assert.deepEqual(outside.partier[0], {
    uuid: '11111111-1111-4111-8111-111111111111',
    beteckning: 'Alfapartiet',
    filnamn: 'alfapartiet',
    forkortning: 'A',
    symbolSrc: '/partisymbol/alfapartiet/9001-alfapartiet.png',
    valar: 2022,
    roster: 1234,
    rostandel: 1.23,
    kalla: { namn: 'Valmyndigheten', url: 'https://example.com/resultat.json', hamtad: '2026-08-25' }
  });
});

test('home data omits an outside-parliament ranking with an unknown party uuid', async t => {
  const { root, dataRoot } = makeHomeData();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  writeJson(dataRoot, 'derived/riksdag.json', {
    storsta_utanfor_riksdagen: {
      period: { fran: 1994, till: 2026 },
      metod: 'Exakt testmetod',
      partier: [{
        parti_uuid: 'abababab-abab-4bab-8bab-abababababab',
        valar: 2022,
        roster: 1,
        rostandel: 0.01,
        kalla: { namn: 'Valmyndigheten', url: 'https://example.com/resultat.json', hamtad: '2026-08-25' }
      }]
    }
  });

  assert.equal((await createPartyDataStore(dataRoot).readHomeData()).outsideParliament, undefined);
});

test('home data is read once per store', async t => {
  const { root, dataRoot } = makeHomeData();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createPartyDataStore(dataRoot);

  assert.equal(await store.readHomeData(), await store.readHomeData());
});
