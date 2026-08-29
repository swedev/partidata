const {
  loadParties,
  loadYearFiles,
  buildParties,
  validate,
  writeFiles
} = require('./parti.js');
const { WIKIDATA_KEYS, validateWikidataSection } = require('./validate.js');
const { loadJSONFile } = require('./utils.js');

/**
 * Reads the founding date (P571) from Wikidata for every party whose file
 * carries a reviewed Q-id, and writes it back through the registry's own write
 * path.
 * Run:
 * > npm run import-wikidata [-- --parti <filnamn>]
 */

const ENTITY_PROPERTY = 'P571';
const GREGORIAN_CALENDAR = 'http://www.wikidata.org/entity/Q1985727';
const WIKIDATA_ID_PATTERN = /^Q[1-9]\d*$/;
const WIKIDATA_TIME_PATTERN = /^\+(\d{4,})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}Z$/;
const EARLIEST_YEAR = 1800;
const RETRY_LIMIT = 3;
const RETRY_DELAY = 5000;

/**
 * USER_AGENT
 * Wikimedia's User-Agent policy asks for a name, a version and a way to reach
 * whoever runs the client.
 * @type {String}
 */
const USER_AGENT = `partidata/${loadJSONFile('package.json').version} (https://github.com/swedev/partidata)`;

/**
 * entityUrl
 * @param  {String} id
 * @return {String}
 */
function entityUrl (id) {
  return `https://www.wikidata.org/wiki/Special:EntityData/${id}.json`;
}

/**
 * parseArgs
 * @param  {String[]} argv
 * @return {{ parti: String|null }}
 */
function parseArgs (argv) {
  let parti = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--parti') {
      parti = argv[i + 1];
      if (!parti || parti.startsWith('--')) {
        throw new Error('--parti kräver ett filnamn');
      }
      i += 1;
      continue;
    }
    throw new Error(`Okänt argument: ${argv[i]}. Användning: npm run import-wikidata -- [--parti <filnamn>]`);
  }
  return { parti };
}

/**
 * retryDelay
 * The wait a 429 or 5xx asks for, in milliseconds. A Retry-After in seconds is
 * honoured; anything else falls back to the fixed delay.
 * @param  {Response} response
 * @return {Number}
 */
function retryDelay (response) {
  const header = response.headers?.get?.('Retry-After')?.trim();
  const seconds = header ? Number(header) : NaN;
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : RETRY_DELAY;
}

/**
 * fetchEntity
 * Downloads one Wikidata entity. A throttled or failing endpoint is retried a
 * few times; a response that does not carry the entity that was asked for — a
 * redirected or deleted Q-id, or broken JSON — is an error, so a party is never
 * left with a date read from someone else's entity.
 * @param  {String} id
 * @param  {Object} [options]
 * @param  {Function} [options.fetchImpl]
 * @param  {Function} [options.sleep]
 * @param  {Number} [options.retries]
 * @return {Promise<Object>} The entity
 */
async function fetchEntity (id, { fetchImpl = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), retries = RETRY_LIMIT } = {}) {
  const url = entityUrl(id);
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetchImpl(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }
    });
    if ((response.status === 429 || response.status >= 500) && attempt < retries) {
      await sleep(retryDelay(response));
      continue;
    }
    if (!response.ok) {
      throw new Error(`Hämtningen av ${id} misslyckades: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      throw new Error(`Svaret för ${id} är inte giltig JSON: ${error.message}`);
    }
    const entity = payload?.entities?.[id];
    if (!entity || entity.id !== id) {
      throw new Error(`Svaret för ${id} innehåller inte entiteten — id:t kan vara omdirigerat eller borttaget`);
    }
    return entity;
  }
}

/**
 * _timeValue
 * The founding date one P571 statement states, in the precision Wikidata gives
 * it. A statement without a usable value returns null; a value this project
 * cannot read as a plain founding date throws, so a human decides rather than
 * the script guessing.
 * @param  {Object} statement
 * @param  {String} context Party and Q-id, for the error message
 * @param  {Number} maxYear
 * @return {String|null} ÅÅÅÅ, ÅÅÅÅ-MM or ÅÅÅÅ-MM-DD
 */
function _timeValue (statement, context, maxYear) {
  const snak = statement.mainsnak;
  if (snak?.snaktype !== 'value' || snak.datavalue?.type !== 'time') {
    return null;
  }
  const value = snak.datavalue.value;
  if (value.calendarmodel !== GREGORIAN_CALENDAR) {
    throw new Error(`${context}: ${ENTITY_PROPERTY} anges i kalendermodellen ${value.calendarmodel}, inte proleptisk gregoriansk`);
  }
  if (value.before !== 0 || value.after !== 0) {
    throw new Error(`${context}: ${ENTITY_PROPERTY} anger ett osäkerhetsintervall (before ${value.before}, after ${value.after})`);
  }
  if (value.precision < 9) {
    throw new Error(`${context}: ${ENTITY_PROPERTY} har precisionen ${value.precision}, grövre än år`);
  }
  const match = WIKIDATA_TIME_PATTERN.exec(value.time);
  if (!match) {
    throw new Error(`${context}: ${ENTITY_PROPERTY} har tidsvärdet ${value.time}, som inte går att läsa`);
  }
  const [, year, month, day] = match;
  if (Number(year) < EARLIEST_YEAR || Number(year) > maxYear) {
    throw new Error(`${context}: ${ENTITY_PROPERTY} anger året ${year}, utanför ${EARLIEST_YEAR}–${maxYear}`);
  }
  const precision = Math.min(value.precision, 11);
  if (precision === 9) {
    return year;
  }
  if (precision === 10) {
    return `${year}-${month}`;
  }
  return `${year}-${month}-${day}`;
}

/**
 * foundingDateFromEntity
 * Reads P571 from an entity under the best-rank rule: preferred statements win
 * over normal ones, deprecated ones are never read. An entity that states two
 * different founding dates at the same rank is an error — which of them the
 * party was founded on is settled on Wikidata, by ranking one of them, not
 * here.
 * @param  {Object} entity
 * @param  {String} context Party and Q-id, for the error message
 * @param  {Number} [maxYear]
 * @return {String|undefined} The founding date, or undefined when the entity states none
 */
function foundingDateFromEntity (entity, context, maxYear = new Date().getUTCFullYear()) {
  const statements = entity.claims?.[ENTITY_PROPERTY] ?? [];
  const preferred = statements.filter(statement => statement.rank === 'preferred');
  const best = preferred.length > 0 ? preferred : statements.filter(statement => statement.rank === 'normal');
  const dates = [...new Set(best.map(statement => _timeValue(statement, context, maxYear)).filter(Boolean))];
  if (dates.length > 1) {
    throw new Error(
      `${context}: ${ENTITY_PROPERTY} anger flera datum (${dates.join(', ')}). ` +
      'Markera rätt påstående med preferred-rank på Wikidata, eller ta bort Q-id:t.'
    );
  }
  return dates[0];
}

/**
 * wikidataTargets
 * The parties the import reads from Wikidata: those whose file carries a
 * wikidata section, narrowed to one party when a filnamn is given. The section
 * as it stands is checked here, before anything is fetched, so a malformed one
 * stops the run rather than being rewritten from the answer.
 * @param  {Object[]} parties From loadParties()
 * @param  {String|null} [filnamn]
 * @return {Object[]}
 */
function wikidataTargets (parties, filnamn = null) {
  let candidates = parties;
  if (filnamn) {
    const party = parties.find(other => other.filnamn === filnamn);
    if (!party) {
      throw new Error(`Okänt parti: ${filnamn}`);
    }
    if (!party.extra?.wikidata) {
      throw new Error(`${filnamn} saknar en wikidata-sektion med ett Q-id`);
    }
    candidates = [party];
  }
  const targets = candidates.filter(party => party.extra?.wikidata !== undefined);
  for (const party of targets) {
    const section = party.extra.wikidata;
    if (!section || typeof section !== 'object' || Array.isArray(section)) {
      throw new Error(`${party.filnamn}.wikidata ska vara ett objekt`);
    }
    for (const key of Object.keys(section)) {
      if (!WIKIDATA_KEYS.includes(key)) {
        throw new Error(`${party.filnamn}.wikidata.${key} är inte en känd nyckel`);
      }
    }
    if (typeof section.id !== 'string' || !WIKIDATA_ID_PATTERN.test(section.id)) {
      throw new Error(`${party.filnamn}.wikidata.id ska vara ett Wikidata-id (Q…)`);
    }
  }
  return targets;
}

/**
 * applyWikidata
 * Writes what was read into the registry in memory: every party whose entity
 * was fetched gets its founding date and fetch date, and a party whose entity
 * no longer states P571 loses the date rather than keeping a claim its source
 * has dropped. The Q-id itself is never touched — linking a party to Wikidata,
 * and unlinking it, is a human decision.
 * @param  {Object[]} parties From loadParties(), all of them
 * @param  {Map} entities Q-id to entity, for the parties that were fetched
 * @param  {String} today ÅÅÅÅ-MM-DD
 * @return {Object[]} One entry per fetched party: { filnamn, beteckning, id, fore, efter }
 */
function applyWikidata (parties, entities, today) {
  const maxYear = Number(today.slice(0, 4));
  const changes = [];
  for (const party of parties) {
    const current = party.extra?.wikidata;
    const entity = current && entities.get(current.id);
    if (!entity) {
      continue;
    }
    const context = `${party.beteckning} (${current.id})`;
    const grundat = foundingDateFromEntity(entity, context, maxYear);
    const section = { id: current.id, ...(grundat ? { grundat } : {}), hamtad: today };
    validateWikidataSection(section, `${party.filnamn}.wikidata`);
    changes.push({
      filnamn: party.filnamn,
      beteckning: party.beteckning,
      id: current.id,
      fore: current.grundat,
      efter: grundat
    });
    party.extra.wikidata = section;
  }

  const owners = new Map();
  for (const party of parties) {
    const id = party.extra?.wikidata?.id;
    if (id === undefined) {
      continue;
    }
    const owner = owners.get(id);
    if (owner !== undefined) {
      throw new Error(`${party.filnamn}.wikidata.id ${id} används redan av ${owner}`);
    }
    owners.set(id, party.filnamn);
  }

  return changes;
}

/**
 * FOUNDED_BEFORE_FIRST_ELECTION_YEARS
 * How far a founding date may precede the first election we have the party in
 * before the pairing is worth a second look. Parties that carried their
 * designation for a decade before our election data begins are ordinary; a
 * gap much wider than that, with nothing registered in between, is the shape
 * a reused party name makes.
 * @type {Number}
 */
const FOUNDED_BEFORE_FIRST_ELECTION_YEARS = 10;

/**
 * sanityWarnings
 * Reads the founding date against what the party's own record says about it.
 * Neither check can prove a mismatch, so both only warn: the registry is the
 * one source that knows this party rather than the name it shares with
 * others, and a Wikidata entity about a different party of the same name
 * tends to disagree with it.
 * @param  {Object} party The built party file, which carries deltagande
 * @param  {String|undefined} grundat
 * @return {String[]}
 */
function sanityWarnings (party, grundat) {
  if (!grundat) {
    return [];
  }
  const warnings = [];
  const foundedYear = Number(grundat.slice(0, 4));
  const registered = party.valmyndigheten_registreringsdatum;

  if (registered && foundedYear > Number(registered.slice(0, 4))) {
    warnings.push(`grundat ${grundat} är efter registreringen ${registered}`);
  }

  const years = Object.keys(party.deltagande ?? {}).map(Number).filter(Number.isFinite);
  if (!registered && years.length > 0) {
    const firstElection = Math.min(...years);
    const gap = firstElection - foundedYear;
    if (gap > FOUNDED_BEFORE_FIRST_ELECTION_YEARS) {
      warnings.push(
        `grundat ${grundat} men ingen registrerad beteckning och första valet ${firstElection}, ${gap} år senare`
      );
    }
  }

  return warnings;
}

/**
 * main
 */
async function main () {
  const { parti } = parseArgs(process.argv.slice(2));

  const registry = loadParties();
  const targets = wikidataTargets(registry.parties, parti);
  if (targets.length === 0) {
    console.log('Inga partier har ett Q-id att hämta.');
    return;
  }

  console.log(`Hämtar ${ENTITY_PROPERTY} för ${targets.length} partier från Wikidata.`);
  const entities = new Map();
  for (const party of targets) {
    const { id } = party.extra.wikidata;
    entities.set(id, await fetchEntity(id));
  }

  const today = new Date().toISOString().slice(0, 10);
  const changes = applyWikidata(registry.parties, entities, today);

  const yearFiles = loadYearFiles();
  const build = buildParties(registry, yearFiles);
  if (build.renamed.length > 0) {
    throw new Error('Registret är inte ombyggt: kör node scripts/parti.js först');
  }
  validate(build, yearFiles);
  const written = writeFiles(build.writeSet);

  console.log(`\nHämtade partier: ${changes.length}`);
  for (const change of changes) {
    const before = change.fore ?? '–';
    const after = change.efter ?? '–';
    const marker = before === after ? ' ' : '*';
    console.log(`  ${marker} ${change.id} ${change.beteckning}: ${before} → ${after}`);
  }
  console.log(`Skrivna filer: ${written.length}`);

  const built = new Map(build.parties.map(party => [party.filnamn, party.data]));
  const warnings = changes.flatMap(change =>
    sanityWarnings(built.get(change.filnamn), change.efter)
      .map(warning => `${change.beteckning} (${change.id}): ${warning}`)
  );
  if (warnings.length > 0) {
    console.log('\nAtt kontrollera:');
    for (const warning of warnings) {
      console.log(`  ! ${warning}`);
    }
    console.log('Datumet är hämtat och skrivet. Stämmer posten inte med partiet, ta bort wikidata-sektionen.');
  }
}

/**
 * Exports
 */
exports.entityUrl = entityUrl;
exports.parseArgs = parseArgs;
exports.fetchEntity = fetchEntity;
exports.foundingDateFromEntity = foundingDateFromEntity;
exports.wikidataTargets = wikidataTargets;
exports.applyWikidata = applyWikidata;
exports.sanityWarnings = sanityWarnings;

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}
