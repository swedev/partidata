const fs = require('fs');
const crypto = require('crypto');

const { dataPath, fetchText, parseCsv, loadJSONFile } = require('./utils.js');
const {
  loadParties,
  loadYearFiles,
  upsertParties,
  buildParties,
  validate,
  writeFiles
} = require('./parti.js');

/**
 * Imports Valmyndigheten's deltagande-partier.csv for one election year,
 * reconciles data/parti/ and writes data/val/<år>/partideltagande/.
 * Run:
 * > npm run import-val -- 2026 [--file <sökväg>]
 */

const COLUMNS = [
  'VALTYP',
  'VALOMRÅDESKOD',
  'VALOMRÅDESNAMN',
  'VALKRETSKOD',
  'VALKRETSNAMN',
  'LÄNSKOD',
  'LÄNSNAMN',
  'PARTIBETECKNING',
  'PARTIFÖRKORTNING',
  'PARTIKOD',
  'ANMÄLNINGSDATUM',
  'BESLUTSDATUM',
  'DIARIENUMMER',
  'REGISTRERADPARTIBETECKNING',
  'ANMÄLDAKANDIDATER',
  'DELTAGANDEGRUND'
];

const VALTYPER = ['RD', 'RF', 'KF'];
const GRUNDER = ['A', 'R', 'K'];

/**
 * csvUrl
 * @param  {String} year
 * @return {String}
 */
function csvUrl (year) {
  return `https://data.val.se/filer/val${year}/parti/deltagande-partier.csv`;
}

/**
 * parseArgs
 * @param  {String[]} argv
 * @return {{ year: String, file: String|null }}
 */
function parseArgs (argv) {
  let year = null;
  let file = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--file') {
      file = argv[++i];
    } else if (!year) {
      year = argv[i];
    } else {
      throw new Error(`Unexpected argument: ${argv[i]}`);
    }
  }
  if (!/^\d{4}$/.test(year || '')) {
    throw new Error('Usage: node scripts/import-val.js <år> [--file <sökväg>]');
  }
  if (file && !fs.existsSync(file)) {
    throw new Error(`No such file: ${file}`);
  }
  return { year, file };
}

/**
 * parseRows
 * Parses and validates the CSV, rejecting anything the import cannot represent.
 * @param  {String} text
 * @return {Object[]}
 */
function parseRows (text) {
  const { header, rows } = parseCsv(text, { separator: ';' });
  if (header.length !== COLUMNS.length || header.some((name, i) => name !== COLUMNS[i])) {
    throw new Error(`Unexpected columns: ${header.join(';')}`);
  }
  rows.forEach((row, i) => {
    const line = i + 2;
    if (!VALTYPER.includes(row.VALTYP)) {
      throw new Error(`Row ${line}: unknown VALTYP "${row.VALTYP}"`);
    }
    if (!GRUNDER.includes(row.DELTAGANDEGRUND)) {
      throw new Error(`Row ${line}: unknown DELTAGANDEGRUND "${row.DELTAGANDEGRUND}"`);
    }
    if (!/^\d{4}$/.test(row.PARTIKOD)) {
      throw new Error(`Row ${line}: invalid PARTIKOD "${row.PARTIKOD}"`);
    }
    if (!['J', 'N'].includes(row.REGISTRERADPARTIBETECKNING)) {
      throw new Error(`Row ${line}: invalid REGISTRERADPARTIBETECKNING "${row.REGISTRERADPARTIBETECKNING}"`);
    }
    const width = { RD: 2, RF: 2, KF: 4 }[row.VALTYP];
    if (!new RegExp(`^\\d{${width}}$`).test(row.VALOMRÅDESKOD)) {
      throw new Error(`Row ${line}: invalid VALOMRÅDESKOD "${row.VALOMRÅDESKOD}" for ${row.VALTYP}`);
    }
    if (row.VALTYP === 'RD' && row.VALOMRÅDESKOD !== '00') {
      throw new Error(`Row ${line}: RD row with VALOMRÅDESKOD "${row.VALOMRÅDESKOD}"`);
    }
    if (!row.PARTIBETECKNING) {
      throw new Error(`Row ${line}: empty PARTIBETECKNING`);
    }
  });
  return rows;
}

/**
 * collectPartier
 * One record per PARTIKOD. Beteckning and förkortning must be consistent within
 * the file; REGISTRERADPARTIBETECKNING is set per anmälan, so a party counts as
 * registered when any of its rows says so.
 * @param  {Object[]} rows
 * @return {Object[]} Sorted by kod
 */
function collectPartier (rows) {
  const partier = new Map();
  for (const row of rows) {
    const existing = partier.get(row.PARTIKOD);
    if (!existing) {
      partier.set(row.PARTIKOD, {
        kod: row.PARTIKOD,
        beteckning: row.PARTIBETECKNING,
        forkortning: row.PARTIFÖRKORTNING,
        registrerad_partibeteckning: row.REGISTRERADPARTIBETECKNING === 'J'
      });
      continue;
    }
    if (existing.beteckning !== row.PARTIBETECKNING) {
      throw new Error(
        `PARTIKOD ${row.PARTIKOD} has two beteckningar: "${existing.beteckning}" and "${row.PARTIBETECKNING}"`
      );
    }
    if (existing.forkortning !== row.PARTIFÖRKORTNING) {
      throw new Error(
        `PARTIKOD ${row.PARTIKOD} has two förkortningar: "${existing.forkortning}" and "${row.PARTIFÖRKORTNING}"`
      );
    }
    existing.registrerad_partibeteckning ||= row.REGISTRERADPARTIBETECKNING === 'J';
  }
  return [...partier.values()].sort((a, b) => a.kod.localeCompare(b.kod));
}

/**
 * bestGrund
 * Own anmälan beats participation inherited from a higher level.
 * @param  {String} current
 * @param  {String} next
 * @return {String}
 */
function bestGrund (current, next) {
  if (!current) {
    return next;
  }
  return GRUNDER.indexOf(next) < GRUNDER.indexOf(current) ? next : current;
}

/**
 * buildYear
 * Builds the four year files, deduplicating the per-valkrets rows.
 * @param  {Object[]} rows
 * @param  {Object[]} partier With uuid resolved
 * @return {{ partier: Object[], riksdag: Object[], region: Object[], kommun: Object[] }}
 */
function buildYear (rows, partier) {
  const byKod = new Map(partier.map(party => [party.kod, party]));
  const regioner = loadJSONFile('data', 'regioner', 'index.json');
  const regionNamn = new Map(regioner.map(region => [region.kod, region]));
  const kommunNamn = new Map(
    regioner.flatMap(region => region.kommuner.map(kommun => [kommun.kod, kommun]))
  );

  const riksdag = new Map();
  const region = new Map();
  const kommun = new Map();

  for (const row of rows) {
    if (row.VALTYP === 'RD') {
      riksdag.set(row.PARTIKOD, bestGrund(riksdag.get(row.PARTIKOD), row.DELTAGANDEGRUND));
      continue;
    }
    const target = row.VALTYP === 'RF' ? region : kommun;
    const namn = row.VALTYP === 'RF' ? regionNamn : kommunNamn;
    if (!namn.has(row.VALOMRÅDESKOD)) {
      throw new Error(`Unknown ${row.VALTYP} VALOMRÅDESKOD "${row.VALOMRÅDESKOD}" (${row.VALOMRÅDESNAMN})`);
    }
    if (!target.has(row.VALOMRÅDESKOD)) {
      target.set(row.VALOMRÅDESKOD, new Map());
    }
    const partierIOmråde = target.get(row.VALOMRÅDESKOD);
    partierIOmråde.set(row.PARTIKOD, bestGrund(partierIOmråde.get(row.PARTIKOD), row.DELTAGANDEGRUND));
  }

  const toPartyEntries = partierIOmråde => [...partierIOmråde.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([kod, grund]) => ({
      beteckning: byKod.get(kod).beteckning,
      kod,
      uuid: byKod.get(kod).uuid,
      grund
    }));

  const toOmråden = (target, namn, koder) => koder
    .filter(kod => target.has(kod))
    .map(kod => ({
      kod,
      namn: namn.get(kod).namn,
      uuid: namn.get(kod).uuid,
      partier: toPartyEntries(target.get(kod))
    }));

  return {
    partier,
    riksdag: toPartyEntries(riksdag),
    region: toOmråden(region, regionNamn, [...regionNamn.keys()].sort()),
    kommun: [...kommunNamn.keys()].sort().map(kod => ({
      kod,
      namn: kommunNamn.get(kod).namn,
      uuid: kommunNamn.get(kod).uuid,
      partier: kommun.has(kod) ? toPartyEntries(kommun.get(kod)) : []
    }))
  };
}

/**
 * main
 */
async function main () {
  const { year, file } = parseArgs(process.argv.slice(2));

  const text = file
    ? fs.readFileSync(file, 'utf8')
    : await fetchText(csvUrl(year));
  console.log(`Källa: ${file || csvUrl(year)}`);
  console.log(`SHA-256: ${crypto.createHash('sha256').update(text, 'utf8').digest('hex')}`);
  console.log(`Hämtad: ${new Date().toISOString()}`);

  const rows = parseRows(text);
  const partier = collectPartier(rows);

  const registry = loadParties();
  const beteckningarFore = new Map(registry.parties.map(party => [party.uuid, party.beteckning]));
  const { created, merged } = upsertParties(registry, year, partier);

  const uuidByKod = new Map();
  registry.parties.forEach(party => party.koder.forEach(kod => uuidByKod.set(kod, party.uuid)));
  partier.forEach(party => {
    party.uuid = uuidByKod.get(party.kod);
    if (!party.uuid) {
      throw new Error(`No uuid resolved for ${party.kod} "${party.beteckning}"`);
    }
  });

  const yearData = buildYear(rows, partier);
  const yearFiles = loadYearFiles({ [year]: yearData });
  const build = buildParties(registry, yearFiles);
  validate(build, yearFiles);

  const valWriteSet = ['partier', 'riksdag', 'region', 'kommun'].map(name => ({
    file: dataPath('val', year, 'partideltagande', `${name}.json`),
    json: yearData[name]
  }));
  const written = writeFiles([...valWriteSet, ...build.writeSet]);

  const renamed = partier.filter(party => {
    const before = beteckningarFore.get(party.uuid);
    return before && before !== party.beteckning;
  });

  console.log(`\nRader: ${rows.length}`);
  console.log(`Partier i filen: ${partier.length}`);
  console.log(`Riksdagsvalet: ${yearData.riksdag.length}, regionval: ${yearData.region.length}, kommunval: ${yearData.kommun.length}`);
  console.log(`Nya partier: ${created.length}`);
  created.forEach(party => console.log(`  + ${party.koder[0]} ${party.beteckning} → ${party.filnamn}`));
  console.log(`Sammanslagna via beteckning: ${merged.length}`);
  merged.forEach(({ record, party }) =>
    console.log(`  ~ ${party.koder.filter(kod => kod !== record.kod).join('/')} → ${record.kod} ${record.beteckning} (${party.filnamn})`));
  console.log(`Omdöpta partier: ${renamed.length}`);
  renamed.forEach(party =>
    console.log(`  * ${party.kod} ${beteckningarFore.get(party.uuid)} → ${party.beteckning}`));
  console.log(`Skrivna filer: ${written.length}`);
  written.slice(0, valWriteSet.length).forEach(path => console.log(`  ${path}`));
}

/**
 * Exports
 */
exports.COLUMNS = COLUMNS;
exports.parseArgs = parseArgs;
exports.parseRows = parseRows;
exports.collectPartier = collectPartier;
exports.bestGrund = bestGrund;
exports.buildYear = buildYear;

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}
