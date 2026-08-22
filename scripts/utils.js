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
