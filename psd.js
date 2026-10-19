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

/* ================= PEMBACA PSD (impor) ================= */
const PSD_BLEND_NAMES = (() => {
  const m = { norm: "source-over" };
  for (const [k, v] of Object.entries(PSD_BLEND_KEYS)) m[v] = k;
  return m;
})();

function psdReader(buf) {
  if (!(buf instanceof Uint8Array)) buf = new Uint8Array(buf);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return {
    dv, buf, _p: 0,
    get pos() { return this._p || 0; },
    set pos(v) { this._p = v; },
    u8() { const v = dv.getUint8(this._p); this._p += 1; return v; },
    u16() { const v = dv.getUint16(this._p); this._p += 2; return v; },
    i16() { const v = dv.getInt16(this._p); this._p += 2; return v; },
    u32() { const v = dv.getUint32(this._p); this._p += 4; return v; },
    i32() { const v = dv.getInt32(this._p); this._p += 4; return v; },
    str(n) {
      let s = "";
      for (let i = 0; i < n; i++) s += String.fromCharCode(dv.getUint8(this._p + i));
      this._p += n;
      return s;
    },
    skip(n) { this._p += n; },
  };
}
function psdUnpackRow(src, n, rowLen) {
  const out = new Uint8Array(rowLen);
  let i = 0, o = 0;
  while (i < n && o < rowLen) {
    const h = src[i++];
    if (h < 128) {
      const c = h + 1;
      for (let k = 0; k < c && o < rowLen && i < n; k++) out[o++] = src[i++];
    } else if (h > 128) {
      const c = 257 - h, v = i < n ? src[i++] : 0;
      for (let k = 0; k < c && o < rowLen; k++) out[o++] = v;
    }
  }
  return out;
}
function psdParseChannel(r, comp, len, cw, ch, depth, target, channelCount) {
  /* target = array of Uint8Array planes */
  const bpp = depth / 8;
  const rowLen = cw * bpp;
  const end = r.pos + Math.max(0, len - 2);
  if (comp === 0) {
    for (let y = 0; y < ch; y++) {
      const row = new Uint8Array(rowLen);
      for (let i = 0; i < rowLen; i++) row[i] = r.dv.getUint8(r.pos + y * rowLen + i);
      for (let x = 0; x < cw; x++) target[y * cw + x] = row[x * bpp];
    }
  } else if (comp === 1) {
    const counts = [];
    let total = 0;
    for (let y = 0; y < ch; y++) { const c = r.u16(); counts.push(c); total += c; }
    let q = r.pos;
    for (let y = 0; y < ch; y++) {
      const row = psdUnpackRow(r.buf.subarray(q, q + counts[y]), counts[y], rowLen);
      for (let x = 0; x < cw; x++) target[y * cw + x] = row[x * bpp];
      q += counts[y];
    }
  }
  r.pos = end;
  return target;
}
function psdCanvasFromPlanes(planes, w, h, left, top) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, w); c.height = Math.max(1, h);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const img = ctx.createImageData(Math.max(1, w), Math.max(1, h));
  const R = planes[0], G = planes[1] || planes[0], B = planes[2] || planes[0], A = planes[3];
  for (let i = 0; i < w * h; i++) {
    img.data[i * 4] = R ? R[i] : 0;
    img.data[i * 4 + 1] = G ? G[i] : 0;
    img.data[i * 4 + 2] = B ? B[i] : 0;
    img.data[i * 4 + 3] = A ? A[i] : 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
function psdLayerCanvas(rec, docW, docH, chanData) {
  const lw = Math.max(1, rec.right - rec.left), lh = Math.max(1, rec.bottom - rec.top);
  const planes = [null, null, null, null];
  for (const ch of chanData) {
    if (ch.id >= 0 && ch.id <= 2) planes[ch.id] = ch.plane;
    else if (ch.id === -1) planes[3] = ch.plane;
  }
  if (!planes[0] && !planes[1] && !planes[2]) return null;
  const lc = document.createElement("canvas");
  lc.width = lw; lc.height = lh;
  const ctx = lc.getContext("2d", { willReadFrequently: true });
  const img = ctx.createImageData(lw, lh);
  const R = planes[0], G = planes[1], B = planes[2], A = planes[3];
  for (let i = 0; i < lw * lh; i++) {
    img.data[i * 4] = R ? R[i] : 0;
    img.data[i * 4 + 1] = G ? G[i] : (R ? R[i] : 0);
    img.data[i * 4 + 2] = B ? B[i] : (R ? R[i] : 0);
    img.data[i * 4 + 3] = A ? A[i] : 255;
  }
  ctx.putImageData(img, 0, 0);
  const full = document.createElement("canvas");
  full.width = docW; full.height = docH;
  full.getContext("2d").drawImage(lc, rec.left, rec.top);
  return full;
}
function parsePSD(arrayBuffer) {
  const r = psdReader(arrayBuffer);
  if (r.str(4) !== "8BPS") throw new Error("bukan file PSD");
  const version = r.u16();
  if (version !== 1) throw new Error("versi PSD tidak didukung");
  r.skip(6);
  const channels = r.u16();
  const h = r.u32(), w = r.u32();
  const depth = r.u16();
  const mode = r.u16();
  if (!w || !h) throw new Error("dimensi tidak valid");
  if (w * h > 60000000) throw new Error("dokumen terlalu besar (maks 60 MP)");
  if (![8, 16].includes(depth)) throw new Error("kedalaman " + depth + "-bit belum didukung");
  if (mode !== 3 && mode !== 1) throw new Error("hanya RGB / Grayscale");
  const gray = mode === 1;

  r.skip(r.u32());
  r.skip(r.u32());

  const lmLen = r.u32();
  const lmStart = r.pos;
  const layers = [];
  let parsedLayers = [];
  try {
    if (lmLen > 8) {
      const lmEnd = lmStart + lmLen;
      const layerInfoLen = r.u32();
      const liEnd = r.pos + layerInfoLen;
      let count = r.i16();
      count = Math.abs(count);
      const recs = [];
      for (let i = 0; i < count; i++) {
        const rec = {
          top: r.i32(), left: r.i32(), bottom: r.i32(), right: r.i32(),
          channels: [], name: "Lapisan " + (i + 1), opacity: 255, visible: true,
          blend: "source-over", isGroup: false, skipLayer: false,
        };
        const nc = r.u16();
        for (let c = 0; c < nc; c++) rec.channels.push({ id: r.i16(), len: r.u32() });
        r.str(4);
        const key = r.str(4);
        rec.blend = PSD_BLEND_NAMES[key] || "source-over";
        rec.opacity = r.u8();
        r.u8();
        const flags = r.u8();
        rec.visible = !(flags & 2);
        r.u8();
        const extraLen = r.u32();
        const extraEnd = r.pos + extraLen;
        const maskLen = r.u32(); r.skip(maskLen);
        const rangeLen = r.u32(); r.skip(rangeLen);
        const nameLen = r.u8();
        let nm = r.str(nameLen);
        const pad = (4 - ((nameLen + 1) % 4)) % 4;
        r.skip(pad);
        while (r.pos + 12 <= extraEnd) {
          const sig = r.str(4);
          if (sig !== "8BIM" && sig !== "8B64") break;
          const k = r.str(4);
          const kl = r.u32();
          const kend = r.pos + kl;
          if (k === "lsct" && kl >= 4) {
            const t = r.u32();
            if (t === 1 || t === 2) { rec.isGroup = true; rec.expanded = t === 1; }
            else if (t === 3) rec.skipLayer = true;
          } else if (k === "luni" && kl > 4) {
            const n = r.u32();
            let s = "";
            for (let j = 0; j < n; j++) s += String.fromCharCode(r.u16());
            if (s.trim()) nm = s;
          }
          r.pos = kend;
          if (r.pos > extraEnd) break;
        }
        r.pos = extraEnd;
        rec.name = nm || rec.name;
        recs.push(rec);
      }
      /* data kanal per lapisan */
      for (const rec of recs) {
        const cw = Math.max(0, rec.right - rec.left), ch = Math.max(0, rec.bottom - rec.top);
        const chanData = [];
        for (const chn of rec.channels) {
          const comp = r.u16();
          const planes = new Uint8Array(Math.max(0, cw * ch));
          if (cw && ch) psdParseChannel(r, comp, chn.len, cw, ch, depth, planes);
          else r.pos += Math.max(0, chn.len - 2);
          chanData.push({ id: chn.id, plane: planes });
        }
        rec.chanData = chanData;
      }
      r.pos = liEnd;
      /* bangun kanvas */
      const activeGroup = [];
      for (const rec of recs) {
        if (rec.skipLayer) { activeGroup.pop(); continue; }
        if (rec.isGroup) {
          const g = { id: null, name: rec.name, isGroup: true, expanded: rec.expanded !== false, visible: rec.visible, opacity: Math.round(rec.opacity / 2.55), blendMode: "source-over", group: activeGroup.length ? activeGroup[activeGroup.length - 1] : null, canvas: null };
          parsedLayers.push(g);
          activeGroup.push(parsedLayers.length - 1);
          continue;
        }
        const cv = psdLayerCanvas(rec, w, h, rec.chanData);
        if (!cv) continue;
        parsedLayers.push({
          name: rec.name, canvas: cv, visible: rec.visible,
          opacity: Math.round(rec.opacity / 2.55), blendMode: rec.blend,
          isGroup: false, expanded: true,
          groupIndex: activeGroup.length ? activeGroup[activeGroup.length - 1] : null,
        });
      }
      r.pos = lmEnd;
    }
  } catch (e) {
    parsedLayers = [];
    r.pos = lmStart + lmLen;
  }
  r.pos = lmStart + lmLen;

  /* gambar komposit */
  const comp = r.u16();
  const compPlanes = [];
  const nCh = Math.max(1, gray ? 1 : 3);
  const rowLen = w * depth / 8;
  if (comp === 0) {
    for (let c = 0; c < nCh; c++) {
      const plane = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) plane[y * w + x] = r.dv.getUint8(r.pos + y * rowLen + x * depth / 8);
      r.pos += rowLen * h;
      compPlanes.push(plane);
    }
  } else if (comp === 1) {
    const p0 = r.pos;
    const readLayout = (perChannel) => {
      const planes = [];
      let q = p0, ok = true;
      const allCounts = [];
      if (!perChannel) {
        for (let i = 0; i < nCh * h; i++) allCounts.push(r.dv.getUint16(q + i * 2));
        q += nCh * h * 2;
        for (let c = 0; c < nCh; c++) {
          const plane = new Uint8Array(w * h);
          for (let y = 0; y < h; y++) {
            const cnt = allCounts[c * h + y];
            const row = psdUnpackRow(r.buf.subarray(q, q + cnt), cnt, rowLen);
            for (let x = 0; x < w; x++) plane[y * w + x] = row[x * depth / 8];
            q += cnt;
          }
          planes.push(plane);
        }
      } else {
        for (let c = 0; c < nCh; c++) {
          const counts = [];
          for (let y = 0; y < h; y++) counts.push(r.dv.getUint16(q + y * 2));
          q += h * 2;
          const plane = new Uint8Array(w * h);
          for (let y = 0; y < h; y++) {
            const cnt = counts[y];
            const row = psdUnpackRow(r.buf.subarray(q, q + cnt), cnt, rowLen);
            for (let x = 0; x < w; x++) plane[y * w + x] = row[x * depth / 8];
            q += cnt;
          }
          planes.push(plane);
        }
      }
      if (q > r.buf.byteLength) ok = false;
      return { planes, ok, end: q };
    };
    let res = readLayout(true);
    if (!res.ok || res.end !== r.buf.byteLength) {
      const spec = readLayout(false);
      if (spec.ok) res = spec;
    }
    res.planes.forEach(p => compPlanes.push(p));
  } else {
    throw new Error("kompresi gambar " + comp + " tidak didukung");
  }
  const composite = psdCanvasFromPlanes(compPlanes, w, h);

  if (!parsedLayers.length) {
    parsedLayers.push({ name: "Background", canvas: composite, visible: true, opacity: 100, blendMode: "source-over", isGroup: false, expanded: true, groupIndex: null });
  }
  for (const l of parsedLayers) if (l.isGroup) l.canvas = document.createElement("canvas");
  return { w, h, depth, layers: parsedLayers, composite };
}
