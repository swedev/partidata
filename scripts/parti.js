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
  'tidigare_filnamn',
  'forkortning',
  'registrerad_partibeteckning',
  'valmyndigheten_registreringsdatum',
  'partisymbol',
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
      tidigare_filnamn: data.tidigare_filnamn || [],
      forkortning: data.forkortning,
      registrerad_partibeteckning: data.registrerad_partibeteckning,
      valmyndigheten_registreringsdatum: data.valmyndigheten_registreringsdatum,
      partisymbol: data.partisymbol
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
 * normalisePartyName
 * Makes harmless spelling differences comparable without treating the result
 * as an identity of its own. The caller must still reject ambiguous matches.
 * @param  {String} name
 * @return {String}
 */
function normalisePartyName (name) {
  return name
    .normalize('NFD')
    .replace(/\p{Mark}/gu, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim();
}

/**
 * normalisedNameCollisions
 * Lists different registry parties whose current names become equal after
 * normalisation. These are review candidates, never automatic merges.
 * @param  {Object[]} parties From loadParties()
 * @return {Object[]} Each { name, parties }
 */
function normalisedNameCollisions (parties) {
  const groups = new Map();
  for (const party of parties) {
    const name = normalisePartyName(party.beteckning);
    if (!groups.has(name)) {
      groups.set(name, []);
    }
    groups.get(name).push(party);
  }
  return [...groups.entries()]
    .filter(([, matches]) => matches.length > 1)
    .map(([name, matches]) => ({
      name,
      parties: matches.slice().sort((a, b) => a.koder[0].localeCompare(b.koder[0]))
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * upsertParties
 * Reconciles one year's party records against the registry, allocating a uuid
 * for parties that are new; their filnamn is allocated by buildParties(), in the
 * same pass as the slugs of parties that were renamed. Identity is PARTIKOD
 * first, then the committed kodbyten.json aliases, then an unambiguous
 * normalised-name match for a party that has been given a new code. A name match is only
 * considered for a party that carries no code of its own in the year being
 * imported, and only when exactly one party and exactly one record share the
 * name.
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
    const key = normalisePartyName(record.beteckning);
    nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
  });

  const created = [];
  const merged = [];
  const unmatched = [];

  for (const record of records) {
    let party = byKod.get(record.kod) || _matchAlias(record.kod, kodbyten, byKod);
    if (!party) {
      const name = normalisePartyName(record.beteckning);
      const nameCandidates = parties.filter(candidate => normalisePartyName(candidate.beteckning) === name);
      const candidates = nameCandidates.filter(candidate =>
        !candidate.koder.some(kod => importedKoder.has(kod))
      );
      if (nameCandidates.length > 1 || (candidates.length > 0 && nameCounts.get(name) > 1)) {
        throw new Error(
          `Ambiguous match for ${record.kod} "${record.beteckning}" in ${year}: ` +
          `${nameCandidates.length} registry candidate(s) [${nameCandidates.map(c => c.koder.join('/')).join(', ')}], ` +
          `${nameCounts.get(name)} record(s) with that normalised name. ` +
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

  for (const record of unmatched) {
    const party = {
      uuid: newUuid(),
      filnamn: null,
      koder: [record.kod],
      beteckning: record.beteckning,
      tidigare_beteckningar: [],
      tidigare_filnamn: []
    };
    parties.push(party);
    byKod.set(record.kod, party);
    created.push(party);
  }

  return { created, merged };
}

/**
 * allocateFilnamn
 * Assigns a filnamn to every party that needs one in this build: parties that
 * are new to the registry and parties whose beteckning changed. One pass, so two
 * claimants on the same base slug are both suffixed with their kod, exactly as
 * two new parties are. A slug counts as taken when it is any party's filnamn or
 * any other party's tidigare_filnamn; a party may reclaim a slug it carried
 * before.
 * @param  {Object[]} claims Each { party, beteckning, kod }
 * @param  {Object[]} parties Every party in the registry
 * @return {Object[]} The claims, each with the allocated filnamn
 */
function allocateFilnamn (claims, parties) {
  const taken = new Set();
  for (const party of parties) {
    if (party.filnamn) {
      taken.add(party.filnamn);
    }
    (party.tidigare_filnamn || []).forEach(filnamn => taken.add(filnamn));
  }

  const baseCounts = new Map();
  for (const claim of claims) {
    const base = toFileName(claim.beteckning);
    baseCounts.set(base, (baseCounts.get(base) || 0) + 1);
  }

  for (const claim of claims) {
    const base = toFileName(claim.beteckning);
    if (!base) {
      throw new Error(`Party name "${claim.beteckning}" (${claim.kod}) produces an empty filnamn`);
    }
    const egna = new Set(claim.party.tidigare_filnamn || []);
    const isTaken = filnamn => taken.has(filnamn) && !egna.has(filnamn);
    const filnamn = isTaken(base) || baseCounts.get(base) > 1 ? `${base}-${claim.kod}` : base;
    if (isTaken(filnamn)) {
      throw new Error(`Cannot allocate filnamn for ${claim.kod} "${claim.beteckning}": ${filnamn} is taken`);
    }
    taken.add(filnamn);
    claim.filnamn = filnamn;
    claim.party.filnamn = filnamn;
  }

  return claims;
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
 * order the imports were run in, apart from tidigare_filnamn, which records the
 * slugs the registry has actually carried. A party whose beteckning changed is
 * given the slug of its new name; the slug it had moves to tidigare_filnamn.
 * @param  {Object} registry From loadParties(), after any upserts
 * @param  {Object} yearFiles From loadYearFiles()
 * @return {{ writeSet: Object[], index: Object[], parties: Object[], renamed: Object[] }}
 */
function buildParties (registry, yearFiles) {
  const { parties } = registry;
  _assertUniqueUuid(parties);
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

  const derived = parties.map(party => {
    const yearRecords = years
      .map(year => ({ year, record: recordsByYear.get(year).get(party.uuid) }))
      .filter(entry => entry.record);
    const derivedYearRecords = yearRecords.filter(entry => entry.record.derived);
    const newest = derivedYearRecords.length > 0 ? derivedYearRecords[derivedYearRecords.length - 1] : null;

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

    return { party, koder, kod, beteckning, tidigareBeteckningar, forkortning, registrerad, deltagande };
  });

  const claims = [];
  for (const entry of derived) {
    const { party, beteckning, kod, koder } = entry;
    if (!party.filnamn) {
      claims.push({ party, beteckning, kod });
      continue;
    }
    const base = toFileName(beteckning);
    const slugOfCurrentName = party.filnamn === base || koder.some(other => party.filnamn === `${base}-${other}`);
    if (beteckning !== party.beteckning && !slugOfCurrentName) {
      claims.push({ party, beteckning, kod, from: party.filnamn });
    }
  }
  allocateFilnamn(claims, parties);

  const renamed = [];
  for (const claim of claims.filter(entry => entry.from)) {
    const historik = [...(claim.party.tidigare_filnamn || []), claim.from];
    claim.party.tidigare_filnamn = [...new Set(historik)].filter(filnamn => filnamn !== claim.filnamn);
    renamed.push({ uuid: claim.party.uuid, from: claim.from, to: claim.filnamn });
  }

  const built = derived.map(entry => {
    const { party, koder, kod, beteckning, tidigareBeteckningar, forkortning, registrerad, deltagande } = entry;
    return {
      uuid: party.uuid,
      filnamn: party.filnamn,
      tidigare_filnamn: party.tidigare_filnamn || [],
      koder,
      data: _orderKeys({
        uuid: party.uuid,
        kod,
        tidigare_koder: koder.filter(other => other !== kod).sort(),
        beteckning,
        tidigare_beteckningar: tidigareBeteckningar,
        filnamn: party.filnamn,
        tidigare_filnamn: party.tidigare_filnamn || [],
        forkortning,
        registrerad_partibeteckning: registrerad,
        valmyndigheten_registreringsdatum: party.valmyndigheten_registreringsdatum,
        partisymbol: party.partisymbol,
        deltagande
      })
    };
  });

  _assertUnique(built);

  const index = built
    .map(party => _orderKeys({
      uuid: party.data.uuid,
      beteckning: party.data.beteckning,
      filnamn: party.data.filnamn,
      tidigare_filnamn: party.tidigare_filnamn,
      forkortning: party.data.forkortning,
      partisymbol: party.data.partisymbol
    }))
    .sort((a, b) => (a.filnamn < b.filnamn ? -1 : a.filnamn > b.filnamn ? 1 : 0));

  const writeSet = built
    .map(party => ({
      file: dataPath('parti', party.filnamn, 'index.json'),
      json: party.data
    }))
    .concat([{ file: dataPath('parti', 'index.json'), json: index }]);

  return { writeSet, index, parties: built, renamed };
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
 * _assertUniqueUuid
 * The uuid is the identity every other derivation hangs on, so a registry that
 * carries one twice is rejected before a single slug is allocated.
 * @param  {Object[]} parties From loadParties(), after any upserts
 */
function _assertUniqueUuid (parties) {
  const seen = new Map();
  for (const party of parties) {
    if (seen.has(party.uuid)) {
      throw new Error(`Duplicate uuid "${party.uuid}": ${seen.get(party.uuid)} and ${party.filnamn}`);
    }
    seen.set(party.uuid, party.filnamn);
  }
}

/**
 * _assertUnique
 * Every party must own its filnamn and each of its codes. A slug the registry
 * has served before is owned just as firmly as an active one, so a
 * tidigare_filnamn may not be any other party's filnamn or tidigare_filnamn.
 */
function _assertUnique (built) {
  const seen = { filnamn: new Map(), kod: new Map() };
  for (const party of built) {
    if (seen.filnamn.has(party.filnamn)) {
      throw new Error(`Duplicate filnamn "${party.filnamn}": ${seen.filnamn.get(party.filnamn)} and ${party.filnamn}`);
    }
    seen.filnamn.set(party.filnamn, party.filnamn);
    for (const filnamn of party.tidigare_filnamn || []) {
      if (seen.filnamn.has(filnamn)) {
        throw new Error(`Duplicate filnamn "${filnamn}": ${seen.filnamn.get(filnamn)} and ${party.filnamn}`);
      }
      seen.filnamn.set(filnamn, party.filnamn);
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
 * _kandidatlistFlyttar
 * The kandidatlistor a party rename takes with it, one per election year that
 * has a file for the old slug.
 * @param  {String} from
 * @param  {String} to
 * @return {Object[]} Each { from, to }, absolute paths
 */
function _kandidatlistFlyttar (from, to) {
  const valDir = dataPath('val');
  if (!fs.existsSync(valDir)) {
    return [];
  }
  return fs.readdirSync(valDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => ({
      from: dataPath('val', entry.name, 'kandidatlistor', `${from}.json`),
      to: dataPath('val', entry.name, 'kandidatlistor', `${to}.json`)
    }))
    .filter(flytt => fs.existsSync(flytt.from));
}

/**
 * validateRenames
 * Asserts that every directory move applyRenames() is about to make can be made,
 * so a rename never leaves the data tree half moved.
 * @param  {Object[]} renamed From buildParties(), each { uuid, from, to }
 */
function validateRenames (renamed) {
  const seenFrom = new Set();
  const seenTo = new Set();
  for (const { from, to } of renamed) {
    if (from === to) {
      throw new Error(`Rename of "${from}" has the same source and target`);
    }
    if (seenFrom.has(from)) {
      throw new Error(`Two renames move data/parti/${from}/`);
    }
    if (seenTo.has(to)) {
      throw new Error(`Two renames target data/parti/${to}/`);
    }
    seenFrom.add(from);
    seenTo.add(to);
    if (!fs.existsSync(dataPath('parti', from))) {
      throw new Error(`Cannot rename ${from} to ${to}: data/parti/${from}/ does not exist`);
    }
    if (fs.existsSync(dataPath('parti', to))) {
      throw new Error(`Cannot rename ${from} to ${to}: data/parti/${to}/ already exists`);
    }
    for (const flytt of _kandidatlistFlyttar(from, to)) {
      if (fs.existsSync(flytt.to)) {
        throw new Error(`Cannot rename ${from} to ${to}: ${path.relative(ROOT, flytt.to)} already exists`);
      }
    }
  }
}

/**
 * applyRenames
 * Moves the directory of every renamed party, and the kandidatlistor keyed by
 * its slug, to the new slug. A kandidatlista repeats the slug in its own
 * filnamn, which is rewritten with the move so the file and its content agree.
 * Runs after validate() and before writeFiles(), so the party file is written
 * into the directory it now belongs in.
 * @param  {Object[]} renamed From buildParties(), each { uuid, from, to }
 * @return {String[]} Moves made, as "<gammal sökväg> → <ny sökväg>"
 */
function applyRenames (renamed) {
  const moved = [];
  for (const { from, to } of renamed) {
    const flyttar = _kandidatlistFlyttar(from, to);
    fs.renameSync(dataPath('parti', from), dataPath('parti', to));
    moved.push(`data/parti/${from} → data/parti/${to}`);
    for (const flytt of flyttar) {
      fs.renameSync(flytt.from, flytt.to);
      const kandidatlista = readJson(flytt.to);
      if (kandidatlista && kandidatlista.filnamn) {
        kandidatlista.filnamn = to;
        fs.writeFileSync(flytt.to, JSON.stringify(kandidatlista, null, 2) + '\n');
      }
      moved.push(`${path.relative(ROOT, flytt.from)} → ${path.relative(ROOT, flytt.to)}`);
    }
  }
  return moved;
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

  validateRenames(build.renamed || []);
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
exports.normalisePartyName = normalisePartyName;
exports.normalisedNameCollisions = normalisedNameCollisions;
exports.upsertParties = upsertParties;
exports.allocateFilnamn = allocateFilnamn;
exports.buildParties = buildParties;
exports.validate = validate;
exports.validateRenames = validateRenames;
exports.applyRenames = applyRenames;
exports.writeFiles = writeFiles;

/**
 * Rebuild the registry from the committed data:
 * > node scripts/parti.js
 */
if (require.main === module) {
  const registry = loadParties();
  if (process.argv.includes('--report-name-collisions')) {
    const collisions = normalisedNameCollisions(registry.parties);
    if (collisions.length === 0) {
      console.log('No normalised party-name collisions.');
    }
    for (const collision of collisions) {
      const matches = collision.parties
        .map(party => `${party.koder.join('/')} "${party.beteckning}" (${party.filnamn})`)
        .join(' | ');
      console.log(`${collision.name}: ${matches}`);
    }
  } else {
    const yearFiles = loadYearFiles();
    const build = buildParties(registry, yearFiles);
    validate(build, yearFiles);
    const moved = applyRenames(build.renamed);
    moved.forEach(move => console.log(`Moved ${move}`));
    const written = writeFiles(build.writeSet);
    console.log(`Wrote ${written.length} files for ${build.parties.length} parties.`);
  }
}
