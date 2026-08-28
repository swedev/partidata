const assert = require('node:assert/strict');
const test = require('node:test');

const { emptyFilters } = require('../src/components/home/filtering.ts');
const { isSortOrder, sortLabels, sortOrders, sortParties } = require('../src/components/home/sorting.ts');

function facet ({ riksdag = false, kommunAntal = 0 } = {}) {
  return { riksdag, regionLan: [], kommunKoder: Array.from({ length: kommunAntal }, (unused, index) => String(1200 + index)) };
}

/** The parties arrive from the server in Swedish name order. */
const PARTIES = [
  { filnamn: 'brett-parti', deltagande: { 2018: facet({ kommunAntal: 40 }), 2026: facet({ kommunAntal: 200 }) } },
  { filnamn: 'gammalt-parti', deltagande: { 2014: facet({ kommunAntal: 3 }), 2018: facet({ kommunAntal: 2 }), 2022: facet({ kommunAntal: 1 }) } },
  { filnamn: 'nytt-parti', deltagande: { 2026: facet({ kommunAntal: 5 }) } },
  { filnamn: 'utan-parti', deltagande: {} }
];

function order (sort, filters = {}) {
  return sortParties(PARTIES, sort, { ...emptyFilters, ...filters }).map(party => party.filnamn);
}

test('the name order is the list as it arrived', () => {
  assert.deepEqual(order('namn'), PARTIES.map(party => party.filnamn));
});

test('the municipality ranking reads the party best year', () => {
  assert.deepEqual(order('kommuner'), ['brett-parti', 'nytt-parti', 'gammalt-parti', 'utan-parti']);
});

test('a chosen year ranks on that year alone', () => {
  assert.deepEqual(order('kommuner', { valar: '2018' }), ['brett-parti', 'gammalt-parti', 'nytt-parti', 'utan-parti']);
  assert.deepEqual(order('kommuner', { valar: '2014' }), ['gammalt-parti', 'brett-parti', 'nytt-parti', 'utan-parti']);
});

test('the latest ballot ranks the most recently registered party first', () => {
  assert.deepEqual(order('senaste'), ['brett-parti', 'nytt-parti', 'gammalt-parti', 'utan-parti']);
});

test('parties that rank equally keep their name order', () => {
  const tied = [
    { filnamn: 'alfa', deltagande: { 2026: facet({ kommunAntal: 7 }) } },
    { filnamn: 'beta', deltagande: { 2026: facet({ kommunAntal: 7 }) } }
  ];
  assert.deepEqual(sortParties(tied, 'kommuner', emptyFilters).map(party => party.filnamn), ['alfa', 'beta']);
});

test('sorting leaves the matches it was given untouched', () => {
  const before = PARTIES.map(party => party.filnamn);
  sortParties(PARTIES, 'kommuner', emptyFilters);
  assert.deepEqual(PARTIES.map(party => party.filnamn), before);
});

test('every order has a label and only known orders are accepted', () => {
  assert.deepEqual(sortOrders, ['namn', 'kommuner', 'senaste']);
  assert.deepEqual(sortOrders.map(value => sortLabels[value]), ['A–Ö', 'Flest kommuner', 'Senast anmält']);
  assert.ok(isSortOrder('kommuner'));
  assert.ok(!isSortOrder('valar'));
});
