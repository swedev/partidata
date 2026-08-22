const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * ROOT
 * Repository root, so paths resolve the same regardless of
 * the working directory the script is started from.
 * @type {String}
 */
const ROOT = path.resolve(__dirname, '..');

/**
 * dataPath
 * Absolute path to a file in the committed data/ tree.
 * @param  {...String} segments Path segments below data/
 * @return {String}
 */
function dataPath (...segments) {
  return path.join(ROOT, 'data', ...segments);
}

/**
 * DEBURR_LETTERS
 * Latin letters without a canonical decomposition — NFD normalisation leaves
 * them intact, so they are transliterated explicitly. The mappings match
 * lodash's deburr table, which the committed `filnamn` values are generated
 * with.
 * @type {Object}
 */
const DEBURR_LETTERS = {
  '\u00d0': 'D', '\u00f0': 'd', // D-with-stroke (eth)
  '\u00d8': 'O', '\u00f8': 'o', // O-with-stroke
  '\u00c6': 'Ae', '\u00e6': 'ae', // ae ligature
  '\u00de': 'Th', '\u00fe': 'th', // thorn
  '\u00df': 'ss', // sharp s
  '\u0110': 'D', '\u0111': 'd', // D-with-stroke
  '\u0126': 'H', '\u0127': 'h', // H-with-stroke
  '\u0131': 'i', // dotless i
  '\u0138': 'k', // kra
  '\u013f': 'L', '\u0140': 'l', // L-with-middle-dot
  '\u0141': 'L', '\u0142': 'l', // L-with-stroke
  '\u014a': 'N', '\u014b': 'n', // eng
  '\u0166': 'T', '\u0167': 't', // T-with-stroke
  '\u0132': 'IJ', '\u0133': 'ij', // ij ligature
  '\u0152': 'Oe', '\u0153': 'oe', // oe ligature
  '\u0149': '\u0027n', // n preceded by apostrophe
  '\u017f': 's' // long s
};

const DEBURR_PATTERN = new RegExp('[' + Object.keys(DEBURR_LETTERS).join('') + ']', 'g');

/**
 * toFileName
 * Turns name with latin chars into file name,
 * e.g. "Östra vägen (C)" => "ostra-vagen-c"
 * @param  {String} name
 * @return {String}
 */
function toFileName (name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(DEBURR_PATTERN, ch => DEBURR_LETTERS[ch])
    .toLowerCase()
    .replace(' - ', '-')
    .replace(/[)(]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+$/, '');
}

/**
 * newUuid
 * @return {String} uuid
 */
function newUuid () {
  return crypto.randomUUID();
}

/**
 * fetchText
 * Downloads a text resource, throwing on any non-2xx response.
 * @param  {String} url
 * @return {Promise<String>}
 */
async function fetchText (url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText} for ${url}`);
  }
  return res.text();
}

/**
 * parseCsv
 * Parses the unquoted, separator-delimited files published by Valmyndigheten.
 * A leading BOM is stripped, values are trimmed (the source writes a single
 * space for an empty value) and every row is checked against the header. Rows
 * may carry one trailing separator, which the 2022 file does.
 * @param  {String} text
 * @param  {Object} [options]
 * @param  {String} [options.separator]
 * @return {{ header: String[], rows: Object[] }}
 */
function parseCsv (text, { separator = ';' } = {}) {
  if (text.includes('"')) {
    throw new Error('parseCsv: quote character found, the source is expected to be unquoted');
  }
  const lines = text
    .replace(/^\ufeff/, '')
    .split(/\r?\n/)
    .filter(line => line.length > 0);
  if (lines.length === 0) {
    throw new Error('parseCsv: empty input');
  }
  const header = lines[0].split(separator).map(value => value.trim());
  const duplicates = header.filter((name, i) => header.indexOf(name) !== i);
  if (duplicates.length > 0) {
    throw new Error(`parseCsv: duplicate column name(s): ${[...new Set(duplicates)].join(', ')}`);
  }
  const rows = lines.slice(1).map((line, i) => {
    const values = line.split(separator).map(value => value.trim());
    if (values.length === header.length + 1 && values[values.length - 1] === '') {
      values.pop();
    }
    if (values.length !== header.length) {
      throw new Error(
        `parseCsv: row ${i + 2} has ${values.length} values, expected ${header.length}`
      );
    }
    return Object.fromEntries(header.map((name, j) => [name, values[j]]));
  });
  return { header, rows };
}

/**
 * loadJSONFile
 * @param  {...String} segments Path segments relative to the repository root
 * @return {Object}
 */
function loadJSONFile (...segments) {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, ...segments))
      .toString('utf8')
  );
}

/**
 * Exports
 */
exports.ROOT = ROOT;
exports.dataPath = dataPath;
exports.toFileName = toFileName;
exports.newUuid = newUuid;
exports.fetchText = fetchText;
exports.parseCsv = parseCsv;
exports.loadJSONFile = loadJSONFile;
