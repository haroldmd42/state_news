const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = data.length;
  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  typeBuf.copy(chunk, 4);
  data.copy(chunk, 8);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function createPNG(width, height, getPixel) {
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y);
      const pixelOffset = rowOffset + 1 + x * 4;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

// Signed distance to rounded rectangle
function sdRoundedBox(x, y, cx, cy, w, h, r) {
  const dx = Math.abs(x - cx) - (w - r);
  const dy = Math.abs(y - cy) - (h - r);
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(dx, dy), 0) - r;
}

// Sample color at normalized coordinate (u, v) in [0, 1]
function samplePoint(u, v, size) {
  // Rounded squircle container
  const boxDist = sdRoundedBox(u, v, 0.5, 0.5, 0.46, 0.46, 0.14);
  if (boxDist > 0) {
    return [0, 0, 0, 0]; // Transparent outside
  }

  // Border
  const borderWidth = size <= 32 ? -0.055 : -0.045;
  const isBorder = boxDist > borderWidth;
  if (isBorder) {
    // Warm amber border #DD700B
    return [221, 112, 11, 240];
  }

  // Background inside container: deep luxury charcoal #141615
  let r = 20, g = 22, b = 21, a = 255;

  // Layer 1: Top Diamond (Hero Amber-Orange #DD700B with light amber apex)
  const dHalfW = size <= 32 ? 0.30 : 0.28;
  const dHalfH = size <= 32 ? 0.15 : 0.14;
  const dCenterY = size <= 32 ? 0.29 : 0.30;
  const dx1 = Math.abs(u - 0.5) / dHalfW;
  const dy1 = Math.abs(v - dCenterY) / dHalfH;
  if (dx1 + dy1 <= 1.0) {
    if (v < dCenterY) {
      return [245, 145, 45, 255]; // Highlights
    }
    return [221, 112, 11, 255]; // #DD700B
  }

  // Layer 2: Middle Chevron (Warm Ivory Cream #FCF8D8)
  const chevronThick = size <= 32 ? 0.11 : 0.085;
  const distU = Math.abs(u - 0.5);
  if (distU <= dHalfW) {
    const ridgeY2 = (size <= 32 ? 0.55 : 0.56) - (distU / dHalfW) * 0.13;
    if (v >= ridgeY2 && v <= ridgeY2 + chevronThick) {
      return [252, 248, 216, 255]; // #FCF8D8
    }
  }

  // Layer 3: Bottom Chevron (Slate Silver #ADACA7)
  if (distU <= dHalfW) {
    const ridgeY3 = (size <= 32 ? 0.72 : 0.73) - (distU / dHalfW) * 0.13;
    if (v >= ridgeY3 && v <= ridgeY3 + chevronThick) {
      return [173, 172, 167, 255]; // #ADACA7
    }
  }

  return [r, g, b, a];
}

// 4x Supersampled anti-aliased renderer
function renderIcon(size) {
  const SAMPLES = 4;
  return createPNG(size, size, (px, py) => {
    let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
    for (let sy = 0; sy < SAMPLES; sy++) {
      for (let sx = 0; sx < SAMPLES; sx++) {
        const u = (px + (sx + 0.5) / SAMPLES) / size;
        const v = (py + (sy + 0.5) / SAMPLES) / size;
        const [r, g, b, a] = samplePoint(u, v, size);
        sumR += (r * a) / 255;
        sumG += (g * a) / 255;
        sumB += (b * a) / 255;
        sumA += a;
      }
    }
    const total = SAMPLES * SAMPLES;
    const finalA = Math.round(sumA / total);
    if (finalA === 0) return [0, 0, 0, 0];
    const finalR = Math.round((sumR / total) * 255 / finalA);
    const finalG = Math.round((sumG / total) * 255 / finalA);
    const finalB = Math.round((sumB / total) * 255 / finalA);
    return [finalR, finalG, finalB, finalA];
  });
}

const assetsDir = path.join(__dirname);
[16, 32, 48, 128].forEach(size => {
  const buf = renderIcon(size);
  const filePath = path.join(assetsDir, `icon${size}.png`);
  fs.writeFileSync(filePath, buf);
  console.log(`Creado ${filePath} (${buf.length} bytes)`);
});

// Also create vector icon.svg
const svgContent = `<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="5" y="5" width="118" height="118" rx="24" fill="#141615" stroke="#DD700B" stroke-width="6"/>
  <path d="M64 22L99 39L64 56L29 39L64 22Z" fill="#DD700B"/>
  <path d="M29 55L64 72L99 55" stroke="#FCF8D8" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M29 76L64 93L99 76" stroke="#ADACA7" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
fs.writeFileSync(path.join(assetsDir, 'icon.svg'), svgContent);
console.log('Creado icon.svg');
