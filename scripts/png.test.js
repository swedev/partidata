const assert = require('node:assert/strict');
const test = require('node:test');

const { contentBox, readHeader } = require('./png.js');
const { png, sheet, WHITE, CLEAR, INK } = require('./fixtures/png.js');

test('the content box ignores a transparent margin', () => {
  assert.deepEqual(contentBox(png(sheet(CLEAR))), {
    bild: { bredd: 10, hojd: 6 },
    bildyta: { x: 3, y: 1, bredd: 4, hojd: 2 }
  });
});

test('the content box ignores a white margin', () => {
  assert.deepEqual(contentBox(png(sheet(WHITE), { colorType: 2 })).bildyta, { x: 3, y: 1, bredd: 4, hojd: 2 });
});

test('a nearly white margin counts as margin', () => {
  const nearlyWhite = { r: 250, g: 248, b: 252, a: 255 };
  assert.deepEqual(contentBox(png(sheet(nearlyWhite))).bildyta, { x: 3, y: 1, bredd: 4, hojd: 2 });
});

test('a mark drawn in white keeps the box its transparency gives it', () => {
  assert.deepEqual(contentBox(png(sheet(CLEAR, WHITE))).bildyta, { x: 3, y: 1, bredd: 4, hojd: 2 });
});

test('a sheet the mark fills measures the whole sheet', () => {
  const filled = sheet(INK, INK, { width: 4, height: 3, x: 0, y: 0, markWidth: 4, markHeight: 3 });
  assert.deepEqual(contentBox(png(filled)), {
    bild: { bredd: 4, hojd: 3 },
    bildyta: { x: 0, y: 0, bredd: 4, hojd: 3 }
  });
});

test('greyscale and greyscale with alpha measure the same box', () => {
  const grey = { r: 30, g: 30, b: 30, a: 255 };
  assert.deepEqual(contentBox(png(sheet(WHITE, grey), { colorType: 0 })).bildyta, { x: 3, y: 1, bredd: 4, hojd: 2 });
  assert.deepEqual(contentBox(png(sheet(CLEAR, grey), { colorType: 4 })).bildyta, { x: 3, y: 1, bredd: 4, hojd: 2 });
});

test('filtered scanlines are restored before they are measured', () => {
  assert.deepEqual(contentBox(png(sheet(CLEAR), { filters: [0, 1, 2, 3, 4] })).bildyta, { x: 3, y: 1, bredd: 4, hojd: 2 });
});

test('an empty sheet has no content box', () => {
  assert.equal(contentBox(png(sheet(CLEAR, CLEAR))), null);
});

test('formats the reader leaves unmeasured return null', () => {
  assert.equal(contentBox(png(sheet(CLEAR), { interlace: 1 })), null);
  assert.equal(contentBox(png(sheet(CLEAR), { bitDepth: 16 })), null);
  assert.equal(contentBox(Buffer.from('not a png at all, not even close')), null);
});

test('the header reports the sheet the symbol was delivered on', () => {
  assert.deepEqual(readHeader(png(sheet(CLEAR))), {
    bredd: 10,
    hojd: 6,
    bitDepth: 8,
    colorType: 6,
    interlace: 0
  });
  assert.equal(readHeader(Buffer.alloc(4)), null);
});
