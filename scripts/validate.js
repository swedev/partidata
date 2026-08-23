const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { ROOT, toFileName } = require('./utils.js');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readJson (file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Kan inte läsa ${file}: ${error.message}`);
  }
}

function requireArray (value, context) {
  assert.ok(Array.isArray(value), `${context} ska vara en array`);
  return value;
}

function requireString (value, context) {
  assert.equal(typeof value, 'string', `${context} ska vara en sträng`);
  assert.notEqual(value, '', `${context} får inte vara tom`);
}

function requireUuid (value, context) {
  requireString(value, context);
  assert.match(value, UUID_PATTERN, `${context} ska vara ett UUID`);
}

function requireUnique (items, key, context) {
  const seen = new Set();
  for (const item of items) {
    const value = item[key];
    assert.ok(!seen.has(value), `${context} innehåller dubbelt ${key}: ${value}`);
    seen.add(value);
  }
}

function validatePartyRegistry (dataDirectory) {
  const partyDirectory = path.join(dataDirectory, 'parti');
  const index = requireArray(readJson(path.join(partyDirectory, 'index.json')), 'parti/index.json');
  requireUnique(index, 'uuid', 'parti/index.json');
  requireUnique(index, 'filnamn', 'parti/index.json');

  const sorted = index.map(party => party.filnamn).toSorted();
  assert.deepEqual(index.map(party => party.filnamn), sorted, 'parti/index.json ska vara sorterad på filnamn');

  const directories = fs.readdirSync(partyDirectory, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .toSorted();
  assert.deepEqual(directories, sorted, 'Partikatalogerna ska motsvara posterna i parti/index.json');

  const partiesByUuid = new Map();
  const partySlugs = new Set();
  const routableSlugs = new Set();
  for (const entry of index) {
    const context = `parti/index.json (${entry.filnamn || 'okänt filnamn'})`;
    requireUuid(entry.uuid, `${context}.uuid`);
    requireString(entry.beteckning, `${context}.beteckning`);
    requireString(entry.filnamn, `${context}.filnamn`);
    const slugs = [entry.filnamn, ...(entry.tidigare_filnamn || [])];
    for (const slug of slugs) {
      requireString(slug, `${context}.filnamn`);
      assert.match(slug, /^[a-z0-9][a-z0-9-]*$/, `${context}: ${slug} är inte en säker slug`);
      assert.ok(!routableSlugs.has(slug), `${context}: sluggen ${slug} används av flera partisidor`);
      routableSlugs.add(slug);
    }

    const file = path.join(partyDirectory, entry.filnamn, 'index.json');
    assert.ok(fs.existsSync(file), `${path.relative(dataDirectory, file)} saknas`);
    const party = readJson(file);
    requireUuid(party.uuid, `${entry.filnamn}.uuid`);
    requireString(party.beteckning, `${entry.filnamn}.beteckning`);
    requireString(party.filnamn, `${entry.filnamn}.filnamn`);
    requireString(party.kod, `${entry.filnamn}.kod`);
    assert.equal(party.filnamn, entry.filnamn, `${entry.filnamn}: filnamn ska matcha katalogen`);

    for (const [key, value] of Object.entries(entry)) {
      assert.deepEqual(value, party[key], `${entry.filnamn}: ${key} skiljer sig mellan index och partifil`);
    }

    const baseSlug = toFileName(party.beteckning);
    const legacyHtmlSlug = toFileName(party.beteckning.replaceAll('&', '&amp;'));
    assert.ok(
      party.filnamn === baseSlug ||
      party.filnamn === `${baseSlug}-${party.kod}` ||
      party.filnamn === `${baseSlug}-` ||
      party.filnamn === legacyHtmlSlug,
      `${entry.filnamn}: filnamn utgår inte från beteckningen ${JSON.stringify(party.beteckning)}`
    );
    partiesByUuid.set(party.uuid, party);
    partySlugs.add(party.filnamn);
  }

  return { index, partiesByUuid, partySlugs };
}

function validateRegions (dataDirectory) {
  const regions = requireArray(readJson(path.join(dataDirectory, 'regioner', 'index.json')), 'regioner/index.json');
  requireUnique(regions, 'kod', 'regioner/index.json');
  requireUnique(regions, 'uuid', 'regioner/index.json');

  const regionsByCode = new Map();
  const municipalities = [];
  for (const region of regions) {
    requireString(region.kod, 'region.kod');
    requireString(region.namn, `region ${region.kod}.namn`);
    requireUuid(region.uuid, `region ${region.kod}.uuid`);
    regionsByCode.set(region.kod, region);
    for (const municipality of requireArray(region.kommuner, `region ${region.kod}.kommuner`)) {
      requireString(municipality.kod, `kommun i region ${region.kod}.kod`);
      requireString(municipality.namn, `kommun ${municipality.kod}.namn`);
      requireUuid(municipality.uuid, `kommun ${municipality.kod}.uuid`);
      municipalities.push(municipality);
    }
  }
  requireUnique(municipalities, 'kod', 'regioner/index.json kommuner');
  requireUnique(municipalities, 'uuid', 'regioner/index.json kommuner');

  return {
    regions,
    regionsByCode,
    municipalities,
    municipalitiesByCode: new Map(municipalities.map(municipality => [municipality.kod, municipality]))
  };
}

function validatePartyList (records, partiesByUuid, context) {
  requireArray(records, context);
  requireUnique(records, 'uuid', context);
  for (const record of records) {
    assert.notEqual(record.uuid, 'NOT FOUND', `${context} innehåller NOT FOUND`);
    requireUuid(record.uuid, `${context}.uuid`);
    requireString(record.kod, `${context}.kod`);
    requireString(record.beteckning, `${context}.beteckning`);
    assert.ok(partiesByUuid.has(record.uuid), `${context} hänvisar till okänt parti-UUID ${record.uuid}`);
  }
}

function validateAreaList (areas, referenceByCode, partiesByUuid, context, complete = false) {
  requireArray(areas, context);
  requireUnique(areas, 'kod', context);
  for (const area of areas) {
    const reference = referenceByCode.get(area.kod);
    assert.ok(reference, `${context} innehåller okänd områdeskod ${area.kod}`);
    assert.equal(area.uuid, reference.uuid, `${context} ${area.kod} har fel UUID`);
    assert.equal(area.namn, reference.namn, `${context} ${area.kod} har fel namn`);
    validatePartyList(area.partier, partiesByUuid, `${context} ${area.kod}.partier`);
  }
  if (complete) {
    assert.deepEqual(
      areas.map(area => area.kod).toSorted(),
      [...referenceByCode.keys()].toSorted(),
      `${context} ska innehålla samtliga områden`
    );
  }
}

function validateCandidateLists (yearDirectory, partySlugs) {
  const directory = path.join(yearDirectory, 'kandidatlistor');
  if (!fs.existsSync(directory)) return 0;

  const files = fs.readdirSync(directory).filter(file => file.endsWith('.json'));
  for (const file of files) {
    const candidateList = readJson(path.join(directory, file));
    requireString(candidateList.filnamn, `${file}.filnamn`);
    assert.equal(file, `${candidateList.filnamn}.json`, `${file}: filnamn-fältet ska matcha filen`);
    assert.ok(partySlugs.has(candidateList.filnamn), `${file} hänvisar till ett okänt parti`);
  }
  return files.length;
}

function validateElectionYears (dataDirectory, parties, geography) {
  const electionDirectory = path.join(dataDirectory, 'val');
  const years = fs.readdirSync(electionDirectory, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{4}$/.test(entry.name));
  let referenceCount = 0;
  let candidateListCount = 0;

  for (const year of years) {
    const yearDirectory = path.join(electionDirectory, year.name);
    const participationDirectory = path.join(yearDirectory, 'partideltagande');
    const partierFile = path.join(participationDirectory, 'partier.json');
    const riksdagFile = path.join(participationDirectory, 'riksdag.json');
    const regionFile = ['region.json', 'landsting.json']
      .map(file => path.join(participationDirectory, file))
      .find(file => fs.existsSync(file));
    const municipalityFile = path.join(participationDirectory, 'kommun.json');

    if (fs.existsSync(partierFile)) {
      const records = readJson(partierFile);
      validatePartyList(records, parties.partiesByUuid, `${year.name}/partier.json`);
      referenceCount += records.length;
    }
    if (fs.existsSync(riksdagFile)) {
      const records = readJson(riksdagFile);
      validatePartyList(records, parties.partiesByUuid, `${year.name}/riksdag.json`);
      referenceCount += records.length;
    }
    if (regionFile) {
      const areas = readJson(regionFile);
      validateAreaList(areas, geography.regionsByCode, parties.partiesByUuid, `${year.name}/${path.basename(regionFile)}`);
      referenceCount += areas.reduce((sum, area) => sum + area.partier.length, 0);
    }
    if (fs.existsSync(municipalityFile)) {
      const areas = readJson(municipalityFile);
      validateAreaList(
        areas,
        geography.municipalitiesByCode,
        parties.partiesByUuid,
        `${year.name}/kommun.json`,
        fs.existsSync(partierFile)
      );
      referenceCount += areas.reduce((sum, area) => sum + area.partier.length, 0);
    }
    candidateListCount += validateCandidateLists(yearDirectory, parties.partySlugs);
  }

  return { years: years.length, referenceCount, candidateListCount };
}

function validateData (dataDirectory = path.join(ROOT, 'data')) {
  const parties = validatePartyRegistry(dataDirectory);
  const geography = validateRegions(dataDirectory);
  requireUnique(
    [
      ...parties.index.map(({ uuid }) => ({ uuid })),
      ...geography.regions.map(({ uuid }) => ({ uuid })),
      ...geography.municipalities.map(({ uuid }) => ({ uuid }))
    ],
    'uuid',
    'partier, regioner och kommuner'
  );
  const elections = validateElectionYears(dataDirectory, parties, geography);

  return {
    parties: parties.index.length,
    regions: geography.regions.length,
    municipalities: geography.municipalities.length,
    ...elections
  };
}

if (require.main === module) {
  const result = validateData(process.argv[2] ? path.resolve(process.argv[2]) : undefined);
  console.log(
    `Validerade ${result.parties} partier, ${result.regions} regioner, ` +
    `${result.municipalities} kommuner och ${result.referenceCount} partireferenser ` +
    `över ${result.years} valår samt ${result.candidateListCount} kandidatlistor.`
  );
}

exports.validateData = validateData;
