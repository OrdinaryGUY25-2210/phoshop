"use strict";
/* Penulis PSD (RGB 8/16-bit, layer penuh, grup folder, RLE PackBits) */
const PSD_BLEND_KEYS = {
  "source-over": "norm", multiply: "mul ", screen: "scrn", overlay: "over",
  darken: "dark", lighten: "lite", "color-dodge": "div ", "color-burn": "idiv",
  "hard-light": "hard", "soft-light": "sftl", difference: "diff", exclusion: "extn",
  hue: "hue ", saturation: "sat ", color: "colr", luminosity: "lum ",
};

function psdPackRow(src) {
  const out = [], n = src.length;
  let i = 0;
  while (i < n) {
    let r = 1;
    while (i + r < n && src[i + r] === src[i] && r < 128) r++;
    if (r >= 3) { out.push((1 - r) & 255, src[i]); i += r; continue; }
    const start = i;
    i++;
    while (i < n && i - start < 128) {
      let r2 = 1;
      while (i + r2 < n && src[i + r2] === src[i] && r2 < 128) r2++;
      if (r2 >= 3) break;
      i++;
    }
    const len = i - start;
    out.push(len - 1);
    for (let k = 0; k < len; k++) out.push(src[start + k]);
  }
  return out;
}
function psdRLE(plane, rowLen, h) {
  const counts = [], data = [];
  for (let y = 0; y < h; y++) {
    const row = psdPackRow(plane.subarray(y * rowLen, (y + 1) * rowLen));
    counts.push(row.length);
    for (const b of row) data.push(b);
  }
  const out = new Uint8Array(2 * h + data.length);
  let o = 0;
  for (const c of counts) { out[o++] = c >> 8; out[o++] = c & 255; }
  out.set(data, o);
  return out;
}
function psd16(plane) {
  const n = plane.length, out = new Uint8Array(n * 2);
  for (let i = 0; i < n; i++) { const v = plane[i]; out[i * 2] = v; out[i * 2 + 1] = v; }
  return out;
}
function psdPascalName(name) {
  const s = (name || "Layer").replace(/[^\x20-\x7e]/g, "?").slice(0, 255);
  const b = new Uint8Array(Math.ceil((1 + s.length) / 4) * 4);
  b[0] = s.length;
  for (let i = 0; i < s.length; i++) b[1 + i] = s.charCodeAt(i);
  return b;
}

function buildPSD(doc) {
  const { w, h, records, comp } = doc;
  const depth = doc.depth === 16 ? 16 : 8;
  const rowLen = w * depth / 8;
  const rle = plane => depth === 16 ? psdRLE(psd16(plane), rowLen, h) : psdRLE(plane, rowLen, h);
  const parts = [];
  let total = 0;
  const push = arr => { parts.push(arr); total += arr.length; };
  const u16 = v => push(new Uint8Array([v >> 8 & 255, v & 255]));
  const u32 = v => push(new Uint8Array([v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255]));
  const raw = s => push(new Uint8Array([...s].map(c => c.charCodeAt(0))));

  /* Header */
  raw("8BPS"); u16(1); push(new Uint8Array(6)); u16(3); u32(h); u32(w); u16(depth); u16(3);
  u32(0); /* color mode data */
  u32(0); /* image resources */

  /* Layer & mask info */
  const layerRecs = [];
  const layerData = [];
  for (const rec of records) {
    const divider = rec.divider || rec.groupStart;
    const chans = divider ? null : [
      [0, rle(rec.r)],
      [1, rle(rec.g)],
      [2, rle(rec.b)],
      [65535, rle(rec.a)],
    ];
    const rb = [];
    const ru16 = v => rb.push(v >> 8 & 255, v & 255);
    const ru32 = v => rb.push(v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255);
    const rraw = s => { for (let i = 0; i < s.length; i++) rb.push(s.charCodeAt(i)); };
    const pushU32 = (arr, v) => arr.push(v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255);
    if (divider) {
      ru32(0); ru32(0); ru32(0); ru32(0);
      ru16(4);
      for (const id of [-1, 0, 1, 2]) { ru16(id === -1 ? 65535 : id); ru32(2); }
      rraw("8BIM"); rraw("norm");
      rb.push(0); rb.push(0); rb.push(rec.visible === false ? 2 : 0); rb.push(0);
      const extra = [];
      pushU32(extra, 0); pushU32(extra, 0);
      for (const b of psdPascalName(rec.name)) extra.push(b);
      extra.push(0x38, 0x42, 0x49, 0x4d, 0x6c, 0x73, 0x63, 0x74);
      if (rec.groupStart) {
        pushU32(extra, 12); pushU32(extra, rec.groupStart);
        extra.push(0x38, 0x42, 0x49, 0x4d, 0x70, 0x61, 0x73, 0x73);
      } else {
        pushU32(extra, 4); pushU32(extra, 3);
      }
      ru32(extra.length);
      for (const b of extra) rb.push(b);
    } else {
      ru32(0); ru32(0); ru32(h); ru32(w);
      ru16(4);
      for (const [id, d] of chans) { ru16(id); ru32(2 + d.length); }
      rraw("8BIM"); rraw(PSD_BLEND_KEYS[rec.blend] || "norm");
      rb.push(Math.max(0, Math.min(255, rec.opacity | 0)));
      rb.push(0); rb.push(rec.visible === false ? 2 : 0); rb.push(0);
      const extra = [];
      pushU32(extra, 0); pushU32(extra, 0);
      for (const b of psdPascalName(rec.name)) extra.push(b);
      ru32(extra.length);
      for (const b of extra) rb.push(b);
    }
    layerRecs.push(new Uint8Array(rb));
    if (divider) {
      for (let c = 0; c < 4; c++) layerData.push(new Uint8Array([0, 0]));
    } else {
      for (const [, d] of chans) {
        layerData.push(new Uint8Array([0, 1])); /* compression 1 = RLE */
        layerData.push(d);
      }
    }
  }
  let layerInfoLen = 2;
  for (const r of layerRecs) layerInfoLen += r.length;
  for (const d of layerData) layerInfoLen += d.length;
  const padLen = layerInfoLen % 2;
  layerInfoLen += padLen;

  u32(4 + layerInfoLen + 4); /* panjang layer & mask info */
  u32(layerInfoLen);
  u16(records.length);
  for (const r of layerRecs) push(r);
  for (const d of layerData) push(d);
  if (padLen) push(new Uint8Array([0]));
  u32(0); /* global layer mask */

  /* Composite image */
  const chR = rle(comp.r), chG = rle(comp.g), chB = rle(comp.b);
  u16(1);
  push(chR); push(chG); push(chB);

  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/* ---- wrapper browser ---- */
function psdPlanesFromCanvas(c) {
  const w = c.width, h = c.height;
  const d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const n = w * h;
  const r = new Uint8Array(n), g = new Uint8Array(n), b = new Uint8Array(n), a = new Uint8Array(n);
  for (let i = 0; i < n; i++) { r[i] = d[i * 4]; g[i] = d[i * 4 + 1]; b[i] = d[i * 4 + 2]; a[i] = d[i * 4 + 3]; }
  return { r, g, b, a };
}
function psdScaleCanvas(c, w, h) {
  const t = document.createElement("canvas");
  t.width = w; t.height = h;
  const x = t.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = "high";
  x.drawImage(c, 0, 0, w, h);
  return t;
}
function exportPSD(depth, scale) {
  depth = depth === 16 ? 16 : 8;
  scale = scale || 1;
  const w = Math.max(1, Math.round(App.docW * scale));
  const h = Math.max(1, Math.round(App.docH * scale));
  const planes = c => (c.width === w && c.height === h) ? psdPlanesFromCanvas(c) : psdPlanesFromCanvas(psdScaleCanvas(c, w, h));
  const groupIds = new Set(App.layers.filter(l => l.isGroup).map(l => l.id));
  const records = [];
  for (const l of App.layers) {
    if (l.group && groupIds.has(l.group)) continue;
    if (l.isGroup) {
      records.push({ name: l.name, opacity: 255, visible: l.visible, groupStart: l.expanded === false ? 2 : 1 });
      for (const m of App.layers) if (m.group === l.id) records.push({ name: m.name, opacity: Math.round(m.opacity * 2.55), visible: m.visible, blend: m.blendMode, ...planes(m.canvas) });
      records.push({ name: "</Layer group>", opacity: 255, visible: false, divider: 3 });
    } else {
      records.push({ name: l.name, opacity: Math.round(l.opacity * 2.55), visible: l.visible, blend: l.blendMode, ...planes(l.canvas) });
    }
  }
  const comp = planes(compositeToCanvas(false));
  const bytes = buildPSD({ w, h, records, comp, depth });
  const blob = new Blob([bytes], { type: "image/vnd.adobe.photoshop" });
  const a = document.createElement("a");
  const tag = (depth === 16 ? "16bit" : "8bit") + (scale !== 1 ? "-" + Math.round(scale * 100) : "");
  a.download = "pslite-" + tag + "-" + stampName() + ".psd";
  a.href = URL.createObjectURL(blob);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast("PSD " + depth + "-bit " + w + "×" + h + " diekspor (" + (bytes.length / 1048576).toFixed(2) + " MB) — lapisan + folder ikut");
}
