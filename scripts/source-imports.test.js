const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.join(__dirname, '..');
const sourceRoot = path.join(projectRoot, 'src');
const dataRoot = path.join(projectRoot, 'data');

/** Every module under `src/` TypeScript compiles, path relative to the repository root. */
function sourceFiles (directory = sourceRoot) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [file] : [];
  });
}

/**
 * The module specifiers one file names, in the four forms the sources use:
 * `import ... from`, a side-effect `import`, `export ... from`, a dynamic
 * `import()` and `require()`.
 */
function specifiers (source) {
  const patterns = [
    /(?:^|[^\w$.])(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?(['"])([^'"]+)\1/g,
    /(?:^|[^\w$.])import\s*\(\s*(['"])([^'"]+)\1/g,
    /(?:^|[^\w$.])require\s*\(\s*(['"])([^'"]+)\1/g,
  ];
  return patterns.flatMap(pattern => [...source.matchAll(pattern)].map(match => match[2]));
}

/** Where a specifier lands, for the two forms that can reach `data/`. */
function resolvesIntoData (specifier, file) {
  if (specifier === 'data' || specifier.startsWith('data/')) return true;
  if (!specifier.startsWith('.')) return false;
  const target = path.resolve(path.dirname(file), specifier);
  const relative = path.relative(dataRoot, target);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

test('nothing under src/ imports from data/', () => {
  const files = sourceFiles();
  assert.ok(files.length > 0, 'src/ har moduler att granska');

  const offenders = files.flatMap(file => specifiers(fs.readFileSync(file, 'utf8'))
    .filter(specifier => resolvesIntoData(specifier, file))
    .map(specifier => `${path.relative(projectRoot, file)}: ${specifier}`));

  assert.deepEqual(offenders, [], 'data/ läses vid förfrågan genom src/server/party-data.ts, inte som import');
});
