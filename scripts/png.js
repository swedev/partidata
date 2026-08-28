const zlib = require('node:zlib');

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * CHANNELS
 * Samples per pixel for the colour types this reader decodes. Palette images
 * (type 3) are absent from Valmyndigheten's symbols and are left unread.
 * @type {Object}
 */
const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

/**
 * WHITE_FLOOR
 * A channel value at or above this counts as the paper the symbol is drawn on,
 * so a sheet with a white margin measures the same as one with a transparent
 * margin.
 * @type {Number}
 */
const WHITE_FLOOR = 243;

/**
 * ALPHA_FLOOR
 * Below this an edge pixel contributes too little to move the content box.
 * @type {Number}
 */
const ALPHA_FLOOR = 16;

/**
 * readHeader
 * @param  {Buffer} data
 * @return {Object|null} IHDR fields, or null when the buffer is not a PNG
 */
function readHeader (data) {
  if (data.length < 33 || !data.subarray(0, 8).equals(SIGNATURE)) {
    return null;
  }
  if (data.toString('latin1', 12, 16) !== 'IHDR') {
    return null;
  }
  return {
    bredd: data.readUInt32BE(16),
    hojd: data.readUInt32BE(20),
    bitDepth: data[24],
    colorType: data[25],
    interlace: data[28]
  };
}

/**
 * readPixelData
 * Concatenates and inflates the IDAT chunks.
 * @param  {Buffer} data
 * @return {Buffer}
 */
function readPixelData (data) {
  const parts = [];
  let offset = 8;
  while (offset + 8 <= data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.toString('latin1', offset + 4, offset + 8);
    if (type === 'IDAT') {
      parts.push(data.subarray(offset + 8, offset + 8 + length));
    } else if (type === 'IEND') {
      break;
    }
    offset += length + 12;
  }
  return zlib.inflateSync(Buffer.concat(parts));
}

/**
 * paeth
 * @param  {Number} a Left
 * @param  {Number} b Above
 * @param  {Number} c Upper left
 * @return {Number}
 */
function paeth (a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * unfilterRow
 * Reverses the per-scanline filter in place, reading the already restored row
 * above.
 * @param  {Number} filter
 * @param  {Buffer} row
 * @param  {Buffer} previous
 * @param  {Number} pixelBytes
 */
function unfilterRow (filter, row, previous, pixelBytes) {
  for (let i = 0; i < row.length; i++) {
    const left = i >= pixelBytes ? row[i - pixelBytes] : 0;
    const above = previous[i];
    const upperLeft = i >= pixelBytes ? previous[i - pixelBytes] : 0;
    switch (filter) {
      case 0: break;
      case 1: row[i] = (row[i] + left) & 0xff; break;
      case 2: row[i] = (row[i] + above) & 0xff; break;
      case 3: row[i] = (row[i] + ((left + above) >> 1)) & 0xff; break;
      case 4: row[i] = (row[i] + paeth(left, above, upperLeft)) & 0xff; break;
      default: throw new Error(`Unknown PNG filter type ${filter}`);
    }
  }
}

/**
 * sampleReader
 * @param  {Number} colorType
 * @return {Function} Row and pixel index to { grey|red, green, blue, alpha }
 */
function sampleReader (colorType) {
  const pixelBytes = CHANNELS[colorType];
  if (colorType === 0) {
    return (row, index) => {
      const value = row[index * pixelBytes];
      return { r: value, g: value, b: value, a: 255 };
    };
  }
  if (colorType === 4) {
    return (row, index) => {
      const value = row[index * pixelBytes];
      return { r: value, g: value, b: value, a: row[index * pixelBytes + 1] };
    };
  }
  if (colorType === 2) {
    return (row, index) => ({
      r: row[index * pixelBytes],
      g: row[index * pixelBytes + 1],
      b: row[index * pixelBytes + 2],
      a: 255
    });
  }
  return (row, index) => ({
    r: row[index * pixelBytes],
    g: row[index * pixelBytes + 1],
    b: row[index * pixelBytes + 2],
    a: row[index * pixelBytes + 3]
  });
}

/**
 * boxFrom
 * @param  {Object} bounds
 * @param  {Number} width
 * @param  {Number} height
 * @return {Object|null} { x, y, bredd, hojd }
 */
function boxFrom (bounds, width, height) {
  if (bounds.left > bounds.right) {
    return null;
  }
  return {
    x: bounds.left,
    y: bounds.top,
    bredd: Math.min(bounds.right - bounds.left + 1, width),
    hojd: Math.min(bounds.bottom - bounds.top + 1, height)
  };
}

/**
 * contentBox
 * Measures where the drawing sits inside the sheet it was delivered on. Symbols
 * arrive on a fixed canvas with the mark placed anywhere inside it, so the box
 * is what lets a renderer show every symbol at the same optical size.
 *
 * The visible box ignores both transparent and white margins; the opaque box
 * ignores only transparent ones, and carries a symbol drawn entirely in white.
 * @param  {Buffer} data
 * @return {Object|null} { bild: { bredd, hojd }, bildyta: { x, y, bredd, hojd } },
 *                       or null when the format is one this reader leaves unmeasured
 */
function contentBox (data) {
  const header = readHeader(data);
  if (!header || header.bitDepth !== 8 || header.interlace !== 0 || !CHANNELS[header.colorType]) {
    return null;
  }

  const { bredd: width, hojd: height, colorType } = header;
  const pixelBytes = CHANNELS[colorType];
  const rowBytes = width * pixelBytes;
  const pixels = readPixelData(data);
  if (pixels.length < (rowBytes + 1) * height) {
    return null;
  }

  const sample = sampleReader(colorType);
  const visible = { left: width, right: -1, top: height, bottom: -1 };
  const opaque = { left: width, right: -1, top: height, bottom: -1 };
  let previous = Buffer.alloc(rowBytes);
  let row = Buffer.alloc(rowBytes);

  for (let y = 0; y < height; y++) {
    const start = y * (rowBytes + 1);
    pixels.copy(row, 0, start + 1, start + 1 + rowBytes);
    unfilterRow(pixels[start], row, previous, pixelBytes);
    for (let x = 0; x < width; x++) {
      const { r, g, b, a } = sample(row, x);
      if (a < ALPHA_FLOOR) continue;
      if (x < opaque.left) opaque.left = x;
      if (x > opaque.right) opaque.right = x;
      if (y < opaque.top) opaque.top = y;
      if (y > opaque.bottom) opaque.bottom = y;
      if (r >= WHITE_FLOOR && g >= WHITE_FLOOR && b >= WHITE_FLOOR) continue;
      if (x < visible.left) visible.left = x;
      if (x > visible.right) visible.right = x;
      if (y < visible.top) visible.top = y;
      if (y > visible.bottom) visible.bottom = y;
    }
    const done = previous;
    previous = row;
    row = done;
  }

  const bildyta = boxFrom(visible, width, height) || boxFrom(opaque, width, height);
  return bildyta ? { bild: { bredd: width, hojd: height }, bildyta } : null;
}

exports.contentBox = contentBox;
exports.readHeader = readHeader;
