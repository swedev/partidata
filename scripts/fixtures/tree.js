const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPTS = path.resolve(__dirname, '..');
const ROOT = path.resolve(SCRIPTS, '..');

/**
 * PARTIER
 * The registry the fixture CSVs are imported against.
 * @type {Object[]}
 */
const PARTIER = [
  {
    uuid: '11111111-1111-4111-8111-111111111111',
    kod: '9001',
    beteckning: 'Testpartiet',
    filnamn: 'testpartiet',
    forkortning: 'TP'
  },
  {
    uuid: '22222222-2222-4222-8222-222222222222',
    kod: '9005',
    beteckning: 'Gamla partiet',
    filnamn: 'gamla-partiet'
  },
  {
    uuid: '33333333-3333-4333-8333-333333333333',
    kod: '9006',
    beteckning: 'Aliaspartiet',
    filnamn: 'aliaspartiet'
  },
  {
    uuid: '44444444-4444-4444-8444-444444444444',
    kod: '9007',
    beteckning: 'Dubbelnamn',
    filnamn: 'dubbelnamn'
  },
  {
    uuid: '55555555-5555-4555-8555-555555555555',
    kod: '9008',
    beteckning: 'Dubbelnamn',
    filnamn: 'dubbelnamn-9008'
  }
];

/**
 * fixture
 * @param  {String} name File in scripts/fixtures/
 * @return {String} Absolute path
 */
function fixture (name) {
  return path.join(__dirname, name);
}

/**
 * makeTree
 * Builds a throwaway copy of the scripts and a minimal data/ tree, so an import
 * can run without touching the repository.
 * @param  {Object} [options]
 * @param  {Object[]} [options.parties]
 * @param  {Object} [options.kodbyten]
 * @return {String} Path to the tree
 */
function makeTree ({ parties = PARTIER, kodbyten = null } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'partidata-'));
  fs.mkdirSync(path.join(dir, 'scripts'));
  for (const file of ['utils.js', 'parti.js', 'import-val.js']) {
    fs.copyFileSync(path.join(SCRIPTS, file), path.join(dir, 'scripts', file));
  }
  fs.mkdirSync(path.join(dir, 'data', 'parti'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'data', 'regioner'), path.join(dir, 'data', 'regioner'), { recursive: true });
  for (const party of parties) {
    fs.mkdirSync(path.join(dir, 'data', 'parti', party.filnamn), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'data', 'parti', party.filnamn, 'index.json'),
      JSON.stringify(party, null, 2) + '\n'
    );
  }
  if (kodbyten) {
    fs.writeFileSync(path.join(dir, 'data', 'parti', 'kodbyten.json'), JSON.stringify(kodbyten, null, 2) + '\n');
  }
  return dir;
}

/**
 * removeTree
 * @param  {String} dir
 */
function removeTree (dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * runImport
 * @param  {String} dir Tree from makeTree()
 * @param  {String} year
 * @param  {String} csv Path to a CSV
 * @return {{ status: Number, stdout: String, stderr: String }}
 */
function runImport (dir, year, csv) {
  const result = spawnSync(
    process.execPath,
    [path.join(dir, 'scripts', 'import-val.js'), year, '--file', csv],
    { encoding: 'utf8' }
  );
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/**
 * runParti
 * Rebuilds the registry from the committed data in a tree.
 * @param  {String} dir Tree from makeTree()
 * @return {{ status: Number, stdout: String, stderr: String }}
 */
function runParti (dir) {
  const result = spawnSync(process.execPath, [path.join(dir, 'scripts', 'parti.js')], { encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/**
 * readJson
 * @param  {...String} segments
 * @return {*}
 */
function readJson (...segments) {
  return JSON.parse(fs.readFileSync(path.join(...segments), 'utf8'));
}

/**
 * snapshot
 * Every file below data/ with its content, for byte comparisons.
 * @param  {String} dir
 * @return {Object}
 */
function snapshot (dir) {
  const root = path.join(dir, 'data');
  const files = {};
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        files[path.relative(root, full)] = fs.readFileSync(full, 'utf8');
      }
    }
  };
  walk(root);
  return files;
}

/**
 * Exports
 */
exports.PARTIER = PARTIER;
exports.fixture = fixture;
exports.makeTree = makeTree;
exports.removeTree = removeTree;
exports.runImport = runImport;
exports.runParti = runParti;
exports.readJson = readJson;
exports.snapshot = snapshot;
