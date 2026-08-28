const fs = require('fs');
const path = require('path');

const { contentBox } = require('./png.js');
const { ROOT, dataPath } = require('./utils.js');
const {
  loadParties,
  loadYearFiles,
  buildParties,
  validate,
  applyRenames,
  writeFiles
} = require('./parti.js');

/**
 * measureParties
 * Reads every committed symbol and records the sheet it was delivered on
 * together with the box its drawing occupies. A file the reader leaves
 * unmeasured keeps its provenance and loses any stale measurement.
 * @param  {Object} registry From loadParties()
 * @param  {Function} [readSymbol] Party to symbol bytes
 * @return {{ measured: String[], unmeasured: String[] }} Party filnamn
 */
function measureParties (registry, readSymbol = party =>
  fs.readFileSync(dataPath('parti', party.filnamn, party.partisymbol.filnamn))) {
  const measured = [];
  const unmeasured = [];
  for (const party of registry.parties) {
    if (!party.partisymbol) {
      continue;
    }
    const box = contentBox(readSymbol(party));
    const { bild, bildyta, ...provenance } = party.partisymbol;
    party.partisymbol = box ? { ...provenance, ...box } : provenance;
    (box ? measured : unmeasured).push(party.filnamn);
  }
  return { measured, unmeasured };
}

function main () {
  const registry = loadParties();
  const { measured, unmeasured } = measureParties(registry);
  const yearFiles = loadYearFiles();
  const build = buildParties(registry, yearFiles);
  validate(build, yearFiles);
  applyRenames(build.renamed);
  const written = writeFiles(build.writeSet);

  console.log(`Mätta symboler: ${measured.length}`);
  console.log(`Omätta symboler: ${unmeasured.length}`);
  for (const filnamn of unmeasured) {
    console.log(`  ${path.relative(ROOT, dataPath('parti', filnamn))}`);
  }
  console.log(`Skrivna JSON-filer: ${written.length}`);
}

exports.measureParties = measureParties;

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
