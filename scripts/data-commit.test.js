const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { readDataCommit } = require('../src/server/data-commit.ts');

const HASH = '0123456789abcdef0123456789abcdef01234567';

/** A working directory with the given `data-commit`, or none when omitted. */
function makeRoot (contents) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'partidata-commit-'));
  if (contents !== undefined) fs.writeFileSync(path.join(root, 'data-commit'), contents);
  return root;
}

test('a working directory without the file has no commit', async () => {
  assert.equal(await readDataCommit(makeRoot()), undefined);
});

test('a commit hash is read back, with or without a trailing newline', async () => {
  assert.equal(await readDataCommit(makeRoot(`${HASH}\n`)), HASH);
  assert.equal(await readDataCommit(makeRoot(HASH)), HASH);
  assert.equal(await readDataCommit(makeRoot(`  ${HASH}  \n`)), HASH);
});

test('anything that is not a commit hash is no commit', async () => {
  for (const junk of ['', 'main', HASH.slice(0, 39), `${HASH}0`, HASH.toUpperCase(), `${HASH} ${HASH}`]) {
    assert.equal(await readDataCommit(makeRoot(junk)), undefined, `"${junk}" är ingen commit`);
  }
});

test('a directory in place of the file is an error, not a missing commit', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'partidata-commit-'));
  fs.mkdirSync(path.join(root, 'data-commit'));
  await assert.rejects(readDataCommit(root));
});
