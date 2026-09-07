const assert = require('node:assert/strict');
const test = require('node:test');

const { sourceMark } = require('../src/components/party-profile/source-mark.ts');

const SYMBOL = '/partisymbol/civis/civis.png';

test('the symbol is the mark when the party has one', () => {
  assert.deepEqual(sourceMark({ symbolSrc: SYMBOL }), { kind: 'symbol', src: SYMBOL });
});

test('the symbol wins over the abbreviation', () => {
  assert.deepEqual(sourceMark({ symbolSrc: SYMBOL, abbreviation: 'MP' }), { kind: 'symbol', src: SYMBOL });
});

test('the registry abbreviation is the mark when there is no symbol', () => {
  assert.deepEqual(sourceMark({ abbreviation: 'MP' }), { kind: 'text', text: 'MP' });
});

test('a party with neither symbol nor abbreviation gets no mark', () => {
  assert.equal(sourceMark({}), undefined);
  assert.equal(sourceMark({ abbreviation: '' }), undefined);
  assert.equal(sourceMark({ symbolSrc: '' }), undefined);
  assert.equal(sourceMark({ symbolSrc: '', abbreviation: '' }), undefined);
});

test('the party name is not an input', () => {
  assert.equal(sourceMark({ namn: 'Civis' }), undefined);
  assert.deepEqual(sourceMark({ namn: 'Civis', abbreviation: 'MP' }), { kind: 'text', text: 'MP' });
});
