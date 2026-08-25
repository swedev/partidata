const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { ROOT } = require('./utils.js');

const DERIVED_FILE = path.join('derived', 'partiprofil', 'riksdag.json');

function readJson (file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function electionResultFiles (dataDirectory) {
  const electionDirectory = path.join(dataDirectory, 'val');
  return fs.readdirSync(electionDirectory, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{4}$/.test(entry.name))
    .map(entry => ({
      relativePath: path.posix.join('val', entry.name, 'valresultat', 'riksdag.json'),
      absolutePath: path.join(electionDirectory, entry.name, 'valresultat', 'riksdag.json')
    }))
    .filter(file => fs.existsSync(file.absolutePath))
    .toSorted((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function uniqueSources (sources) {
  return [...new Map(sources.map(source => [`${source.namn}\0${source.url}\0${source.hamtad}`, source])).values()];
}

function buildPartyProfileParliamentView (dataDirectory = path.join(ROOT, 'data')) {
  const files = electionResultFiles(dataDirectory);
  assert.ok(files.length > 0, 'Inga riksdagsresultat hittades');
  const results = files.map(file => ({ ...file, data: readJson(file.absolutePath) }));
  const chamberResult = results.filter(result => result.data.mandatfordelning).at(-1);
  assert.ok(chamberResult, 'Ingen mandatfördelning hittades');
  const sources = [
    ...results.map(result => result.data.valdeltagande.kalla),
    chamberResult.data.mandatfordelning.kalla
  ];

  return {
    schema_version: 1,
    genererad_fran: files.map(file => file.relativePath),
    senast_uppdaterad: sources.map(source => source.hamtad).toSorted().at(-1),
    kammare: {
      valar: chamberResult.data.valar,
      partier: chamberResult.data.mandatfordelning.partier,
      kalla: chamberResult.data.mandatfordelning.kalla
    },
    valdeltagande: {
      resultat: results.map(result => ({
        valar: result.data.valar,
        procent: result.data.valdeltagande.procent
      })),
      kallor: uniqueSources(results.map(result => result.data.valdeltagande.kalla))
    }
  };
}

function serializePartyProfileParliamentView (dataDirectory) {
  return `${JSON.stringify(buildPartyProfileParliamentView(dataDirectory), null, 2)}\n`;
}

function writePartyProfileParliamentView (dataDirectory = path.join(ROOT, 'data')) {
  const target = path.join(dataDirectory, DERIVED_FILE);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, serializePartyProfileParliamentView(dataDirectory));
  return target;
}

function checkPartyProfileParliamentView (dataDirectory = path.join(ROOT, 'data')) {
  const target = path.join(dataDirectory, DERIVED_FILE);
  assert.ok(fs.existsSync(target), `${DERIVED_FILE} saknas; kör npm run build:derived-data`);
  assert.equal(fs.readFileSync(target, 'utf8'), serializePartyProfileParliamentView(dataDirectory), `${DERIVED_FILE} är inaktuell; kör npm run build:derived-data`);
}

if (require.main === module) {
  if (process.argv.includes('--check')) {
    checkPartyProfileParliamentView();
    console.log(`${DERIVED_FILE} är aktuell.`);
  } else {
    const target = writePartyProfileParliamentView();
    console.log(`Skrev ${path.relative(ROOT, target)}.`);
  }
}

exports.buildPartyProfileParliamentView = buildPartyProfileParliamentView;
exports.checkPartyProfileParliamentView = checkPartyProfileParliamentView;
exports.writePartyProfileParliamentView = writePartyProfileParliamentView;
