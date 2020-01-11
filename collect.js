const fs = require('fs');

const { loadJSONFile } = require('./utils.js');
const { getNonRiksdagPartiesFromKommunXmlUrl } = require('./helpers.js');

/**
 * Script for collecting data from XML files at data.val.se
 * and updating party participation per municipality (kommun).
 * Run:
 * > node collect.js
 */

const year = '2018';

const kommunJsonFile = `./val/${year}/partideltagande/kommun.json`;
const kommunDeltagande = loadJSONFile(kommunJsonFile);

const fetchLimit = 40;
let numFetched = 0;
let index = 0;
let kommun = kommunDeltagande[index];

// Starting index
while (kommun && kommun.partier) {
  index++;
  kommun = kommunDeltagande[index];
}
console.log('Starting at index:', index);

/**
 * interval
 */
const _intervalId = setInterval(() => {

  kommun = kommunDeltagande[index];
  if (!kommun || numFetched >= fetchLimit) {
    // stop fetching
    clearInterval(_intervalId);
    // write new data
    console.log('Done, writing file');
    fs.writeFileSync(kommunJsonFile, JSON.stringify(kommunDeltagande, null, 2));
    return;
  }
  console.log('Kommun:', kommun.kod, kommun.namn);
  // Already fetched
  if (kommun.partier) {
    console.log('Already fetched.');
    index++;
    return;
  }

  const url = _getXMLUrl(kommun, year);
  console.log('Getting data from:\n', url);
  // Get data
  getNonRiksdagPartiesFromKommunXmlUrl(year, url)
    .then(partier => {
      console.log('Found parties:', partier.map(p => p.beteckning), '\n\n');
      kommun.partier = partier;
      numFetched++;
    });

  index++;
}, 2000);

/**
 * _getXMLUrl
 */
function _getXMLUrl(kommun, year) {
  const lanKod = kommun.kod.substr(0, 2);
  const komKod = kommun.kod.substr(2, 2);
  return `https://data.val.se/val/val${year}/valsedlar/K/kommun/${lanKod}/${komKod}/${lanKod}${komKod}K.xml`;
}
