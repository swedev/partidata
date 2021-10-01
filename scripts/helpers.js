const fs = require('fs');
const path = require('path');

const {
  loadJSONFile,
  loadXML
} = require('./utils.js');

/**
 * parseULFile
 * @return {Array} Parsed list
 */
function parseULFile (filePathname) {
  const lines = fs
    .readFileSync(path.resolve(__dirname, filePathname || 'ul.html'))
    .toString('utf8')
    .replace('&amp;', '&')
    .split('\n');
  return lines.reduce((acc, line) => {
    if (line.indexOf('<li>') === 0) {
      const kod = line.match(/id(\d\d\d\d)/)[1];
      const beteckning = line.match(/">(.+?)<\/a>/)[1];
      acc.push({
        kod: kod,
        beteckning: beteckning
      });
    }
    return acc;
  }, []);
}

/**
 * parseKommunXMLFile
 * @return {Array} Parsed list
 */
function parseKommunXMLFile (filePathname) {
  return parseKommunXML(
    fs.readFileSync(path.resolve(__dirname, filePathname || 'kommun.xml'))
      .toString('utf8')
  );
}

/**
 * parseKommunXML
 * @return {Array} Parsed list
 */
function parseKommunXML (xmlStr) {
  const lines = xmlStr
    .replace(/&amp;/g, '&')
    .split('\n')
    .map(l => l.trim());
  const trackDuplicatesMap = {};
  return lines.reduce((acc, line) => {
    if (line.indexOf('<PARTI BETECKNING="') === 0) {
      const kod = line.match(/KOD="(\d\d\d\d)"/)[1];
      const beteckning = line.match(/BETECKNING="(.+?)"/)[1];
      if (!trackDuplicatesMap[beteckning]) {
        acc.push({
          kod: kod,
          beteckning: beteckning
        });
      }
      trackDuplicatesMap[beteckning] = kod;
    }
    return acc;
  }, []);
}

/**
 * getNonRiksdagPartiesFromULFile
 * @param  {String} year
 * @param  {String} filePathname
 * @return {Array}
 */
function getNonRiksdagPartiesFromULFile (year, filePathname) {
  // riksdag
  const riksdagPartyMap = _getRiksdagPartyMap(year);
  // return ul parties not in riksdag, with uuid.
  const parties = parseULFile(filePathname)
    .filter(p => !riksdagPartyMap[p.beteckning]);
  // Add uuid
  parties.forEach(p => {
    p.uuid = partyMap[p.beteckning]
      ? partyMap[p.beteckning].uuid
      : 'NOT FOUND';
  });
  return parties;
}

/**
 * getNonRiksdagPartiesFromKommunXmlFile
 * @param  {String} year
 * @param  {String} filePathname
 * @return {Array}
 */
function getNonRiksdagPartiesFromKommunXmlFile (year, filePathname) {
  // riksdag
  const riksdagPartyMap = _getRiksdagPartyMap(year);
  // return kommun parties not in riksdag, with uuid.
  const parties = parseKommunXMLFile(filePathname)
    .filter(p => !riksdagPartyMap[p.beteckning]);
  // Add uuid
  parties.forEach(p => {
    p.uuid = partyMap[p.beteckning]
      ? partyMap[p.beteckning].uuid
      : 'NOT FOUND';
  });
  return parties;
}

/**
 * getNonRiksdagPartiesFromKommunXmlUrl
 * @param  {String} year
 * @param  {String} url
 * @return {Array}
 */
function getNonRiksdagPartiesFromKommunXmlUrl (year, url) {
  // riksdag
  const riksdagPartyMap = _getRiksdagPartyMap(year);
  // return promise
  return new Promise((resolve, reject) => {
    // Load xml from url
    loadXML(url, (err, data) => {
      if (err) {
        reject(err);
      }
      // return kommun parties not in riksdag, with uuid.
      const parties = parseKommunXML(data.toString('latin1'))
        .filter(p => !riksdagPartyMap[p.beteckning]);
      // Add uuid
      parties.forEach(p => {
        p.uuid = partyMap[p.beteckning]
          ? partyMap[p.beteckning].uuid
          : 'NOT FOUND';
      });
      // resolve
      resolve(parties);
    });
  });
}

/**
 * _getRiksdagPartyMap
 */
function _getRiksdagPartyMap (year) {
  const riksdagParties = JSON.parse(
    fs.readFileSync(path.resolve('data', 'val', String(year), 'partideltagande/riksdag.json'))
      .toString('utf8')
  );
  return riksdagParties.reduce((acc, p) => {
    acc[p.beteckning] = p;
    return acc;
  }, {});
}

/**
 * vars
 */

// all parties
const parties = loadJSONFile('data', 'parti', 'index.json');
const partyMap = parties.reduce((acc, p) => {
  acc[p.beteckning] = p;
  return acc;
}, {});

// all regions
const regions = loadJSONFile('data', 'regioner', 'index.json');

/**
 * Exports
 */
exports.getNonRiksdagPartiesFromULFile = getNonRiksdagPartiesFromULFile;
exports.getNonRiksdagPartiesFromKommunXmlFile = getNonRiksdagPartiesFromKommunXmlFile;
exports.getNonRiksdagPartiesFromKommunXmlUrl = getNonRiksdagPartiesFromKommunXmlUrl;
exports.parties = parties;
exports.partyMap = partyMap;
exports.regions = regions;
