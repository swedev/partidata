const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { ROOT } = require('./utils.js');

const DERIVED_FILE = path.join('derived', 'partiprofil', 'riksdag.json');
const DIAGRAM_FILE = path.join('public', 'img', 'sveriges_riksdag.svg');

/**
 * SEAT_COLOURS
 * Presentation only: the committed data carries no colour, so the diagram maps
 * the chamber's abbreviations to the hues they are recognised by. An
 * abbreviation without an entry is drawn neutral.
 * @type {Object}
 */
const SEAT_COLOURS = {
  V: '#b00000',
  S: '#ed1b34',
  MP: '#00c554',
  C: '#39944a',
  L: '#0069b4',
  KD: '#2d338e',
  M: '#019cdb',
  SD: '#fedf09'
};
const NEUTRAL_COLOUR = '#d2d2d2';

const DIAGRAM = { width: 512, height: 256, rows: 9, innerRadius: 110, outerRadius: 244, seatRadius: 6 };

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
  return [...new Map(sources.map(source => [`${source.namn}\0${source.url}\0${source.hamtad}`, source])).values()];
}

function buildPartyProfileParliamentView (dataDirectory = path.join(ROOT, 'data')) {
  const files = electionResultFiles(dataDirectory);
  assert.ok(files.length > 0, 'Inga riksdagsresultat hittades');
  const results = files.map(file => ({ ...file, data: readJson(file.absolutePath) }));
  const chamberResult = results.filter(result => result.data.mandatfordelning).at(-1);
  assert.ok(chamberResult, 'Ingen mandatfördelning hittades');
  const sources = [
    ...results.map(result => result.data.valdeltagande.kalla),
    chamberResult.data.mandatfordelning.kalla
  ];

  return {
    schema_version: 1,
    genererad_fran: files.map(file => file.relativePath),
    senast_uppdaterad: sources.map(source => source.hamtad).toSorted().at(-1),
    kammare: {
      valar: chamberResult.data.valar,
      partier: chamberResult.data.mandatfordelning.partier,
      kalla: chamberResult.data.mandatfordelning.kalla
    },
    valdeltagande: {
      resultat: results.map(result => ({
        valar: result.data.valar,
        procent: result.data.valdeltagande.procent
      })),
      kallor: uniqueSources(results.map(result => result.data.valdeltagande.kalla))
    }
  };
}

/**
 * seatRows
 * Splits the seats over concentric rows, each row holding a share of the total
 * proportional to its radius, so the ring of seats keeps an even density. The
 * remainder goes to the rows with the largest fractional claim, which makes the
 * split a pure function of the seat count.
 * @param  {Number} total
 * @return {Number[]} Seats per row, innermost first
 */
function seatRows (total) {
  const radii = Array.from({ length: DIAGRAM.rows }, (unused, row) =>
    DIAGRAM.innerRadius + (DIAGRAM.outerRadius - DIAGRAM.innerRadius) * row / (DIAGRAM.rows - 1));
  const sum = radii.reduce((carry, radius) => carry + radius, 0);
  const shares = radii.map((radius, row) => ({ row, exact: total * radius / sum }));
  const counts = shares.map(share => Math.floor(share.exact));
  const spare = total - counts.reduce((carry, count) => carry + count, 0);
  shares
    .toSorted((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)) || a.row - b.row)
    .slice(0, spare)
    .forEach(share => { counts[share.row] += 1; });
  return counts;
}

/**
 * seatPositions
 * The seats of a hemicycle, ordered the way the chamber is read: from one end
 * of the arc to the other, innermost row first where seats share an angle.
 * @param  {Number} total
 * @return {Array<{ x: String, y: String }>}
 */
function seatPositions (total) {
  const centreX = DIAGRAM.width / 2;
  const centreY = DIAGRAM.height - DIAGRAM.seatRadius;
  const seats = seatRows(total).flatMap((count, row) => {
    const radius = DIAGRAM.innerRadius + (DIAGRAM.outerRadius - DIAGRAM.innerRadius) * row / (DIAGRAM.rows - 1);
    return Array.from({ length: count }, (unused, seat) => ({
      radius,
      angle: count === 1 ? Math.PI / 2 : Math.PI * (1 - seat / (count - 1))
    }));
  });

  return seats
    .toSorted((a, b) => b.angle - a.angle || a.radius - b.radius)
    .map(seat => ({
      x: (centreX + seat.radius * Math.cos(seat.angle)).toFixed(2),
      y: (centreY - seat.radius * Math.sin(seat.angle)).toFixed(2)
    }));
}

function buildParliamentDiagram (dataDirectory = path.join(ROOT, 'data')) {
  const view = buildPartyProfileParliamentView(dataDirectory);
  const { valar, partier } = view.kammare;
  const total = partier.reduce((carry, party) => carry + party.mandat, 0);
  const positions = seatPositions(total);

  let placed = 0;
  const groups = partier.map(party => {
    const seats = positions.slice(placed, placed + party.mandat);
    placed += party.mandat;
    const circles = seats
      .map(seat => `<circle r="${DIAGRAM.seatRadius}" cx="${seat.x}" cy="${seat.y}"/>`)
      .join('\n');
    return `<g id="${party.forkortning}" fill="${SEAT_COLOURS[party.forkortning] ?? NEUTRAL_COLOUR}">\n${circles}\n</g>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<!-- Genererad av scripts/build-derived-data.js ur mandatfördelningen i riksdagsvalet ${valar}. Redigera inte för hand. -->`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${DIAGRAM.width} ${DIAGRAM.height}" data-valar="${valar}">`,
    '<g style="transform: rotate(180deg); transform-origin: center">',
    ...groups,
    '</g>',
    '</svg>',
    ''
  ].join('\n');
}

function writeParliamentDiagram (dataDirectory = path.join(ROOT, 'data'), target = path.join(ROOT, DIAGRAM_FILE)) {
  fs.writeFileSync(target, buildParliamentDiagram(dataDirectory));
  return target;
}

function checkParliamentDiagram (dataDirectory = path.join(ROOT, 'data'), target = path.join(ROOT, DIAGRAM_FILE)) {
  assert.ok(fs.existsSync(target), `${DIAGRAM_FILE} saknas; kör npm run build:derived-data`);
  assert.equal(fs.readFileSync(target, 'utf8'), buildParliamentDiagram(dataDirectory), `${DIAGRAM_FILE} är inaktuell; kör npm run build:derived-data`);
}

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
    checkParliamentDiagram();
    console.log(`${DERIVED_FILE} och ${DIAGRAM_FILE} är aktuella.`);
  } else {
    const targets = [writePartyProfileParliamentView(), writeParliamentDiagram()];
    console.log(`Skrev ${targets.map(target => path.relative(ROOT, target)).join(' och ')}.`);
  }
}

exports.SEAT_COLOURS = SEAT_COLOURS;
exports.buildParliamentDiagram = buildParliamentDiagram;
exports.buildPartyProfileParliamentView = buildPartyProfileParliamentView;
exports.checkParliamentDiagram = checkParliamentDiagram;
exports.checkPartyProfileParliamentView = checkPartyProfileParliamentView;
exports.seatRows = seatRows;
exports.writeParliamentDiagram = writeParliamentDiagram;
exports.writePartyProfileParliamentView = writePartyProfileParliamentView;
