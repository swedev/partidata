const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const standaloneRoot = path.join(projectRoot, '.next', 'standalone');
const releaseRoot = path.join(projectRoot, '.release');

function copyDirectory (source, target) {
  if (!fs.existsSync(source)) throw new Error(`Saknar byggartefakt: ${path.relative(projectRoot, source)}`);
  fs.cpSync(source, target, { recursive: true });
}

if (!fs.existsSync(path.join(standaloneRoot, 'server.js'))) {
  throw new Error('Saknar .next/standalone/server.js; kör next build med output: standalone först');
}

fs.rmSync(releaseRoot, { recursive: true, force: true });
fs.mkdirSync(releaseRoot, { recursive: true });
copyDirectory(standaloneRoot, releaseRoot);
copyDirectory(path.join(projectRoot, 'public'), path.join(releaseRoot, 'public'));
copyDirectory(path.join(projectRoot, '.next', 'static'), path.join(releaseRoot, '.next', 'static'));
copyDirectory(path.join(projectRoot, 'data'), path.join(releaseRoot, 'data'));

for (const required of ['server.js', 'public/favicon.ico', '.next/static', 'data/parti/index.json']) {
  if (!fs.existsSync(path.join(releaseRoot, required))) throw new Error(`Ofullständig release: ${required} saknas`);
}

console.log(`Byggde ${path.relative(projectRoot, releaseRoot)}/`);
