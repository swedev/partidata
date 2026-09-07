const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { ROOT } = require('./utils.js');

const DERIVED_FILE = path.join('derived', 'riksdag.json');

/**
 * SEAT_ORDER
 * Presentation only: the hemicycle and the chamber lists are read left to
 * right, so the mandate rows are ordered along the political spectrum the way
 * the chamber is conventionally drawn, not in the source file's row order. An
 * abbreviation without an entry keeps its source order after the listed ones.
 * @type {String[]}
 */
const SEAT_ORDER = ['V', 'S', 'MP', 'C', 'L', 'KD', 'M', 'SD'];

function seatOrderIndex (forkortning) {
  const index = SEAT_ORDER.indexOf(forkortning);
  return index === -1 ? SEAT_ORDER.length : index;
}

function readJson (file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function electionResultFiles (dataDirectory) {
  const electionDirectory = path.join(dataDirectory, 'val');
  return fs.readdirSync(electionDirectory, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{4}$/.test(entry.name))
    .map(entry => ({
      relativePath: path.posix.join('val', entry.name, 'valresultat', 'riksdag.json'),
      absolutePath: path.join(electionDirectory, entry.name, 'valresultat', 'riksdag.json')
    }))
    .filter(file => fs.existsSync(file.absolutePath))
    .toSorted((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function uniqueSources (sources) {
  return [...new Map(sources.map(source => [`${source.namn}\0${source.url}\0${source.hamtad}\0${source.sha256}`, source])).values()];
}

function sourceFor (result, reference) {
  const source = result.kallor.find(source => source.id === reference);
  assert.ok(source, `${result.valar}: källreferensen ${reference} saknas`);
  return source;
}

function compareRatios (left, right) {
  return left.roster * right.giltiga_roster - right.roster * left.giltiga_roster;
}

function buildParliamentView (dataDirectory = path.join(ROOT, 'data')) {
  const files = electionResultFiles(dataDirectory);
  assert.ok(files.length > 0, 'Inga riksdagsresultat hittades');
  const results = files.map(file => ({ ...file, data: readJson(file.absolutePath) }));
  const chamberResult = results.filter(result => result.data.mandatfordelning?.partier.length > 0).at(-1);
  assert.ok(chamberResult, 'Ingen mandatfördelning hittades');
  const partyIndex = readJson(path.join(dataDirectory, 'derived', 'parti.json'));
  const partiesByUuid = new Map(partyIndex.map(party => [party.uuid, party]));
  const currentChamber = new Set(chamberResult.data.mandatfordelning.partier.map(party => party.parti_uuid));

  const bestByParty = new Map();
  for (const result of results) {
    for (const row of result.data.rostresultat.partier) {
      if (currentChamber.has(row.parti_uuid) || !partiesByUuid.has(row.parti_uuid)) continue;
      const candidate = {
        parti_uuid: row.parti_uuid,
        valar: result.data.valar,
        roster: row.roster,
        giltiga_roster: result.data.rostresultat.giltiga_roster,
        rostandel: row.rostandel,
        kalla: sourceFor(result.data, row.kallreferens)
      };
      const previous = bestByParty.get(row.parti_uuid);
      if (!previous || compareRatios(candidate, previous) > 0 ||
          (compareRatios(candidate, previous) === 0 && candidate.valar > previous.valar)) {
        bestByParty.set(row.parti_uuid, candidate);
      }
    }
  }

  const outside = [...bestByParty.values()]
    .toSorted((left, right) => compareRatios(right, left) || right.roster - left.roster || left.parti_uuid.localeCompare(right.parti_uuid))
    .slice(0, 6);
  const turnoutSources = uniqueSources(results.map(result => sourceFor(result.data, result.data.valdeltagande.kallreferens)));
  const chamberSource = sourceFor(chamberResult.data, chamberResult.data.mandatfordelning.partier[0].kallreferens);

  return {
    schema_version: 2,
    genererad_fran: files.map(file => file.relativePath),
    senast_uppdaterad: results.flatMap(result => result.data.kallor.map(source => source.hamtad)).toSorted().at(-1),
    kammare: {
      valar: chamberResult.data.valar,
      partier: chamberResult.data.mandatfordelning.partier.map(row => {
        const party = partiesByUuid.get(row.parti_uuid);
        assert.ok(party, `${chamberResult.data.valar}: mandatpartiet ${row.parti_uuid} saknas i partiregistret`);
        return {
          parti_uuid: row.parti_uuid,
          forkortning: party.forkortning ?? row.kallkod ?? row.partibeteckning,
          mandat: row.mandat
        };
      }).toSorted((left, right) => seatOrderIndex(left.forkortning) - seatOrderIndex(right.forkortning)),
      kalla: chamberSource
    },
    valdeltagande: {
      resultat: results.map(result => ({
        valar: result.data.valar,
        procent: result.data.valdeltagande.procent
      })),
      kallor: turnoutSources
    },
    storsta_utanfor_riksdagen: {
      period: {
        fran: results[0].data.valar,
        till: results.at(-1).data.valar
      },
      metod: 'Högsta exakta andel giltiga röster per uuid bland partier i Partidatas register som saknar mandat efter periodens senaste val. Endast individuellt särredovisade och entydigt kopplade partirader rangordnas. Vid lika andel vinner senaste valår.',
      partier: outside
    }
  };
}

const buildPartyProfileParliamentView = buildParliamentView;

function serializePartyProfileParliamentView (dataDirectory) {
  return `${JSON.stringify(buildPartyProfileParliamentView(dataDirectory), null, 2)}\n`;
}

function writePartyProfileParliamentView (dataDirectory = path.join(ROOT, 'data')) {
  const target = path.join(dataDirectory, DERIVED_FILE);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, serializePartyProfileParliamentView(dataDirectory));
  return target;
}

function checkPartyProfileParliamentView (dataDirectory = path.join(ROOT, 'data')) {
  const target = path.join(dataDirectory, DERIVED_FILE);
  assert.ok(fs.existsSync(target), `${DERIVED_FILE} saknas; kör npm run build:derived-data`);
  assert.equal(fs.readFileSync(target, 'utf8'), serializePartyProfileParliamentView(dataDirectory), `${DERIVED_FILE} är inaktuell; kör npm run build:derived-data`);
}

if (require.main === module) {
  if (process.argv.includes('--check')) {
    checkPartyProfileParliamentView();
    console.log(`${DERIVED_FILE} är aktuell.`);
  } else {
    console.log(`Skrev ${path.relative(ROOT, writePartyProfileParliamentView())}.`);
  }
}

exports.SEAT_ORDER = SEAT_ORDER;
exports.buildParliamentView = buildParliamentView;
exports.buildPartyProfileParliamentView = buildPartyProfileParliamentView;
exports.checkPartyProfileParliamentView = checkPartyProfileParliamentView;
exports.writePartyProfileParliamentView = writePartyProfileParliamentView;
