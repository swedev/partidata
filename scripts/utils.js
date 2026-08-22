const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { Buffer } = require('buffer');

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
 * loadXML
 * @param  {String}   url
 * @param  {Function} callback
 * @return {request object}
 */
function loadXML (url, callback) {
  return https.get(url, function (res) {
    const chunks = [];

    res.on('data', function (chunk) {
      chunks.push(chunk);
    });

    res.on('error', function (e) {
      callback(e, null);
    });

    res.on('timeout', function (e) {
      callback(e, null);
    });

    res.on('end', function () {
      callback(null, Buffer.concat(chunks));
    });
  });
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
exports.loadXML = loadXML;
exports.loadJSONFile = loadJSONFile;
