const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const projectRoot = path.join(__dirname, '..');
const releaseRoot = path.join(projectRoot, '.release');
const collator = new Intl.Collator('sv');
const homePageSize = 48;

/**
 * The expected order below is computed with the same ICU data as the server
 * this test starts, so a runtime without Swedish locale data would produce a
 * matching root-collation fallback on both sides. These literal comparisons
 * fail on such a runtime instead.
 */
function assertSwedishCollation () {
  for (const [first, second] of [['z', 'å'], ['å', 'ä'], ['ä', 'ö'], ['Jarl', 'Jämtlands']]) {
    assert.ok(collator.compare(first, second) < 0, `"${first}" ska sorteras före "${second}"`);
  }
}

function comparePartyOrder (a, b) {
  return collator.compare(a.beteckning, b.beteckning) || collator.compare(a.filnamn, b.filnamn);
}

/** The election years the registry carries participation for, oldest first. */
function electionYears (projectRoot) {
  const electionRoot = path.join(projectRoot, 'data', 'val');
  return fs.readdirSync(electionRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{4}$/.test(entry.name))
    .map(entry => entry.name)
    .filter(year => fs.existsSync(path.join(electionRoot, year, 'partideltagande', 'partier.json')))
    .toSorted();
}

/** Every imported parliamentary result file, oldest first. */
function parliamentResults (projectRoot) {
  const electionRoot = path.join(projectRoot, 'data', 'val');
  return fs.readdirSync(electionRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{4}$/.test(entry.name))
    .map(entry => path.join(electionRoot, entry.name, 'valresultat', 'riksdag.json'))
    .filter(file => fs.existsSync(file))
    .map(file => JSON.parse(fs.readFileSync(file, 'utf8')))
    .toSorted((a, b) => a.valar - b.valar);
}

/** The parties standing in one election, which is what a chosen year narrows to. */
function standingParties (projectRoot, parties, year) {
  const participating = new Set(JSON.parse(fs.readFileSync(
    path.join(projectRoot, 'data', 'val', year, 'partideltagande', 'partier.json'), 'utf8'
  )).map(party => party.uuid));
  return parties.filter(party => participating.has(party.uuid));
}

/**
 * Every party's registered participation, read from the same files the site
 * reads, so the expected result of a filtered URL can be worked out here.
 */
function participationByParty (projectRoot, parties) {
  return new Map(parties.map(party => [party.filnamn, JSON.parse(fs.readFileSync(
    path.join(projectRoot, 'data', 'parti', party.filnamn, 'index.json'), 'utf8'
  )).deltagande ?? {}]));
}

/**
 * The search comparison, written out here rather than imported, so the smoke
 * test does not check the site against the very code it renders with.
 */
function normalise (value) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function matchesQuery (party, query) {
  const haystack = normalise(`${party.beteckning} ${party.forkortning ?? ''} ${party.omrade ?? ''}`);
  return normalise(query).split(' ').every(term => haystack.includes(term));
}

/** The slugs the first page of the grid is expected to link to. */
function expectedGrid (parties) {
  return parties.slice(0, homePageSize).map(party => party.filnamn);
}

/** The "N av M" the results heading carries, whichever way React split the text. */
function countPattern (matched, total) {
  return new RegExp(`>${matched}(<!-- -->)? av (<!-- -->)?${total}</span>`);
}

/** The "N av 349" of the hero's seat block, whichever way React split the text. */
function seatPattern (seats) {
  return new RegExp(`<dt>Mandat i riksdagen</dt><dd>${seats}(<!-- -->)? <span>av 349</span></dd>`);
}

/** The markup of one segmented control, cut out by the legend that names it. */
function segmentGroup (html, legend) {
  const group = html.match(new RegExp(
    `<fieldset[^>]*class="home-segments"[^>]*><legend[^>]*>${legend}</legend>([\\s\\S]*?)</fieldset>`
  ));
  assert.ok(group, `segmentgruppen "${legend}" finns i markupen`);
  return group[1];
}

/** The value of the one segment a group has selected, which is always exactly one. */
function checkedSegment (groupHtml) {
  const checked = [...groupHtml.matchAll(/<input[^>]*>/g)]
    .map(match => match[0])
    .filter(input => / checked=""/.test(input));
  assert.equal(checked.length, 1, 'exakt ett segment i gruppen är valt');
  return checked[0].match(/ value="([^"]*)"/)[1];
}

/** The radio of one segment, by the value it stands for. */
function segmentInput (groupHtml, value) {
  const input = groupHtml.match(new RegExp(`<input[^>]*value="${value}"[^>]*>`));
  assert.ok(input, `segmentet "${value}" finns i gruppen`);
  return input[0];
}

/** Extracts the party links of the "Alla partier" grid in document order. */
function partyGridLinks (html) {
  const section = html.slice(html.indexOf('id="alla-partier"'));
  const gridStart = section.indexOf('<ul class="home-grid">');
  assert.ok(gridStart !== -1, 'partigridet hittades i markupen');
  const grid = section.slice(gridStart, section.indexOf('</ul>', gridStart));
  return [...grid.matchAll(/href="\/parti\/([^"/]+)\/?"/g)].map(match => match[1]);
}

/**
 * A request `fetch` will not send: it normalises `..` out of the path before it
 * leaves the client, and the point here is what the server does with it.
 */
async function rawRequest (port, requestPath) {
  return await new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port, path: requestPath, method: 'GET' }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        location: response.headers.location,
        body: Buffer.concat(chunks)
      }));
    });
    request.on('error', reject);
    request.end();
  });
}

async function freePort () {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(error => error ? reject(error) : resolve(address.port));
    });
  });
}

async function waitForHealth (baseUrl, child, output) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Servern avslutades med ${child.exitCode}\n${output.join('')}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Servern blev inte frisk\n${output.join('')}`);
}

async function main () {
  if (!fs.existsSync(path.join(releaseRoot, 'server.js'))) throw new Error('Kör npm run build:release före npm run test:http');
  const { version } = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  const parties = JSON.parse(fs.readFileSync(path.join(projectRoot, 'data', 'derived', 'parti.json'), 'utf8'));
  const derivedParliament = JSON.parse(fs.readFileSync(path.join(projectRoot, 'data', 'derived', 'riksdag.json'), 'utf8'));
  const chamber = derivedParliament.kammare;
  const outside = derivedParliament.storsta_utanfor_riksdagen;
  assertSwedishCollation();
  const current = parties.find(party => party.filnamn === 'miljopartiet-de-grona') ?? parties[0];
  const duplicate = parties.find(party => party.filnamn === 'kommunens-val-0503');
  const withoutParticipation = parties.find(party => party.filnamn === 'angfarjepartiet');
  const years = electionYears(projectRoot);
  assert.ok(years.length >= 2, 'minst två valår har partideltagande');
  const latest = years.at(-1);
  const earlier = years.at(-2);
  const standing = standingParties(projectRoot, parties, latest);
  const deltagande = participationByParty(projectRoot, parties);
  const inNameOrder = parties.toSorted(comparePartyOrder);
  const expectedOrder = expectedGrid(standing.toSorted(comparePartyOrder));
  const [first] = expectedOrder;
  const previous = parties.find(party => party.tidigare_filnamn?.length > 0);
  const cleanedSlug = parties.find(party =>
    party.filnamn === 'folk-natur' && party.tidigare_filnamn?.includes('folk---natur')
  );
  const withSymbol = parties.find(party => party.partisymbol);
  const founded = JSON.parse(fs.readFileSync(
    path.join(projectRoot, 'data', 'parti', current.filnamn, 'index.json'), 'utf8'
  )).wikidata;
  assert.ok(current);
  assert.equal(duplicate?.omrade, 'Hylte');
  assert.ok(withoutParticipation);
  assert.ok(previous);
  assert.ok(cleanedSlug);
  assert.ok(withSymbol);
  assert.ok(founded?.grundat, `${current.filnamn} har ett grundandedatum från Wikidata`);

  const results = parliamentResults(projectRoot);
  assert.ok(results.length > 0, 'riksdagsresultat är importerade');
  const chamberResult = results.at(-1);
  assert.equal(chamberResult.valar, chamber.valar, 'kammaråret är det senaste importerade valet');
  const currentSeats = chamberResult.mandatfordelning.partier.find(party => party.parti_uuid === current.uuid);
  assert.ok(currentSeats, `${current.filnamn} har mandat i kammaren`);
  assert.equal(
    currentSeats.mandat,
    chamber.partier.find(party => party.parti_uuid === current.uuid).mandat,
    'partisidans mandat är samma siffra som startsidans riksdagssektion'
  );
  const seated = new Set(chamberResult.mandatfordelning.partier.map(party => party.parti_uuid));
  const byUuid = new Map(parties.map(party => [party.uuid, party]));
  const withoutSeats = chamberResult.rostresultat.partier
    .map(row => byUuid.get(row.parti_uuid))
    .filter(party => party && !seated.has(party.uuid))
    .toSorted((a, b) => a.filnamn < b.filnamn ? -1 : a.filnamn > b.filnamn ? 1 : 0)
    .at(0);
  assert.ok(withoutSeats, `valet ${chamber.valar} har ett registrerat parti utan mandat`);
  assert.ok(
    !results.some(result => result.rostresultat.partier.some(row => row.parti_uuid === withoutParticipation.uuid)),
    `${withoutParticipation.filnamn} saknar röstrad i varje importerat riksdagsval`
  );

  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const output = [];
  const child = spawn(process.execPath, ['server.js'], {
    cwd: releaseRoot,
    env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', data => output.push(data.toString()));
  child.stderr.on('data', data => output.push(data.toString()));

  try {
    await waitForHealth(baseUrl, child, output);

    const home = await fetch(`${baseUrl}/`);
    assert.equal(home.status, 200);
    const homeBody = await home.text();
    assert.match(homeBody, /<title[^>]*>Partidata<\/title>/);
    assert.match(homeBody, /<link rel="canonical" href="https:\/\/www\.partidata\.se\/"[^>]*>/);
    assert.match(homeBody, /Sök parti på namn eller förkortning/);
    assert.match(homeBody, /Alla partier/, 'partilistan har en rubrik');
    assert.match(
      homeBody,
      countPattern(standing.length, parties.length),
      'rubriken räknar partierna i det förvalda valåret mot hela registret'
    );
    assert.equal(checkedSegment(segmentGroup(homeBody, 'Valår')), latest, 'valårsfiltret står på det senaste valet');
    assert.match(homeBody, /<option value="namn" selected="">Sorterat <!-- -->A–Ö<\/option>/, 'sorteringen står på bokstavsordning');
    assert.match(homeBody, /<option value="kommuner">Sorterat <!-- -->Flest kommuner<\/option>/, 'sorteringen kan rangordna på kommuner');
    assert.match(homeBody, new RegExp(`/parti/${first}`), 'partigridet länkar till en partisida');
    assert.match(homeBody, /Riksdagspartier/);
    assert.match(homeBody, /Största partierna utanför riksdagen/);
    assert.match(homeBody, new RegExp(`>${outside.partier[0].rostandel.toFixed(2).replace('.', ',')}(<!-- -->)? %<`), 'utanför-rankningen visar den härledda röstandelen');
    assert.equal(homeBody.split('party-card--medium').length - 1, outside.partier.length, 'utanför-rankningen renderar alla härledda partikort');
    assert.match(homeBody, new RegExp(`valet (<!-- -->)?${chamber.valar}`), 'riksdagssektionen anger valåret');
    assert.match(homeBody, /<select aria-label="Mandatfördelning efter val"/, 'riksdagssektionens val har ett eget tillgängligt namn');
    assert.ok(!homeBody.includes('aria-label="Valår"'), 'Valår namnger bara listfiltret');
    assert.equal(checkedSegment(segmentGroup(homeBody, 'Valtyp')), '', 'valtypen står på alla');
    assert.match(homeBody, /Visa fler partier \(/, 'visa fler anger hur många som återstår');
    assert.match(homeBody, /Alternativet \(Bromölla\)/, 'identiska partinamn får ort på korten');
    assert.match(homeBody, /Alternativet \(Ljungby\)/, 'alla synliga namndubbletter särskiljs');

    const gridLinks = partyGridLinks(homeBody);
    assert.equal(gridLinks.length, Math.min(homePageSize, standing.length), 'partigridet renderar en hel sida partier');
    assert.deepEqual(gridLinks, expectedOrder, 'partigridet följer svensk bokstavsordning');

    const riksdagCards = homeBody.split('party-card--large').length - 1;
    assert.equal(riksdagCards, chamber.partier.length, 'riksdagspartierna renderas som stora partikort');

    const parliamentary = inNameOrder.filter(party => deltagande.get(party.filnamn)[earlier]?.riksdag);
    assert.ok(parliamentary.length > 0, `partier anmälda till riksdagsvalet ${earlier} hittades`);
    const filtered = await fetch(`${baseUrl}/?valar=${earlier}&valtyp=riksdag`);
    assert.equal(filtered.status, 200);
    const filteredBody = await filtered.text();
    assert.equal(checkedSegment(segmentGroup(filteredBody, 'Valår')), earlier, 'valårsfiltret står på året i länken');
    assert.equal(checkedSegment(segmentGroup(filteredBody, 'Valtyp')), 'riksdag', 'riksdagsvalet är det valda segmentet');
    assert.match(filteredBody, /<link rel="canonical" href="https:\/\/www\.partidata\.se\/"[^>]*>/, 'en filtrerad vy är samma kanoniska sida');
    assert.match(filteredBody, countPattern(parliamentary.length, parties.length), 'rubriken räknar de filtrerade partierna');
    assert.deepEqual(partyGridLinks(filteredBody), expectedGrid(parliamentary), 'gridet visar partierna länken filtrerar fram');

    // A county rules out the nationwide election, which the server renders as a
    // disabled segment carrying the reason as its description.
    const regionCounties = new Set([...deltagande.values()].flatMap(facets => facets[earlier]?.region ?? []));
    const county = regionCounties.has('01') ? '01' : [...regionCounties].toSorted().at(0);
    assert.ok(county, `regionvalet ${earlier} har minst ett län`);
    const inCounty = await fetch(`${baseUrl}/?valar=${earlier}&valtyp=region&lan=${county}`);
    assert.equal(inCounty.status, 200);
    const kindGroup = segmentGroup(await inCounty.text(), 'Valtyp');
    assert.equal(checkedSegment(kindGroup), 'region', 'regionvalet är det valda segmentet');
    const lockedInput = segmentInput(kindGroup, 'riksdag');
    assert.match(lockedInput, / disabled=""/, 'ett valt län låser riksdagsvalet');
    const noteId = lockedInput.match(/ aria-describedby="([^"]*)"/);
    assert.ok(noteId, 'det låsta segmentet pekar ut sin beskrivning');
    assert.ok(
      kindGroup.includes(`<span id="${noteId[1]}" class="sr-only">Riksdagsval gäller inte ett valt område — välj Hela landet och Alla kommuner först</span>`),
      'beskrivningen är låstexten i ett dolt spann'
    );
    assert.doesNotMatch(segmentInput(kindGroup, 'kommun'), / aria-describedby=/, 'ett olåst segment får ingen beskrivning');

    // The ranking is the widest municipal ballot that year, and the sort is
    // stable, so parties on equally many keep Swedish name order.
    const found = inNameOrder
      .filter(party => matchesQuery(party, 'parti'))
      .filter(party => {
        const facet = deltagande.get(party.filnamn)[earlier];
        return Boolean(facet) && (facet.riksdag || facet.region.length > 0 || facet.kommun.length > 0);
      })
      .toSorted((a, b) =>
        deltagande.get(b.filnamn)[earlier].kommun.length - deltagande.get(a.filnamn)[earlier].kommun.length);
    assert.ok(found.length > homePageSize, 'sökningen ger fler träffar än en sida');
    const searched = await fetch(`${baseUrl}/?valar=${earlier}&sortering=kommuner&q=parti`);
    assert.equal(searched.status, 200);
    const searchedBody = await searched.text();
    assert.match(searchedBody, /<option value="kommuner" selected="">Sorterat <!-- -->Flest kommuner<\/option>/, 'sorteringen står på länkens ordning');
    assert.match(searchedBody, /<input[^>]*type="search"[^>]*value="parti"/, 'sökfältet står på länkens sökterm');
    assert.match(searchedBody, countPattern(found.length, parties.length), 'rubriken räknar sökträffarna');
    assert.deepEqual(partyGridLinks(searchedBody), expectedGrid(found), 'gridet är rangordnat på antal kommuner');

    const everyYear = await fetch(`${baseUrl}/?valar=alla`);
    assert.equal(everyYear.status, 200);
    const everyYearBody = await everyYear.text();
    assert.equal(checkedSegment(segmentGroup(everyYearBody, 'Valår')), '', 'valårsfiltret står på alla valår');
    assert.match(everyYearBody, countPattern(parties.length, parties.length), 'utan valår och övriga filter matchar hela registret');
    assert.deepEqual(partyGridLinks(everyYearBody), expectedGrid(inNameOrder), 'gridet är hela registret i bokstavsordning');

    const invalid = await fetch(`${baseUrl}/?valar=1900&valtyp=eu`);
    assert.equal(invalid.status, 200);
    const invalidBody = await invalid.text();
    assert.equal(checkedSegment(segmentGroup(invalidBody, 'Valår')), latest, 'ett valår datan saknar faller tillbaka på förvalet');
    assert.equal(checkedSegment(segmentGroup(invalidBody, 'Valtyp')), '', 'en okänd valtyp faller tillbaka på alla');

    const canonicalYear = await fetch(`${baseUrl}/?valar=${latest}`);
    assert.equal(canonicalYear.status, 200);
    assert.deepEqual(partyGridLinks(await canonicalYear.text()), gridLinks, 'förvalet i länken ger samma vy som startsidan');

    const profile = await fetch(`${baseUrl}/parti/${current.filnamn}/`);
    assert.equal(profile.status, 200);
    const profileBody = await profile.text();
    assert.match(profileBody, /<title[^>]*>[^<]+[–-] Partidata<\/title>/);
    assert.match(profileBody, /<dt>Grundat<\/dt>/, 'partisidan visar grundandedatumet som nyckelfakta');
    assert.match(profileBody, new RegExp(`<time datetime="${founded.grundat}">`, 'i'), 'datumet bär källans precision');
    assert.match(
      profileBody,
      new RegExp(`href="https://www\\.wikidata\\.org/wiki/${founded.id}">Wikidata <!-- -->${founded.id}</a>`),
      'källraden länkar till Wikidata med Q-id:t synligt'
    );
    assert.match(profileBody, new RegExp(`hämtat <!-- -->${founded.hamtad}`), 'källraden anger hämtdatumet');
    assert.match(profileBody, seatPattern(currentSeats.mandat), 'partisidan visar kammarmandaten från de importerade resultaten');
    assert.match(profileBody, /<section class="profile-results"/, 'ett parti med resultat får resultatsektionen');
    assert.match(profileBody, /id="deltagande"/, 'ett parti med resultat får valdeltagandesektionen');

    const withoutSeatsProfile = await fetch(`${baseUrl}/parti/${withoutSeats.filnamn}/`);
    assert.equal(withoutSeatsProfile.status, 200);
    const withoutSeatsBody = await withoutSeatsProfile.text();
    assert.match(withoutSeatsBody, /<section class="profile-results"/, 'ett parti med röstrad men utan mandat får resultatsektionen');
    assert.match(withoutSeatsBody, /id="deltagande"/, 'ett parti med röstrad men utan mandat får valdeltagandesektionen');
    assert.doesNotMatch(withoutSeatsBody, /<dt>Mandat i riksdagen<\/dt>/, 'ett parti utan mandat får inget mandatblock');
    assert.doesNotMatch(withoutSeatsBody, /platser i kammaren/, 'ett parti utan mandat får inget kammarblock');

    const duplicateProfile = await fetch(`${baseUrl}/parti/${duplicate.filnamn}/`);
    assert.equal(duplicateProfile.status, 200);
    const duplicateBody = await duplicateProfile.text();
    assert.match(duplicateBody, /<title[^>]*>Kommunens Väl \(Hylte\) [–-] Partidata<\/title>/);
    assert.match(duplicateBody, /<h1>Kommunens Väl \(Hylte\)<\/h1>/);

    const withoutParticipationProfile = await fetch(`${baseUrl}/parti/${withoutParticipation.filnamn}/`);
    assert.equal(withoutParticipationProfile.status, 200);
    const withoutParticipationBody = await withoutParticipationProfile.text();
    assert.match(withoutParticipationBody, /Inget registrerat deltagande/);
    assert.doesNotMatch(withoutParticipationBody, /<dt>Grundat<\/dt>/, 'ett parti utan Wikidata-uppgift får ingen tom platshållare');
    assert.doesNotMatch(withoutParticipationBody, /profile-results/, 'ett parti utan resultat får ingen resultatsektion');
    assert.doesNotMatch(withoutParticipationBody, /id="deltagande"/, 'ett parti utan resultat får ingen valdeltagandesektion');
    assert.doesNotMatch(withoutParticipationBody, /<dt>Mandat i riksdagen<\/dt>/, 'ett parti utan resultat får inget mandatblock');

    const redirect = await fetch(`${baseUrl}/parti/${previous.tidigare_filnamn[0]}/`, { redirect: 'manual' });
    assert.equal(redirect.status, 308);
    assert.equal(new URL(redirect.headers.get('location'), baseUrl).pathname, `/parti/${previous.filnamn}/`);

    const cleanedRedirect = await fetch(`${baseUrl}/parti/folk---natur/`, { redirect: 'manual' });
    assert.equal(cleanedRedirect.status, 308);
    assert.equal(new URL(cleanedRedirect.headers.get('location'), baseUrl).pathname, '/parti/folk-natur/');

    assert.equal((await fetch(`${baseUrl}/parti/finns-inte/`)).status, 404);

    const symbolUrl = `${baseUrl}/partisymbol/${withSymbol.filnamn}/${withSymbol.partisymbol.filnamn}`;
    const symbol = await fetch(symbolUrl);
    assert.equal(symbol.status, 200);
    assert.equal(symbol.headers.get('content-type'), 'image/png');
    assert.ok((await symbol.arrayBuffer()).byteLength > 0);
    assert.equal((await fetch(symbolUrl, { method: 'HEAD' })).status, 200);
    assert.equal((await fetch(symbolUrl, { method: 'POST' })).status, 405);

    const sitemap = await fetch(`${baseUrl}/sitemap.xml`);
    assert.equal(sitemap.status, 200);
    assert.match(sitemap.headers.get('content-type'), /application\/xml/);
    const sitemapBody = await sitemap.text();
    assert.match(sitemapBody, new RegExp(`/parti/${current.filnamn}/`));
    assert.doesNotMatch(sitemapBody, new RegExp(`/parti/${previous.tidigare_filnamn[0]}/`));
    assert.match(sitemapBody, /<loc>[^<]*\/data\/<\/loc>/, 'sitemapen tar med dokumentationssidan');

    const registryFile = fs.readFileSync(path.join(projectRoot, 'data', 'derived', 'parti.json'));
    const registryEtag = `"${crypto.createHash('sha256').update(registryFile).digest('hex')}"`;

    /** The full header set a JSON resource answers with, checked in one place. */
    function expectDataHeaders (response, { etag, length, body = true } = {}) {
      if (body) assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
      else assert.equal(response.headers.get('content-type'), null, 'ett 304-svar bär ingen kroppstyp');
      if (length !== undefined) assert.equal(response.headers.get('content-length'), String(length));
      assert.equal(response.headers.get('cache-control'), 'public, max-age=3600');
      assert.equal(response.headers.get('vary'), 'Accept-Encoding');
      assert.equal(response.headers.get('etag'), etag);
      assert.equal(response.headers.get('x-partidata-version'), version);
      assert.equal(response.headers.get('access-control-allow-origin'), '*');
      const exposed = response.headers.get('access-control-expose-headers');
      assert.match(exposed, /ETag/);
      assert.match(exposed, /X-Partidata-Version/);
    }

    // Uncompressed, so the body can be compared byte for byte and Content-Length
    // is the file's own size; the app hands the bytes to whatever compresses them.
    const identity = { 'Accept-Encoding': 'identity' };
    const registry = await fetch(`${baseUrl}/data/derived/parti.json`, { redirect: 'manual', headers: identity });
    assert.equal(registry.status, 200, 'registret svarar direkt, utan snedstrecksvidarebefordran');
    expectDataHeaders(registry, { etag: registryEtag, length: registryFile.length });
    assert.match(registry.headers.get('etag'), /^"[0-9a-f]{64}"$/, 'etaggen är en sha256');
    assert.ok(Buffer.from(await registry.arrayBuffer()).equals(registryFile), 'kroppen är filens byte');

    for (const header of [registryEtag, `W/${registryEtag}`]) {
      const notModified = await fetch(`${baseUrl}/data/derived/parti.json`, { headers: { 'If-None-Match': header } });
      assert.equal(notModified.status, 304, `${header} ger 304`);
      expectDataHeaders(notModified, { etag: registryEtag, body: false });
      assert.equal((await notModified.text()).length, 0, 'ett 304-svar har ingen kropp');
    }
    for (const header of ['abc', `"${'0'.repeat(64)}"`]) {
      const stale = await fetch(`${baseUrl}/data/derived/parti.json`, { headers: { 'If-None-Match': header } });
      assert.equal(stale.status, 200, `${header} matchar inte etaggen`);
    }

    const registryHead = await fetch(`${baseUrl}/data/derived/parti.json`, { method: 'HEAD', headers: identity });
    assert.equal(registryHead.status, 200);
    expectDataHeaders(registryHead, { etag: registryEtag, length: registryFile.length });
    assert.equal((await registryHead.text()).length, 0, 'HEAD svarar utan kropp');

    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const rejected = await fetch(`${baseUrl}/data/derived/parti.json`, { method });
      assert.equal(rejected.status, 405, `${method} avvisas`);
      assert.equal(rejected.headers.get('allow'), 'GET, HEAD, OPTIONS');
      assert.equal(rejected.headers.get('access-control-allow-origin'), '*');
    }

    // A preflight asks about the method, not the resource, so an unknown
    // address is answered the same way as a known one.
    for (const target of ['/data/derived/parti.json', '/data/finns-inte.json']) {
      const preflight = await fetch(`${baseUrl}${target}`, { method: 'OPTIONS' });
      assert.equal(preflight.status, 204, `${target} svarar på preflight`);
      assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
      assert.equal(preflight.headers.get('access-control-allow-methods'), 'GET, HEAD, OPTIONS');
      assert.match(preflight.headers.get('access-control-allow-headers'), /If-None-Match/);
      assert.equal(preflight.headers.get('access-control-max-age'), '86400');
    }

    const partyResource = await fetch(`${baseUrl}/data/parti/${current.filnamn}/index.json`);
    assert.equal(partyResource.status, 200);
    assert.equal((await partyResource.json()).uuid, current.uuid, 'partiets registerfil kommer ur samma register');

    const movedResource = await fetch(
      `${baseUrl}/data/parti/${previous.tidigare_filnamn[0]}/index.json`,
      { redirect: 'manual' }
    );
    assert.equal(movedResource.status, 308);
    assert.equal(
      new URL(movedResource.headers.get('location'), baseUrl).pathname,
      `/data/parti/${previous.filnamn}/index.json`
    );
    assert.equal(movedResource.headers.get('access-control-allow-origin'), '*');

    const missingResource = await fetch(`${baseUrl}/data/parti/finns-inte/index.json`);
    assert.equal(missingResource.status, 404);
    assert.equal(missingResource.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.equal(missingResource.headers.get('access-control-allow-origin'), '*');
    assert.deepEqual(await missingResource.json(), { fel: 'Okänd resurs' });

    const candidateFile = path.join(projectRoot, 'data', 'val', '2018', 'kandidatlistor', 'gotenes-framtid.json');
    assert.ok(
      fs.existsSync(candidateFile),
      'kandidatfilen finns kvar — peka provet på en annan fil under val/<år>/kandidatlistor/ om den flyttats'
    );
    const withProfile = parties.find(party =>
      fs.existsSync(path.join(projectRoot, 'data', 'parti', party.filnamn, 'profil.json')));
    assert.ok(withProfile, 'något parti har en profil.json att hålla utanför /data/');
    for (const target of [
      '/data/val/2018/kandidatlistor/gotenes-framtid.json',
      `/data/parti/${withSymbol.filnamn}/${withSymbol.partisymbol.filnamn}`,
      `/data/parti/${withProfile.filnamn}/profil.json`,
      '/data/parti/kodbyten.json',
      '/data/valresultat/riksdag-partikopplingar.json',
      '/data/val/2022/valresultat/scb-tabeller.json',
      '/data/derived/',
      '/data/%2e%2e/package.json',
      '/data/parti/%2e%2e/kodbyten.json',
      '/data/derived%2fparti.json',
      '/data/derived/parti.json%00',
      '/data/DERIVED/parti.json'
    ]) {
      const forbidden = await fetch(`${baseUrl}${target}`, { redirect: 'manual' });
      assert.equal(forbidden.status, 404, `${target} lämnas inte ut`);
    }

    // Addresses the framework normalises itself. What is locked is that nothing
    // outside the allowlist is served, not which status Next picks: at most one
    // redirect is followed, it stays under /data/, and a 200 can only be the
    // resource the normalised address names.
    for (const target of ['/data/derived', '/data/derived//parti.json', '/data/derived/parti.json/']) {
      let normalised = await fetch(`${baseUrl}${target}`, { redirect: 'manual' });
      if (normalised.status >= 300 && normalised.status < 400) {
        const location = new URL(normalised.headers.get('location'), baseUrl);
        assert.equal(location.origin, baseUrl, `${target} vidarebefordras inom sajten`);
        assert.ok(location.pathname.startsWith('/data/'), `${target} vidarebefordras inom /data/`);
        normalised = await fetch(location, { redirect: 'manual' });
      }
      assert.ok([200, 404].includes(normalised.status), `${target} slutar på 200 eller 404`);
      if (normalised.status === 200) {
        assert.ok(
          Buffer.from(await normalised.arrayBuffer()).equals(registryFile),
          `${target} kan bara nå registret`
        );
      }
    }

    const traversal = await rawRequest(port, '/data/../package.json');
    assert.notEqual(traversal.status, 200, 'en rå ../-sökväg lämnar inte ut något utanför data/');

    assert.equal((await fetch(`${baseUrl}/api/data/derived/parti.json`)).status, 200, 'routens egen adress fungerar');

    const participationFile = JSON.parse(fs.readFileSync(
      path.join(projectRoot, 'data', 'val', latest, 'partideltagande', 'partier.json'), 'utf8'
    ));
    const participation = await fetch(`${baseUrl}/data/val/${latest}/partideltagande/partier.json`);
    assert.equal(participation.status, 200);
    assert.equal((await participation.json()).length, participationFile.length);

    const resultYear = String(chamberResult.valar);
    assert.equal((await fetch(`${baseUrl}/data/val/${resultYear}/valresultat/riksdag.json`)).status, 200);
    const latestResult = await fetch(`${baseUrl}/data/val/${latest}/valresultat/riksdag.json`);
    assert.equal(
      latestResult.status,
      fs.existsSync(path.join(projectRoot, 'data', 'val', latest, 'valresultat', 'riksdag.json')) ? 200 : 404,
      `valresultatet ${latest} svarar efter om filen finns`
    );

    const dataPage = await fetch(`${baseUrl}/data/`);
    assert.equal(dataPage.status, 200);
    const dataBody = await dataPage.text();
    assert.match(dataBody, /<title[^>]*>Data – Partidata<\/title>/);
    assert.match(dataBody, /<link rel="canonical" href="https:\/\/www\.partidata\.se\/data\/"[^>]*>/);
    assert.match(dataBody, /Access-Control-Allow-Origin/, 'sidan dokumenterar CORS-huvudet');
    assert.match(dataBody, /CC0/, 'sidan anger licensen');
    const documented = [...new Set([...dataBody.matchAll(/href="(\/data\/[^"]+)"/g)].map(match => match[1]))];
    assert.ok(documented.length >= 8, 'adresstabellen länkar till resurserna');
    for (const address of documented) {
      const linked = await fetch(`${baseUrl}${address}`, { redirect: 'manual' });
      assert.equal(linked.status, 200, `${address} på dokumentationssidan svarar 200`);
    }

    assert.match(homeBody, /href="\/data\/"/, 'navigationen länkar till dokumentationssidan');
    assert.match(
      profileBody,
      new RegExp(`href="/data/parti/${current.filnamn}/index\\.json"`),
      'partisidans registerdata pekar på Partidata'
    );
    assert.doesNotMatch(
      profileBody,
      new RegExp(`github\\.com/swedev/partidata/blob/main/data/parti/${current.filnamn}/index\\.json`),
      'registerdatalänken pekar inte längre på GitHub'
    );

    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.equal(health.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await health.json(), { status: 'ok', version }, 'hälsokontrollen anger versionen som byggdes');

    assert.match(homeBody, new RegExp(`Version <!-- -->${version.replace(/\./g, '\\.')}`), 'sidfoten visar versionen');
    console.log('HTTP-smoke passerade');
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill('SIGTERM');
      await exited;
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
