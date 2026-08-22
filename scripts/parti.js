const fs = require('fs');

const { dataPath } = require('./utils.js');
const { parties } = require('./helpers.js');

const newParties = parties.map(({ uuid, beteckning, filnamn }) => ({ uuid, beteckning, filnamn }));

// Write index file
fs.writeFileSync(dataPath('parti', 'index.json'), JSON.stringify(newParties, null, 2) + '\n');
