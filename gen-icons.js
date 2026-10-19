"use strict";
/* Generator icon PNG untuk PS Lite (tanpa dependensi eksternal) */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const FONT = {
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
};

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function makeIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    // alpha blend over existing
    const na = a / 255, oa = px[i + 3] / 255;
    const ra = na + oa * (1 - na);
    if (ra === 0) return;
    px[i] = Math.round((r * na + px[i] * oa * (1 - na)) / ra);
    px[i + 1] = Math.round((g * na + px[i + 1] * oa * (1 - na)) / ra);
    px[i + 2] = Math.round((b * na + px[i + 2] * oa * (1 - na)) / ra);
    px[i + 3] = Math.round(ra * 255);
  };
  const fillRect = (x0, y0, w, h, c) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, ...c);
  };
  const fillCircle = (cx, cy, r, c) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(x, y, ...c);
  };
  const line = (x0, y0, x1, y1, thick, c) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 2;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      fillCircle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, thick / 2, c);
    }
  };
  const drawChar = (ch, ox, oy, scale, c) => {
    const rows = FONT[ch];
    rows.forEach((row, y) => [...row].forEach((v, x) => {
      if (v === "1") fillRect(ox + x * scale, oy + y * scale, scale, scale, c);
    }));
  };

  const BG = [43, 43, 43];
  const BLUE = [58, 142, 230];
  const LIGHT = [216, 216, 216];
  fillRect(0, 0, size, size, BG);

  // accent corner bars
  const bar = Math.round(size * 0.13);
  fillRect(0, 0, Math.round(size * 0.42), bar, BLUE);
  fillRect(0, 0, bar, Math.round(size * 0.42), BLUE);

  // brush handle + tip
  const s = size;
  line(s * 0.30, s * 0.62, s * 0.66, s * 0.28, s * 0.07, LIGHT);
  fillCircle(s * 0.70, s * 0.24, s * 0.09, BLUE);

  // PS letters
  const scale = Math.max(2, Math.round(size / 22));
  const fw = 5 * scale, fh = 7 * scale, gap = scale;
  const totalW = fw * 2 + gap;
  const ox = Math.round(size * 0.12), oy = Math.round(size - fh - size * 0.10);
  drawChar("P", ox, oy, scale, [255, 255, 255]);
  drawChar("S", ox + fw + gap, oy, scale, [255, 255, 255]);

  return encodePNG(size, size, px);
}

const outDir = path.join(__dirname, "icons");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "icon-192.png"), makeIcon(192));
fs.writeFileSync(path.join(outDir, "icon-512.png"), makeIcon(512));
console.log("Icons OK:", fs.readdirSync(outDir).join(", "));
