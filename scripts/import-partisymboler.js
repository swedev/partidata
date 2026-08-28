const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { unzipSync } = require('fflate');

const { contentBox } = require('./png.js');
const { ROOT, dataPath, fetchBuffer, toFileName } = require('./utils.js');
const {
  loadParties,
  loadYearFiles,
  buildParties,
  validate,
  applyRenames,
  writeFiles
} = require('./parti.js');

const LEGACY_YEAR = 2019;
const LEGACY_BASE_URL = 'https://historik.val.se/val/ep2019/regpartier';
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * symbolUrl
 * @param  {String} year
 * @return {String}
 */
function symbolUrl (year) {
  return `https://data.val.se/filer/val${year}/parti/partisymboler.zip`;
}

/**
 * symbolFileName
 * Includes both Valmyndigheten's code and a readable name slug so the file is
 * self-describing when served directly.
 * @param  {String} code
 * @param  {String} partyName
 * @return {String}
 */
function symbolFileName (code, partyName) {
  const slug = toFileName(partyName);
  if (!slug) {
    throw new Error(`Party name "${partyName}" produces an empty symbol filename`);
  }
  return `${code}-${slug}.png`;
}

/**
 * assertStoredSymbolFileName
 * Prevents a corrupt metadata value from escaping the party directory when an
 * obsolete symbol file is removed after a name or code change.
 * @param  {String} fileName
 */
function assertStoredSymbolFileName (fileName) {
  if (path.basename(fileName) !== fileName || !/^\d{4}-[a-z0-9-]+\.png$/.test(fileName)) {
    throw new Error(`Invalid stored symbol filename: ${fileName}`);
  }
}

/**
 * measurements
 * The sheet a symbol is delivered on, and where the drawing sits inside it, so
 * a renderer can show every symbol at the same optical size. A file this
 * reader leaves unmeasured is stored without the fields.
 * @param  {Buffer} data
 * @return {Object} { bild, bildyta }, or empty
 */
function measurements (data) {
  return contentBox(data) || {};
}

/**
 * parseArgs
 * @param  {String[]} argv
 * @return {{ year: String, file: String|null, legacyDir: String|null }}
 */
function parseArgs (argv) {
  let year = null;
  let file = null;
  let legacyDir = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--file') {
      file = argv[++i];
      if (!file) {
        throw new Error('--file requires a path');
      }
    } else if (argv[i] === '--legacy-dir') {
      legacyDir = argv[++i];
      if (!legacyDir) {
        throw new Error('--legacy-dir requires a path');
      }
    } else if (!year) {
      year = argv[i];
    } else {
      throw new Error(`Unexpected argument: ${argv[i]}`);
    }
  }
  if (!/^\d{4}$/.test(year || '')) {
    throw new Error('Usage: node scripts/import-partisymboler.js <år> [--file <zip>] [--legacy-dir <katalog>]');
  }
  if (file && !fs.existsSync(file)) {
    throw new Error(`No such file: ${file}`);
  }
  if (legacyDir && !fs.statSync(legacyDir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`No such directory: ${legacyDir}`);
  }
  return { year, file, legacyDir };
}

/**
 * assertPng
 * @param  {Buffer} data
 * @param  {String} name
 */
function assertPng (data, name) {
  if (data.length < PNG_SIGNATURE.length || !data.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error(`${name} is not a PNG file`);
  }
}

/**
 * normalizeCode
 * ZIP filenames omit leading zeroes while the registry uses four digits.
 * @param  {String} code
 * @return {String}
 */
function normalizeCode (code) {
  if (!/^\d{1,4}$/.test(code)) {
    throw new Error(`Invalid partikod "${code}" in symbol filename`);
  }
  return code.padStart(4, '0');
}

/**
 * readZipSymbols
 * @param  {Buffer} zip
 * @param  {String} year
 * @return {Object[]} Each { code, data, sourceName }
 */
function readZipSymbols (zip, year) {
  let files;
  try {
    files = unzipSync(new Uint8Array(zip));
  } catch (error) {
    throw new Error(`Could not read symbol ZIP: ${error.message}`);
  }
  const pattern = new RegExp(`^(\\d+)_Val ${year}\\.png$`);
  const symbols = [];
  const seen = new Set();
  for (const [sourceName, bytes] of Object.entries(files)) {
    const match = path.basename(sourceName).match(pattern);
    if (!match) {
      throw new Error(`Unexpected file in symbol ZIP: ${sourceName}`);
    }
    const code = normalizeCode(match[1]);
    if (seen.has(code)) {
      throw new Error(`Duplicate partikod ${code} in symbol ZIP`);
    }
    seen.add(code);
    const data = Buffer.from(bytes);
    assertPng(data, sourceName);
    symbols.push({ code, data, sourceName });
  }
  if (symbols.length === 0) {
    throw new Error('The symbol ZIP contains no PNG files');
  }
  return symbols.sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * readLegacySymbols
 * Reads the code-named files preserved by the old valsedel app.
 * @param  {String} dir
 * @return {Object[]} Each { code, data, sourceName }
 */
function readLegacySymbols (dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile() && /^\d{4}\.png$/.test(entry.name))
    .map(entry => {
      const data = fs.readFileSync(path.join(dir, entry.name));
      assertPng(data, entry.name);
      return { code: entry.name.slice(0, 4), data, sourceName: entry.name };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * mapSymbols
 * Resolves codes, including earlier codes, to the registry's stable party uuid.
 * Current symbols win over legacy symbols for the same party.
 * @param  {Object} registry From loadParties()
 * @param  {Object[]} current
 * @param  {Object[]} legacy
 * @param  {String} year
 * @return {{ imports: Object[], skippedLegacy: Number }}
 */
function mapSymbols (registry, current, legacy, year) {
  const byCode = new Map();
  for (const party of registry.parties) {
    for (const code of party.koder) {
      if (byCode.has(code)) {
        throw new Error(`Duplicate party code ${code} in registry`);
      }
      byCode.set(code, party);
    }
  }

  const imports = [];
  const importedUuids = new Set();
  const add = (symbol, sourceYear, sourceUrl, onlyIfMissing) => {
    const party = byCode.get(symbol.code);
    if (!party) {
      throw new Error(`No party found for symbol code ${symbol.code}`);
    }
    if (importedUuids.has(party.uuid)) {
      if (onlyIfMissing) {
        return false;
      }
      throw new Error(`More than one current symbol resolves to ${party.filnamn}`);
    }
    if (onlyIfMissing && party.partisymbol) {
      return false;
    }
    importedUuids.add(party.uuid);
    const previousFileName = party.partisymbol?.filnamn;
    if (previousFileName) {
      assertStoredSymbolFileName(previousFileName);
    }
    party.partisymbol = {
      filnamn: symbolFileName(symbol.code, party.beteckning),
      kalla: 'Valmyndigheten',
      kallurl: sourceUrl,
      valar: Number(sourceYear),
      partikod: symbol.code,
      ...measurements(symbol.data)
    };
    imports.push({ party, data: symbol.data, previousFileName });
    return true;
  };

  current.forEach(symbol => add(symbol, year, symbolUrl(year), false));
  let skippedLegacy = 0;
  legacy.forEach(symbol => {
    if (!add(symbol, LEGACY_YEAR, `${LEGACY_BASE_URL}/${symbol.code}.png`, true)) {
      skippedLegacy++;
    }
  });
  return { imports, skippedLegacy };
}

/**
 * writeSymbols
 * @param  {Object[]} imports From mapSymbols()
 * @return {String[]} Paths relative to the repository root
 */
function writeSymbols (imports) {
  return imports.map(({ party, data, previousFileName }) => {
    const file = dataPath('parti', party.filnamn, party.partisymbol.filnamn);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
    if (previousFileName && previousFileName !== party.partisymbol.filnamn) {
      const previousFile = dataPath('parti', party.filnamn, previousFileName);
      if (fs.existsSync(previousFile)) {
        fs.unlinkSync(previousFile);
      }
    }
    return path.relative(ROOT, file);
  });
}

async function main () {
  const { year, file, legacyDir } = parseArgs(process.argv.slice(2));
  const source = file || symbolUrl(year);
  const zip = file ? fs.readFileSync(file) : await fetchBuffer(source);
  const current = readZipSymbols(zip, year);
  const legacy = legacyDir ? readLegacySymbols(legacyDir) : [];

  console.log(`Källa: ${source}`);
  console.log(`SHA-256: ${crypto.createHash('sha256').update(zip).digest('hex')}`);
  console.log(`Hämtad: ${new Date().toISOString()}`);

  const registry = loadParties();
  const { imports, skippedLegacy } = mapSymbols(registry, current, legacy, year);
  const yearFiles = loadYearFiles();
  const build = buildParties(registry, yearFiles);
  validate(build, yearFiles);
  const moved = applyRenames(build.renamed);
  const writtenJson = writeFiles(build.writeSet);
  const writtenSymbols = writeSymbols(imports);

  console.log(`\nAktuella symboler: ${current.length}`);
  console.log(`Äldre symboler: ${legacy.length - skippedLegacy}`);
  console.log(`Överhoppade äldre symboler: ${skippedLegacy}`);
  console.log(`Flyttade filer: ${moved.length}`);
  console.log(`Skrivna symboler: ${writtenSymbols.length}`);
  console.log(`Skrivna JSON-filer: ${writtenJson.length}`);
}

exports.LEGACY_YEAR = LEGACY_YEAR;
exports.LEGACY_BASE_URL = LEGACY_BASE_URL;
exports.symbolUrl = symbolUrl;
exports.symbolFileName = symbolFileName;
exports.assertStoredSymbolFileName = assertStoredSymbolFileName;
exports.parseArgs = parseArgs;
exports.assertPng = assertPng;
exports.measurements = measurements;
exports.normalizeCode = normalizeCode;
exports.readZipSymbols = readZipSymbols;
exports.readLegacySymbols = readLegacySymbols;
exports.mapSymbols = mapSymbols;
exports.writeSymbols = writeSymbols;

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}
