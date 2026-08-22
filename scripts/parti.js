const fs = require('fs');
const path = require('path');

const { ROOT, dataPath, toFileName, newUuid } = require('./utils.js');

/**
 * PARTY_KEY_ORDER
 * Fixed key order for data/parti/<filnamn>/index.json so generated files are
 * byte-stable regardless of how the values were derived.
 * @type {String[]}
 */
const PARTY_KEY_ORDER = [
  'uuid',
  'kod',
  'tidigare_koder',
  'beteckning',
  'tidigare_beteckningar',
  'filnamn',
  'forkortning',
  'registrerad_partibeteckning',
  'valmyndigheten_registreringsdatum',
  'deltagande'
];

/**
 * readJson
 * @param  {String} file
 * @return {*} Parsed content, or null when the file does not exist
 */
function readJson (file) {
  if (!fs.existsSync(file)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * loadParties
 * Reads the party files, which are the source of truth; data/parti/index.json
 * is derived from them.
 * @return {{ parties: Object[], kodbyten: Object }}
 */
function loadParties () {
  const partiDir = dataPath('parti');
  const filnamn = fs.readdirSync(partiDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
  const parties = filnamn.map(name => {
    const file = path.join(partiDir, name, 'index.json');
    const data = readJson(file);
    if (!data) {
      throw new Error(`Missing party file: ${file}`);
    }
    if (data.filnamn !== name) {
      throw new Error(`Party file ${file} has filnamn "${data.filnamn}"`);
    }
    return {
      uuid: data.uuid,
      filnamn: data.filnamn,
      koder: [data.kod, ...(data.tidigare_koder || [])].filter(Boolean),
      beteckning: data.beteckning,
      tidigare_beteckningar: data.tidigare_beteckningar || [],
      forkortning: data.forkortning,
      registrerad_partibeteckning: data.registrerad_partibeteckning,
      valmyndigheten_registreringsdatum: data.valmyndigheten_registreringsdatum
    };
  });
  return {
    parties,
    kodbyten: readJson(dataPath('parti', 'kodbyten.json')) || {}
  };
}

/**
 * loadYearFiles
 * Reads every data/val/<år>/partideltagande/ directory. A year passed in
 * overrides is taken from memory instead of from disk, which is how an import
 * in progress contributes its own year.
 * @param  {Object} [overrides] Year to { partier, riksdag, region, kommun }
 * @return {Object} Year to file set
 */
function loadYearFiles (overrides = {}) {
  const valDir = dataPath('val');
  const years = new Set(Object.keys(overrides).map(String));
  if (fs.existsSync(valDir)) {
    fs.readdirSync(valDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .forEach(entry => years.add(entry.name));
  }
  const yearFiles = {};
  for (const year of [...years].sort()) {
    if (overrides[year]) {
      yearFiles[year] = overrides[year];
      continue;
    }
    const dir = dataPath('val', year, 'partideltagande');
    if (!fs.existsSync(dir)) {
      continue;
    }
    yearFiles[year] = {
      partier: readJson(path.join(dir, 'partier.json')),
      riksdag: readJson(path.join(dir, 'riksdag.json')) || [],
      region: readJson(path.join(dir, 'region.json')) || readJson(path.join(dir, 'landsting.json')) || [],
      kommun: readJson(path.join(dir, 'kommun.json')) || []
    };
  }
  return yearFiles;
}

/**
 * upsertParties
 * Reconciles one year's party records against the registry, allocating uuid and
 * filnamn for parties that are new. Identity is PARTIKOD first, then the
 * committed kodbyten.json aliases, then an unambiguous name match for a party
 * that has been given a new code. A name match is only considered for a party
 * that carries no code of its own in the year being imported, and only when
 * exactly one party and exactly one record share the name.
 * @param  {Object} registry From loadParties()
 * @param  {String} year
 * @param  {Object[]} partier Year records, each { kod, beteckning }
 * @return {{ created: Object[], merged: Object[] }}
 */
function upsertParties (registry, year, partier) {
  const { parties, kodbyten } = registry;
  const byKod = new Map();
  parties.forEach(party => party.koder.forEach(kod => byKod.set(kod, party)));

  const importedKoder = new Set(partier.map(record => record.kod));

  const records = [...partier].sort((a, b) => a.kod.localeCompare(b.kod));
  const nameCounts = new Map();
  records.forEach(record => {
    const key = record.beteckning.toLowerCase();
    nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
  });

  const created = [];
  const merged = [];
  const unmatched = [];

  for (const record of records) {
    let party = byKod.get(record.kod) || _matchAlias(record.kod, kodbyten, byKod);
    if (!party) {
      const candidates = parties.filter(candidate =>
        candidate.beteckning.toLowerCase() === record.beteckning.toLowerCase() &&
        !candidate.koder.some(kod => importedKoder.has(kod))
      );
      if (candidates.length > 0 && (candidates.length > 1 || nameCounts.get(record.beteckning.toLowerCase()) > 1)) {
        throw new Error(
          `Ambiguous match for ${record.kod} "${record.beteckning}" in ${year}: ` +
          `${candidates.length} registry candidate(s) [${candidates.map(c => c.koder.join('/')).join(', ')}], ` +
          `${nameCounts.get(record.beteckning.toLowerCase())} record(s) with that name. ` +
          'Resolve it in data/parti/kodbyten.json.'
        );
      }
      if (candidates.length === 1) {
        party = candidates[0];
        merged.push({ record, party, via: 'beteckning' });
      }
    }
    if (party) {
      if (!party.koder.includes(record.kod)) {
        party.koder.push(record.kod);
        byKod.set(record.kod, party);
      }
    } else {
      unmatched.push(record);
    }
  }

  const takenFilnamn = new Set(parties.map(party => party.filnamn));
  const baseCounts = new Map();
  unmatched.forEach(record => {
    const base = toFileName(record.beteckning);
    baseCounts.set(base, (baseCounts.get(base) || 0) + 1);
  });
  for (const record of unmatched) {
    const base = toFileName(record.beteckning);
    if (!base) {
      throw new Error(`Party name "${record.beteckning}" (${record.kod}) produces an empty filnamn`);
    }
    const filnamn = takenFilnamn.has(base) || baseCounts.get(base) > 1
      ? `${base}-${record.kod}`
      : base;
    if (takenFilnamn.has(filnamn)) {
      throw new Error(`Cannot allocate filnamn for ${record.kod} "${record.beteckning}": ${filnamn} is taken`);
    }
    const party = {
      uuid: newUuid(),
      filnamn,
      koder: [record.kod],
      beteckning: record.beteckning,
      tidigare_beteckningar: []
    };
    takenFilnamn.add(filnamn);
    parties.push(party);
    byKod.set(record.kod, party);
    created.push(party);
  }

  return { created, merged };
}

/**
 * _matchAlias
 * Looks up a code in kodbyten.json in both directions, so an import of an older
 * year finds a party the registry already holds under its newer code.
 */
function _matchAlias (kod, kodbyten, byKod) {
  const related = new Set();
  if (kodbyten[kod]) {
    related.add(kodbyten[kod]);
  }
  Object.entries(kodbyten).forEach(([nyKod, gammalKod]) => {
    if (gammalKod === kod) {
      related.add(nyKod);
    }
  });
  for (const candidate of related) {
    const party = byKod.get(candidate);
    if (party) {
      return party;
    }
  }
  return null;
}

/**
 * buildParties
 * Derives every party's current fields and participation from the year files,
 * so the result is a pure function of the committed data rather than of the
 * order the imports were run in.
 * @param  {Object} registry From loadParties(), after any upserts
 * @param  {Object} yearFiles From loadYearFiles()
 * @return {{ writeSet: Object[], index: Object[], parties: Object[] }}
 */
function buildParties (registry, yearFiles) {
  const { parties } = registry;
  const years = Object.keys(yearFiles).sort();

  const recordsByYear = new Map();
  const participationByYear = new Map();
  for (const year of years) {
    const files = yearFiles[year];
    const records = new Map();
    if (files.partier) {
      files.partier.forEach(record => records.set(record.uuid, { ...record, derived: true }));
    } else {
      (files.riksdag || []).forEach(record => records.set(record.uuid, {
        kod: record.kod,
        beteckning: record.beteckning,
        derived: false
      }));
    }
    recordsByYear.set(year, records);

    const riksdag = new Set((files.riksdag || []).map(record => record.uuid));
    const region = new Map();
    const kommun = new Map();
    (files.region || []).forEach(område => {
      (område.partier || []).forEach(record => {
        if (!region.has(record.uuid)) {
          region.set(record.uuid, []);
        }
        region.get(record.uuid).push(område.kod);
      });
    });
    (files.kommun || []).forEach(område => {
      (område.partier || []).forEach(record => {
        if (!kommun.has(record.uuid)) {
          kommun.set(record.uuid, []);
        }
        kommun.get(record.uuid).push(område.kod);
      });
    });
    participationByYear.set(year, { riksdag, region, kommun });
  }

  const built = parties.map(party => {
    const yearRecords = years
      .map(year => ({ year, record: recordsByYear.get(year).get(party.uuid) }))
      .filter(entry => entry.record);
    const newest = yearRecords.length > 0 ? yearRecords[yearRecords.length - 1] : null;

    const koder = [...new Set(party.koder)];
    const kod = newest ? newest.record.kod : party.koder[0];
    const beteckning = newest ? newest.record.beteckning : party.beteckning;

    let forkortning = party.forkortning;
    let registrerad = party.registrerad_partibeteckning;
    if (newest && newest.record.derived) {
      forkortning = newest.record.forkortning || undefined;
      registrerad = newest.record.registrerad_partibeteckning;
    }

    const namn = [...party.tidigare_beteckningar];
    yearRecords.filter(entry => !entry.record.derived).forEach(entry => namn.push(entry.record.beteckning));
    namn.push(party.beteckning);
    yearRecords.filter(entry => entry.record.derived).forEach(entry => namn.push(entry.record.beteckning));
    const tidigareBeteckningar = [...new Set(namn)].filter(name => name !== beteckning);

    const deltagande = {};
    for (const year of years) {
      const participation = participationByYear.get(year);
      const iRiksdag = participation.riksdag.has(party.uuid);
      const region = (participation.region.get(party.uuid) || []).slice().sort();
      const kommun = (participation.kommun.get(party.uuid) || []).slice().sort();
      if (iRiksdag || region.length > 0 || kommun.length > 0) {
        deltagande[year] = { riksdag: iRiksdag, region, kommun };
      }
    }

    return {
      uuid: party.uuid,
      filnamn: party.filnamn,
      koder,
      data: _orderKeys({
        uuid: party.uuid,
        kod,
        tidigare_koder: koder.filter(other => other !== kod).sort(),
        beteckning,
        tidigare_beteckningar: tidigareBeteckningar,
        filnamn: party.filnamn,
        forkortning,
        registrerad_partibeteckning: registrerad,
        valmyndigheten_registreringsdatum: party.valmyndigheten_registreringsdatum,
        deltagande
      })
    };
  });

  _assertUnique(built);

  const index = built
    .map(party => ({
      uuid: party.data.uuid,
      beteckning: party.data.beteckning,
      filnamn: party.data.filnamn
    }))
    .sort((a, b) => (a.filnamn < b.filnamn ? -1 : a.filnamn > b.filnamn ? 1 : 0));

  const writeSet = built
    .map(party => ({
      file: dataPath('parti', party.filnamn, 'index.json'),
      json: party.data
    }))
    .concat([{ file: dataPath('parti', 'index.json'), json: index }]);

  return { writeSet, index, parties: built };
}

/**
 * _orderKeys
 * Applies PARTY_KEY_ORDER and drops empty optional values.
 */
function _orderKeys (data) {
  const ordered = {};
  for (const key of PARTY_KEY_ORDER) {
    const value = data[key];
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (Array.isArray(value) && value.length === 0) {
      continue;
    }
    if (!Array.isArray(value) && typeof value === 'object' && Object.keys(value).length === 0) {
      continue;
    }
    ordered[key] = value;
  }
  return ordered;
}

/**
 * _assertUnique
 * Every party must own its filnamn, its uuid and each of its codes.
 */
function _assertUnique (built) {
  const seen = { filnamn: new Map(), uuid: new Map(), kod: new Map() };
  for (const party of built) {
    for (const [key, value] of [['filnamn', party.filnamn], ['uuid', party.uuid]]) {
      if (seen[key].has(value)) {
        throw new Error(`Duplicate ${key} "${value}": ${seen[key].get(value)} and ${party.filnamn}`);
      }
      seen[key].set(value, party.filnamn);
    }
    for (const kod of party.koder) {
      if (seen.kod.has(kod)) {
        throw new Error(`Duplicate kod "${kod}": ${seen.kod.get(kod)} and ${party.filnamn}`);
      }
      seen.kod.set(kod, party.filnamn);
    }
  }
}

/**
 * validate
 * Asserts the invariants the import depends on, before anything is written.
 * @param  {Object} build From buildParties()
 * @param  {Object} yearFiles From loadYearFiles()
 */
function validate (build, yearFiles) {
  const uuids = new Set(build.parties.map(party => party.uuid));
  const regioner = readJson(dataPath('regioner', 'index.json')) || [];
  const regionKoder = new Set(regioner.map(region => region.kod));
  const kommunKoder = new Set(regioner.flatMap(region => region.kommuner.map(kommun => kommun.kod)));

  for (const [year, files] of Object.entries(yearFiles)) {
    const referenced = [
      ...(files.partier || []),
      ...(files.riksdag || []),
      ...(files.region || []).flatMap(område => område.partier || []),
      ...(files.kommun || []).flatMap(område => område.partier || [])
    ];
    for (const record of referenced) {
      if (!uuids.has(record.uuid)) {
        throw new Error(`Party uuid ${record.uuid} (${record.kod}) in ${year} is missing from the registry`);
      }
    }
    for (const område of files.region || []) {
      if (!regionKoder.has(område.kod)) {
        throw new Error(`Unknown region kod ${område.kod} in ${year}`);
      }
    }
    const kommunerInYear = (files.kommun || []).map(område => område.kod);
    for (const kod of kommunerInYear) {
      if (!kommunKoder.has(kod)) {
        throw new Error(`Unknown kommun kod ${kod} in ${year}`);
      }
    }
    if (files.partier && kommunerInYear.length !== kommunKoder.size) {
      throw new Error(
        `${year}/kommun.json has ${kommunerInYear.length} kommuner, expected ${kommunKoder.size}`
      );
    }
  }

  const index = build.writeSet[build.writeSet.length - 1].json;
  if (index.length !== build.parties.length) {
    throw new Error(`index.json has ${index.length} entries, expected ${build.parties.length}`);
  }
}

/**
 * writeFiles
 * @param  {Object[]} writeSet Entries of { file, json }
 * @return {String[]} Written paths, relative to the repository root
 */
function writeFiles (writeSet) {
  return writeSet.map(({ file, json }) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
    return path.relative(ROOT, file);
  });
}

/**
 * Exports
 */
exports.PARTY_KEY_ORDER = PARTY_KEY_ORDER;
exports.loadParties = loadParties;
exports.loadYearFiles = loadYearFiles;
exports.upsertParties = upsertParties;
exports.buildParties = buildParties;
exports.validate = validate;
exports.writeFiles = writeFiles;

/**
 * Rebuild the registry from the committed data:
 * > node scripts/parti.js
 */
if (require.main === module) {
  const registry = loadParties();
  const yearFiles = loadYearFiles();
  const build = buildParties(registry, yearFiles);
  validate(build, yearFiles);
  const written = writeFiles(build.writeSet);
  console.log(`Wrote ${written.length} files for ${build.parties.length} parties.`);
}
