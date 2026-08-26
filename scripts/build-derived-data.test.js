const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { ROOT } = require('./utils.js');
const {
  SEAT_COLOURS,
  buildParliamentDiagram,
  buildPartyProfileParliamentView,
  checkParliamentDiagram,
  seatRows
} = require('./build-derived-data.js');

const SOURCE = {
  id: 'resultat',
  namn: 'Valmyndigheten',
  titel: 'Testresultat',
  url: 'https://example.com/resultat.json',
  version: 'Slutligt resultat',
  format: 'application/json',
  hamtad: '2026-08-25',
  sha256: 'a'.repeat(64)
};

function writeJson (root, relativePath, value) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

function makeData (partier) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'partidata-diagram-'));
  const registry = partier.map((party, index) => ({
    uuid: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    kod: String(9000 + index),
    beteckning: `Parti ${party.forkortning}`,
    filnamn: `parti-${party.forkortning.toLowerCase()}`,
    forkortning: party.forkortning,
  }));
  writeJson(root, 'parti/index.json', registry.map(({ kod, ...party }) => party));
  registry.forEach(party => writeJson(root, `parti/${party.filnamn}/index.json`, party));
  const validVotes = partier.reduce((sum, party) => sum + (party.roster ?? 1), 0);
  writeJson(root, 'val/2022/valresultat/riksdag.json', {
    schema_version: 2,
    valtyp: 'riksdag',
    valar: 2022,
    status: 'slutligt',
    kallor: [SOURCE],
    valdeltagande: { procent: 84.21, kallreferens: 'resultat' },
    rostresultat: {
      giltiga_roster: validVotes,
      kallreferenser: ['resultat'],
      partier: registry.map((party, index) => ({
        parti_uuid: party.uuid,
        kallkod: party.forkortning,
        partibeteckning: party.beteckning,
        roster: partier[index].roster ?? 1,
        rostandel: Number(((partier[index].roster ?? 1) * 100 / validVotes).toFixed(2)),
        kallreferens: 'resultat',
      })),
      ej_kopplade: [],
      aggregat: [],
    },
    mandatfordelning: {
      antal_mandat: 349,
      kallreferenser: ['resultat'],
      partier: partier.map((party, index) => ({ party, index }))
        .filter(({ party }) => Number.isInteger(party.mandat))
        .map(({ party, index }) => ({
          parti_uuid: registry[index].uuid,
          kallkod: party.forkortning,
          partibeteckning: registry[index].beteckning,
          mandat: party.mandat,
          kallreferens: 'resultat',
        })),
    }
  });
  return root;
}

function groups (svg) {
  return [...svg.matchAll(/<g id="([^"]+)" fill="([^"]+)">([\s\S]*?)<\/g>/g)]
    .map(match => ({ id: match[1], fill: match[2], seats: (match[3].match(/<circle /g) ?? []).length }));
}

test('the seat rows hold every seat and grow outwards', () => {
  for (const total of [1, 12, 349, 350]) {
    const rows = seatRows(total);
    assert.equal(rows.reduce((carry, count) => carry + count, 0), total);
    assert.deepEqual(rows, [...rows].sort((a, b) => a - b));
  }
});

test('the diagram draws one group per party, sized by its mandate count', t => {
  const root = makeData([
    { forkortning: 'V', mandat: 24 },
    { forkortning: 'S', mandat: 107 },
    { forkortning: 'SD', mandat: 218 }
  ]);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const svg = buildParliamentDiagram(root);
  assert.deepEqual(groups(svg), [
    { id: 'V', fill: SEAT_COLOURS.V, seats: 24 },
    { id: 'S', fill: SEAT_COLOURS.S, seats: 107 },
    { id: 'SD', fill: SEAT_COLOURS.SD, seats: 218 }
  ]);
  assert.equal((svg.match(/<circle /g) ?? []).length, 349);
});

test('the diagram records the election year it was generated from', t => {
  const root = makeData([{ forkortning: 'S', mandat: 349 }]);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const svg = buildParliamentDiagram(root);
  assert.match(svg, /data-valar="2022"/);
  assert.match(svg, /riksdagsvalet 2022/);
  assert.equal(svg, buildParliamentDiagram(root), 'the same data gives the same bytes');
});

test('an abbreviation outside the colour map is drawn neutral', t => {
  const root = makeData([{ forkortning: 'S', mandat: 300 }, { forkortning: 'XYZ', mandat: 49 }]);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const [, unknown] = groups(buildParliamentDiagram(root));
  assert.equal(unknown.id, 'XYZ');
  assert.equal(unknown.fill, '#d2d2d2');
});

test('outside parties are ranked by exact vote share, excluding the current chamber and keeping six', t => {
  const root = makeData([
    { forkortning: 'S', mandat: 349, roster: 900000 },
    { forkortning: 'A', roster: 1001 },
    { forkortning: 'B', roster: 1004 },
    { forkortning: 'C', roster: 900 },
    { forkortning: 'D', roster: 800 },
    { forkortning: 'E', roster: 700 },
    { forkortning: 'F', roster: 600 },
    { forkortning: 'G', roster: 500 },
  ]);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const result = buildPartyProfileParliamentView(root);
  assert.deepEqual(
    result.storsta_utanfor_riksdagen.partier.map(party => party.kalla.id && party.parti_uuid),
    [
      '00000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000004',
      '00000000-0000-4000-8000-000000000005',
      '00000000-0000-4000-8000-000000000006',
      '00000000-0000-4000-8000-000000000007',
    ]
  );
  assert.equal(result.storsta_utanfor_riksdagen.partier[0].rostandel, result.storsta_utanfor_riksdagen.partier[1].rostandel);
  assert.ok(!result.storsta_utanfor_riksdagen.partier.some(party => party.parti_uuid.endsWith('000000000001')));
});

test('the colour map covers every party in the committed chamber', () => {
  const chamber = buildPartyProfileParliamentView().kammare;
  const uncoloured = chamber.partier
    .map(party => party.forkortning)
    .filter(forkortning => !(forkortning in SEAT_COLOURS));
  assert.deepEqual(uncoloured, [], `Lägg till färg för ${uncoloured.join(', ')} i SEAT_COLOURS`);
});

test('the committed diagram matches the committed mandate data', () => {
  checkParliamentDiagram();
  const svg = fs.readFileSync(path.join(ROOT, 'public', 'img', 'sveriges_riksdag.svg'), 'utf8');
  const chamber = buildPartyProfileParliamentView().kammare;
  assert.deepEqual(
    groups(svg).map(group => ({ forkortning: group.id, mandat: group.seats })),
    chamber.partier.map(party => ({ forkortning: party.forkortning, mandat: party.mandat }))
  );
  assert.match(svg, new RegExp(`data-valar="${chamber.valar}"`));
});
