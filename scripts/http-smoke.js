const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const projectRoot = path.join(__dirname, '..');
const releaseRoot = path.join(projectRoot, '.release');

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
  const current = parties.find(party => party.filnamn === 'miljopartiet-de-grona') ?? parties[0];
  const first = parties.toSorted((a, b) => new Intl.Collator('sv').compare(a.beteckning, b.beteckning))[0];
  const previous = parties.find(party => party.tidigare_filnamn?.length > 0);
  const withSymbol = parties.find(party => party.partisymbol);
  assert.ok(current);
  assert.ok(previous);
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
    assert.match(homeBody, /Sök parti på namn eller förkortning/);
    assert.match(homeBody, /Alla partier/, 'partilistan har en rubrik');
    assert.match(homeBody, new RegExp(`>${parties.length}</span>`), 'rubriken räknar partierna ur datan');
    assert.match(homeBody, new RegExp(`/parti/${first.filnamn}`), 'partigridet länkar till en partisida');
    assert.match(homeBody, /Riksdagspartier/);
    assert.match(homeBody, new RegExp(`valet (<!-- -->)?${chamber.valar}`), 'riksdagssektionen anger valåret');
    assert.match(homeBody, new RegExp(`${seats}(<!-- -->)? mandat`), 'faktaraden anger kammarens storlek');
    assert.match(homeBody, new RegExp(`${majority}(<!-- -->)? för egen majoritet`), 'faktaraden anger egen majoritet');
    assert.match(homeBody, /aria-pressed="false"/, 'valtypen renderas som en chip-grupp');
    assert.match(homeBody, /Visa fler partier \(/, 'visa fler anger hur många som återstår');

    const riksdagCards = homeBody.split('party-card--large').length - 1;
    assert.equal(riksdagCards, chamber.partier.length, 'riksdagspartierna renderas som stora partikort');

    const profile = await fetch(`${baseUrl}/parti/${current.filnamn}/`);
    assert.equal(profile.status, 200);
    assert.match(await profile.text(), /<title[^>]*>[^<]+[–-] Partidata<\/title>/);

    const redirect = await fetch(`${baseUrl}/parti/${previous.tidigare_filnamn[0]}/`, { redirect: 'manual' });
    assert.equal(redirect.status, 308);
    assert.equal(new URL(redirect.headers.get('location'), baseUrl).pathname, `/parti/${previous.filnamn}/`);

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
