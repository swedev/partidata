const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { validatePartyTitles } = require('./validate-export.js');

function writePartyPage (directory, slug, title) {
  const partyDirectory = path.join(directory, 'parti', slug);
  fs.mkdirSync(partyDirectory, { recursive: true });
  fs.writeFileSync(path.join(partyDirectory, 'index.html'), `<html><head>${title}</head></html>`);
}

test('validatePartyTitles accepts exported party pages with titles', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'partidata-export-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  writePartyPage(directory, 'testpartiet', '<title data-next-head="">Testpartiet - Partidata 🇸🇪</title>');

  assert.doesNotThrow(() => validatePartyTitles(directory));
});

test('validatePartyTitles rejects empty or missing titles', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'partidata-export-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  writePartyPage(directory, 'tom-title', '<title></title>');
  writePartyPage(directory, 'saknad-title', '');

  assert.throws(
    () => validatePartyTitles(directory),
    error => error.message.includes('parti/tom-title/index.html') &&
      error.message.includes('parti/saknad-title/index.html')
  );
});
