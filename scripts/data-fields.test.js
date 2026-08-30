const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { PARTY_KEY_ORDER } = require('./parti.js');
const { FIELD_DOCS } = require('../src/components/data/fields.ts');

const dataRoot = path.join(__dirname, '..', 'data');

function readJson (...segments) {
  return JSON.parse(fs.readFileSync(path.join(dataRoot, ...segments), 'utf8'));
}

/** The election years the data carries, oldest first. */
function years () {
  return fs.readdirSync(path.join(dataRoot, 'val'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{4}$/.test(entry.name))
    .map(entry => entry.name)
    .toSorted();
}

/** The most recent year whose participation or result directory holds the file. */
function latestWith (katalog, fil) {
  const year = years().findLast(candidate =>
    fs.existsSync(path.join(dataRoot, 'val', candidate, katalog, fil)));
  assert.ok(year, `något valår har ${katalog}/${fil}`);
  return readJson('val', year, katalog, fil);
}

/** One real specimen per documented resource, read from the committed data. */
const SPECIMENS = {
  'registry': () => readJson('derived', 'parti.json'),
  'party': () => readJson('parti', 'moderaterna', 'index.json'),
  'participation-partier': () => latestWith('partideltagande', 'partier.json'),
  'participation-riksdag': () => latestWith('partideltagande', 'riksdag.json'),
  'participation-omrade': () => latestWith('partideltagande', 'region.json'),
  'results': () => latestWith('valresultat', 'riksdag.json'),
  'derived-parliament': () => readJson('derived', 'riksdag.json'),
  'regions': () => readJson('regioner', 'index.json')
};

/** The documented fields that stand at the top level of the resource. */
function topLevel (resource) {
  return resource.falt.filter(falt => !falt.namn.includes('.') && !falt.namn.includes('['));
}

/** Every object the check applies to: the elements of a list, or the object itself. */
function records (specimen) {
  return Array.isArray(specimen) ? specimen : [specimen];
}

test('every documented resource has a specimen in the committed data', () => {
  assert.deepEqual(FIELD_DOCS.map(resource => resource.id).toSorted(), Object.keys(SPECIMENS).toSorted());
  for (const resource of FIELD_DOCS) {
    assert.ok(topLevel(resource).length > 0, `${resource.id} dokumenterar toppnivåfält`);
    assert.ok(records(SPECIMENS[resource.id]()).length > 0, `${resource.id} har ett exemplar med innehåll`);
  }
});

test('the field tables name every top-level key the data carries', () => {
  for (const resource of FIELD_DOCS) {
    const documented = new Set(topLevel(resource).map(falt => falt.namn));
    // Hand-added extension fields in a party file are outside the table by
    // design: the README says they are just as public, and the registry rebuild
    // is what defines which keys the scripts handle.
    const extras = resource.id === 'party' ? new Set(PARTY_KEY_ORDER) : undefined;
    for (const record of records(SPECIMENS[resource.id]())) {
      for (const key of Object.keys(record)) {
        if (extras && !extras.has(key)) continue;
        assert.ok(documented.has(key), `${resource.id}.${key} står i fälttabellen`);
      }
    }
  }
});

test('every field the tables call required is in the data', () => {
  for (const resource of FIELD_DOCS) {
    const required = topLevel(resource).filter(falt => falt.obligatoriskt).map(falt => falt.namn);
    assert.ok(required.length > 0, `${resource.id} har obligatoriska fält`);
    for (const record of records(SPECIMENS[resource.id]())) {
      for (const namn of required) {
        assert.ok(namn in record, `${resource.id}.${namn} finns i varje exemplar`);
      }
    }
  }
});
