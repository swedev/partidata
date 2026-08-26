const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { ROOT } = require('./utils.js');
const {
  SOURCE_DEFINITIONS,
  buildCanonicalResult,
  parseSourceFiles,
  serializeResult,
  sourceMetadata
} = require('./riksdag-results.js');

function usage () {
  return 'Användning: node scripts/import-riksdagsval.js <valår> --hamtad <YYYY-MM-DD> --file <käll-id>=<sökväg> [...] [--transkribering <sökväg>]';
}

function parseArgs (argv) {
  const [yearValue, ...rest] = argv;
  const year = Number(yearValue);
  assert.ok(SOURCE_DEFINITIONS[year], usage());
  const paths = {};
  let retrievedAt;
  for (let index = 0; index < rest.length; index++) {
    const argument = rest[index];
    if (argument === '--hamtad') {
      retrievedAt = rest[++index];
    } else if (argument === '--file') {
      const value = rest[++index] ?? '';
      const separator = value.indexOf('=');
      assert.ok(separator > 0, '--file ska anges som <käll-id>=<sökväg>');
      paths[value.slice(0, separator)] = path.resolve(value.slice(separator + 1));
    } else if (argument === '--transkribering') {
      paths.transkribering = path.resolve(rest[++index] ?? '');
    } else {
      throw new Error(`Okänt argument: ${argument}\n${usage()}`);
    }
  }
  assert.match(retrievedAt ?? '', /^\d{4}-\d{2}-\d{2}$/, `--hamtad saknas eller är ogiltigt\n${usage()}`);
  const expectedIds = Object.keys(SOURCE_DEFINITIONS[year].sources);
  for (const id of expectedIds) {
    assert.ok(paths[id], `Källfilen ${id} saknas; använd --file ${id}=<sökväg>`);
  }
  if (SOURCE_DEFINITIONS[year].parser === 'scb-transcription') {
    assert.ok(paths.transkribering, '--transkribering krävs för SCB:s skannade tabell');
  }
  for (const sourcePath of Object.values(paths)) {
    assert.ok(fs.existsSync(sourcePath), `Filen saknas: ${sourcePath}`);
  }
  return { year, retrievedAt, paths };
}

function importResult ({ year, retrievedAt, paths }, dataRoot = path.join(ROOT, 'data')) {
  const files = Object.fromEntries(Object.entries(paths).map(([id, sourcePath]) => [id, fs.readFileSync(sourcePath)]));
  const raw = parseSourceFiles(year, files);
  const sources = sourceMetadata(year, files, retrievedAt);
  const result = buildCanonicalResult(raw, sources, dataRoot);
  const target = path.join(dataRoot, 'val', String(year), 'valresultat', 'riksdag.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, serializeResult(result));
  return { target, result };
}

if (require.main === module) {
  const imported = importResult(parseArgs(process.argv.slice(2)));
  const unresolved = imported.result.rostresultat.ej_kopplade.length;
  console.log(
    `Skrev ${path.relative(ROOT, imported.target)} med ${imported.result.rostresultat.partier.length} kopplade ` +
    `och ${unresolved} ej kopplade partirader.`
  );
}

exports.importResult = importResult;
exports.parseArgs = parseArgs;
