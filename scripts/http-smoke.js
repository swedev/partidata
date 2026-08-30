const assert = require('node:assert/strict');
const fs = require('node:fs');
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
