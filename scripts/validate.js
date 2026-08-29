const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { checkPartyProfileParliamentView } = require('./build-derived-data.js');
const { EXTRA_KEY_PATTERN, PARTY_KEY_ORDER } = require('./parti.js');
const { readHeader } = require('./png.js');
const { ROOT, toFileName } = require('./utils.js');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const INDEX_KEYS_FROM_PARTY = ['beteckning', 'filnamn', 'forkortning', 'omrade', 'partisymbol', 'tidigare_filnamn', 'uuid'];

const WIKIDATA_ID_PATTERN = /^Q[1-9]\d*$/;
const WIKIDATA_KEYS = ['id', 'grundat', 'hamtad'];
const WIKIDATA_DATE_PATTERN = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

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

function validateResultSource (source, context) {
  validateProfileSource(source, context);
  requireString(source.id, `${context}.id`);
  requireString(source.titel, `${context}.titel`);
  requireString(source.version, `${context}.version`);
  requireString(source.format, `${context}.format`);
  requireString(source.sha256, `${context}.sha256`);
  assert.match(source.sha256, /^[0-9a-f]{64}$/, `${context}.sha256 ska vara en SHA-256-checksumma`);
  if (source.transkribering_sha256 !== undefined) {
    requireString(source.transkribering_sha256, `${context}.transkribering_sha256`);
    assert.match(source.transkribering_sha256, /^[0-9a-f]{64}$/, `${context}.transkribering_sha256 ska vara en SHA-256-checksumma`);
  }
}

function normalizedSourceIdentity (value) {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('sv-SE');
}

function validateParliamentIdentityLinks (dataDirectory, partiesByUuid) {
  const file = path.join(dataDirectory, 'valresultat', 'riksdag-partikopplingar.json');
  if (!fs.existsSync(file)) return;
  const links = readJson(file);
  assert.equal(links.schema_version, 1, 'valresultat/riksdag-partikopplingar.json.schema_version ska vara 1');
  const mappings = requireArray(links.kopplingar, 'valresultat/riksdag-partikopplingar.json.kopplingar');
  requireUnique(mappings, 'parti_uuid', 'valresultat/riksdag-partikopplingar.json.kopplingar');
  const owners = { namn: new Map(), kod: new Map() };
  const claim = (kind, value, uuid, context) => {
    requireString(value, context);
    const key = normalizedSourceIdentity(value);
    const previous = owners[kind].get(key);
    assert.ok(!previous || previous === uuid, `${context} kolliderar med en koppling till ${previous}`);
    owners[kind].set(key, uuid);
  };
  for (const [index, mapping] of mappings.entries()) {
    const context = `valresultat/riksdag-partikopplingar.json.kopplingar[${index}]`;
    requireUuid(mapping.parti_uuid, `${context}.parti_uuid`);
    assert.ok(partiesByUuid.has(mapping.parti_uuid), `${context} hänvisar till okänt parti-UUID ${mapping.parti_uuid}`);
    const names = requireArray(mapping.kallbeteckningar, `${context}.kallbeteckningar`);
    const codes = requireArray(mapping.kallkoder, `${context}.kallkoder`);
    assert.ok(names.length + codes.length > 0, `${context} måste innehålla minst en historisk identitet`);
    names.forEach((value, valueIndex) => claim('namn', value, mapping.parti_uuid, `${context}.kallbeteckningar[${valueIndex}]`));
    codes.forEach((value, valueIndex) => claim('kod', value, mapping.parti_uuid, `${context}.kallkoder[${valueIndex}]`));
  }
  const blocked = requireArray(links.blockerade_kallbeteckningar, 'valresultat/riksdag-partikopplingar.json.blockerade_kallbeteckningar');
  const blockedKeys = new Set();
  blocked.forEach((value, index) => {
    requireString(value, `valresultat/riksdag-partikopplingar.json.blockerade_kallbeteckningar[${index}]`);
    const key = normalizedSourceIdentity(value);
    assert.ok(!blockedKeys.has(key), `blockerade_kallbeteckningar innehåller dubbletten ${value}`);
    assert.ok(!owners.namn.has(key), `${value} kan inte vara både kopplad och blockerad`);
    blockedKeys.add(key);
  });
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

function requireInteger (value, context, minimum = 0) {
  assert.ok(Number.isInteger(value) && value >= minimum, `${context} ska vara ett heltal från ${minimum}`);
}

/**
 * validatePartySymbol
 * The symbol file has to exist, and any measurement of it has to describe that
 * file: a sheet of the size the file reports, and a box inside that sheet.
 */
function validatePartySymbol (symbol, file, context) {
  requireString(symbol.filnamn, `${context}.filnamn`);
  requireString(symbol.kalla, `${context}.kalla`);
  requireUrl(symbol.kallurl, `${context}.kallurl`);
  requireInteger(symbol.valar, `${context}.valar`, 1900);
  requireString(symbol.partikod, `${context}.partikod`);
  assert.ok(fs.existsSync(file), `${context}: symbolfilen ${symbol.filnamn} saknas`);

  const measured = symbol.bild !== undefined || symbol.bildyta !== undefined;
  if (!measured) return;
  assert.ok(symbol.bild && symbol.bildyta, `${context}: bild och bildyta hör ihop`);
  requireInteger(symbol.bild.bredd, `${context}.bild.bredd`, 1);
  requireInteger(symbol.bild.hojd, `${context}.bild.hojd`, 1);
  requireInteger(symbol.bildyta.x, `${context}.bildyta.x`);
  requireInteger(symbol.bildyta.y, `${context}.bildyta.y`);
  requireInteger(symbol.bildyta.bredd, `${context}.bildyta.bredd`, 1);
  requireInteger(symbol.bildyta.hojd, `${context}.bildyta.hojd`, 1);
  assert.ok(
    symbol.bildyta.x + symbol.bildyta.bredd <= symbol.bild.bredd &&
    symbol.bildyta.y + symbol.bildyta.hojd <= symbol.bild.hojd,
    `${context}.bildyta ligger utanför bilden`
  );

  const header = readHeader(fs.readFileSync(file));
  if (header) {
    assert.deepEqual(
      { bredd: header.bredd, hojd: header.hojd },
      { bredd: symbol.bild.bredd, hojd: symbol.bild.hojd },
      `${context}.bild stämmer inte med ${symbol.filnamn}`
    );
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

/**
 * isCalendarDate
 * Whether the parts name a day the calendar holds: a month 01–12 and a day that
 * month has in that year.
 * @param  {Number} year
 * @param  {Number} month
 * @param  {Number} day
 * @return {Boolean}
 */
function isCalendarDate (year, month, day) {
  if (year < 1 || month < 1 || month > 12 || day < 1) {
    return false;
  }
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/**
 * requireWikidataDate
 * A date in the precision Wikidata states it: ÅÅÅÅ, ÅÅÅÅ-MM or ÅÅÅÅ-MM-DD. The
 * parts present have to name a real day, so 1988-00 and 2026-99-99 are rejected
 * rather than stored as a truncation of something.
 * @param {String} value
 * @param {String} context
 * @param {Boolean} [full] Require the day precision
 */
function requireWikidataDate (value, context, full = false) {
  requireString(value, context);
  const match = WIKIDATA_DATE_PATTERN.exec(value);
  assert.ok(match, `${context} ska vara ${full ? 'ÅÅÅÅ-MM-DD' : 'ÅÅÅÅ, ÅÅÅÅ-MM eller ÅÅÅÅ-MM-DD'}`);
  const [, year, month, day] = match;
  assert.ok(!full || day !== undefined, `${context} ska vara ÅÅÅÅ-MM-DD`);
  assert.ok(
    isCalendarDate(Number(year), Number(month ?? 1), Number(day ?? 1)),
    `${context} är inte ett verkligt datum: ${value}`
  );
}

/**
 * validateWikidataSection
 * The wikidata section of a party file: the Q-id a human has linked the party
 * to, and what the import read from that entity. The key set is closed, so a
 * misspelled key is rejected here instead of surviving as an unread value.
 * @param {*} value
 * @param {String} context
 */
function validateWikidataSection (value, context) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${context} ska vara ett objekt`);
  for (const key of Object.keys(value)) {
    assert.ok(WIKIDATA_KEYS.includes(key), `${context}.${key} är inte en känd nyckel`);
  }
  requireString(value.id, `${context}.id`);
  assert.match(value.id, WIKIDATA_ID_PATTERN, `${context}.id ska vara ett Wikidata-id (Q…)`);
  assert.ok(
    value.hamtad !== undefined,
    `${context}.hamtad saknas. Q-id:t läggs till för hand, resten hämtas: kör npm run import-wikidata -- --parti <filnamn>`
  );
  requireWikidataDate(value.hamtad, `${context}.hamtad`, true);
  if (value.grundat !== undefined) {
    requireWikidataDate(value.grundat, `${context}.grundat`);
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
  const wikidataOwners = new Map();
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
    if (party.omrade !== undefined) requireString(party.omrade, `${entry.filnamn}.omrade`);
    assert.equal(party.filnamn, entry.filnamn, `${entry.filnamn}: filnamn ska matcha katalogen`);

    for (const key of Object.keys(party).filter(other => !PARTY_KEY_ORDER.includes(other))) {
      assert.match(key, EXTRA_KEY_PATTERN, `${entry.filnamn}: fältet "${key}" har inte ett giltigt fältnamn`);
    }

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

    if (party.partisymbol !== undefined) {
      validatePartySymbol(
        party.partisymbol,
        path.join(partyDirectory, entry.filnamn, party.partisymbol.filnamn || ''),
        `${entry.filnamn}.partisymbol`
      );
    }

    if (party.wikidata !== undefined) {
      validateWikidataSection(party.wikidata, `${entry.filnamn}.wikidata`);
      const owner = wikidataOwners.get(party.wikidata.id);
      assert.ok(owner === undefined, `${entry.filnamn}.wikidata.id ${party.wikidata.id} används redan av ${owner}`);
      wikidataOwners.set(party.wikidata.id, entry.filnamn);
    }

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

function validateParliamentResults (dataDirectory, partiesByUuid) {
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
    assert.equal(result.schema_version, 2, `${context}.schema_version ska vara 2`);
    assert.equal(result.valtyp, 'riksdag', `${context}.valtyp ska vara riksdag`);
    assert.equal(result.valar, year, `${context}.valar ska matcha katalogens valår`);
    assert.equal(result.status, 'slutligt', `${context}.status ska vara slutligt`);
    const sources = requireArray(result.kallor, `${context}.kallor`);
    assert.ok(sources.length > 0, `${context}.kallor får inte vara tom`);
    requireUnique(sources, 'id', `${context}.kallor`);
    sources.forEach((source, index) => validateResultSource(source, `${context}.kallor[${index}]`));
    const sourceIds = new Set(sources.map(source => source.id));
    const requireReference = (reference, referenceContext) => {
      requireString(reference, referenceContext);
      assert.ok(sourceIds.has(reference), `${referenceContext} hänvisar till okänd källa ${reference}`);
    };

    assert.ok(typeof result.valdeltagande?.procent === 'number' && result.valdeltagande.procent >= 0 && result.valdeltagande.procent <= 100, `${context}.valdeltagande.procent ska vara 0–100`);
    requireReference(result.valdeltagande.kallreferens, `${context}.valdeltagande.kallreferens`);

    const voteResult = result.rostresultat;
    assert.ok(Number.isInteger(voteResult?.giltiga_roster) && voteResult.giltiga_roster > 0, `${context}.rostresultat.giltiga_roster ska vara ett positivt heltal`);
    requireArray(voteResult.kallreferenser, `${context}.rostresultat.kallreferenser`).forEach((reference, index) => {
      requireReference(reference, `${context}.rostresultat.kallreferenser[${index}]`);
    });
    const linked = requireArray(voteResult.partier, `${context}.rostresultat.partier`);
    const unresolved = requireArray(voteResult.ej_kopplade, `${context}.rostresultat.ej_kopplade`);
    const aggregates = requireArray(voteResult.aggregat, `${context}.rostresultat.aggregat`);
    requireUnique(linked, 'parti_uuid', `${context}.rostresultat.partier`);
    const sourceRows = [...linked, ...unresolved, ...aggregates];
    const sourceIdentities = new Set();
    for (const [index, row] of sourceRows.entries()) {
      const rowContext = `${context}.rostresultat.rad[${index}]`;
      requireString(row.partibeteckning, `${rowContext}.partibeteckning`);
      if (row.kallkod !== undefined) requireString(row.kallkod, `${rowContext}.kallkod`);
      assert.ok(Number.isInteger(row.roster) && row.roster >= 0, `${rowContext}.roster ska vara ett positivt heltal`);
      assert.ok(typeof row.rostandel === 'number' && row.rostandel >= 0 && row.rostandel <= 100, `${rowContext}.rostandel ska vara 0–100`);
      assert.equal(row.rostandel, Number((row.roster * 100 / voteResult.giltiga_roster).toFixed(2)), `${rowContext}.rostandel ska härledas från röstetalet`);
      requireReference(row.kallreferens, `${rowContext}.kallreferens`);
      const identity = `${row.kallkod ?? ''}\0${row.partibeteckning}`;
      assert.ok(!sourceIdentities.has(identity), `${context}.rostresultat innehåller dubblettraden ${identity.replace('\0', ' ')}`);
      sourceIdentities.add(identity);
    }
    for (const row of linked) {
      requireUuid(row.parti_uuid, `${context}.rostresultat.partier.parti_uuid`);
      assert.ok(partiesByUuid.has(row.parti_uuid), `${context}.rostresultat hänvisar till okänt parti-UUID ${row.parti_uuid}`);
    }
    assert.equal(sourceRows.reduce((total, row) => total + row.roster, 0), voteResult.giltiga_roster, `${context}.rostresultat ska summera till giltiga röster`);

    hasChamberComposition = true;
    const parties = requireArray(result.mandatfordelning.partier, `${context}.mandatfordelning.partier`);
    requireUnique(parties, 'parti_uuid', `${context}.mandatfordelning.partier`);
    requireArray(result.mandatfordelning.kallreferenser, `${context}.mandatfordelning.kallreferenser`).forEach((reference, index) => {
      requireReference(reference, `${context}.mandatfordelning.kallreferenser[${index}]`);
    });
    for (const party of parties) {
      requireUuid(party.parti_uuid, `${context}.mandatfordelning.partier.parti_uuid`);
      assert.ok(partiesByUuid.has(party.parti_uuid), `${context}.mandatfordelning hänvisar till okänt parti-UUID ${party.parti_uuid}`);
      assert.ok(linked.some(row => row.parti_uuid === party.parti_uuid), `${context}.mandatpartiet ${party.parti_uuid} saknar röstresultat`);
      requireString(party.partibeteckning, `${context}.mandatfordelning.partier.partibeteckning`);
      assert.ok(Number.isInteger(party.mandat) && party.mandat >= 0, `${context}.mandatfordelning.partier.mandat ska vara ett positivt heltal`);
      requireReference(party.kallreferens, `${context}.mandatfordelning.partier.kallreferens`);
    }
    assert.equal(result.mandatfordelning.antal_mandat, 349, `${context}.mandatfordelning.antal_mandat ska vara 349`);
    assert.equal(parties.reduce((total, party) => total + party.mandat, 0), result.mandatfordelning.antal_mandat, `${context}.mandatfordelning ska summera till antal_mandat`);
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
  validateParliamentIdentityLinks(dataDirectory, parties.partiesByUuid);
  validateParliamentResults(dataDirectory, parties.partiesByUuid);

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
exports.validateWikidataSection = validateWikidataSection;
exports.WIKIDATA_KEYS = WIKIDATA_KEYS;
