const zlib = require('node:zlib');

/**
 * Builds PNG files in memory so a test can state the picture it measures. The
 * chunk CRCs are left at zero, which the reader under test does not check.
 */

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

function paeth (a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function chunk (type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(0);
  return Buffer.concat([length, body, crc]);
}

/**
 * Builds a PNG from a pixel grid, so a test states the picture it measures.
 * @param  {Object[][]} pixels Rows of { r, g, b, a }
 * @param  {Object} [options] { colorType, bitDepth, interlace, filters }
 * @return {Buffer}
 */
function png (pixels, { colorType = 6, bitDepth = 8, interlace = 0, filters } = {}) {
  const height = pixels.length;
  const width = pixels[0].length;
  const pixelBytes = CHANNELS[colorType] || 4;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = bitDepth;
  header[9] = colorType;
  header[12] = interlace;

  const raw = pixels.map(row => {
    const line = Buffer.alloc(width * pixelBytes);
    row.forEach((pixel, x) => {
      const at = x * pixelBytes;
      if (colorType === 0 || colorType === 4) {
        line[at] = pixel.r;
        if (colorType === 4) line[at + 1] = pixel.a;
      } else {
        line[at] = pixel.r;
        line[at + 1] = pixel.g;
        line[at + 2] = pixel.b;
        if (colorType === 6) line[at + 3] = pixel.a;
      }
    });
    return line;
  });

  const rows = raw.map((line, y) => {
    const filter = filters ? filters[y % filters.length] : 0;
    const previous = y > 0 ? raw[y - 1] : Buffer.alloc(width * pixelBytes);
    const encoded = Buffer.alloc(line.length);
    for (let i = 0; i < line.length; i++) {
      const left = i >= pixelBytes ? line[i - pixelBytes] : 0;
      const above = previous[i];
      const upperLeft = i >= pixelBytes ? previous[i - pixelBytes] : 0;
      const subtract = filter === 1 ? left
        : filter === 2 ? above
          : filter === 3 ? (left + above) >> 1
            : filter === 4 ? paeth(left, above, upperLeft)
              : 0;
      encoded[i] = (line[i] - subtract) & 0xff;
    }
    return Buffer.concat([Buffer.from([filter]), encoded]);
  });

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const WHITE = { r: 255, g: 255, b: 255, a: 255 };
const CLEAR = { r: 0, g: 0, b: 0, a: 0 };
const INK = { r: 20, g: 40, b: 60, a: 255 };

/**
 * A sheet with the mark placed in a rectangle inside it.
 * @param  {Object} margin The pixel the margin is drawn with
 * @return {Object[][]}
 */
function sheet (margin, mark = INK, { width = 10, height = 6, x = 3, y = 1, markWidth = 4, markHeight = 2 } = {}) {
  return Array.from({ length: height }, (unusedRow, row) =>
    Array.from({ length: width }, (unusedColumn, column) =>
      row >= y && row < y + markHeight && column >= x && column < x + markWidth ? mark : margin));
}

/**
 * Exports
 */
exports.png = png;
exports.sheet = sheet;
exports.WHITE = WHITE;
exports.CLEAR = CLEAR;
exports.INK = INK;
