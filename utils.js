const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const uuidV4 = require('uuid/v4');
const https = require('https');
const { Buffer } = require('buffer');

/**
 * toFileName
 * Turns name with latin chars into file name,
 * e.g. "Östra vägen (C)" => "ostra-vagen-c"
 * @param  {String} name
 * @return {String}
 */
function toFileName(name) {
  return _.deburr(name)
    .toLowerCase()
    .replace(' - ', '-')
    .replace(/[)(]/g, '')
    .replace(/[^a-z0-9]/g, '-');
}

/**
 * newUuid
 * @return {String} uuid
 */
function newUuid() {
  return uuidV4();
}

/**
 * loadXML
 * @param  {String}   url
 * @param  {Function} callback
 * @return {request object}
 */
function loadXML(url, callback) {
  return https.get(url, function(res) {
    var chunks = [];

    res.on('data', function(chunk) {
      chunks.push(chunk);
    });

    res.on('error', function(e) {
      callback(e, null);
    });

    res.on('timeout', function(e) {
      callback(e, null);
    });

    res.on('end', function() {
      callback(null, Buffer.concat(chunks));
    });
  });
}

/**
 * loadJSONFile
 * @param  {String} filePathname
 * @return {Object}
 */
function loadJSONFile(filePathname) {
  return JSON.parse(
    fs.readFileSync(path.resolve(__dirname, filePathname))
      .toString('utf8')
  );
}

/**
 * Exports
 */
exports.toFileName = toFileName;
exports.newUuid = newUuid;
exports.loadXML = loadXML;
exports.loadJSONFile = loadJSONFile;
