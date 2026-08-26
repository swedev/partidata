const assert = require('node:assert/strict');
const { test } = require('node:test');

const { toFileName } = require('./utils.js');

test('toFileName collapses separators and trims the slug', () => {
  const examples = {
    'Folk & Natur': 'folk-natur',
    'SPORT- OCH KOMMUNPARTIET': 'sport-och-kommunpartiet',
    '20% skattepartiet': '20-skattepartiet',
    'iGov.Direct®': 'igov-direct',
    'IP - IDROTTSPARTIET - Rädda Stadshagens IP!': 'ip-idrottspartiet-radda-stadshagens-ip',
    '  Östra vägen (C)  ': 'ostra-vagen-c',
    'EMPA(R)TIET': 'empartiet'
  };

  for (const [name, expected] of Object.entries(examples)) {
    assert.equal(toFileName(name), expected);
  }
});

test('toFileName retains explicit transliterations', () => {
  assert.equal(toFileName('Ærø ß'), 'aero-ss');
});
