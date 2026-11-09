// Generates the app icons in public/ with no dependencies (a tiny rasterizer + PNG encoder).
// Run with: npm run icons. The outputs are committed, so this only runs when the design changes.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const BG = [59, 42, 26]; // #3b2a1a
const RIM = [200, 161, 101]; // #c8a165
const HEAD = [244, 234, 210]; // #f4ead2
const NECK = [120, 78, 42]; // #784e2a
const STRING = [70, 60, 50];
const PEG = [200, 161, 101];

/** Shapes in a 0..1 unit square; `scale` shrinks the drawing toward the centre (maskable). */
function colorAt(x, y, scale) {
  const u = (x - 0.5) / scale + 0.5;
  const v = (y - 0.5) / scale + 0.5;
  const cx = 0.5;
  const cy = 0.66;
  const r = Math.hypot(u - cx, v - cy);
  const neckL = 0.44;
  const neckR = 0.56;
  if (r <= 0.25) {
    // Strings over the head, ending at the tailpiece.
    if (r <= 0.205) {
      for (let i = 0; i < 4; i++) {
        const sx = neckL + 0.024 + i * 0.0253;
        if (Math.abs(u - sx) < 0.0045 && v < cy + 0.15) return STRING;
      }
      return HEAD;
    }
    return RIM;
  }
  if (u >= neckL && u <= neckR && v >= 0.06 && v <= cy) {
    for (let i = 0; i < 4; i++) {
      const sx = neckL + 0.024 + i * 0.0253;
      if (Math.abs(u - sx) < 0.0045) return STRING;
    }
    return NECK;
  }
  // Tuning pegs at the top of the neck, and the 5th-string peg partway up.
  if (Math.hypot(u - (neckL - 0.03), v - 0.1) < 0.022 || Math.hypot(u - (neckR + 0.03), v - 0.1) < 0.022) return PEG;
  if (Math.hypot(u - (neckL - 0.03), v - 0.17) < 0.022 || Math.hypot(u - (neckR + 0.03), v - 0.17) < 0.022) return PEG;
  if (Math.hypot(u - (neckR + 0.03), v - 0.3) < 0.02) return PEG;
  return BG;
}

function render(size, scale) {
  const ss = 4;
  const px = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = colorAt((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size, scale);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const n = ss * ss;
      const o = (y * size + x) * 3;
      px[o] = Math.round(r / n);
      px[o + 1] = Math.round(g / n);
      px[o + 2] = Math.round(b / n);
    }
  }
  return px;
}

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const out = new URL("../public/", import.meta.url);
const icons = [
  ["apple-touch-icon.png", 180, 1],
  ["icon-192.png", 192, 1],
  ["icon-512.png", 512, 1],
  ["icon-maskable-512.png", 512, 0.78], // keep the drawing inside the maskable safe zone
];
for (const [name, size, scale] of icons) {
  writeFileSync(new URL(name, out), png(size, render(size, scale)));
  console.log(`wrote public/${name}`);
}
