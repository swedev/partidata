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

const SOURCE = { namn: 'Riksdagen', url: 'https://data.riksdagen.se/', hamtad: '2026-08-25' };
const TURNOUT = { procent: 84.21, kalla: { namn: 'SCB', url: 'https://www.scb.se/', hamtad: '2026-08-25' } };

function writeJson (root, relativePath, value) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

function makeData (partier) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'partidata-diagram-'));
  writeJson(root, 'val/2018/valresultat/riksdag.json', { valar: 2018, valdeltagande: TURNOUT });
  writeJson(root, 'val/2022/valresultat/riksdag.json', {
    valar: 2022,
    valdeltagande: TURNOUT,
    mandatfordelning: { partier, kalla: SOURCE }
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
