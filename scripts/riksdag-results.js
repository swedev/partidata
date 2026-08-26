const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE_DEFINITIONS = {
  1994: {
    parser: 'scb-transcription',
    resultSourceIds: ['publikation'],
    mandateSourceIds: ['publikation'],
    turnoutSourceId: 'publikation',
    sources: {
      publikation: {
        namn: 'SCB',
        titel: 'Allmänna valen 1994. Del 1, Riksdagsvalet',
        url: 'https://share.scb.se/ov9993/data/historisk%20statistik/SOS%201911-/Valstatistiken/Allm%C3%A4nna%20valen%20%28SOS%29%201970-1998/Valstatistik-Allmanna-valen-1994-Del-1-Riksdagsvalet.pdf',
        version: 'Tabell 6–7, slutligt resultat',
        format: 'application/pdf'
      }
    }
  },
  1998: {
    parser: 'scb-transcription',
    resultSourceIds: ['publikation'],
    mandateSourceIds: ['publikation'],
    turnoutSourceId: 'publikation',
    sources: {
      publikation: {
        namn: 'SCB',
        titel: 'Allmänna valen 1998. Del 1, Riksdagen',
        url: 'https://share.scb.se/ov9993/data/historisk%20statistik/SOS%201911-/Valstatistiken/Allm%C3%A4nna%20valen%20%28SOS%29%201970-1998/Valstatistik-Allmanna-valen-1998-Del-1-Riksdagen.pdf',
        version: 'Tabell 6–7, slutligt resultat',
        format: 'application/pdf'
      }
    }
  },
  2002: {
    parser: 'val-2002-html',
    resultSourceIds: ['resultat'],
    mandateSourceIds: ['resultat'],
    turnoutSourceId: 'resultat',
    sources: {
      resultat: {
        namn: 'Valmyndigheten',
        titel: 'Riksdagsvalet 2002, hela riket',
        url: 'https://historik.val.se/val/val_02/slutresultat/00R/00.html',
        version: 'Slutligt resultat',
        format: 'text/html'
      }
    }
  },
  2006: {
    parser: 'val-2006-html',
    resultSourceIds: ['resultat', 'ovriga'],
    mandateSourceIds: ['resultat'],
    turnoutSourceId: 'resultat',
    sources: {
      resultat: {
        namn: 'Valmyndigheten',
        titel: 'Riksdagsvalet 2006, hela riket',
        url: 'https://historik.val.se/val/val2006/slutlig/R/rike/roster.html',
        version: 'Slutligt resultat',
        format: 'text/html'
      },
      ovriga: {
        namn: 'Valmyndigheten',
        titel: 'Riksdagsvalet 2006, övriga partier',
        url: 'https://historik.val.se/val/val2006/slutlig/R/rike/ovriga.html',
        version: 'Slutligt resultat',
        format: 'text/html'
      }
    }
  },
  2010: legacyDefinition(2010),
  2014: legacyDefinition(2014),
  2018: legacyDefinition(2018),
  2022: {
    parser: 'val-2022-json',
    resultSourceIds: ['resultat'],
    mandateSourceIds: ['resultat'],
    turnoutSourceId: 'resultat',
    sources: {
      resultat: {
        namn: 'Valmyndigheten',
        titel: 'Val till riksdagen 2022, riket',
        url: 'https://resultat.val.se/data/resultat/val2022/RD_S.json',
        version: 'Slutligt valresultat',
        format: 'application/json'
      }
    }
  }
};

function legacyDefinition (year) {
  const root = `https://historik.val.se/val/val${year}/slutresultat/R/rike`;
  return {
    parser: 'val-legacy-html',
    resultSourceIds: ['resultat'],
    mandateSourceIds: ['mandat'],
    turnoutSourceId: 'resultat',
    sources: {
      resultat: {
        namn: 'Valmyndigheten',
        titel: `Riksdagsvalet ${year}, hela riket`,
        url: `${root}/`,
        version: 'Slutligt resultat',
        format: 'text/html'
      },
      mandat: {
        namn: 'Valmyndigheten',
        titel: `Riksdagsvalet ${year}, valda och mandat`,
        url: `${root}/valda.html`,
        version: 'Slutligt resultat',
        format: 'text/html'
      }
    }
  };
}

function decodeHtml (value) {
  const named = {
    amp: '&', apos: "'", aring: 'å', Aring: 'Å',
    auml: 'ä', Auml: 'Ä', gt: '>', lt: '<', nbsp: ' ',
    ouml: 'ö', Ouml: 'Ö', quot: '"'
  };
  return value.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, key) => {
    if (key[0] !== '#') return named[key] ?? entity;
    const radix = key[1].toLowerCase() === 'x' ? 16 : 10;
    const digits = radix === 16 ? key.slice(2) : key.slice(1);
    return String.fromCodePoint(Number.parseInt(digits, radix));
  });
}

/**
 * Extracts table cells without depending on a browser DOM. The state stack is
 * intentional: Valmyndigheten's 2002 page contains layout tables around the
 * result tables, while later pages do not.
 */
function parseHtmlTables (html) {
  const tables = [];
  const stack = [];
  const tokens = html.match(/<[^>]+>|[^<]+/g) ?? [];
  for (const token of tokens) {
    const tag = token.match(/^<\s*(\/?)\s*([a-z0-9]+)/i);
    if (!tag) {
      const current = stack.at(-1);
      if (current?.cell) current.cell.push(decodeHtml(token));
      continue;
    }
    const closing = tag[1] === '/';
    const name = tag[2].toLowerCase();
    if (!closing && name === 'table') {
      stack.push({ rows: [], row: null, cell: null });
    } else if (!closing && name === 'tr' && stack.length > 0) {
      stack.at(-1).row = [];
    } else if (!closing && (name === 'td' || name === 'th') && stack.at(-1)?.row) {
      stack.at(-1).cell = [];
    } else if (!closing && name === 'br' && stack.at(-1)?.cell) {
      stack.at(-1).cell.push(' ');
    } else if (closing && (name === 'td' || name === 'th') && stack.at(-1)?.cell) {
      const current = stack.at(-1);
      current.row.push(current.cell.join('').replace(/\s+/g, ' ').trim());
      current.cell = null;
    } else if (closing && name === 'tr' && stack.at(-1)?.row) {
      const current = stack.at(-1);
      if (current.row.length > 0) current.rows.push(current.row);
      current.row = null;
    } else if (closing && name === 'table' && stack.length > 0) {
      tables.push(stack.pop().rows);
    }
  }
  assert.equal(stack.length, 0, 'HTML-källan innehåller en oavslutad tabell');
  return tables;
}

function compact (row) {
  return row.filter(value => value !== '');
}

function integer (value, context) {
  const normalized = String(value).replace(/[\s\u00a0]/g, '');
  assert.match(normalized, /^\d+$/, `${context} ska vara ett heltal, fick "${value}"`);
  return Number(normalized);
}

function decimal (value, context) {
  const normalized = String(value).replace('%', '').replace(',', '.').trim();
  assert.match(normalized, /^\d+(?:\.\d+)?$/, `${context} ska vara ett decimaltal, fick "${value}"`);
  return Number(normalized);
}

function resultRow (kallkod, partibeteckning, roster, kallreferens) {
  return {
    ...(kallkod ? { kallkod } : {}),
    partibeteckning,
    roster: integer(roster, `${partibeteckning}.roster`),
    ...(kallreferens ? { kallreferens } : {})
  };
}

function parseTranscription (year, files) {
  const transcription = JSON.parse(files.transkribering.toString('utf8'));
  assert.equal(transcription.valar, year, 'Transkriberingens valår stämmer inte');
  return {
    valar: year,
    valdeltagande: transcription.valdeltagande,
    giltigaRoster: transcription.giltiga_roster,
    rows: transcription.resultat.map(row => resultRow(row.kallkod, row.partibeteckning, row.roster, 'publikation')),
    mandates: transcription.mandatfordelning.map(row => ({
      kallkod: row.kallkod,
      partibeteckning: row.partibeteckning,
      mandat: integer(row.mandat, `${row.partibeteckning}.mandat`)
    }))
  };
}

function parse2002 (files) {
  const tables = parseHtmlTables(files.resultat.toString('utf8'));
  const partyNames = new Map();
  const nameTable = tables.find(table => table[0]?.[0] === 'Partier');
  assert.ok(nameTable, '2002: partitabel saknas');
  for (const row of nameTable.slice(2)) {
    const values = compact(row);
    if (values.length >= 2) partyNames.set(values[0], values[1]);
  }

  const matrix = tables.find(table => compact(table[0] ?? []).includes('M') && compact(table[0] ?? []).includes('OG'));
  assert.ok(matrix, '2002: resultattabell saknas');
  const codes = compact(matrix[0]);
  const votes = compact(matrix[1]);
  const mandateValues = compact(matrix[4]);
  assert.equal(codes.length, votes.length, '2002: olika antal partikoder och röstetal');

  const mainRows = codes
    .map((code, index) => resultRow(code, partyNames.get(code), votes[index], 'resultat'))
    .filter(row => row.kallkod !== 'ÖVR' && row.kallkod !== 'OG');
  const mandates = codes.slice(0, mandateValues.length)
    .map((code, index) => ({
      kallkod: code,
      partibeteckning: partyNames.get(code),
      mandat: integer(mandateValues[index].replace(/\(.+$/, ''), `${code}.mandat`)
    }))
    .filter(row => row.mandat > 0);

  const otherTable = tables.find(table => table[0]?.[0] === 'Varav övriga');
  assert.ok(otherTable, '2002: tabellen Varav övriga saknas');
  const otherRows = otherTable.slice(2).map(row => {
    const values = compact(row);
    assert.equal(values.length, 3, `2002: oväntad övrig-rad ${JSON.stringify(values)}`);
    return resultRow(values[0], values[1], values[2], 'resultat');
  });
  const rows = [...mainRows, ...otherRows];
  const giltigaRoster = rows.reduce((sum, row) => sum + row.roster, 0);
  assert.equal(giltigaRoster, 5303212, '2002: summan giltiga röster avviker från källan');

  return { valar: 2002, valdeltagande: 80.11, giltigaRoster, rows, mandates };
}

function parse2006 (files) {
  const resultTables = parseHtmlTables(files.resultat.toString('utf8'));
  const main = resultTables.find(table => table[0]?.[0] === 'Röstfördelning');
  const summary = resultTables.find(table => table[0]?.[0] === 'Röstredovisning');
  assert.ok(main && summary, '2006: resultat- eller summeringstabell saknas');
  const mainRows = main.slice(2)
    .filter(row => row[0] !== 'ÖVR')
    .map(row => resultRow(row[0], row[1], row[2], 'resultat'));
  const mandates = main.slice(2)
    .filter(row => row[0] !== 'ÖVR')
    .map(row => ({ kallkod: row[0], partibeteckning: row[1], mandat: integer(row[4], `${row[0]}.mandat`) }));

  const otherTables = parseHtmlTables(files.ovriga.toString('utf8'));
  const other = otherTables.find(table => table[0]?.[0] === 'Partibeteckning');
  assert.ok(other, '2006: tabellen Övriga partier saknas');
  const otherRows = other.slice(1).map(row => resultRow(undefined, row[0], row[1], 'ovriga'));
  const rows = [...mainRows, ...otherRows];
  const giltigaRoster = integer(summary.find(row => row[0] === 'Summa giltiga röster')[1], '2006.giltiga_roster');
  assert.equal(rows.reduce((sum, row) => sum + row.roster, 0), giltigaRoster, '2006: resultatraderna summerar inte till giltiga röster');

  return {
    valar: 2006,
    valdeltagande: decimal(summary.find(row => row[0] === 'Valdeltagande')[1], '2006.valdeltagande'),
    giltigaRoster,
    rows,
    mandates
  };
}

function parseLegacy (year, files) {
  const tables = parseHtmlTables(files.resultat.toString('utf8'));
  const main = tables.find(table => table[0]?.[0] === 'Förk.' && table[0]?.[1] === 'Parti' && table.some(row => row[1] === 'Giltiga röster'));
  const other = tables.find(table => table[0]?.[0] === 'Förk.' && table.at(-1)?.[1] === 'Totalt övriga partier');
  assert.ok(main && other, `${year}: resultat- eller övrigtabell saknas`);

  const mainRows = main.slice(1, main.findIndex(row => row[1] === 'Giltiga röster'));
  const rows = mainRows
    .filter(row => row[0] !== 'ÖVR')
    .map(row => resultRow(row[0], row[1], row[2], 'resultat'));
  for (const row of other.slice(1, -1)) {
    if (row[1]?.startsWith('Röster på partier som ej beställt valsedlar')) {
      rows.push(resultRow(undefined, row[1], row[2], 'resultat'));
    } else {
      rows.push(resultRow(row[0], row[1], row[2], 'resultat'));
    }
  }
  const validRow = main.find(row => row[1] === 'Giltiga röster');
  const turnoutRow = main.find(row => row[0] === 'VDT');
  const giltigaRoster = integer(validRow[2], `${year}.giltiga_roster`);
  assert.equal(rows.reduce((sum, row) => sum + row.roster, 0), giltigaRoster, `${year}: resultatraderna summerar inte till giltiga röster`);

  const mandateTables = parseHtmlTables(files.mandat.toString('utf8'));
  const mandateTable = mandateTables.find(table => table[0]?.[0] === 'Förk.' && table[0]?.[1] === 'Parti' && table[0]?.[2]?.startsWith('Mandat'));
  assert.ok(mandateTable, `${year}: mandattabell saknas`);
  const mandates = mandateTable.slice(1, -1).map(row => ({
    kallkod: row[0],
    partibeteckning: row[1],
    mandat: integer(row[2], `${row[0]}.mandat`)
  }));

  return {
    valar: year,
    valdeltagande: decimal(turnoutRow[3], `${year}.valdeltagande`),
    giltigaRoster,
    rows,
    mandates
  };
}

function parse2022 (files) {
  const source = JSON.parse(files.resultat.toString('utf8'));
  const rows = source.rosterPaverkaMandat.partiroster
    .filter(row => row.visa === 0 || row.visa === 1 || row.visa === 6)
    .map(row => resultRow(row.partikod, row.partibeteckning, row.antalRoster, 'resultat'));
  const giltigaRoster = source.rosterPaverkaMandat.antalRoster;
  assert.equal(rows.reduce((sum, row) => sum + row.roster, 0), giltigaRoster, '2022: resultatraderna summerar inte till giltiga röster');
  return {
    valar: 2022,
    valdeltagande: decimal(source.valdeltagande, '2022.valdeltagande'),
    giltigaRoster,
    rows,
    mandates: source.partiMandat.map(row => ({
      kallkod: row.partikod,
      partibeteckning: row.partibeteckning,
      mandat: row.antalMandat
    }))
  };
}

function parseSourceFiles (year, files) {
  const definition = SOURCE_DEFINITIONS[year];
  assert.ok(definition, `Valåret ${year} stöds inte`);
  if (definition.parser === 'scb-transcription') return parseTranscription(year, files);
  if (definition.parser === 'val-2002-html') return parse2002(files);
  if (definition.parser === 'val-2006-html') return parse2006(files);
  if (definition.parser === 'val-legacy-html') return parseLegacy(year, files);
  if (definition.parser === 'val-2022-json') return parse2022(files);
  throw new Error(`Okänd parser: ${definition.parser}`);
}

function nameKey (value) {
  return value.normalize('NFC').trim().toLocaleLowerCase('sv-SE').replace(/\s+/g, ' ');
}

function loadIdentityResolver (dataRoot) {
  const index = JSON.parse(fs.readFileSync(path.join(dataRoot, 'parti', 'index.json'), 'utf8'));
  const parties = index.map(entry => JSON.parse(fs.readFileSync(path.join(dataRoot, 'parti', entry.filnamn, 'index.json'), 'utf8')));
  const links = JSON.parse(fs.readFileSync(path.join(dataRoot, 'valresultat', 'riksdag-partikopplingar.json'), 'utf8'));
  const byUuid = new Map(parties.map(party => [party.uuid, party]));
  const byCode = new Map();
  const byName = new Map();
  const add = (target, key, uuid) => {
    if (!key) return;
    if (!target.has(key)) target.set(key, new Set());
    target.get(key).add(uuid);
  };
  for (const party of parties) {
    [party.kod, ...(party.tidigare_koder ?? [])].forEach(code => add(byCode, code.toLocaleLowerCase('sv-SE'), party.uuid));
    [party.beteckning, ...(party.tidigare_beteckningar ?? [])].forEach(name => add(byName, nameKey(name), party.uuid));
  }
  for (const link of links.kopplingar) {
    assert.ok(byUuid.has(link.parti_uuid), `Partikoppling refererar okänt uuid ${link.parti_uuid}`);
    (link.kallkoder ?? []).forEach(code => add(byCode, code.toLocaleLowerCase('sv-SE'), link.parti_uuid));
    (link.kallbeteckningar ?? []).forEach(name => add(byName, nameKey(name), link.parti_uuid));
  }
  const blocked = new Set((links.blockerade_kallbeteckningar ?? []).map(nameKey));

  return row => {
    const codeCandidates = byCode.get(row.kallkod?.toLocaleLowerCase('sv-SE')) ?? new Set();
    if (codeCandidates.size === 1) return byUuid.get([...codeCandidates][0]);
    if (codeCandidates.size > 1 || blocked.has(nameKey(row.partibeteckning))) return undefined;
    const candidates = new Set();
    for (const uuid of byName.get(nameKey(row.partibeteckning)) ?? []) candidates.add(uuid);
    return candidates.size === 1 ? byUuid.get([...candidates][0]) : undefined;
  };
}

function isAggregate (row) {
  return row.partibeteckning.startsWith('Övriga ') || row.partibeteckning.startsWith('Röster på partier som ej beställt valsedlar');
}

function share (votes, validVotes) {
  return Number((votes * 100 / validVotes).toFixed(2));
}

function buildCanonicalResult (raw, sources, dataRoot) {
  const definition = SOURCE_DEFINITIONS[raw.valar];
  const resolve = loadIdentityResolver(dataRoot);
  const partier = [];
  const ejKopplade = [];
  const aggregat = [];
  for (const row of raw.rows) {
    const common = {
      ...(row.kallkod ? { kallkod: row.kallkod } : {}),
      partibeteckning: row.partibeteckning,
      roster: row.roster,
      rostandel: share(row.roster, raw.giltigaRoster),
      kallreferens: row.kallreferens
    };
    if (isAggregate(row)) {
      aggregat.push(common);
      continue;
    }
    const party = resolve(row);
    if (party) {
      partier.push({ parti_uuid: party.uuid, ...common });
    } else {
      ejKopplade.push(common);
    }
  }

  const mandateRows = raw.mandates.map(row => {
    const party = resolve(row);
    assert.ok(party, `Mandatraden ${row.kallkod ?? ''} ${row.partibeteckning} kan inte kopplas till ett parti`);
    return {
      parti_uuid: party.uuid,
      ...(row.kallkod ? { kallkod: row.kallkod } : {}),
      partibeteckning: row.partibeteckning,
      mandat: row.mandat,
      kallreferens: definition.mandateSourceIds[0]
    };
  });

  return {
    schema_version: 2,
    valtyp: 'riksdag',
    valar: raw.valar,
    status: 'slutligt',
    kallor: sources,
    valdeltagande: {
      procent: raw.valdeltagande,
      kallreferens: definition.turnoutSourceId
    },
    rostresultat: {
      giltiga_roster: raw.giltigaRoster,
      kallreferenser: definition.resultSourceIds,
      partier,
      ej_kopplade: ejKopplade,
      aggregat
    },
    mandatfordelning: {
      antal_mandat: mandateRows.reduce((sum, row) => sum + row.mandat, 0),
      kallreferenser: definition.mandateSourceIds,
      partier: mandateRows
    }
  };
}

function sourceMetadata (year, files, retrievedAt) {
  const definition = SOURCE_DEFINITIONS[year];
  return Object.entries(definition.sources).map(([id, source]) => {
    const bytes = files[id];
    assert.ok(bytes, `${year}: källfilen ${id} saknas`);
    return {
      id,
      ...source,
      hamtad: retrievedAt,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      ...(definition.parser === 'scb-transcription'
        ? {
            transkribering_sha256: crypto.createHash('sha256')
              .update(files.transkribering)
              .digest('hex')
          }
        : {})
    };
  });
}

function serializeResult (result) {
  return `${JSON.stringify(result, null, 2)}\n`;
}

exports.SOURCE_DEFINITIONS = SOURCE_DEFINITIONS;
exports.buildCanonicalResult = buildCanonicalResult;
exports.parseHtmlTables = parseHtmlTables;
exports.parseSourceFiles = parseSourceFiles;
exports.serializeResult = serializeResult;
exports.sourceMetadata = sourceMetadata;
