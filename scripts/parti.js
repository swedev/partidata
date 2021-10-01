const _ = require('lodash');
const path = require('path');
const fs = require('fs');

const { parties } = require('./helpers.js');

const newParties = parties.map(party => _.pick(party, ['uuid', 'beteckning', 'filnamn']));

// Write index file
fs.writeFileSync(path.join('data', 'parti', 'index.json'), JSON.stringify(newParties, null, 2) + '\n');
