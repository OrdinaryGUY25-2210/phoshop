"use strict";
/* PS Lite — Editor foto gaya Photoshop (desktop + mobile PWA) */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uid = (() => { let i = 1; return () => i++; })();

/* ================= STATE ================= */
const App = {
  docW: 800, docH: 600,
  layers: [], activeLayerId: null,
  tool: "brush",
  zoom: 1, panX: 0, panY: 0,
  color: "#000000", secondary: "#ffffff",
  brushSize: 24, hardness: 100, toolOpacity: 100,
  bucketTolerance: 32,
  shapeType: "rect", shapeMode: "fill",
  fontFamily: "Arial", fontSize: 42, fontBold: false, fontItalic: false,
  selection: null, cropRect: null, marqueeDraft: null,
  tempShape: null, floatSel: null,
  history: [], historyIndex: -1,
  dirty: true,
  mouse: { x: 0, y: 0, inside: false, touch: false },
  showGrid: false,
  spaceDown: false,
  stroke: null,      // brush stroke session
  eraseSnap: null,   // pre-stroke snapshot (eraser)
  drag: null,        // move/shape/crop/marquee drag session
  panDrag: null,
  pointers: new Map(),
  pinch: null,
};

const TOOLS = {
  move:    { label: "Pindah",      key: "V", icon: "✥" },
  marquee: { label: "Kotak Pilih", key: "M", icon: "▦" },
  crop:    { label: "Pangkas",     key: "C", icon: "✂" },
  brush:   { label: "Kuas",        key: "B", icon: "🖌" },
  eraser:  { label: "Penghapus",   key: "E", icon: "⌫" },
  bucket:  { label: "Ember Cat",   key: "G", icon: "🪣" },
  dropper: { label: "Penetes",     key: "I", icon: "💧" },
  text:    { label: "Teks",        key: "T", icon: "𝚃" },
  shape:   { label: "Bentuk",      key: "U", icon: "⬚" },
  zoom:    { label: "Zoom",        key: "Z", icon: "🔍" },
  hand:    { label: "Tangan",      key: "H", icon: "✋" },
};

const PALETTE = [
  "#000000","#434343","#666666","#999999","#b7b7b7","#cccccc","#d9d9d9","#ffffff",
  "#ff0000","#ff9900","#ffff00","#00ff00","#00ffff","#0000ff","#9900ff","#ff00ff",
  "#e6b800","#cc7a00","#99684f","#7a9e5c","#4f8a6e","#3d6e8a","#5c5c9e","#8a4f7a",
  "#f4cccc","#fce5cd","#fff2cc","#d9ead3","#d0e0e3","#c9daf8","#d9d2e9","#ead1dc",
];

/* ================= DOM ================= */
const view = $("#view"), vctx = view.getContext("2d");
const viewport = $("#viewport");
const composite = document.createElement("canvas"), cctx = composite.getContext("2d");
const strokeCanvas = document.createElement("canvas"), sctx = strokeCanvas.getContext("2d", { willReadFrequently: true });
let checkerPattern = null;

/* ================= UTIL ================= */
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
}
function cloneCanvas(src) {
  const c = document.createElement("canvas");
  c.width = src.width; c.height = src.height;
  c.getContext("2d").drawImage(src, 0, 0);
  return c;
}
let toastTimer = null;
function toast(msg, err) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "show" + (err ? " err" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = "", 2200);
}
function normalizeRect(x0, y0, x1, y1) {
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
}

/* ================= LAYERS ================= */
function makeCtx(c) { return c.getContext("2d", { willReadFrequently: true }); }
function createLayer(name, w = App.docW, h = App.docH) {
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  return {
    id: uid(), name, canvas, ctx: makeCtx(canvas),
    visible: true, opacity: 100, locked: false, blendMode: "source-over",
  };
}
function activeLayer() { return App.layers.find(l => l.id === App.activeLayerId) || null; }
function layerIndex(id) { return App.layers.findIndex(l => l.id === id); }

function addLayer(name, above = true) {
  const l = createLayer(name || `Lapisan ${App.layers.length + 1}`);
  const i = layerIndex(App.activeLayerId);
  const at = above ? i + 1 : i;
  App.layers.splice(clamp(at, 0, App.layers.length), 0, l);
  App.activeLayerId = l.id;
  return l;
}
function deleteLayer() {
  const i = layerIndex(App.activeLayerId);
  if (App.layers.length <= 1) return toast("Minimal satu lapisan", true);
  const l = App.layers[i];
  if (l.locked) return toast("Lapisan terkunci", true);
  App.layers.splice(i, 1);
  App.activeLayerId = App.layers[Math.max(0, i - 1)].id;
  pushHistory("Hapus Lapisan"); updateUI();
}
function duplicateLayer() {
  const src = activeLayer(); if (!src) return;
  const l = createLayer(src.name + " salinan");
  l.ctx.drawImage(src.canvas, 0, 0);
  l.opacity = src.opacity; l.blendMode = src.blendMode;
  const i = layerIndex(src.id);
  App.layers.splice(i + 1, 0, l);
  App.activeLayerId = l.id;
  pushHistory("Duplikat Lapisan"); updateUI();
}
function moveLayer(dir) {
  const i = layerIndex(App.activeLayerId);
  const j = i + dir;
  if (j < 0 || j >= App.layers.length) return;
  [App.layers[i], App.layers[j]] = [App.layers[j], App.layers[i]];
  pushHistory("Urutkan Lapisan"); updateUI();
}
function mergeDown() {
  const i = layerIndex(App.activeLayerId);
  if (i <= 0) return toast("Tidak ada lapisan di bawah", true);
  const below = App.layers[i - 1], above = App.layers[i];
  if (below.locked) return toast("Lapisan bawah terkunci", true);
  below.ctx.globalAlpha = above.opacity / 100;
  below.ctx.drawImage(above.canvas, 0, 0);
  below.ctx.globalAlpha = 1;
  App.layers.splice(i, 1);
  App.activeLayerId = below.id;
  pushHistory("Gabung Lapisan"); updateUI();
}
function flattenImage() {
  const flat = createLayer("Background");
  flat.ctx.fillStyle = "#ffffff";
  flat.ctx.fillRect(0, 0, App.docW, App.docH);
  for (const l of App.layers) {
    if (!l.visible) continue;
    flat.ctx.globalAlpha = l.opacity / 100;
    flat.ctx.globalCompositeOperation = l.blendMode;
    flat.ctx.drawImage(l.canvas, 0, 0);
  }
  flat.ctx.globalAlpha = 1; flat.ctx.globalCompositeOperation = "source-over";
  App.layers = [flat];
  App.activeLayerId = flat.id;
  pushHistory("Ratakan Gambar"); updateUI();
}

/* ================= HISTORY ================= */
function snapshot() {
  return {
    docW: App.docW, docH: App.docH, activeLayerId: App.activeLayerId,
    layers: App.layers.map(l => ({
      id: l.id, name: l.name, visible: l.visible, opacity: l.opacity,
      locked: l.locked, blendMode: l.blendMode, canvas: cloneCanvas(l.canvas),
    })),
  };
}
function pushHistory(label) {
  App.history = App.history.slice(0, App.historyIndex + 1);
  App.history.push({ label, state: snapshot() });
  if (App.history.length > 30) App.history.shift();
  App.historyIndex = App.history.length - 1;
  renderHistoryList();
}
function jumpTo(i) {
  if (i < 0 || i >= App.history.length) return;
  App.historyIndex = i;
  const s = App.history[i].state;
  App.docW = s.docW; App.docH = s.docH;
  ensureComposite();
  App.layers = s.layers.map(sl => ({
    id: sl.id, name: sl.name, visible: sl.visible, opacity: sl.opacity,
    locked: sl.locked, blendMode: sl.blendMode,
    canvas: sl.canvas, ctx: makeCtx(sl.canvas),
  }));
  App.activeLayerId = s.activeLayerId;
  App.selection = null; App.cropRect = null; App.floatSel = null;
  updateUI();
}
function undo() { if (App.historyIndex > 0) { jumpTo(App.historyIndex - 1); toast("Urungkan"); } }
function redo() { if (App.historyIndex < App.history.length - 1) { jumpTo(App.historyIndex + 1); toast("Ulangi"); } }

/* ================= CANVAS / RENDER ================= */
function ensureComposite() {
  composite.width = App.docW; composite.height = App.docH;
  strokeCanvas.width = App.docW; strokeCanvas.height = App.docH;
}
function initChecker() {
  const p = document.createElement("canvas");
  p.width = p.height = 16;
  const pc = p.getContext("2d");
  pc.fillStyle = "#ffffff"; pc.fillRect(0, 0, 16, 16);
  pc.fillStyle = "#b8b8b8"; pc.fillRect(0, 0, 8, 8); pc.fillRect(8, 8, 8, 8);
  checkerPattern = vctx.createPattern(p, "repeat");
}
function screenToDoc(sx, sy) {
  return { x: (sx - App.panX) / App.zoom, y: (sy - App.panY) / App.zoom };
}
function fitView() {
  const vw = viewport.clientWidth, vh = viewport.clientHeight;
  App.zoom = Math.min(vw / App.docW, vh / App.docH) * 0.92;
  App.panX = (vw - App.docW * App.zoom) / 2;
  App.panY = (vh - App.docH * App.zoom) / 2;
  App.dirty = true;
}
function zoomAt(factor, cx, cy) {
  const old = App.zoom;
  App.zoom = clamp(old * factor, 0.03, 48);
  App.panX = cx - (cx - App.panX) * (App.zoom / old);
  App.panY = cy - (cy - App.panY) * (App.zoom / old);
  App.dirty = true;
}

function render() {
  const dpr = window.devicePixelRatio || 1;
  const vw = viewport.clientWidth, vh = viewport.clientHeight;
  if (view.width !== Math.round(vw * dpr) || view.height !== Math.round(vh * dpr)) {
    view.width = Math.round(vw * dpr); view.height = Math.round(vh * dpr);
  }
  const ctx = vctx;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, vw, vh);
  ctx.fillStyle = "#141414";
  ctx.fillRect(0, 0, vw, vh);

  ctx.save();
  ctx.translate(App.panX, App.panY);
  ctx.scale(App.zoom, App.zoom);

  // checkerboard + composite
  ctx.fillStyle = checkerPattern || "#888";
  ctx.fillRect(0, 0, App.docW, App.docH);

  cctx.setTransform(1, 0, 0, 1, 0, 0);
  cctx.clearRect(0, 0, App.docW, App.docH);
  for (const l of App.layers) {
    if (!l.visible) continue;
    cctx.globalAlpha = l.opacity / 100;
    cctx.globalCompositeOperation = l.blendMode;
    cctx.drawImage(l.canvas, 0, 0);
  }
  cctx.globalAlpha = 1; cctx.globalCompositeOperation = "source-over";

  ctx.imageSmoothingEnabled = App.zoom < 1.5;
  ctx.drawImage(composite, 0, 0);

  // live brush stroke preview
  if (App.stroke && App.tool === "brush") {
    ctx.globalAlpha = App.toolOpacity / 100;
    ctx.drawImage(strokeCanvas, 0, 0);
    ctx.globalAlpha = 1;
  }

  // doc border + grid
  ctx.lineWidth = 1 / App.zoom;
  ctx.strokeStyle = "#5a5a5a";
  ctx.strokeRect(0, 0, App.docW, App.docH);
  if (App.showGrid) {
    ctx.strokeStyle = "rgba(120,160,220,.25)";
    ctx.lineWidth = 1 / App.zoom;
    for (let x = 50; x < App.docW; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, App.docH); ctx.stroke(); }
    for (let y = 50; y < App.docH; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(App.docW, y); ctx.stroke(); }
  }

  // overlay (doc space)
  if (App.floatSel) ctx.drawImage(App.floatSel.canvas, App.floatSel.x, App.floatSel.y);
  if (App.tempShape) drawTempShape(ctx);
  const sel = App.marqueeDraft || App.selection;
  if (App.marqueeDraft) drawMarchingAnts(ctx, App.marqueeDraft);
  else if (App.selection && !App.floatSel) drawMarchingAnts(ctx, App.selection);
  if (App.cropRect) drawCropRect(ctx);

  ctx.restore();

  // brush cursor (screen space, mouse only)
  if (App.mouse.inside && !App.mouse.touch && ["brush", "eraser", "bucket", "dropper"].includes(App.tool)) {
    const r = (App.tool === "brush" || App.tool === "eraser") ? App.brushSize * App.zoom / 2 : 6;
    ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(App.mouse.x, App.mouse.y, Math.max(2, r), 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,.6)";
    ctx.beginPath(); ctx.arc(App.mouse.x, App.mouse.y, Math.max(2, r) + 1, 0, Math.PI * 2); ctx.stroke();
  }
  App.dirty = false;
}
function drawMarchingAnts(ctx, r) {
  const z = App.zoom;
  ctx.save();
  ctx.lineWidth = 1.2 / z;
  ctx.strokeStyle = "rgba(255,255,255,.9)";
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.setLineDash([4 / z, 4 / z]);
  ctx.lineDashOffset = -(performance.now() / 55) % 8 / z;
  ctx.strokeStyle = "#000";
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}
function drawCropRect(ctx) {
  const r = App.cropRect, z = App.zoom;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.55)";
  ctx.fillRect(0, 0, App.docW, r.y);
  ctx.fillRect(0, r.y + r.h, App.docW, App.docH - r.y - r.h);
  ctx.fillRect(0, r.y, r.x, r.h);
  ctx.fillRect(r.x + r.w, r.y, App.docW - r.x - r.w, r.h);
  ctx.lineWidth = 1.5 / z;
  ctx.strokeStyle = "#fff";
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.setLineDash([5 / z, 5 / z]);
  ctx.lineDashOffset = -(performance.now() / 55) % 10 / z;
  ctx.strokeStyle = "#000";
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  // third guide lines
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(255,255,255,.35)";
  ctx.lineWidth = 1 / z;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(r.x + r.w * i / 3, r.y); ctx.lineTo(r.x + r.w * i / 3, r.y + r.h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h * i / 3); ctx.lineTo(r.x + r.w, r.y + r.h * i / 3); ctx.stroke();
  }
  ctx.restore();
}
function drawTempShape(ctx) {
  const s = App.tempShape;
  ctx.save();
  ctx.globalAlpha = App.toolOpacity / 100;
  const r = normalizeRect(s.x0, s.y0, s.x1, s.y1);
  shapePath(ctx, s.type, r);
  if (s.mode !== "stroke") { ctx.fillStyle = s.color; ctx.fill(); }
  if (s.mode !== "fill") { ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.restore();
}
function shapePath(ctx, type, r) {
  ctx.beginPath();
  if (type === "ellipse") ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
  else ctx.rect(r.x, r.y, r.w, r.h);
}

/* render loop */
function loop() {
  if (App.dirty || App.selection || App.cropRect || App.marqueeDraft || App.floatSel) render();
  requestAnimationFrame(loop);
}

/* ================= TOOLS: POINTER ================= */
function evPos(e) {
  const rect = view.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

view.addEventListener("pointerdown", e => {
  view.setPointerCapture(e.pointerId);
  App.pointers.set(e.pointerId, evPos(e));
  const p = App.pointers.get(e.pointerId);

  // pinch start (2nd finger)
  if (App.pointers.size === 2) {
    cancelStroke();
    App.drag = null;
    const pts = [...App.pointers.values()];
    App.pinch = {
      dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
      mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
      zoom: App.zoom, panX: App.panX, panY: App.panY,
    };
    return;
  }
  if (App.pinch) return;

  App.mouse = { x: p.x, y: p.y, inside: true, touch: e.pointerType === "touch" };
  const isPan = e.button === 1 || App.spaceDown || App.tool === "hand";
  if (isPan) {
    App.panDrag = { x: p.x, y: p.y, px: App.panX, py: App.panY };
    viewport.classList.add("panning");
    return;
  }
  toolDown(e, p);
});

view.addEventListener("pointermove", e => {
  const p = evPos(e);
  if (App.pointers.has(e.pointerId)) App.pointers.set(e.pointerId, p);

  if (App.pinch && App.pointers.size >= 2) {
    const pts = [...App.pointers.values()];
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    const f = dist / (App.pinch.dist || 1);
    App.zoom = clamp(App.pinch.zoom * f, 0.03, 48);
    App.panX = App.pinch.panX + (mid.x - App.pinch.mid.x);
    App.panY = App.pinch.panY + (mid.y - App.pinch.mid.y);
    App.dirty = true;
    return;
  }

  App.mouse = { x: p.x, y: p.y, inside: true, touch: e.pointerType === "touch" };

  if (App.panDrag) {
    App.panX = App.panDrag.px + (p.x - App.panDrag.x);
    App.panY = App.panDrag.py + (p.y - App.panDrag.y);
    App.dirty = true;
    return;
  }
  toolMove(e, p);
});

function pointerEnd(e) {
  App.pointers.delete(e.pointerId);
  if (App.pinch) { if (App.pointers.size < 2) App.pinch = null; return; }
  if (App.panDrag) { App.panDrag = null; viewport.classList.remove("panning"); return; }
  toolUp(e, evPos(e));
}
view.addEventListener("pointerup", pointerEnd);
view.addEventListener("pointercancel", pointerEnd);
view.addEventListener("pointerleave", () => { App.mouse.inside = false; App.dirty = true; });
view.addEventListener("pointerenter", () => { App.mouse.inside = true; });
view.addEventListener("contextmenu", e => e.preventDefault());

viewport.addEventListener("wheel", e => {
  e.preventDefault();
  const p = evPos(e);
  zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, p.x, p.y);
}, { passive: false });

/* drag & drop file */
viewport.addEventListener("dragover", e => e.preventDefault());
viewport.addEventListener("drop", e => {
  e.preventDefault();
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith("image/")) openImageFile(f);
});

function cancelStroke() {
  if (App.stroke) {
    sctx.clearRect(0, 0, App.docW, App.docH);
    App.stroke = null;
  }
  if (App.eraseSnap) {
    const l = activeLayer();
    if (l) { l.ctx.clearRect(0, 0, App.docW, App.docH); l.ctx.drawImage(App.eraseSnap, 0, 0); }
    App.eraseSnap = null;
  }
  App.dirty = true;
}

/* ---- tool handlers ---- */
function toolDown(e, p) {
  const d = screenToDoc(p.x, p.y);
  const layer = activeLayer();
  switch (App.tool) {
    case "brush": {
      if (!layer || layer.locked) return toast("Lapisan terkunci / tidak ada", true);
      App.stroke = { last: d, color: App.color };
      sctx.clearRect(0, 0, App.docW, App.docH);
      stampAt(sctx, d.x, d.y);
      App.dirty = true;
      break;
    }
    case "eraser": {
      if (!layer || layer.locked) return toast("Lapisan terkunci / tidak ada", true);
      App.eraseSnap = cloneCanvas(layer.canvas);
      eraseAt(d.x, d.y);
      App.stroke = { last: d, erase: true };
      App.dirty = true;
      break;
    }
    case "bucket": {
      if (!layer || layer.locked) return toast("Lapisan terkunci / tidak ada", true);
      const x = Math.floor(d.x), y = Math.floor(d.y);
      if (x < 0 || y < 0 || x >= App.docW || y >= App.docH) return;
      const { r, g, b } = hexToRgb(App.color);
      floodFill(layer.ctx, x, y, [r, g, b, 255], App.bucketTolerance);
      pushHistory("Ember Cat");
      updateLayerThumbs(); App.dirty = true;
      break;
    }
    case "dropper": {
      const c = composite.getContext("2d");
      const px = clamp(Math.floor(d.x), 0, App.docW - 1), py = clamp(Math.floor(d.y), 0, App.docH - 1);
      const data = c.getImageData(px, py, 1, 1).data;
      const hex = rgbToHex(data[0], data[1], data[2]);
      if (e.altKey) { App.secondary = hex; } else { App.color = hex; }
      updateColorUI();
      break;
    }
    case "marquee": {
      App.marqueeDraft = { x: d.x, y: d.y, w: 0, h: 0, x0: d.x, y0: d.y };
      App.drag = { type: "marquee" };
      App.dirty = true;
      break;
    }
    case "crop": {
      App.cropRect = { x: d.x, y: d.y, w: 0, h: 0, x0: d.x, y0: d.y };
      App.drag = { type: "crop" };
      updateOptionsBar();
      App.dirty = true;
      break;
    }
    case "shape": {
      App.tempShape = { type: App.shapeType, mode: App.shapeMode, color: App.color, x0: d.x, y0: d.y, x1: d.x, y1: d.y };
      App.drag = { type: "shape" };
      App.dirty = true;
      break;
    }
    case "move": {
      if (!layer || layer.locked) return toast("Lapisan terkunci / tidak ada", true);
      if (App.floatSel) {
        App.drag = { type: "float", dx: d.x - App.floatSel.x, dy: d.y - App.floatSel.y };
      } else if (App.selection) {
        const s = App.selection;
        if (d.x >= s.x && d.x < s.x + s.w && d.y >= s.y && d.y < s.y + s.h) {
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(s.w)); c.height = Math.max(1, Math.round(s.h));
          c.getContext("2d").drawImage(layer.canvas, s.x, s.y, s.w, s.h, 0, 0, c.width, c.height);
          layer.ctx.clearRect(s.x, s.y, s.w, s.h);
          App.floatSel = { canvas: c, x: s.x, y: s.y };
          App.drag = { type: "float", dx: d.x - s.x, dy: d.y - s.y };
        } else App.drag = null;
      } else {
        App.drag = { type: "layer", snap: cloneCanvas(layer.canvas), sx: d.x, sy: d.y };
      }
      App.dirty = true;
      break;
    }
    case "zoom": {
      zoomAt(e.altKey ? 1 / 1.6 : 1.6, p.x, p.y);
      break;
    }
    case "hand": {
      App.panDrag = { x: p.x, y: p.y, px: App.panX, py: App.panY };
      viewport.classList.add("panning");
      break;
    }
    case "text": {
      showTextInput(p.x, p.y, d.x, d.y);
      break;
    }
  }
}

function toolMove(e, p) {
  if (!App.drag && !App.stroke) { App.dirty = true; return; }
  const d = screenToDoc(p.x, p.y);
  const layer = activeLayer();

  if (App.stroke && App.stroke.erase) { eraseAt(d.x, d.y); App.stroke.last = d; App.dirty = true; return; }
  if (App.stroke) {
    lineStamp(sctx, App.stroke.last, d);
    App.stroke.last = d;
    App.dirty = true;
    return;
  }
  if (!App.drag) return;

  switch (App.drag.type) {
    case "marquee": {
      const o = App.marqueeDraft;
      App.marqueeDraft = { x: Math.min(o.x0, d.x), y: Math.min(o.y0, d.y), w: Math.abs(d.x - o.x0), h: Math.abs(d.y - o.y0), x0: o.x0, y0: o.y0 };
      App.dirty = true;
      break;
    }
    case "crop": {
      const o = App.cropRect;
      App.cropRect = { x: Math.min(o.x0, d.x), y: Math.min(o.y0, d.y), w: Math.abs(d.x - o.x0), h: Math.abs(d.y - o.y0), x0: o.x0, y0: o.y0 };
      App.dirty = true;
      break;
    }
    case "shape": {
      App.tempShape.x1 = d.x; App.tempShape.y1 = d.y;
      App.dirty = true;
      break;
    }
    case "layer": {
      const dx = Math.round(d.x - App.drag.sx), dy = Math.round(d.y - App.drag.sy);
      layer.ctx.clearRect(0, 0, App.docW, App.docH);
      layer.ctx.drawImage(App.drag.snap, dx, dy);
      pushHistory("Pindah Lapisan");
      App.dirty = true;
      break;
    }
    case "float": {
      App.floatSel.x = Math.round(d.x - App.drag.dx);
      App.floatSel.y = Math.round(d.y - App.drag.dy);
      App.dirty = true;
      break;
    }
  }
}

function toolUp(e, p) {
  const layer = activeLayer();
  if (App.stroke && !App.stroke.erase) {
    layer.ctx.globalAlpha = App.toolOpacity / 100;
    layer.ctx.drawImage(strokeCanvas, 0, 0);
    layer.ctx.globalAlpha = 1;
    sctx.clearRect(0, 0, App.docW, App.docH);
    App.stroke = null;
    pushHistory("Kuas");
    updateLayerThumbs();
  }
  if (App.stroke && App.stroke.erase) {
    App.stroke = null; App.eraseSnap = null;
    pushHistory("Penghapus");
    updateLayerThumbs();
  }
  if (!App.drag) { App.dirty = true; return; }
  const d = screenToDoc(p.x, p.y);

  switch (App.drag.type) {
    case "marquee": {
      const r = App.marqueeDraft;
      App.marqueeDraft = null;
      App.selection = (r && r.w > 2 && r.h > 2) ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) } : null;
      break;
    }
    case "crop": {
      const r = App.cropRect;
      if (r && (r.w < 4 || r.h < 4)) { App.cropRect = null; updateOptionsBar(); }
      else if (r) {
        App.cropRect = { x: Math.round(clamp(r.x, 0, App.docW - 1)), y: Math.round(clamp(r.y, 0, App.docH - 1)), w: Math.round(clamp(r.w, 1, App.docW)), h: Math.round(clamp(r.h, 1, App.docH)) };
        App.cropRect.w = Math.min(App.cropRect.w, App.docW - App.cropRect.x);
        App.cropRect.h = Math.min(App.cropRect.h, App.docH - App.cropRect.y);
        updateOptionsBar();
      }
      break;
    }
    case "shape": {
      const s = App.tempShape;
      App.tempShape = null;
      if (s && (Math.abs(s.x1 - s.x0) > 1 || Math.abs(s.y1 - s.y0) > 1)) {
        if (layer && !layer.locked) {
          const r = normalizeRect(s.x0, s.y0, s.x1, s.y1);
          layer.ctx.save();
          layer.ctx.globalAlpha = App.toolOpacity / 100;
          shapePath(layer.ctx, s.type, r);
          if (s.mode !== "stroke") { layer.ctx.fillStyle = s.color; layer.ctx.fill(); }
          if (s.mode !== "fill") { layer.ctx.strokeStyle = s.color; layer.ctx.lineWidth = 2; layer.ctx.stroke(); }
          layer.ctx.restore();
          pushHistory("Bentuk");
          updateLayerThumbs();
        } else toast("Lapisan terkunci / tidak ada", true);
      }
      break;
    }
    case "float": {
      if (App.floatSel && layer) {
        layer.ctx.drawImage(App.floatSel.canvas, App.floatSel.x, App.floatSel.y);
        const s = App.selection;
        if (s) App.selection = { x: App.floatSel.x, y: App.floatSel.y, w: App.floatSel.canvas.width, h: App.floatSel.canvas.height };
        App.floatSel = null;
        pushHistory("Pindah Seleksi");
        updateLayerThumbs();
      }
      break;
    }
  }
  App.drag = null;
  App.dirty = true;
}

/* brush stamping */
function stampAt(ctx, x, y) {
  const r = App.brushSize / 2;
  const hard = App.hardness / 100;
  const { r: cr, g: cg, b: cb } = hexToRgb(ctx === sctx ? App.stroke.color : App.color);
  if (hard >= 0.98) {
    ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  } else {
    const g = ctx.createRadialGradient(x, y, Math.max(0.5, r * hard), x, y, r);
    g.addColorStop(0, `rgba(${cr},${cg},${cb},1)`);
    g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}
function lineStamp(ctx, a, b) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const step = Math.max(1, App.brushSize * 0.12);
  const n = Math.max(1, Math.ceil(dist / step));
  for (let i = 1; i <= n; i++) {
    stampAt(ctx, a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n);
  }
}
function eraseAt(x, y) {
  const l = activeLayer(); if (!l) return;
  l.ctx.save();
  l.ctx.globalCompositeOperation = "destination-out";
  l.ctx.globalAlpha = App.toolOpacity / 100;
  l.ctx.beginPath(); l.ctx.arc(x, y, App.brushSize / 2, 0, Math.PI * 2); l.ctx.fill();
  l.ctx.restore();
}

/* flood fill */
function floodFill(ctx, sx, sy, rgba, tolerance) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const si = (sy * w + sx) * 4;
  const tr = d[si], tg = d[si + 1], tb = d[si + 2], ta = d[si + 3];
  const [fr, fg, fb, fa] = rgba;
  if (tr === fr && tg === fg && tb === fb && ta === fa) return;
  const tol = tolerance;
  const match = i => {
    const p = i * 4;
    return Math.abs(d[p] - tr) <= tol && Math.abs(d[p + 1] - tg) <= tol &&
           Math.abs(d[p + 2] - tb) <= tol && Math.abs(d[p + 3] - ta) <= tol;
  };
  const stack = [[sx, sy]];
  while (stack.length) {
    let [x, y] = stack.pop();
    let i = y * w + x;
    if (x < 0 || y < 0 || x >= w || y >= h || !match(i)) continue;
    while (x > 0 && match(i - 1)) { x--; i--; }
    let up = false, down = false;
    while (x < w && match(i)) {
      d[i * 4] = fr; d[i * 4 + 1] = fg; d[i * 4 + 2] = fb; d[i * 4 + 3] = fa;
      if (y > 0) { if (match(i - w)) { if (!up) { stack.push([x, y - 1]); up = true; } } else up = false; }
      if (y < h - 1) { if (match(i + w)) { if (!down) { stack.push([x, y + 1]); down = true; } } else down = false; }
      x++; i++;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/* ================= TEXT TOOL ================= */
let textInputBox = null;
function showTextInput(sx, sy, dx, dy) {
  hideTextInput();
  textInputBox = document.createElement("div");
  textInputBox.className = "text-input-box";
  textInputBox.style.left = sx + "px";
  textInputBox.style.top = sy + "px";
  textInputBox.innerHTML = `<input type="text" placeholder="Ketik teks → Enter">`;
  viewport.appendChild(textInputBox);
  const inp = textInputBox.querySelector("input");
  inp.addEventListener("keydown", ev => {
    ev.stopPropagation();
    if (ev.key === "Enter") { commitText(dx, dy, inp.value); hideTextInput(); }
    if (ev.key === "Escape") hideTextInput();
  });
  setTimeout(() => inp.focus(), 30);
}
function hideTextInput() { if (textInputBox) { textInputBox.remove(); textInputBox = null; } }
function commitText(x, y, text) {
  if (!text.trim()) return;
  const l = activeLayer();
  if (!l || l.locked) return toast("Lapisan terkunci / tidak ada", true);
  pushHistory("Teks");
  l.ctx.save();
  l.ctx.globalAlpha = App.toolOpacity / 100;
  l.ctx.fillStyle = App.color;
  l.ctx.font = `${App.fontItalic ? "italic " : ""}${App.fontBold ? "bold " : ""}${App.fontSize}px ${App.fontFamily}`;
  l.ctx.textBaseline = "top";
  l.ctx.fillText(text, x, y);
  l.ctx.restore();
  updateLayerThumbs();
  App.dirty = true;
}

/* ================= EDIT ACTIONS ================= */
function fillWith(hex, clear) {
  const l = activeLayer(); if (!l || l.locked) return toast("Lapisan terkunci / tidak ada", true);
  const r = App.selection || { x: 0, y: 0, w: App.docW, h: App.docH };
  if (clear) l.ctx.clearRect(r.x, r.y, r.w, r.h);
  else { l.ctx.fillStyle = hex; l.ctx.fillRect(r.x, r.y, r.w, r.h); }
  pushHistory(clear ? "Hapus" : "Isi Warna");
  updateLayerThumbs(); App.dirty = true;
}
function clearAction() {
  const l = activeLayer(); if (!l || l.locked) return toast("Lapisan terkunci / tidak ada", true);
  const r = App.selection || { x: 0, y: 0, w: App.docW, h: App.docH };
  l.ctx.clearRect(r.x, r.y, r.w, r.h);
  pushHistory("Hapus");
  updateLayerThumbs(); App.dirty = true;
}
function selectAll() { App.selection = { x: 0, y: 0, w: App.docW, h: App.docH }; App.dirty = true; }
function deselect() { App.selection = null; App.floatSel = null; App.dirty = true; }

function applyCrop() {
  const r = App.cropRect; if (!r) return;
  const nw = Math.max(1, Math.round(r.w)), nh = Math.max(1, Math.round(r.h));
  for (const l of App.layers) {
    const nc = document.createElement("canvas");
    nc.width = nw; nc.height = nh;
    nc.getContext("2d").drawImage(l.canvas, r.x, r.y, nw, nh, 0, 0, nw, nh);
    l.canvas = nc; l.ctx = makeCtx(nc);
  }
  App.docW = nw; App.docH = nh;
  ensureComposite();
  App.cropRect = null; App.selection = null;
  fitView();
  pushHistory("Pangkas"); updateUI();
}
function resizeImage(nw, nh) {
  nw = Math.max(1, Math.round(nw)); nh = Math.max(1, Math.round(nh));
  for (const l of App.layers) {
    const nc = document.createElement("canvas");
    nc.width = nw; nc.height = nh;
    nc.getContext("2d").drawImage(l.canvas, 0, 0, nw, nh);
    l.canvas = nc; l.ctx = makeCtx(nc);
  }
  App.docW = nw; App.docH = nh;
  ensureComposite();
  fitView();
  pushHistory("Ukuran Gambar"); updateUI();
}

/* ================= FILTERS / ADJUSTMENTS ================= */
function withLayer(label, fn) {
  const l = activeLayer();
  if (!l || l.locked) return toast("Lapisan terkunci / tidak ada", true);
  fn(l);
  pushHistory(label);
  updateLayerThumbs();
  App.dirty = true;
}
function applyInvert() {
  withLayer("Invert", l => {
    const img = l.ctx.getImageData(0, 0, App.docW, App.docH);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
    l.ctx.putImageData(img, 0, 0);
  });
}
function applyGrayscale() {
  withLayer("Grayscale", l => {
    const img = l.ctx.getImageData(0, 0, App.docW, App.docH);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    l.ctx.putImageData(img, 0, 0);
  });
}
function applySepia() {
  withLayer("Sepia", l => {
    const img = l.ctx.getImageData(0, 0, App.docW, App.docH);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      d[i] = clamp(r * 0.393 + g * 0.769 + b * 0.189, 0, 255);
      d[i + 1] = clamp(r * 0.349 + g * 0.686 + b * 0.168, 0, 255);
      d[i + 2] = clamp(r * 0.272 + g * 0.534 + b * 0.131, 0, 255);
    }
    l.ctx.putImageData(img, 0, 0);
  });
}
function applyBlur(px) {
  withLayer("Blur", l => {
    const tmp = cloneCanvas(l.canvas);
    const tc = tmp.getContext("2d");
    tc.filter = `blur(${px}px)`;
    tc.drawImage(tmp, 0, 0);
    l.ctx.clearRect(0, 0, App.docW, App.docH);
    l.ctx.drawImage(tmp, 0, 0);
  });
}
function applySharpen() {
  withLayer("Sharpen", l => {
    const img = l.ctx.getImageData(0, 0, App.docW, App.docH);
    const src = new Uint8ClampedArray(img.data);
    const d = img.data, w = App.docW, h = App.docH;
    const k = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        for (let c = 0; c < 3; c++) {
          let sum = 0, ki = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++)
              sum += src[((y + dy) * w + (x + dx)) * 4 + c] * k[ki++];
          d[(y * w + x) * 4 + c] = clamp(sum, 0, 255);
        }
      }
    }
    l.ctx.putImageData(img, 0, 0);
  });
}
function applyNoise(amount) {
  withLayer("Noise", l => {
    const img = l.ctx.getImageData(0, 0, App.docW, App.docH);
    const d = img.data;
    const amp = amount * 1.28;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * amp;
      d[i] = clamp(d[i] + n, 0, 255);
      d[i + 1] = clamp(d[i + 1] + n, 0, 255);
      d[i + 2] = clamp(d[i + 2] + n, 0, 255);
    }
    l.ctx.putImageData(img, 0, 0);
  });
}
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hsl2rgb(h, s, l) {
  if (s === 0) { const v = l * 255; return [v, v, v]; }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
}

/* live-preview adjustment dialog */
function openAdjustDialog(title, controls, applyFn) {
  const l = activeLayer();
  if (!l || l.locked) return toast("Lapisan terkunci / tidak ada", true);
  const orig = l.ctx.getImageData(0, 0, App.docW, App.docH);
  const values = {};
  controls.forEach(c => values[c.id] = c.value);
  const html = controls.map(c => `
    <label class="adj-label">${c.label}<span class="adj-val" id="adjv-${c.id}">${c.value}</span>
      <input type="range" id="adj-${c.id}" min="${c.min}" max="${c.max}" value="${c.value}">
    </label>`).join("");
  const apply = () => {
    l.ctx.putImageData(orig, 0, 0);
    applyFn(orig, values, l);
    App.dirty = true;
  };
  showModal(title, html, [
    { label: "Batal", onClick: () => { l.ctx.putImageData(orig, 0, 0); App.dirty = true; } },
    { label: "Oke", primary: true, onClick: () => { pushHistory(title); updateLayerThumbs(); } },
  ]);
  controls.forEach(c => {
    const inp = $("#adj-" + c.id);
    inp.addEventListener("input", () => {
      values[c.id] = +inp.value;
      $("#adjv-" + c.id).textContent = inp.value;
      apply();
    });
  });
}
function dialogBrightnessContrast() {
  openAdjustDialog("Kecerahan / Kontras", [
    { id: "b", label: "Kecerahan", min: -100, max: 100, value: 0 },
    { id: "c", label: "Kontras", min: -100, max: 100, value: 0 },
  ], (orig, v, l) => {
    const out = l.ctx.createImageData(orig.width, orig.height);
    const s = orig.data, d = out.data;
    const cC = v.c * 2.55;
    const f = (259 * (cC + 255)) / (255 * (259 - cC));
    const add = v.b * 2.55;
    for (let i = 0; i < s.length; i += 4) {
      d[i] = clamp(f * (s[i] - 128) + 128 + add, 0, 255);
      d[i + 1] = clamp(f * (s[i + 1] - 128) + 128 + add, 0, 255);
      d[i + 2] = clamp(f * (s[i + 2] - 128) + 128 + add, 0, 255);
      d[i + 3] = s[i + 3];
    }
    l.ctx.putImageData(out, 0, 0);
  });
}
function dialogHueSaturation() {
  openAdjustDialog("Rona / Saturasi", [
    { id: "h", label: "Rona (Hue)", min: -180, max: 180, value: 0 },
    { id: "s", label: "Saturasi", min: -100, max: 100, value: 0 },
    { id: "l", label: "Cahaya", min: -100, max: 100, value: 0 },
  ], (orig, v, l) => {
    const out = l.ctx.createImageData(orig.width, orig.height);
    const s = orig.data, d = out.data;
    for (let i = 0; i < s.length; i += 4) {
      let [h, sat, li] = rgb2hsl(s[i], s[i + 1], s[i + 2]);
      h = (h + v.h / 360 + 1) % 1;
      sat = clamp(sat * (1 + v.s / 100), 0, 1);
      li = clamp(li * (1 + v.l / 100), 0, 1);
      const [r, g, b] = hsl2rgb(h, sat, li);
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = s[i + 3];
    }
    l.ctx.putImageData(out, 0, 0);
  });
}
function dialogBlur() {
  const l = activeLayer();
  if (!l || l.locked) return toast("Lapisan terkunci / tidak ada", true);
  const orig = cloneCanvas(l.canvas);
  showModal("Blur Gaussian", `
    <label class="adj-label">Radius <span class="adj-val" id="adjv-r">4</span>
      <input type="range" id="adj-r" min="1" max="20" value="4">
    </label>`, [
    { label: "Batal", onClick: () => { l.ctx.clearRect(0, 0, App.docW, App.docH); l.ctx.drawImage(orig, 0, 0); App.dirty = true; } },
    { label: "Oke", primary: true, onClick: () => { pushHistory("Blur"); updateLayerThumbs(); } },
  ]);
  const run = px => {
    l.ctx.clearRect(0, 0, App.docW, App.docH);
    const t = cloneCanvas(orig);
    const tc = t.getContext("2d");
    tc.filter = `blur(${px}px)`;
    tc.drawImage(t, 0, 0);
    l.ctx.drawImage(t, 0, 0);
    App.dirty = true;
  };
  $("#adj-r").addEventListener("input", e => {
    $("#adjv-r").textContent = e.target.value;
    run(+e.target.value);
  });
}
function dialogNoise() {
  const l = activeLayer();
  if (!l || l.locked) return toast("Lapisan terkunci / tidak ada", true);
  const orig = cloneCanvas(l.canvas);
  showModal("Tambah Noise", `
    <label class="adj-label">Jumlah <span class="adj-val" id="adjv-n">25</span>
      <input type="range" id="adj-n" min="1" max="100" value="25">
    </label>`, [
    { label: "Batal", onClick: () => { l.ctx.clearRect(0, 0, App.docW, App.docH); l.ctx.drawImage(orig, 0, 0); App.dirty = true; } },
    { label: "Oke", primary: true, onClick: () => { pushHistory("Noise"); updateLayerThumbs(); } },
  ]);
  $("#adj-n").addEventListener("input", e => {
    $("#adjv-n").textContent = e.target.value;
    l.ctx.clearRect(0, 0, App.docW, App.docH);
    l.ctx.drawImage(orig, 0, 0);
    const img = l.ctx.getImageData(0, 0, App.docW, App.docH);
    const d = img.data, amp = +e.target.value * 1.28;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * amp;
      d[i] = clamp(d[i] + n, 0, 255);
      d[i + 1] = clamp(d[i + 1] + n, 0, 255);
      d[i + 2] = clamp(d[i + 2] + n, 0, 255);
    }
    l.ctx.putImageData(img, 0, 0);
    App.dirty = true;
  });
}

/* ================= FILE OPS ================= */
function newDocDialog() {
  showModal("Dokumen Baru", `
    <div class="field-row">
      <div class="field"><label>Lebar (px)</label><input type="number" id="nd-w" value="800" min="1" max="8000"></div>
      <div class="field"><label>Tinggi (px)</label><input type="number" id="nd-h" value="600" min="1" max="8000"></div>
    </div>
    <div class="field"><label>Latar belakang</label>
      <select id="nd-bg"><option value="white">Putih</option><option value="transparent">Transparan</option></select>
    </div>`, [
    { label: "Batal", onClick: () => {} },
    { label: "Buat", primary: true, onClick: close => {
      const w = clamp(+$("#nd-w").value || 800, 1, 8000);
      const h = clamp(+$("#nd-h").value || 600, 1, 8000);
      newDocument(w, h, $("#nd-bg").value);
    }},
  ]);
}
function newDocument(w, h, bg, keepHint) {
  App.docW = w; App.docH = h;
  ensureComposite();
  App.layers = [];
  if (bg === "white") {
    const bgl = createLayer("Background");
    bgl.ctx.fillStyle = "#ffffff";
    bgl.ctx.fillRect(0, 0, w, h);
    App.layers.push(bgl);
  }
  const l1 = createLayer("Lapisan 1");
  App.layers.push(l1);
  App.activeLayerId = l1.id;
  App.selection = null; App.cropRect = null; App.floatSel = null;
  App.history = []; App.historyIndex = -1;
  pushHistory("Dokumen Baru");
  fitView(); updateUI();
  if (!keepHint) $("#empty-hint").classList.add("hide");
}
function openImageFile(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    App.docW = img.naturalWidth; App.docH = img.naturalHeight;
    ensureComposite();
    const bgl = createLayer("Background");
    bgl.ctx.fillStyle = "#ffffff";
    bgl.ctx.fillRect(0, 0, App.docW, App.docH);
    const imgL = createLayer(file.name.replace(/\.[^.]+$/, ""));
    imgL.ctx.drawImage(img, 0, 0);
    App.layers = [bgl, imgL];
    App.activeLayerId = imgL.id;
    App.selection = null; App.cropRect = null;
    App.history = []; App.historyIndex = -1;
    pushHistory("Buka Gambar");
    URL.revokeObjectURL(url);
    fitView(); updateUI();
    $("#empty-hint").classList.add("hide");
    toast(`Dibuka: ${file.name} (${App.docW}×${App.docH})`);
  };
  img.onerror = () => toast("Gagal membuka gambar", true);
  img.src = url;
}
function compositeToCanvas(whiteBg) {
  const c = document.createElement("canvas");
  c.width = App.docW; c.height = App.docH;
  const cc = c.getContext("2d");
  if (whiteBg) { cc.fillStyle = "#fff"; cc.fillRect(0, 0, c.width, c.height); }
  for (const l of App.layers) {
    if (!l.visible) continue;
    cc.globalAlpha = l.opacity / 100;
    cc.globalCompositeOperation = l.blendMode;
    cc.drawImage(l.canvas, 0, 0);
  }
  return c;
}
function downloadCanvas(c, name, mime) {
  const a = document.createElement("a");
  a.download = name;
  a.href = c.toDataURL(mime, 0.92);
  a.click();
  toast("Gambar disimpan: " + name);
}
function savePNG() { downloadCanvas(compositeToCanvas(false), "pslite-editan.png", "image/png"); }
function saveJPEG() { downloadCanvas(compositeToCanvas(true), "pslite-editan.jpg", "image/jpeg"); }

/* ================= MODAL ================= */
function showModal(title, bodyHTML, buttons) {
  const root = $("#modal-root");
  root.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-title">${title}</div>
      <div class="modal-body">${bodyHTML}</div>
      <div class="modal-btns"></div>
    </div>`;
  const btnBox = root.querySelector(".modal-btns");
  const close = () => root.innerHTML = "";
  (buttons || [{ label: "Tutup", primary: true }]).forEach(b => {
    const btn = document.createElement("button");
    btn.textContent = b.label;
    if (b.primary) btn.className = "primary";
    btn.addEventListener("click", () => { close(); if (b.onClick) b.onClick(close); });
    btnBox.appendChild(btn);
  });
  root.querySelector(".modal-backdrop").addEventListener("click", close);
}

/* ================= UI: MENUS ================= */
const MENUS = {
  Berkas: [
    { label: "Baru…", sc: "Ctrl+N", fn: newDocDialog },
    { label: "Buka…", sc: "Ctrl+O", fn: () => $("#file-input").click() },
    { sep: 1 },
    { label: "Simpan sebagai PNG", sc: "Ctrl+S", fn: savePNG },
    { label: "Simpan sebagai JPEG", fn: saveJPEG },
  ],
  Edit: [
    { label: "Urungkan", sc: "Ctrl+Z", fn: undo },
    { label: "Ulangi", sc: "Ctrl+Y", fn: redo },
    { sep: 1 },
    { label: "Isi Warna Depan", sc: "Alt+Del", fn: () => fillWith(App.color, false) },
    { label: "Isi Warna Belakang", sc: "Ctrl+Del", fn: () => fillWith(App.secondary, false) },
    { label: "Hapus Isi", sc: "Del", fn: clearAction },
    { sep: 1 },
    { label: "Pilih Semua", sc: "Ctrl+A", fn: selectAll },
    { label: "Batalkan Pilihan", sc: "Ctrl+D", fn: deselect },
  ],
  Gambar: [
    { label: "Ukuran Gambar…", fn: dialogResize },
    { sep: 1 },
    { label: "Ratakan Gambar", fn: flattenImage },
  ],
  Filter: [
    { label: "Blur…", fn: dialogBlur },
    { label: "Blur Cepat", fn: () => applyBlur(2) },
    { label: "Perjelas (Sharpen)", fn: applySharpen },
    { sep: 1 },
    { label: "Invert", sc: "Ctrl+I", fn: applyInvert },
    { label: "Grayscale", fn: applyGrayscale },
    { label: "Sepia", fn: applySepia },
    { label: "Tambah Noise…", fn: dialogNoise },
  ],
  Tampilan: [
    { label: "Perbesar", sc: "Ctrl++", fn: () => zoomAt(1.25, viewport.clientWidth / 2, viewport.clientHeight / 2) },
    { label: "Perkecil", sc: "Ctrl+-", fn: () => zoomAt(1 / 1.25, viewport.clientWidth / 2, viewport.clientHeight / 2) },
    { label: "Pas di Layar", sc: "Ctrl+0", fn: fitView },
    { label: "100%", sc: "Ctrl+1", fn: () => { const cx = viewport.clientWidth / 2, cy = viewport.clientHeight / 2; zoomAt(1 / App.zoom, cx, cy); } },
    { sep: 1 },
    { label: "Tampilkan Grid", fn: () => { App.showGrid = !App.showGrid; App.dirty = true; toast("Grid " + (App.showGrid ? "aktif" : "mati")); } },
  ],
  Bantuan: [
    { label: "Pintasan Keyboard…", fn: shortcutsDialog },
    { label: "Tentang PS Lite", fn: aboutDialog },
  ],
};
function buildMenus() {
  const box = $("#menus");
  box.innerHTML = "";
  Object.entries(MENUS).forEach(([name, items]) => {
    const m = document.createElement("div");
    m.className = "menu";
    m.innerHTML = `<div class="menu-title">${name}</div><div class="dropdown"></div>`;
    const dd = m.querySelector(".dropdown");
    items.forEach(it => {
      if (it.sep) { const s = document.createElement("div"); s.className = "sep"; dd.appendChild(s); return; }
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `<span>${it.label}</span><span class="sc">${it.sc || ""}</span>`;
      item.addEventListener("click", () => { m.classList.remove("open"); it.fn(); });
      dd.appendChild(item);
    });
    m.querySelector(".menu-title").addEventListener("click", e => {
      e.stopPropagation();
      const was = m.classList.contains("open");
      $$(".menu").forEach(x => x.classList.remove("open"));
      if (!was) m.classList.add("open");
    });
    box.appendChild(m);
  });
  document.addEventListener("click", () => $$(".menu").forEach(x => x.classList.remove("open")));
}
function dialogResize() {
  showModal("Ukuran Gambar", `
    <div class="field-row">
      <div class="field"><label>Lebar (px)</label><input type="number" id="rs-w" value="${App.docW}" min="1" max="8000"></div>
      <div class="field"><label>Tinggi (px)</label><input type="number" id="rs-h" value="${App.docH}" min="1" max="8000"></div>
    </div>`, [
    { label: "Batal", onClick: () => {} },
    { label: "Terapkan", primary: true, onClick: () => resizeImage(+$("#rs-w").value, +$("#rs-h").value) },
  ]);
}
function shortcutsDialog() {
  const rows = [
    ["Kuas", "B"], ["Penghapus", "E"], ["Pindah", "V"], ["Kotak Pilih", "M"],
    ["Pangkas", "C"], ["Ember Cat", "G"], ["Penetes", "I"], ["Teks", "T"],
    ["Bentuk", "U"], ["Zoom", "Z"], ["Tangan / Spasi", "H / Space"],
    ["Urungkan / Ulangi", "Ctrl+Z / Ctrl+Y"], ["Simpan PNG", "Ctrl+S"],
    ["Pilih Semua / Batalkan", "Ctrl+A / Ctrl+D"], ["Isi warna depan", "Alt+Del"],
    ["Hapus isi", "Del"], ["Ukuran kuas", "[ dan ]"], ["Tukar warna", "X"],
    ["Reset warna", "D"], ["Gabung ke bawah", "Ctrl+E"], ["Pas di layar", "Ctrl+0"],
    ["Zoom 100%", "Ctrl+1"], ["Batal (crop/teks)", "Esc"],
  ];
  showModal("Pintasan Keyboard", `
    <table class="shortcut-table">
      <tr><th>Aksi</th><th>Tombol</th></tr>
      ${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join("")}
    </table>`);
}
function aboutDialog() {
  showModal("Tentang PS Lite", `
    <p><b>PS Lite</b> v1.0 — editor foto gaya Photoshop.</p>
    <p style="margin-top:10px">Berjalan di browser desktop &amp; HP (PWA), aplikasi desktop Electron, dan Android (Capacitor).</p>
    <p style="margin-top:10px;color:var(--text2)">Tools: kuas, penghapus, ember cat, teks, bentuk, pangkas, seleksi, pindah lapisan, penetes warna + lapisan, blend mode, penyesuaian, filter, riwayat.</p>`);
}

/* ================= UI: TOOLBAR / OPTIONS ================= */
function buildToolbar() {
  const box = $("#tool-buttons");
  box.innerHTML = "";
  Object.entries(TOOLS).forEach(([id, t]) => {
    const b = document.createElement("button");
    b.className = "tool-btn" + (App.tool === id ? " active" : "");
    b.textContent = t.icon;
    b.title = `${t.label} (${t.key})`;
    b.dataset.tool = id;
    b.addEventListener("click", () => setTool(id));
    box.appendChild(b);
  });
}
function setTool(id) {
  if (App.cropRect && id !== "crop") { /* keep crop until applied/cancelled */ }
  cancelStroke();
  hideTextInput();
  App.tool = id;
  $$(".tool-btn").forEach(b => b.classList.toggle("active", b.dataset.tool === id));
  updateOptionsBar();
  viewport.classList.toggle("pan-ready", id === "hand");
  updateStatus();
  App.dirty = true;
}
function updateOptionsBar() {
  const bar = $("#optionsbar");
  const t = App.tool;
  let html = `<span class="tool-name">${TOOLS[t].label}</span>`;
  const slider = (id, label, min, max, val, unit = "") =>
    `<label>${label}<input type="range" id="ob-${id}" min="${min}" max="${max}" value="${val}"><span class="val" id="obv-${id}">${val}${unit}</span></label>`;

  if (t === "brush" || t === "eraser") {
    html += slider("size", "Ukuran", 1, 300, App.brushSize, "px");
    html += slider("op", "Opasitas", 1, 100, App.toolOpacity, "%");
    html += slider("hard", "Kekerasan", 0, 100, App.hardness, "%");
  } else if (t === "bucket") {
    html += slider("tol", "Toleransi", 0, 100, App.bucketTolerance);
  } else if (t === "text") {
    html += `<label>Font
      <select id="ob-font">
        ${["Arial", "Georgia", "Times New Roman", "Courier New", "Impact", "Verdana", "Trebuchet MS"].map(f =>
          `<option ${f === App.fontFamily ? "selected" : ""}>${f}</option>`).join("")}
      </select></label>`;
    html += `<label>Ukuran<input type="number" id="ob-fsize" min="6" max="400" value="${App.fontSize}">px</label>`;
    html += `<label class="chk"><input type="checkbox" id="ob-fbold" ${App.fontBold ? "checked" : ""}>Tebal</label>`;
    html += `<label class="chk"><input type="checkbox" id="ob-fit" ${App.fontItalic ? "checked" : ""}>Miring</label>`;
  } else if (t === "shape") {
    html += `<div class="radio-group" id="ob-shapetype">
      <button data-v="rect" class="${App.shapeType === "rect" ? "on" : ""}">▭ Persegi</button>
      <button data-v="ellipse" class="${App.shapeType === "ellipse" ? "on" : ""}">◯ Lingkaran</button>
    </div>`;
    html += `<div class="radio-group" id="ob-shapemode">
      <button data-v="fill" class="${App.shapeMode === "fill" ? "on" : ""}">Isi</button>
      <button data-v="stroke" class="${App.shapeMode === "stroke" ? "on" : ""}">Tepi</button>
      <button data-v="both" class="${App.shapeMode === "both" ? "on" : ""}">Keduanya</button>
    </div>`;
  } else if (t === "crop") {
    if (App.cropRect) {
      html += `<button class="opt-btn primary" id="ob-crop-apply">✓ Terapkan Pangkasan</button>
               <button class="opt-btn" id="ob-crop-cancel">✕ Batalkan</button>
               <label>${Math.round(App.cropRect.w)} × ${Math.round(App.cropRect.h)} px</label>`;
    } else {
      html += `<label style="color:var(--text2)">Seret pada kanvas untuk area pangkasan</label>`;
    }
  } else if (t === "zoom") {
    html += `<button class="opt-btn" id="ob-zin">＋ Perbesar</button>
             <button class="opt-btn" id="ob-zout">－ Perkecil</button>
             <button class="opt-btn" id="ob-fit">Pas di Layar</button>`;
  } else if (t === "marquee") {
    html += `<button class="opt-btn" id="ob-selall">Pilih Semua</button>
             <button class="opt-btn" id="ob-seldel">Batalkan Pilihan</button>`;
    if (App.selection) html += `<button class="opt-btn danger" id="ob-selclear">Hapus Isi Seleksi</button>`;
  } else if (t === "move") {
    html += `<label style="color:var(--text2)">Seret lapisan / isi seleksi • ${App.selection ? "ada seleksi" : "tanpa seleksi"}</label>`;
  }
  bar.innerHTML = html;

  const bind = (id, fn) => { const el = $("#ob-" + id); if (el) el.addEventListener(id === "font" || id === "fbold" || id === "fit" || id === "fsize" ? "input" : "input", fn); };
  const s = (id, key, unit = "") => {
    const el = $("#ob-" + id);
    if (el) el.addEventListener("input", () => {
      App[key] = +el.value;
      const v = $("#obv-" + id);
      if (v) v.textContent = el.value + unit;
      App.dirty = true;
    });
  };
  s("size", "brushSize", "px"); s("op", "toolOpacity", "%"); s("hard", "hardness", "%"); s("tol", "bucketTolerance");
  const f = $("#ob-font"); if (f) f.addEventListener("change", () => App.fontFamily = f.value);
  const fs = $("#ob-fsize"); if (fs) fs.addEventListener("change", () => App.fontSize = clamp(+fs.value, 6, 400));
  const fb = $("#ob-fbold"); if (fb) fb.addEventListener("change", () => App.fontBold = fb.checked);
  const fi = $("#ob-fit"); if (fi) fi.addEventListener("change", () => App.fontItalic = fi.checked);
  ["ob-shapetype", "ob-shapemode"].forEach(gid => {
    const g = $("#" + gid);
    if (g) g.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
      if (gid === "ob-shapetype") App.shapeType = b.dataset.v; else App.shapeMode = b.dataset.v;
      updateOptionsBar();
    }));
  });
  const ca = $("#ob-crop-apply"); if (ca) ca.addEventListener("click", applyCrop);
  const cc = $("#ob-crop-cancel"); if (cc) cc.addEventListener("click", () => { App.cropRect = null; updateOptionsBar(); App.dirty = true; });
  const zi = $("#ob-zin"); if (zi) zi.addEventListener("click", () => zoomAt(1.25, viewport.clientWidth / 2, viewport.clientHeight / 2));
  const zo = $("#ob-zout"); if (zo) zo.addEventListener("click", () => zoomAt(1 / 1.25, viewport.clientWidth / 2, viewport.clientHeight / 2));
  const ft = $("#ob-fit"); if (ft) ft.addEventListener("click", fitView);
  const sa = $("#ob-selall"); if (sa) sa.addEventListener("click", selectAll);
  const sd = $("#ob-seldel"); if (sd) sd.addEventListener("click", deselect);
  const sc2 = $("#ob-selclear"); if (sc2) sc2.addEventListener("click", clearAction);
}

/* ================= UI: COLOR ================= */
function buildPalette() {
  const box = $("#palette");
  box.innerHTML = "";
  PALETTE.forEach(c => {
    const d = document.createElement("div");
    d.className = "pcolor";
    d.style.background = c;
    d.title = c;
    d.addEventListener("click", () => { App.color = c; updateColorUI(); });
    d.addEventListener("contextmenu", e => { e.preventDefault(); App.secondary = c; updateColorUI(); });
    box.appendChild(d);
  });
}
function updateColorUI() {
  $("#fg-swatch").style.background = App.color;
  $("#bg-swatch").style.background = App.secondary;
  $("#fg-swatch2").style.background = App.color;
  $("#bg-swatch2").style.background = App.secondary;
  $("#color-input").value = App.color;
  $("#hex-input").value = App.color.toUpperCase();
}
function bindColorUI() {
  const pick = (isFg, e) => {
    e.preventDefault();
    const inp = document.createElement("input");
    inp.type = "color";
    inp.value = isFg ? App.color : App.secondary;
    inp.style.position = "fixed"; inp.style.opacity = "0";
    document.body.appendChild(inp);
    inp.addEventListener("input", () => { if (isFg) App.color = inp.value; else App.secondary = inp.value; updateColorUI(); });
    inp.addEventListener("change", () => inp.remove());
    inp.click();
  };
  ["#fg-swatch", "#fg-swatch2"].forEach(s => $(s).addEventListener("click", e => pick(true, e)));
  ["#bg-swatch", "#bg-swatch2"].forEach(s => $(s).addEventListener("click", e => pick(false, e)));
  $("#swap-colors").addEventListener("click", () => { [App.color, App.secondary] = [App.secondary, App.color]; updateColorUI(); });
  $("#color-input").addEventListener("input", e => { App.color = e.target.value; updateColorUI(); });
  $("#hex-input").addEventListener("change", e => {
    let v = e.target.value.trim();
    if (!v.startsWith("#")) v = "#" + v;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) { App.color = v; updateColorUI(); }
    else e.target.value = App.color;
  });
}

/* ================= UI: ADJUST GRID ================= */
function buildAdjustGrid() {
  const items = [
    ["Kecerahan / Kontras", dialogBrightnessContrast],
    ["Rona / Saturasi", dialogHueSaturation],
    ["Blur", dialogBlur],
    ["Perjelas", applySharpen],
    ["Invert", applyInvert],
    ["Grayscale", applyGrayscale],
    ["Sepia", applySepia],
    ["Noise", dialogNoise],
  ];
  const g = $("#adjust-grid");
  g.innerHTML = "";
  items.forEach(([label, fn]) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.addEventListener("click", fn);
    g.appendChild(b);
  });
}

/* ================= UI: LAYERS PANEL ================= */
function renderLayerList() {
  const box = $("#layer-list");
  box.innerHTML = "";
  const rev = [...App.layers].reverse();
  rev.forEach(l => {
    const row = document.createElement("div");
    row.className = "layer-row" + (l.id === App.activeLayerId ? " active" : "");
    row.innerHTML = `
      <button class="eye ${l.visible ? "" : "off"}" title="Visibilitas">${l.visible ? "👁" : "—"}</button>
      <canvas width="44" height="33"></canvas>
      <div class="lname">${l.name}</div>
      <button class="lock ${l.locked ? "on" : ""}" title="Kunci">${l.locked ? "🔒" : "🔓"}</button>`;
    const c = row.querySelector("canvas");
    const cc = c.getContext("2d");
    const scale = Math.min(44 / App.docW, 33 / App.docH);
    cc.drawImage(l.canvas, (44 - App.docW * scale) / 2, (33 - App.docH * scale) / 2, App.docW * scale, App.docH * scale);
    row.addEventListener("click", () => {
      App.activeLayerId = l.id;
      renderLayerList(); syncLayerControls(); updateStatus();
    });
    row.querySelector(".eye").addEventListener("click", e => {
      e.stopPropagation();
      l.visible = !l.visible;
      pushHistory(l.visible ? "Tampilkan Lapisan" : "Sembunyikan Lapisan");
      renderLayerList(); App.dirty = true;
    });
    row.querySelector(".lock").addEventListener("click", e => {
      e.stopPropagation();
      l.locked = !l.locked;
      renderLayerList();
      toast(l.locked ? "Lapisan dikunci" : "Lapisan terbuka");
    });
    const nameEl = row.querySelector(".lname");
    nameEl.addEventListener("dblclick", () => {
      nameEl.innerHTML = `<input value="${l.name.replace(/"/g, "&quot;")}">`;
      const inp = nameEl.querySelector("input");
      inp.focus(); inp.select();
      inp.addEventListener("blur", () => { l.name = inp.value || l.name; renderLayerList(); });
      inp.addEventListener("keydown", ev => {
        ev.stopPropagation();
        if (ev.key === "Enter") inp.blur();
      });
    });
    box.appendChild(row);
  });
  const al = activeLayer();
  if (al) {
    $("#blend-select").value = al.blendMode;
    $("#layer-opacity").value = al.opacity;
    $("#layer-op-val").textContent = al.opacity + "%";
  }
}
function updateLayerThumbs() {
  // lightweight thumb refresh without full list rebuild
  renderLayerList();
}
function syncLayerControls() {
  const al = activeLayer();
  if (!al) return;
  $("#blend-select").value = al.blendMode;
  $("#layer-opacity").value = al.opacity;
  $("#layer-op-val").textContent = al.opacity + "%";
}
function bindLayerUI() {
  $("#layer-new").addEventListener("click", () => { addLayer(); pushHistory("Lapisan Baru"); updateUI(); });
  $("#layer-dup").addEventListener("click", duplicateLayer);
  $("#layer-del").addEventListener("click", deleteLayer);
  $("#layer-up").addEventListener("click", () => moveLayer(1));
  $("#layer-down").addEventListener("click", () => moveLayer(-1));
  $("#layer-merge").addEventListener("click", mergeDown);
  $("#blend-select").addEventListener("change", e => {
    const l = activeLayer(); if (!l) return;
    l.blendMode = e.target.value;
    pushHistory("Mode Gabungan"); App.dirty = true;
  });
  $("#layer-opacity").addEventListener("input", e => {
    const l = activeLayer(); if (!l) return;
    l.opacity = +e.target.value;
    $("#layer-op-val").textContent = l.opacity + "%";
    App.dirty = true;
  });
  $("#layer-opacity").addEventListener("change", () => pushHistory("Opasitas Lapisan"));
}

/* ================= UI: HISTORY PANEL ================= */
function renderHistoryList() {
  const box = $("#history-list");
  box.innerHTML = "";
  App.history.forEach((h, i) => {
    const d = document.createElement("div");
    d.className = "hist-item" + (i === App.historyIndex ? " current" : "") + (i > App.historyIndex ? " future" : "");
    d.innerHTML = `<span class="hn">${i + 1}</span>${h.label}`;
    d.addEventListener("click", () => jumpTo(i));
    box.appendChild(d);
  });
  box.scrollTop = box.scrollHeight;
}

/* ================= STATUS ================= */
function updateStatus() {
  $("#st-zoom").textContent = Math.round(App.zoom * 100) + "%";
  $("#st-size").textContent = `${App.docW} × ${App.docH} px`;
  const al = activeLayer();
  $("#st-layer").textContent = al ? al.name : "—";
  $("#st-tool").textContent = TOOLS[App.tool].label;
  const d = screenToDoc(App.mouse.x, App.mouse.y);
  $("#st-pos").textContent = App.mouse.inside ? `${Math.round(d.x)}, ${Math.round(d.y)} px` : "";
}
function updateUI() {
  renderLayerList();
  renderHistoryList();
  updateStatus();
  updateOptionsBar();
  App.dirty = true;
}

/* ================= KEYBOARD ================= */
document.addEventListener("keydown", e => {
  if (e.target.matches("input, textarea, select")) return;
  const ctrl = e.ctrlKey || e.metaKey;
  if (e.code === "Space" && !App.spaceDown) { App.spaceDown = true; viewport.classList.add("pan-ready"); e.preventDefault(); }

  if (ctrl) {
    const k = e.key.toLowerCase();
    if (k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (k === "y") { e.preventDefault(); redo(); return; }
    if (k === "s") { e.preventDefault(); savePNG(); return; }
    if (k === "o") { e.preventDefault(); $("#file-input").click(); return; }
    if (k === "n") { e.preventDefault(); newDocDialog(); return; }
    if (k === "a") { e.preventDefault(); selectAll(); return; }
    if (k === "d") { e.preventDefault(); deselect(); return; }
    if (k === "i") { e.preventDefault(); applyInvert(); return; }
    if (k === "e") { e.preventDefault(); mergeDown(); return; }
    if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); fillWith(App.secondary, false); return; }
    if (k === "0") { e.preventDefault(); fitView(); return; }
    if (k === "1") { e.preventDefault(); zoomAt(1 / App.zoom, viewport.clientWidth / 2, viewport.clientHeight / 2); return; }
    if (k === "=" || k === "+") { e.preventDefault(); zoomAt(1.25, viewport.clientWidth / 2, viewport.clientHeight / 2); return; }
    if (k === "-") { e.preventDefault(); zoomAt(1 / 1.25, viewport.clientWidth / 2, viewport.clientHeight / 2); return; }
    return;
  }
  if (e.key === "Escape") {
    if (App.cropRect) { App.cropRect = null; updateOptionsBar(); App.dirty = true; }
    if (App.floatSel) {
      const l = activeLayer();
      if (l) { l.ctx.drawImage(App.floatSel.canvas, App.floatSel.x, App.floatSel.y); updateLayerThumbs(); }
      App.floatSel = null;
    }
    hideTextInput();
    return;
  }
  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    if (e.altKey) fillWith(App.color, false);
    else clearAction();
    return;
  }
  if (e.key === "Enter" && App.cropRect) { applyCrop(); return; }

  const k = e.key.toLowerCase();
  if (k === "x") { [App.color, App.secondary] = [App.secondary, App.color]; updateColorUI(); return; }
  if (k === "d") { App.color = "#000000"; App.secondary = "#ffffff"; updateColorUI(); return; }
  if (k === "[") { App.brushSize = clamp(App.brushSize - 4, 1, 300); updateOptionsBar(); return; }
  if (k === "]") { App.brushSize = clamp(App.brushSize + 4, 1, 300); updateOptionsBar(); return; }
  if (TOOLS[k]) setTool(k);
});
document.addEventListener("keyup", e => {
  if (e.code === "Space") { App.spaceDown = false; viewport.classList.toggle("pan-ready", App.tool === "hand"); }
});

/* ================= INIT ================= */
function init() {
  initChecker();
  buildMenus();
  buildToolbar();
  buildPalette();
  buildAdjustGrid();
  bindColorUI();
  bindLayerUI();
  updateColorUI();
  ensureComposite();
  newDocument(800, 600, "white", true);
  setTool("brush");
  updateUI();

  $("#file-input").addEventListener("change", e => {
    const f = e.target.files[0];
    if (f) openImageFile(f);
    e.target.value = "";
  });

  // mobile panel drawer
  $("#panel-toggle").addEventListener("click", e => {
    e.stopPropagation();
    $("#panels").classList.toggle("open");
  });
  document.addEventListener("click", e => {
    const panels = $("#panels");
    if (panels.classList.contains("open") && !panels.contains(e.target) && e.target.id !== "panel-toggle") {
      panels.classList.remove("open");
    }
  });

  new ResizeObserver(() => { App.dirty = true; }).observe(viewport);

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  loop();
}
init();
