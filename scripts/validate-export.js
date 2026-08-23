const fs = require('node:fs');
const path = require('node:path');

function findHtmlFiles (directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? findHtmlFiles(entryPath) : entryPath.endsWith('.html') ? [entryPath] : [];
  });
}

function validatePartyTitles (outDirectory) {
  const partyDirectory = path.join(outDirectory, 'parti');
  const files = findHtmlFiles(partyDirectory);
  if (files.length === 0) {
    throw new Error(`Inga exporterade partisidor hittades i ${partyDirectory}`);
  }
  const invalid = files.filter(file => {
    const html = fs.readFileSync(file, 'utf8');
    const title = html.match(/<title\b[^>]*>(.*?)<\/title>/s)?.[1].trim();
    return !title;
  });

  if (invalid.length > 0) {
    const relativeFiles = invalid.map(file => path.relative(outDirectory, file));
    throw new Error(`Tom eller saknad <title> i:\n${relativeFiles.join('\n')}`);
  }

  console.log(`Kontrollerade <title> på ${files.length} partisidor.`);
}

if (require.main === module) {
  validatePartyTitles(path.resolve(process.argv[2] || 'out'));
}

exports.validatePartyTitles = validatePartyTitles;
