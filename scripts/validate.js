const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { checkPartyProfileParliamentView } = require('./build-derived-data.js');
const { ROOT, toFileName } = require('./utils.js');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const INDEX_KEYS_FROM_PARTY = ['beteckning', 'filnamn', 'forkortning', 'partisymbol', 'tidigare_filnamn', 'uuid'];

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

function requireUrl (value, context) {
  requireString(value, context);
  assert.doesNotThrow(() => new URL(value), `${context} ska vara en giltig URL`);
}

function validateProfileSource (source, context) {
  assert.ok(source && typeof source === 'object' && !Array.isArray(source), `${context} ska vara ett objekt`);
  requireString(source.namn, `${context}.namn`);
  requireUrl(source.url, `${context}.url`);
  requireString(source.hamtad, `${context}.hamtad`);
  assert.match(source.hamtad, /^\d{4}-\d{2}-\d{2}$/, `${context}.hamtad ska vara ÅÅÅÅ-MM-DD`);
}

function validatePartyProfile (profile, context) {
  assert.ok(profile && typeof profile === 'object' && !Array.isArray(profile), `${context} ska vara ett objekt`);
  requireString(profile.namn, `${context}.namn`);
  validateProfileSource(profile.namn_kalla, `${context}.namn_kalla`);
  if (profile.webbplats !== undefined) requireUrl(profile.webbplats, `${context}.webbplats`);
  if (profile.accentfarg !== undefined) {
    requireString(profile.accentfarg, `${context}.accentfarg`);
    assert.match(profile.accentfarg, /^#[0-9a-f]{6}$/i, `${context}.accentfarg ska vara en hex-färg`);
  }
  if (profile.beskrivning !== undefined) requireString(profile.beskrivning, `${context}.beskrivning`);
  if (profile.symbolvisning !== undefined) {
    assert.equal(profile.symbolvisning, 'mark', `${context}.symbolvisning har ett okänt värde`);
  }
  if (profile.profiltext !== undefined) {
    requireString(profile.profiltext.text, `${context}.profiltext.text`);
    validateProfileSource(profile.profiltext.kalla, `${context}.profiltext.kalla`);
  }
  if (profile.kanaler !== undefined) {
    requireArray(profile.kanaler, `${context}.kanaler`);
    for (const [index, channel] of profile.kanaler.entries()) {
      requireString(channel.etikett, `${context}.kanaler[${index}].etikett`);
      if (channel.detalj !== undefined) requireString(channel.detalj, `${context}.kanaler[${index}].detalj`);
      requireUrl(channel.url, `${context}.kanaler[${index}].url`);
    }
  }
  if (profile.utdrag !== undefined) {
    requireString(profile.utdrag.etikett, `${context}.utdrag.etikett`);
    requireString(profile.utdrag.rubrik, `${context}.utdrag.rubrik`);
    if (profile.utdrag.ingress !== undefined) requireString(profile.utdrag.ingress, `${context}.utdrag.ingress`);
    requireUrl(profile.utdrag.url, `${context}.utdrag.url`);
    validateProfileSource(profile.utdrag.kalla, `${context}.utdrag.kalla`);
    requireArray(profile.utdrag.punkter, `${context}.utdrag.punkter`);
    for (const [index, item] of profile.utdrag.punkter.entries()) {
      requireString(item.rubrik, `${context}.utdrag.punkter[${index}].rubrik`);
      requireString(item.text, `${context}.utdrag.punkter[${index}].text`);
    }
  }
  if (profile.foretradare !== undefined) {
    requireArray(profile.foretradare, `${context}.foretradare`);
    requireUnique(profile.foretradare, 'namn', `${context}.foretradare`);
    for (const [index, representative] of profile.foretradare.entries()) {
      requireString(representative.namn, `${context}.foretradare[${index}].namn`);
      requireString(representative.uppdrag, `${context}.foretradare[${index}].uppdrag`);
      requireUrl(representative.url, `${context}.foretradare[${index}].url`);
      if (representative.bild !== undefined) requireString(representative.bild, `${context}.foretradare[${index}].bild`);
      if (representative.framlyft !== undefined) assert.equal(typeof representative.framlyft, 'boolean', `${context}.foretradare[${index}].framlyft ska vara boolean`);
    }
  }
  if (profile.nyheter !== undefined) {
    requireArray(profile.nyheter, `${context}.nyheter`);
    for (const [index, article] of profile.nyheter.entries()) {
      const articleContext = `${context}.nyheter[${index}]`;
      requireString(article.datum, `${articleContext}.datum`);
      assert.match(article.datum, /^\d{4}-\d{2}-\d{2}$/, `${articleContext}.datum ska vara ÅÅÅÅ-MM-DD`);
      requireString(article.kalla, `${articleContext}.kalla`);
      requireString(article.kallkod, `${articleContext}.kallkod`);
      requireString(article.kallfarg, `${articleContext}.kallfarg`);
      assert.match(article.kallfarg, /^#[0-9a-f]{6}$/i, `${articleContext}.kallfarg ska vara en hex-färg`);
      if (article.sektion !== undefined) requireString(article.sektion, `${articleContext}.sektion`);
      requireString(article.titel, `${articleContext}.titel`);
      requireUrl(article.url, `${articleContext}.url`);
    }
  }
  if (profile.wikipedia !== undefined) {
    requireString(profile.wikipedia.titel, `${context}.wikipedia.titel`);
    requireUrl(profile.wikipedia.url, `${context}.wikipedia.url`);
    requireString(profile.wikipedia.utdrag, `${context}.wikipedia.utdrag`);
    requireString(profile.wikipedia.hamtad, `${context}.wikipedia.hamtad`);
    assert.match(profile.wikipedia.hamtad, /^\d{4}-\d{2}-\d{2}$/, `${context}.wikipedia.hamtad ska vara ÅÅÅÅ-MM-DD`);
    if (profile.wikipedia.fakta !== undefined) {
      requireArray(profile.wikipedia.fakta, `${context}.wikipedia.fakta`);
      for (const [index, fact] of profile.wikipedia.fakta.entries()) {
        requireString(fact.etikett, `${context}.wikipedia.fakta[${index}].etikett`);
        requireString(fact.varde, `${context}.wikipedia.fakta[${index}].varde`);
      }
    }
  }
  if (profile.valresultat !== undefined) {
    assert.equal(profile.valresultat.valtyp, 'riksdag', `${context}.valresultat.valtyp har ett okänt värde`);
    requireArray(profile.valresultat.kallor, `${context}.valresultat.kallor`);
    assert.ok(profile.valresultat.kallor.length > 0, `${context}.valresultat.kallor får inte vara tom`);
    profile.valresultat.kallor.forEach((source, index) => {
      validateProfileSource(source, `${context}.valresultat.kallor[${index}]`);
    });
    requireArray(profile.valresultat.resultat, `${context}.valresultat.resultat`);
    assert.ok(profile.valresultat.resultat.length > 0, `${context}.valresultat.resultat får inte vara tom`);
    requireUnique(profile.valresultat.resultat, 'valar', `${context}.valresultat.resultat`);
    let previousYear = 0;
    for (const result of profile.valresultat.resultat) {
      assert.ok(Number.isInteger(result.valar) && result.valar > previousYear, `${context}.valresultat.resultat ska vara sorterat på valår`);
      assert.ok(typeof result.rostandel === 'number' && result.rostandel >= 0 && result.rostandel <= 100, `${context}.valresultat.resultat.rostandel ska vara 0–100`);
      assert.ok(Number.isInteger(result.mandat) && result.mandat >= 0 && result.mandat <= 349, `${context}.valresultat.resultat.mandat ska vara 0–349`);
      if (result.roster !== undefined) assert.ok(Number.isInteger(result.roster) && result.roster >= 0, `${context}.valresultat.resultat.roster ska vara ett positivt heltal`);
      previousYear = result.valar;
    }
  }
  if (profile.dokument !== undefined) {
    requireArray(profile.dokument, `${context}.dokument`);
    for (const [index, document] of profile.dokument.entries()) {
      const documentContext = `${context}.dokument[${index}]`;
      assert.ok(['valmanifest', 'partiprogram'].includes(document.typ), `${documentContext}.typ har ett okänt värde`);
      requireString(document.titel, `${documentContext}.titel`);
      requireUrl(document.url, `${documentContext}.url`);
      validateProfileSource(document.kalla, `${documentContext}.kalla`);
      if (document.delar !== undefined) {
        requireArray(document.delar, `${documentContext}.delar`);
        requireUnique(document.delar, 'nummer', `${documentContext}.delar`);
        for (const section of document.delar) {
          assert.ok(Number.isInteger(section.nummer) && section.nummer > 0, `${documentContext}.delar.nummer ska vara ett positivt heltal`);
          requireString(section.titel, `${documentContext}.delar.titel`);
          if (section.url !== undefined) requireUrl(section.url, `${documentContext}.delar.url`);
        }
      }
    }
  }
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
    for (const key of INDEX_KEYS_FROM_PARTY) {
      assert.deepEqual(entry[key], party[key], `${entry.filnamn}: ${key} saknas i index.json`);
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

    const profileFile = path.join(partyDirectory, entry.filnamn, 'profil.json');
    if (fs.existsSync(profileFile)) {
      validatePartyProfile(readJson(profileFile), `${entry.filnamn}/profil.json`);
    }
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

function validateParliamentResults (dataDirectory) {
  const electionDirectory = path.join(dataDirectory, 'val');
  const resultFiles = fs.readdirSync(electionDirectory, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{4}$/.test(entry.name))
    .map(entry => ({
      year: Number(entry.name),
      file: path.join(electionDirectory, entry.name, 'valresultat', 'riksdag.json')
    }))
    .filter(result => fs.existsSync(result.file))
    .toSorted((a, b) => a.year - b.year);

  if (resultFiles.length === 0) return;

  let hasChamberComposition = false;
  for (const { year, file } of resultFiles) {
    const context = `${year}/valresultat/riksdag.json`;
    const result = readJson(file);
    assert.equal(result.valar, year, `${context}.valar ska matcha katalogens valår`);
    assert.ok(typeof result.valdeltagande?.procent === 'number' && result.valdeltagande.procent >= 0 && result.valdeltagande.procent <= 100, `${context}.valdeltagande.procent ska vara 0–100`);
    validateProfileSource(result.valdeltagande?.kalla, `${context}.valdeltagande.kalla`);

    if (result.mandatfordelning === undefined) continue;
    hasChamberComposition = true;
    const parties = requireArray(result.mandatfordelning.partier, `${context}.mandatfordelning.partier`);
    requireUnique(parties, 'forkortning', `${context}.mandatfordelning.partier`);
    for (const party of parties) {
      requireString(party.forkortning, `${context}.mandatfordelning.partier.forkortning`);
      assert.ok(Number.isInteger(party.mandat) && party.mandat >= 0, `${context}.mandatfordelning.partier.mandat ska vara ett positivt heltal`);
    }
    assert.equal(parties.reduce((total, party) => total + party.mandat, 0), 349, `${context}.mandatfordelning ska innehålla 349 mandat`);
    validateProfileSource(result.mandatfordelning.kalla, `${context}.mandatfordelning.kalla`);
  }

  assert.ok(hasChamberComposition, 'Minst ett riksdagsresultat ska innehålla mandatfördelning');
  checkPartyProfileParliamentView(dataDirectory);
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
  validateParliamentResults(dataDirectory);

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
