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

function psdReader(buf, big) {
  if (!(buf instanceof Uint8Array)) buf = new Uint8Array(buf);
  const byteLength = buf.byteLength;
  const dv = new DataView(buf.buffer, buf.byteOffset, byteLength);
  const r = {
    dv, buf, byteLength, big: !!big, _p: 0,
    get pos() { return this._p || 0; },
    set pos(v) { v = Math.floor(Number(v)); this._p = v > 0 ? v : 0; },
    need(n) {
      n = Math.max(0, Math.floor(Number(n) || 0));
      if (r._p + n > r.byteLength) throw new Error("File PSD terpotong atau rusak (data melewati ukuran file)");
    },
    u8() { this.need(1); const v = dv.getUint8(this._p); this._p += 1; return v; },
    u16() { this.need(2); const v = dv.getUint16(this._p); this._p += 2; return v; },
    i16() { this.need(2); const v = dv.getInt16(this._p); this._p += 2; return v; },
    u32() { this.need(4); const v = dv.getUint32(this._p); this._p += 4; return v; },
    i32() { this.need(4); const v = dv.getInt32(this._p); this._p += 4; return v; },
    u64() { this.need(8); const hi = dv.getUint32(this._p), lo = dv.getUint32(this._p + 4); this._p += 8; return hi * 4294967296 + lo; },
    /* panjang field: 4 byte untuk PSD, 8 byte untuk PSB */
    len() { return this.big ? this.u64() : this.u32(); },
    str(n) {
      n = Math.max(0, Math.floor(Number(n) || 0));
      this.need(n);
      let s = "";
      for (let i = 0; i < n; i++) s += String.fromCharCode(buf[this._p + i]);
      this._p += n;
      return s;
    },
    skip(n) { n = Math.max(0, Math.floor(Number(n) || 0)); this.need(n); this._p += n; },
  };
  return r;
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
/* Baca satu channel (planar 8-bit hasil downsample dari 8/16/32-bit). Melempar error bila rusak;
   pemanggil yang menentukan posisi akhir, jadi kerusakan satu channel tidak menggeser channel lain. */
function psdParseChannel(r, comp, len, cw, ch, depth, target, big) {
  const bpp = Math.max(1, depth >> 3);
  const rowLen = cw * bpp;
  const buf = r.buf;
  const start = r.pos;
  const limit = Math.min(r.byteLength, start + Math.max(0, len - 2));
  if (comp === 0) {
    for (let y = 0; y < ch; y++) {
      const base = start + y * rowLen;
      if (base + rowLen > limit) break;
      const o = y * cw;
      if (bpp === 1) target.set(buf.subarray(base, base + cw), o);
      else for (let x = 0; x < cw; x++) target[o + x] = buf[base + x * bpp];
    }
  } else if (comp === 1) {
    const cs = big ? 4 : 2;
    if (start + ch * cs > limit) throw new Error("tabel RLE terpotong");
    let q = start + ch * cs;
    for (let y = 0; y < ch; y++) {
      const cRow = big ? r.dv.getUint32(start + y * 4) : r.dv.getUint16(start + y * 2);
      if (q + cRow > limit) break;
      const row = psdUnpackRow(buf.subarray(q, q + cRow), cRow, rowLen);
      const o = y * cw;
      if (bpp === 1) target.set(row.subarray(0, cw), o);
      else for (let x = 0; x < cw; x++) target[o + x] = row[x * bpp];
      q += cRow;
    }
  } else {
    console.warn("Kompresi channel", comp, "(ZIP) belum didukung, channel dikosongkan");
  }
  return target;
}
function cmykToRgb(c,m,y,k){
  c=Math.max(0,Math.min(255,c)); m=Math.max(0,Math.min(255,m)); y=Math.max(0,Math.min(255,y)); k=Math.max(0,Math.min(255,k));
  const cc=c/255,mm=m/255,yy=y/255,kk=k/255;
  const r=255*(1-cc)*(1-kk), g=255*(1-mm)*(1-kk), b=255*(1-yy)*(1-kk);
  return [Math.round(r),Math.round(g),Math.round(b)];
}
function psdCanvasFromPlanes(planes, w, h, mode) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, w); c.height = Math.max(1, h);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const img = ctx.createImageData(Math.max(1, w), Math.max(1, h));
  const m = mode || 3;
  if (m === 4 && planes[0] && planes[1] && planes[2] && planes[3]){
    const C=planes[0],M=planes[1],Y=planes[2],K=planes[3],A=planes[4];
    const sz = c.width*c.height;
    for (let i=0;i<sz;i++){
      const [r,g,b]=cmykToRgb(C[i],M[i],Y[i],K[i]);
      img.data[i*4]=r; img.data[i*4+1]=g; img.data[i*4+2]=b; img.data[i*4+3]=A?A[i]:255;
    }
  } else if (m === 1){
    const G=planes[0],A=planes[1];
    const sz = c.width*c.height;
    for (let i=0;i<sz;i++){
      const v=G?G[i]:0;
      img.data[i*4]=v; img.data[i*4+1]=v; img.data[i*4+2]=v; img.data[i*4+3]=A?A[i]:255;
    }
  } else if (m === 2 && window.__psdPalette){
    const pal=window.__psdPalette, idx=planes[0],A=planes[1];
    const sz = c.width*c.height;
    for (let i=0;i<sz;i++){
      const id=idx?idx[i]:0;
      img.data[i*4]=pal[id]||0; img.data[i*4+1]=pal[256+id]||0; img.data[i*4+2]=pal[512+id]||0; img.data[i*4+3]=A?A[i]:255;
    }
  } else {
    const R = planes[0], G = planes[1], B = planes[2], A = planes[3];
    const sz = c.width*c.height;
    for (let i = 0; i < sz; i++) {
      img.data[i * 4] = R ? R[i] : 0;
      img.data[i * 4 + 1] = G ? G[i] : (R ? R[i] : 0);
      img.data[i * 4 + 2] = B ? B[i] : (R ? R[i] : 0);
      img.data[i * 4 + 3] = A ? A[i] : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
function psdLayerCanvas(rec, docW, docH, chanData, mode) {
  const lw = Math.max(1, rec.right - rec.left), lh = Math.max(1, rec.bottom - rec.top);
  if (lw * lh > 400000000) return null;
  const planes = [null, null, null, null, null];
  const m = mode || 3;
  for (const ch of chanData) {
    if (ch.id >= 0 && ch.id <= 3) planes[ch.id] = ch.plane;
    else if (ch.id === -1) planes[4] = ch.plane;
    else if (ch.id === -2) planes[4] = planes[4] || ch.plane; // user mask as alpha
  }
  if (!planes[0] && !planes[1] && !planes[2] && !planes[3]) {
    // try to use any
  }
  const lc = document.createElement("canvas");
  lc.width = lw; lc.height = lh;
  const ctx = lc.getContext("2d", { willReadFrequently: true });
  const img = ctx.createImageData(lw, lh);
  if (m === 4 && planes[0] && planes[1] && planes[2] && planes[3]){
    const C=planes[0],MM=planes[1],Y=planes[2],K=planes[3],A=planes[4];
    for (let i=0;i<lw*lh;i++){
      const [r,g,b]=cmykToRgb(C[i],MM[i],Y[i],K[i]);
      img.data[i*4]=r; img.data[i*4+1]=g; img.data[i*4+2]=b; img.data[i*4+3]=A?A[i]:255;
    }
  } else if (m === 1){
    const G=planes[0],A=planes[1]||planes[4];
    for (let i=0;i<lw*lh;i++){
      const v=G?G[i]:0;
      img.data[i*4]=v; img.data[i*4+1]=v; img.data[i*4+2]=v; img.data[i*4+3]=A?A[i]:255;
    }
  } else if (m === 2 && window.__psdPalette){
    const pal=window.__psdPalette, idx=planes[0],A=planes[1]||planes[4];
    for (let i=0;i<lw*lh;i++){
      const id=idx?idx[i]:0;
      img.data[i*4]=pal[id]||0; img.data[i*4+1]=pal[256+id]||0; img.data[i*4+2]=pal[512+id]||0; img.data[i*4+3]=A?A[i]:255;
    }
  } else {
    const R = planes[0], G = planes[1], B = planes[2], A = planes[3]||planes[4];
    for (let i = 0; i < lw * lh; i++) {
      img.data[i * 4] = R ? R[i] : 0;
      img.data[i * 4 + 1] = G ? G[i] : (R ? R[i] : 0);
      img.data[i * 4 + 2] = B ? B[i] : (R ? R[i] : 0);
      img.data[i * 4 + 3] = A ? A[i] : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  /* kembalikan canvas seukuran layer saja; posisi (left/top) dipakai pemanggil saat menggambar */
  return lc;
}
/* kunci additional-info yang memakai panjang 8 byte di PSB */
const PSB_LONG_KEYS = new Set(["LMsk","Lr16","Lr32","Layr","Mt16","Mt32","Mtrn","Alph","FMsk","lnk2","FEid","FXid","PxSD","cinf"]);

function psdParseLayerInfo(r, depth, mode, docW, docH, end) {
  let count = Math.abs(r.i16());
  const recs = [];
  for (let i = 0; i < count; i++) {
    const rec = {
      top: r.i32(), left: r.i32(), bottom: r.i32(), right: r.i32(),
      channels: [], name: "Lapisan " + (i + 1), opacity: 255, visible: true,
      blend: "source-over", isGroup: false, skipLayer: false,
    };
    const nc = r.u16();
    if (nc > 56) throw new Error("jumlah channel layer tidak valid");
    for (let c = 0; c < nc; c++) rec.channels.push({ id: r.i16(), len: r.len() });
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
    r.skip((4 - ((nameLen + 1) % 4)) % 4);
    while (r.pos + 12 <= extraEnd) {
      const sig = r.str(4);
      if (sig !== "8BIM" && sig !== "8B64") break;
      const k = r.str(4);
      const kl = (r.big && PSB_LONG_KEYS.has(k)) ? r.u64() : r.u32();
      const kend = r.pos + kl;
      if (k === "lsct" && kl >= 4) {
        const t = r.u32();
        if (t === 1 || t === 2) { rec.isGroup = true; rec.expanded = t === 1; }
        else if (t === 3) rec.skipLayer = true;
      } else if (k === "luni" && kl > 4) {
        const n = r.u32();
        let s = "";
        for (let j = 0; j < n && r.pos + 2 <= kend; j++) s += String.fromCharCode(r.u16());
        if (s.trim()) nm = s;
      }
      r.pos = kend;
      if (r.pos > extraEnd) break;
    }
    r.pos = extraEnd;
    rec.name = nm || rec.name;
    recs.push(rec);
  }
  /* data channel per layer: posisi tiap channel ditentukan dari panjangnya, bukan dari hasil parsing */
  let truncated = false;
  for (const rec of recs) {
    const cw = Math.max(0, rec.right - rec.left), ch = Math.max(0, rec.bottom - rec.top);
    const tooBig = cw * ch > 400000000;
    const chanData = [];
    for (const chn of rec.channels) {
      const chStart = r.pos;
      const plane = new Uint8Array(cw && ch && !tooBig ? cw * ch : 0);
      if (truncated || chStart + chn.len > r.byteLength) {
        truncated = true;           // file terpotong: sisanya dibiarkan kosong
      } else if (plane.length && chn.len >= 2) {
        try {
          const comp = r.u16();
          psdParseChannel(r, comp, chn.len, cw, ch, depth, plane, r.big);
        } catch (e) { console.warn("channel layer rusak:", rec.name, e.message); }
      }
      if (!truncated) r.pos = chStart + chn.len;
      chanData.push({ id: chn.id, plane, len: chn.len });
    }
    rec.chanData = chanData;
    if (truncated) { /* tetap lanjutkan membangun layer yang sudah terbaca */ }
  }
  return recs;
}

function psdBuildLayers(recs, w, h, mode) {
  const parsedLayers = [];
  const activeGroup = [];
  for (const rec of recs) {
    if (rec.skipLayer) { activeGroup.pop(); continue; }
    if (rec.isGroup) {
      parsedLayers.push({ id: null, name: rec.name, isGroup: true, expanded: rec.expanded !== false, visible: rec.visible, opacity: Math.round(rec.opacity / 2.55), blendMode: "source-over", group: activeGroup.length ? activeGroup[activeGroup.length - 1] : null, canvas: null });
      activeGroup.push(parsedLayers.length - 1);
      continue;
    }
    const cv = psdLayerCanvas(rec, w, h, rec.chanData, mode);
    if (!cv) continue;
    parsedLayers.push({
      name: rec.name, canvas: cv, offX: rec.left, offY: rec.top, visible: rec.visible,
      opacity: Math.round(rec.opacity / 2.55), blendMode: rec.blend,
      isGroup: false, expanded: true,
      groupIndex: activeGroup.length ? activeGroup[activeGroup.length - 1] : null,
    });
    rec.chanData = null;            // lepas memori secepatnya
  }
  return parsedLayers;
}

function psdReadComposite(r, w, h, channels, nCh, depth, big) {
  const planes = [];
  const bpp = Math.max(1, depth >> 3);
  const rowLen = w * bpp;
  let comp = 0;
  try { comp = r.u16(); } catch (e) { return planes; }
  const buf = r.buf;
  const total = Math.max(channels, nCh);
  if (comp === 0) {
    let q = r.pos;
    for (let c = 0; c < nCh; c++) {
      const plane = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        const base = q + y * rowLen;
        if (base + rowLen > r.byteLength) break;
        const o = y * w;
        if (bpp === 1) plane.set(buf.subarray(base, base + w), o);
        else for (let x = 0; x < w; x++) plane[o + x] = buf[base + x * bpp];
      }
      planes.push(plane);
      q += rowLen * h;
    }
  } else if (comp === 1) {
    /* spesifikasi: tabel panjang baris untuk SEMUA channel dulu, baru datanya */
    const cs = big ? 4 : 2;
    let tbl = r.pos;
    let q = tbl + total * h * cs;
    if (q > r.byteLength) return planes;
    for (let c = 0; c < nCh; c++) {
      const plane = new Uint8Array(w * h);
      let stop = false;
      for (let y = 0; y < h; y++) {
        const idx = tbl + (c * h + y) * cs;
        const cnt = big ? r.dv.getUint32(idx) : r.dv.getUint16(idx);
        if (q + cnt > r.byteLength) { stop = true; break; }
        const row = psdUnpackRow(buf.subarray(q, q + cnt), cnt, rowLen);
        const o = y * w;
        if (bpp === 1) plane.set(row.subarray(0, w), o);
        else for (let x = 0; x < w; x++) plane[o + x] = row[x * bpp];
        q += cnt;
      }
      planes.push(plane);
      if (stop) break;
    }
  } else {
    console.warn("Kompresi komposit", comp, "tidak didukung");
  }
  return planes;
}

function parsePSD(arrayBuffer) {
  let r = psdReader(arrayBuffer, false);
  if (r.str(4) !== "8BPS") throw new Error("bukan file PSD");
  const version = r.u16();
  if (version !== 1 && version !== 2) throw new Error("versi PSD tidak didukung");
  const big = version === 2;                      // PSB (Large Document)
  r.big = big;
  r.skip(6);
  const channels = r.u16();
  const h = r.u32(), w = r.u32();
  const depth = r.u16();
  const mode = r.u16();
  if (!w || !h) throw new Error("dimensi tidak valid");
  if (w * h > 400000000) throw new Error("dokumen terlalu besar (" + w + "×" + h + ")");
  const gray = (mode === 1);

  /* color mode data (palet untuk Indexed: 768 byte, planar R/G/B) */
  const colorModeDataLen = r.u32();
  window.__psdPalette = null;
  if (colorModeDataLen > 0) {
    if (mode === 2 && colorModeDataLen >= 768) {
      const pal = new Array(768);
      for (let i = 0; i < 768; i++) pal[i] = r.u8();
      window.__psdPalette = pal;
      r.skip(colorModeDataLen - 768);
    } else r.skip(colorModeDataLen);
  }
  /* image resources */
  r.skip(r.u32());

  /* layer & mask info */
  let lmLen = 0;
  try { lmLen = r.len(); } catch (e) { lmLen = 0; }
  const lmStart = r.pos;
  const lmEnd = Math.min(lmStart + lmLen, r.byteLength);
  let parsedLayers = [];
  try {
    if (lmLen > 0) {
      const layerInfoLen = r.len();
      const liEnd = r.pos + layerInfoLen;
      let recs = null;
      if (layerInfoLen > 2) {
        recs = psdParseLayerInfo(r, depth, mode, w, h, liEnd);
        r.pos = liEnd;
      } else {
        /* PSD 16/32-bit: layer disimpan di blok tambahan Lr16 / Lr32 / Layr */
        r.pos = liEnd;
        const gmLen = r.u32(); r.skip(gmLen);
        while (r.pos + 12 <= lmEnd) {
          const sig = r.str(4);
          if (sig !== "8BIM" && sig !== "8B64") break;
          const key = r.str(4);
          const kl = (big && PSB_LONG_KEYS.has(key)) ? r.u64() : r.u32();
          const kStart = r.pos;
          if (key === "Lr16" || key === "Lr32" || key === "Layr") {
            recs = psdParseLayerInfo(r, depth, mode, w, h, kStart + kl);
            break;
          }
          r.pos = kStart + kl + ((4 - (kl % 4)) % 4);
        }
      }
      if (recs && recs.length) parsedLayers = psdBuildLayers(recs, w, h, mode);
    }
  } catch (e) {
    console.warn("Gagal membaca layer, pakai gambar komposit:", e.message);
    parsedLayers = [];
  }
  r.pos = lmEnd;

  /* gambar komposit */
  let nCh = gray ? 1 : 3;
  if (mode === 4) nCh = 4;
  if (mode === 2) nCh = 1;
  nCh = Math.min(nCh, Math.max(1, channels));
  let compPlanes = [];
  try { compPlanes = psdReadComposite(r, w, h, channels, nCh, depth, big); } catch (e) { console.warn("komposit gagal:", e.message); }
  const composite = psdCanvasFromPlanes(compPlanes, w, h, mode);

  if (!parsedLayers.length && composite) {
    parsedLayers.push({ name: "Background", canvas: composite, offX: 0, offY: 0, visible: true, opacity: 100, blendMode: "source-over", isGroup: false, expanded: true, groupIndex: null });
  }
  for (const l of parsedLayers) if (l.isGroup && !l.canvas) l.canvas = document.createElement("canvas");
  window.__psdPalette = null;
  return { w, h, depth, layers: parsedLayers, composite, mode, isPSB: big };
}
