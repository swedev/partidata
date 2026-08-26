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
  const parties = JSON.parse(fs.readFileSync(path.join(projectRoot, 'data', 'parti', 'index.json'), 'utf8'));
  const chamber = JSON.parse(fs.readFileSync(path.join(projectRoot, 'data', 'derived', 'partiprofil', 'riksdag.json'), 'utf8')).kammare;
  const seats = chamber.partier.reduce((total, party) => total + party.mandat, 0);
  const majority = Math.floor(seats / 2) + 1;
  assertSwedishCollation();
  const current = parties.find(party => party.filnamn === 'miljopartiet-de-grona') ?? parties[0];
  const duplicate = parties.find(party => party.filnamn === 'kommunens-val-0503');
  const withoutParticipation = parties.find(party => party.filnamn === 'angfarjepartiet');
  const expectedOrder = parties.toSorted(comparePartyOrder).slice(0, homePageSize).map(party => party.filnamn);
  const [first] = expectedOrder;
  const previous = parties.find(party => party.tidigare_filnamn?.length > 0);
  const cleanedSlug = parties.find(party =>
    party.filnamn === 'folk-natur' && party.tidigare_filnamn?.includes('folk---natur')
  );
  const withSymbol = parties.find(party => party.partisymbol);
  assert.ok(current);
  assert.equal(duplicate?.omrade, 'Hylte');
  assert.ok(withoutParticipation);
  assert.ok(previous);
  assert.ok(cleanedSlug);
  assert.ok(withSymbol);

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
    assert.match(homeBody, new RegExp(`>${parties.length}</span>`), 'rubriken räknar partierna ur datan');
    assert.match(homeBody, new RegExp(`/parti/${first}`), 'partigridet länkar till en partisida');
    assert.match(homeBody, /Riksdagspartier/);
    assert.match(homeBody, new RegExp(`valet (<!-- -->)?${chamber.valar}`), 'riksdagssektionen anger valåret');
    assert.match(homeBody, new RegExp(`${seats}(<!-- -->)? mandat`), 'faktaraden anger kammarens storlek');
    assert.match(homeBody, new RegExp(`${majority}(<!-- -->)? för egen majoritet`), 'faktaraden anger egen majoritet');
    assert.match(homeBody, /aria-pressed="false"/, 'valtypen renderas som en chip-grupp');
    assert.match(homeBody, /Visa fler partier \(/, 'visa fler anger hur många som återstår');
    assert.match(homeBody, /Alternativet \(Bromölla\)/, 'identiska partinamn får ort på korten');
    assert.match(homeBody, /Alternativet \(Ljungby\)/, 'alla synliga namndubbletter särskiljs');

    const gridLinks = partyGridLinks(homeBody);
    assert.equal(gridLinks.length, Math.min(homePageSize, parties.length), 'partigridet renderar en hel sida partier');
    assert.deepEqual(gridLinks, expectedOrder, 'partigridet följer svensk bokstavsordning');

    const riksdagCards = homeBody.split('party-card--large').length - 1;
    assert.equal(riksdagCards, chamber.partier.length, 'riksdagspartierna renderas som stora partikort');

    const profile = await fetch(`${baseUrl}/parti/${current.filnamn}/`);
    assert.equal(profile.status, 200);
    assert.match(await profile.text(), /<title[^>]*>[^<]+[–-] Partidata<\/title>/);

    const duplicateProfile = await fetch(`${baseUrl}/parti/${duplicate.filnamn}/`);
    assert.equal(duplicateProfile.status, 200);
    const duplicateBody = await duplicateProfile.text();
    assert.match(duplicateBody, /<title[^>]*>Kommunens Väl \(Hylte\) [–-] Partidata<\/title>/);
    assert.match(duplicateBody, /<h1>Kommunens Väl \(Hylte\)<\/h1>/);

    const withoutParticipationProfile = await fetch(`${baseUrl}/parti/${withoutParticipation.filnamn}/`);
    assert.equal(withoutParticipationProfile.status, 200);
    assert.match(await withoutParticipationProfile.text(), /Inget registrerat valdeltagande/);

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
    assert.deepEqual(await health.json(), { status: 'ok' });
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
