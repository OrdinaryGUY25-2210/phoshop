/* ============================================================
   PS Lite — FITUR LANJUTAN (inti)
   Tool retouch (stempel klon, perbaikan, dodge/burn/sponge,
   smudge, blur/tajam kuas, seleksi cepat, pena/vektor),
   penggaris + garis panduan, rotasi tampilan kanvas,
   lapisan penyesuaian (non-destruktif) + clipping mask.
   Dimuat setelah app.js.
   ============================================================ */
(function () {
  "use strict";
  const NS = (window.EXTNS = window.EXTNS || {});

  /* ---------- STATE ---------- */
  Object.assign(App, {
    cloneSrc: null, cloneAligned: true, cloneSnap: null, cloneOffset: null,
    healStrength: 70, dodgeExposure: 30, spongeMode: "desat", smudgeStrength: 45,
    quickSel: null, quickSeed: null, quickTol: 32, quickMode: "new", quickSampleAll: false,
    penPts: [], penClosed: false, penHover: null,
    guides: [], showRulers: true, showGuides: true, guideDrag: null,
    viewRot: 0, viewRotDeg: 0,
    mode: "rgb",
    documents: null, docId: 1, docName: "Tanpa Judul 1", docSeq: 1,
    retouchLast: null, retouchSnap: null,
  });

  /* ---------- TOOLS BARU ---------- */
  const NEW_TOOLS = {
    clone: { label: "Stempel Klon", key: "S", icon: "⎘",
      svg: '<path d="M8 3h8v4H8z"/><path d="M10 7v4h4V7"/><rect x="6" y="11" width="12" height="10" rx="1"/>' },
    heal: { label: "Perbaikan Bercak", key: "J", icon: "✚",
      svg: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>' },
    dodge: { label: "Dodge (Cerah)", key: "O", icon: "◑",
      svg: '<circle cx="12" cy="12" r="6"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>' },
    burn: { label: "Burn (Gelap)", key: "K", icon: "◐",
      svg: '<circle cx="12" cy="12" r="6" fill="currentColor" stroke="none"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>' },
    sponge: { label: "Sponge (Saturasi)", key: "P", icon: "◍",
      svg: '<circle cx="12" cy="12" r="7"/><path d="M7 9c3 2 7 2 10 0M7 15c3-2 7-2 10 0"/>' },
    smudge: { label: "Smudge", key: "R", icon: "≈",
      svg: '<path d="M3 15c3-6 6 6 9 0s6-6 9 0"/><path d="M3 20h18"/>' },
    blurbrush: { label: "Kuas Blur", key: "F", icon: "◌",
      svg: '<circle cx="12" cy="12" r="7" stroke-dasharray="2 3"/><circle cx="12" cy="12" r="2"/>' },
    sharpenbrush: { label: "Kuas Tajam", key: "Y", icon: "◈",
      svg: '<path d="M12 3l3 6 6 3-6 3-3 6-3-6-6-3 6-3z"/>' },
    quickselect: { label: "Seleksi Cepat", key: "Q", icon: "◔",
      svg: '<circle cx="10" cy="10" r="6"/><path d="M10 4a6 6 0 010 12z" fill="currentColor" stroke="none"/><path d="M15 15l6 6"/>' },
    pen: { label: "Pena (Vektor)", key: "A", icon: "✎",
      svg: '<path d="M4 20l3-9 6-6 6 6-6 6z"/><path d="M7 11h10"/>' },
  };
  Object.assign(TOOLS, NEW_TOOLS);
  /* urutkan ulang agar logis: setelah penghapus / sebelum ember */
  (function reorder() {
    const order = ["move", "marquee", "lasso", "wand", "quickselect", "pen", "crop",
      "brush", "eraser", "clone", "heal", "dodge", "burn", "sponge", "smudge", "blurbrush", "sharpenbrush",
      "bucket", "gradient", "dropper", "text", "shape", "zoom", "hand"];
    const snapshot = {};
    order.forEach(k => { if (TOOLS[k]) snapshot[k] = TOOLS[k]; });
    Object.keys(TOOLS).forEach(k => delete TOOLS[k]);
    Object.assign(TOOLS, snapshot);
  })();

  NS.RETOUCH = ["clone", "heal", "dodge", "burn", "sponge", "smudge", "blurbrush", "sharpenbrush"];
  NS.EXT_TOOLS = [...NS.RETOUCH, "quickselect", "pen"];

  /* ---------- UTIL ---------- */
  NS.tmp = document.createElement("canvas");
  NS.tmpCtx = NS.tmp.getContext("2d", { willReadFrequently: true });
  NS.sizedTmp = () => {
    if (NS.tmp.width !== App.docW || NS.tmp.height !== App.docH) {
      NS.tmp.width = App.docW; NS.tmp.height = App.docH;
    }
    NS.tmpCtx.setTransform(1, 0, 0, 1, 0, 0);
    NS.tmpCtx.globalCompositeOperation = "source-over";
    NS.tmpCtx.globalAlpha = 1;
    NS.tmpCtx.clearRect(0, 0, App.docW, App.docH);
    return NS.tmpCtx;
  };
  NS.canEdit = () => {
    const l = activeLayer();
    if (!l || l.isGroup) { toast("Pilih lapisan biasa dulu", true); return null; }
    if (l.locked) { toast("Lapisan terkunci", true); return null; }
    return l;
  };
  NS.softMask = (t, r, hardness) => {
    const inner = Math.max(0, Math.min(r - 0.5, r * hardness));
    const g = t.createRadialGradient(r, r, inner, r, r, r);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    t.globalCompositeOperation = "destination-in";
    t.fillStyle = g;
    t.fillRect(0, 0, r * 2, r * 2);
    t.globalCompositeOperation = "source-over";
  };
  NS.patchCanvas = (srcCanvas, sx, sy, r, hardness) => {
    const d = Math.ceil(r * 2) + 2;
    const c = document.createElement("canvas");
    c.width = d; c.height = d;
    const t = c.getContext("2d");
    t.drawImage(srcCanvas, sx - r, sy - r, d, d, 0, 0, d, d);
    NS.softMask(t, d / 2, hardness);
    return c;
  };
  NS.localPixels = (l, x, y, r, fn) => {
    const x0 = Math.max(0, Math.floor(x - r)), y0 = Math.max(0, Math.floor(y - r));
    const w = Math.min(App.docW - x0, Math.ceil(r * 2) + 1), h = Math.min(App.docH - y0, Math.ceil(r * 2) + 1);
    if (w <= 0 || h <= 0) return;
    const img = l.ctx.getImageData(x0, y0, w, h);
    fn(img.data, w, h, x - x0, y - y0, r);
    l.ctx.putImageData(img, x0, y0);
  };
  NS.lut = (stops) => {
    const t = new Uint8ClampedArray(256);
    const s = [...stops].sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < 256; i++) {
      let v = i;
      for (let k = 0; k < s.length - 1; k++) {
        const [x0, y0] = s[k], [x1, y1] = s[k + 1];
        if (i >= x0 && i <= x1 && x1 > x0) { v = y0 + (y1 - y0) * (i - x0) / (x1 - x0); break; }
      }
      t[i] = clamp(Math.round(v), 0, 255);
    }
    return t;
  };

  /* ---------- STAMP RETOUCH ---------- */
  NS.strokeHit = (from, to, step) => {
    const out = [];
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let i = 1; i <= n; i++) out.push({ x: from.x + (to.x - from.x) * i / n, y: from.y + (to.y - from.y) * i / n });
    return out;
  };
  NS.cloneStampAt = (l, x, y, heal) => {
    const r = Math.max(1, App.brushSize / 2);
    const off = App.cloneOffset || { dx: 0, dy: 0 };
    const patch = NS.patchCanvas(App.cloneSnap || l.canvas, x + off.dx, y + off.dy, r, App.hardness / 100);
    l.ctx.save();
    l.ctx.globalAlpha = clamp(App.toolOpacity / 100, 0.02, 1) * (heal ? Math.max(0.35, App.healStrength / 100) : 1);
    if (heal) l.ctx.globalCompositeOperation = "luminosity";
    l.ctx.drawImage(patch, x - patch.width / 2, y - patch.height / 2);
    l.ctx.restore();
  };
  NS.smudgeAt = (l, from, to) => {
    const r = Math.max(1, App.brushSize / 2);
    const patch = NS.patchCanvas(NS.tmp, from.x, from.y, r, App.hardness / 100);
    l.ctx.save();
    l.ctx.globalAlpha = clamp(App.smudgeStrength / 100, 0.02, 1);
    l.ctx.drawImage(patch, to.x - patch.width / 2, to.y - patch.height / 2);
    l.ctx.restore();
  };
  NS.dodgeAt = (l, x, y, mode) => {
    const r = Math.max(1, App.brushSize / 2);
    const s = (App.dodgeExposure / 100) * 0.4;
    NS.localPixels(l, x, y, r, (d, w, h, cx, cy, rr) => {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const dist = Math.hypot(i - cx, j - cy);
        if (dist > rr) continue;
        const f = (1 - dist / rr) * s;
        const p = (j * w + i) * 4;
        if (mode === "burn") { d[p] *= 1 - f; d[p + 1] *= 1 - f; d[p + 2] *= 1 - f; }
        else if (mode === "sponge") {
          const g = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
          const k = App.spongeMode === "sat" ? -f : f;
          d[p] = clamp(d[p] + (g - d[p]) * k, 0, 255);
          d[p + 1] = clamp(d[p + 1] + (g - d[p + 1]) * k, 0, 255);
          d[p + 2] = clamp(d[p + 2] + (g - d[p + 2]) * k, 0, 255);
        } else {
          d[p] += (255 - d[p]) * f; d[p + 1] += (255 - d[p + 1]) * f; d[p + 2] += (255 - d[p + 2]) * f;
        }
      }
    });
  };
  NS.kernelAt = (l, x, y, k) => {
    const r = Math.max(1, App.brushSize / 2);
    NS.localPixels(l, x, y, r, (d, w, h, cx, cy, rr) => {
      const src = new Uint8ClampedArray(d);
      for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
        const dist = Math.hypot(i - cx, j - cy);
        if (dist > rr) continue;
        const p = (j * w + i) * 4;
        for (let c = 0; c < 3; c++) {
          let sum = 0, ki = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
            sum += src[((j + dy) * w + (i + dx)) * 4 + c] * k[ki++];
          d[p + c] = clamp(sum, 0, 255);
        }
      }
    });
  };

  /* ---------- SELECTION CEPAT ---------- */
  NS.quickSelectAt = (x, y) => {
    const l = NS.canEdit(); if (!l) return;
    const r = Math.max(1, App.brushSize / 2);
    const src = App.quickSampleAll ? composite : l.canvas;
    const x0 = Math.max(0, Math.floor(x - r)), y0 = Math.max(0, Math.floor(y - r));
    const w = Math.min(App.docW - x0, Math.ceil(r * 2) + 1), h = Math.min(App.docH - y0, Math.ceil(r * 2) + 1);
    if (w <= 0 || h <= 0) return;
    const img = src.getContext("2d").getImageData(x0, y0, w, h);
    const d = img.data;
    const md = NS.sizedTmp();
    md.clearRect(0, 0, App.docW, App.docH);
    md.globalAlpha = 1;
    md.fillStyle = "#fff";
    const seed = App.quickSeed;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const dist = Math.hypot(i - (x - x0), j - (y - y0));
      if (dist > r) continue;
      const p = (j * w + i) * 4;
      const dd = Math.abs(d[p] - seed.r) + Math.abs(d[p + 1] - seed.g) + Math.abs(d[p + 2] - seed.b);
      if (dd <= App.quickTol * 3) {
        const a = clamp((1 - dist / r) * 2, 0, 1);
        md.fillStyle = App.quickMode === "sub" ? "rgba(0,0,0," + a + ")" : "rgba(255,255,255," + a + ")";
        md.fillRect(i, j, 1.05, 1.05);
      }
    }
    App.quickSel.getContext("2d").drawImage(NS.tmp, 0, 0);
    App.selection = NS.maskSelection(App.quickSel);
    App.dirty = true;
  };
  NS.maskSelection = (mask) => {
    if (typeof maskBBox !== "function") return { type: "rect", x: 0, y: 0, w: App.docW, h: App.docH, mask };
    const b = maskBBox(mask);
    return { type: "mask", mask, x: b.x, y: b.y, w: b.w, h: b.h };
  };
  NS.finishQuickSelect = () => {
    if (!App.quickSel) return;
    App.selection = NS.maskSelection(App.quickSel);
    const any = App.selection.w > 0 && App.selection.h > 0;
    if (!any) { App.selection = null; App.quickSel = null; }
    pushHistory("Seleksi Cepat");
    updateOptionsBar(); App.dirty = true;
  };

  /* ---------- PENA / VEKTOR ---------- */
  NS.penToSelection = () => {
    const pts = App.penPts;
    if (pts.length < 3) return toast("Pena: minimal 3 titik", true);
    const c = newDocCanvas();
    const t = c.getContext("2d");
    t.fillStyle = "#fff";
    t.beginPath();
    t.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) t.lineTo(pts[i].x, pts[i].y);
    t.closePath();
    t.fill();
    App.selection = NS.maskSelection(c);
    NS.penClear();
    pushHistory("Seleksi dari Pena");
    toast("Seleksi dibuat dari jalur pena");
    updateOptionsBar(); App.dirty = true;
  };
  NS.penFill = (strokeOnly) => {
    const l = NS.canEdit(); if (!l) return;
    const pts = App.penPts;
    if (pts.length < 2) return toast("Pena: minimal 2 titik", true);
    l.ctx.save();
    l.ctx.globalAlpha = App.toolOpacity / 100;
    l.ctx.beginPath();
    l.ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) l.ctx.lineTo(pts[i].x, pts[i].y);
    if (App.penClosed || pts.length > 2) l.ctx.closePath();
    if (strokeOnly) {
      l.ctx.strokeStyle = App.color; l.ctx.lineWidth = Math.max(1, App.brushSize / 6);
      l.ctx.lineJoin = "round"; l.ctx.stroke();
    } else {
      l.ctx.fillStyle = App.color; l.ctx.fill();
      l.ctx.strokeStyle = App.color; l.ctx.lineWidth = 1; l.ctx.stroke();
    }
    l.ctx.restore();
    pushHistory(strokeOnly ? "Garis Pena" : "Isi Pena");
    NS.penClear(); updateLayerThumbs();
  };
  NS.penClear = () => { App.penPts = []; App.penClosed = false; App.dirty = true; updateOptionsBar(); };

  /* ---------- HOOK TOOL ---------- */
  EXT.toolDown = (e, p) => {
    const t = App.tool;
    if (!NS.EXT_TOOLS.includes(t)) return false;
    if (NS.guideStart(e, p)) return true;
    const d = screenToDoc(p.x, p.y);
    if (t === "pen") {
      if (App.penPts.length >= 3 && Math.hypot(d.x - App.penPts[0].x, d.y - App.penPts[0].y) < 8 / App.zoom) {
        App.penClosed = true; NS.penToSelection(); return true;
      }
      App.penPts.push({ x: d.x, y: d.y });
      App.penClosed = false;
      App.dirty = true; updateOptionsBar();
      return true;
    }
    if (t === "quickselect") {
      const l = NS.canEdit(); if (!l) return true;
      const src = App.quickSampleAll ? composite : l.canvas;
      const px = clamp(Math.floor(d.x), 0, App.docW - 1), py = clamp(Math.floor(d.y), 0, App.docH - 1);
      const c = src.getContext("2d").getImageData(px, py, 1, 1).data;
      if (App.quickMode === "new" || !App.quickSel) {
        App.quickSel = newDocCanvas();
        App.quickSeed = { r: c[0], g: c[1], b: c[2] };
      }
      NS.stroke = { last: d };
      NS.quickSelectAt(d.x, d.y);
      return true;
    }
    const l = NS.canEdit();
    if (!l) return true;
    if (t === "clone" || t === "heal") {
      if (e.altKey) {
        App.cloneSrc = { x: d.x, y: d.y };
        App.cloneOffset = null;
        toast(`Sumber ditetapkan (${Math.round(d.x)}, ${Math.round(d.y)})`);
        return true;
      }
      if (!App.cloneSrc) { toast("Alt+klik dahulu untuk menetapkan titik sumber", true); return true; }
      App.cloneSnap = cloneCanvas(l.canvas);
      if (!App.cloneAligned || !App.cloneOffset) {
        App.cloneOffset = { dx: App.cloneSrc.x - d.x, dy: App.cloneSrc.y - d.y };
      }
      NS.stroke = { last: d };
      NS.cloneStampAt(l, d.x, d.y, t === "heal");
      App.dirty = true;
      return true;
    }
    if (t === "smudge") { NS.sizedTmp().drawImage(l.canvas, 0, 0); NS.stroke = { last: d }; return true; }
    NS.stroke = { last: d };
    if (t === "dodge") NS.dodgeAt(l, d.x, d.y, "dodge");
    else if (t === "burn") NS.dodgeAt(l, d.x, d.y, "burn");
    else if (t === "sponge") NS.dodgeAt(l, d.x, d.y, "sponge");
    else if (t === "blurbrush") NS.kernelAt(l, d.x, d.y, [1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9]);
    else if (t === "sharpenbrush") NS.kernelAt(l, d.x, d.y, [0, -1, 0, -1, 5, -1, 0, -1, 0]);
    App.dirty = true;
    return true;
  };

  EXT.toolMove = (e, p) => {
    const t = App.tool;
    if (t === "pen") {
      App.penHover = screenToDoc(p.x, p.y);
      App.dirty = true;
      return true;
    }
    if (NS.guideMove(p)) return true;
    if (!NS.stroke) return NS.EXT_TOOLS.includes(t);
    const l = activeLayer(); if (!l) return true;
    const d = screenToDoc(p.x, p.y);
    if (t === "quickselect") { NS.quickSelectAt(d.x, d.y); NS.stroke.last = d; return true; }
    const step = Math.max(1, App.brushSize * 0.15);
    for (const q of NS.strokeHit(NS.stroke.last, d, step)) {
      if (t === "clone" || t === "heal") NS.cloneStampAt(l, q.x, q.y, t === "heal");
      else if (t === "smudge") NS.smudgeAt(l, NS.stroke.last, q);
      else if (t === "dodge") NS.dodgeAt(l, q.x, q.y, "dodge");
      else if (t === "burn") NS.dodgeAt(l, q.x, q.y, "burn");
      else if (t === "sponge") NS.dodgeAt(l, q.x, q.y, "sponge");
      else if (t === "blurbrush") NS.kernelAt(l, q.x, q.y, [1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9]);
      else if (t === "sharpenbrush") NS.kernelAt(l, q.x, q.y, [0, -1, 0, -1, 5, -1, 0, -1, 0]);
    }
    NS.stroke.last = d;
    App.dirty = true;
    return true;
  };

  EXT.toolUp = (e, p) => {
    if (NS.guideEnd(p)) return true;
    const t = App.tool;
    if (t === "pen") return true;
    if (t === "quickselect") { NS.stroke = null; NS.finishQuickSelect(); return true; }
    if (!NS.stroke) return NS.EXT_TOOLS.includes(t);
    NS.stroke = null;
    App.cloneSnap = null;
    const label = t === "clone" ? "Stempel Klon" : t === "heal" ? "Perbaikan Bercak"
      : t === "dodge" ? "Dodge" : t === "burn" ? "Burn" : t === "sponge" ? "Sponge"
      : t === "smudge" ? "Smudge" : t === "blurbrush" ? "Kuas Blur" : "Kuas Tajam";
    pushHistory(label);
    updateLayerThumbs();
    return true;
  };

  /* ---------- PENGARIS & GARIS PANDUAN ---------- */
  NS.RULER = 18;
  NS.guideStart = (e, p) => {
    if (!App.showRulers) return false;
    if (p.x <= NS.RULER && p.y > NS.RULER) {
      App.guideDrag = { axis: "x", from: "ruler", pos: 0 };
      return true;
    }
    if (p.y <= NS.RULER && p.x > NS.RULER) {
      App.guideDrag = { axis: "y", from: "ruler", pos: 0 };
      return true;
    }
    const d = screenToDoc(p.x, p.y);
    const tol = 5 / App.zoom;
    const g = App.guides.find(g => (g.axis === "x" ? Math.abs(g.pos - d.x) : Math.abs(g.pos - d.y)) < tol);
    if (g) { App.guideDrag = { axis: g.axis, guide: g, from: "guide" }; return true; }
    return false;
  };
  NS.guideMove = (p) => {
    const gd = App.guideDrag;
    if (!gd) return false;
    const d = screenToDoc(p.x, p.y);
    gd.pos = gd.axis === "x" ? d.x : d.y;
    App.dirty = true;
    return true;
  };
  NS.guideEnd = (p) => {
    const gd = App.guideDrag;
    if (!gd) return false;
    App.guideDrag = null;
    const mx = p ? p.x : App.mouse.x, my = p ? p.y : App.mouse.y;
    const inRuler = gd.axis === "x" ? mx <= NS.RULER : my <= NS.RULER;
    if (gd.from === "guide") {
      if (inRuler) { App.guides = App.guides.filter(g => g !== gd.guide); toast("Garis panduan dihapus"); }
      else { gd.guide.pos = Math.round(gd.pos); pushHistory("Geser Garis Panduan"); }
    } else if (!inRuler) {
      App.guides.push({ axis: gd.axis, pos: Math.round(gd.pos) });
      toast("Garis panduan ditambah — seret ke penggaris untuk menghapus");
    }
    App.dirty = true;
    return true;
  };
  const _snapTargets = snapTargets;
  snapTargets = function (axis) {
    const t = _snapTargets(axis);
    if (App.showGuides) for (const g of App.guides) {
      if ((g.axis === "x" && axis === "x") || (g.axis === "y" && axis === "y")) t.push(g.pos);
    }
    return t;
  };

  /* ---------- OVERLAY ---------- */
  EXT.overlayDoc = (ctx) => {
    const z = App.zoom;
    if (App.showGuides && App.guides.length) {
      ctx.save();
      ctx.strokeStyle = "rgba(0,220,255,.85)";
      ctx.lineWidth = 1 / z;
      for (const g of App.guides) {
        ctx.beginPath();
        if (g.axis === "x") { ctx.moveTo(g.pos, -4000); ctx.lineTo(g.pos, App.docH + 4000); }
        else { ctx.moveTo(-4000, g.pos); ctx.lineTo(App.docW + 4000, g.pos); }
        ctx.stroke();
      }
      ctx.restore();
    }
    const gd = App.guideDrag;
    if (gd && gd.pos != null) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,220,0,.95)";
      ctx.lineWidth = 1 / z;
      ctx.setLineDash([5 / z, 4 / z]);
      ctx.beginPath();
      if (gd.axis === "x") { ctx.moveTo(gd.pos, 0); ctx.lineTo(gd.pos, App.docH); }
      else { ctx.moveTo(0, gd.pos); ctx.lineTo(App.docW, gd.pos); }
      ctx.stroke();
      ctx.restore();
    }
    if (App.tool === "pen" && App.penPts.length) {
      ctx.save();
      ctx.strokeStyle = "#7ec8ff";
      ctx.lineWidth = 1.4 / z;
      ctx.beginPath();
      ctx.moveTo(App.penPts[0].x, App.penPts[0].y);
      for (let i = 1; i < App.penPts.length; i++) ctx.lineTo(App.penPts[i].x, App.penPts[i].y);
      if (App.penHover) ctx.lineTo(App.penHover.x, App.penHover.y);
      ctx.stroke();
      ctx.setLineDash([4 / z, 3 / z]);
      ctx.strokeStyle = "rgba(120,200,255,.6)";
      if (App.penHover) {
        ctx.beginPath();
        ctx.moveTo(App.penHover.x, App.penHover.y);
        ctx.lineTo(App.penPts[0].x, App.penPts[0].y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      const s = 3 / z;
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#1f6fb2";
      App.penPts.forEach((q, i) => {
        ctx.beginPath();
        ctx.rect(q.x - s, q.y - s, s * 2, s * 2);
        ctx.fill(); ctx.stroke();
        if (i === 0) { ctx.fillStyle = "#7ec8ff"; ctx.fillRect(q.x - s * 1.6, q.y - s * 1.6, s * 3.2, s * 3.2); ctx.fillStyle = "#fff"; }
      });
      ctx.restore();
    }
  };
  EXT.overlayScreen = (ctx, vw, vh) => {
    if (App.showRulers) {
      const R = NS.RULER;
      ctx.save();
      ctx.fillStyle = "#262626";
      ctx.fillRect(0, 0, vw, R);
      ctx.fillRect(0, 0, R, vh);
      ctx.fillStyle = "#3a3a3a";
      ctx.fillRect(0, 0, R, R);
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, R + .5); ctx.lineTo(vw, R + .5); ctx.moveTo(R + .5, 0); ctx.lineTo(R + .5, vh); ctx.stroke();
      const step = App.zoom < 0.25 ? 200 : App.zoom < 0.6 ? 100 : App.zoom < 1.5 ? 50 : 10;
      ctx.fillStyle = "#9a9a9a";
      ctx.font = "9px sans-serif";
      ctx.strokeStyle = "#6a6a6a";
      ctx.beginPath();
      for (let x = 0; x <= App.docW; x += step) {
        const sx = x * App.zoom + App.panX;
        if (sx < R || sx > vw) continue;
        ctx.moveTo(Math.round(sx) + .5, R - 4); ctx.lineTo(Math.round(sx) + .5, R);
        ctx.fillText(String(Math.round(x)), Math.round(sx) + 2, 9);
      }
      for (let y = 0; y <= App.docH; y += step) {
        const sy = y * App.zoom + App.panY;
        if (sy < R || sy > vh) continue;
        ctx.moveTo(R - 4, Math.round(sy) + .5); ctx.lineTo(R, Math.round(sy) + .5);
        ctx.save();
        ctx.translate(8, Math.round(sy) + 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(String(Math.round(y)), 0, 0);
        ctx.restore();
      }
      ctx.stroke();
      ctx.restore();
    }
    if (NS.EXT_TOOLS.includes(App.tool) && App.mouse.inside && !App.mouse.touch) {
      const r = App.tool === "pen" ? 4 : Math.max(2, App.brushSize * App.zoom / 2);
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(App.mouse.x, App.mouse.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,.6)";
      ctx.beginPath(); ctx.arc(App.mouse.x, App.mouse.y, r + 1, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (App.mode === "gray") {
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.font = "bold 10px sans-serif";
      ctx.fillText("MODE: GRAYSCALE", NS.RULER + 8, 12);
      ctx.restore();
    }
  };

  /* ---------- LAPISAN PENYESUAIAN + CLIPPING ---------- */
  NS.clipBase = (l) => {
    const i = layerIndex(l.id);
    for (let k = i - 1; k >= 0; k--) {
      const b = App.layers[k];
      if (b.isGroup) continue;
      if (b.group !== l.group) continue;
      return b;
    }
    return null;
  };
  NS.applyAdj = (ctx, l) => {
    const adj = l.adj;
    if (!adj || !NS.ADJUST[adj.type]) return;
    const w = App.docW, h = App.docH;
    const cur = ctx.getImageData(0, 0, w, h);
    const edited = new ImageData(new Uint8ClampedArray(cur.data), w, h);
    NS.ADJUST[adj.type](edited.data, adj.params || {}, w, h);
    const layerAlpha = clamp((l.opacity == null ? 100 : l.opacity) / 100, 0, 1);
    const maskData = (l.mask && l.maskOn !== false) ? l.mask.getContext("2d").getImageData(0, 0, w, h).data : null;
    const base = l.clip ? NS.clipBase(l) : null;
    const baseData = base ? base.canvas.getContext("2d").getImageData(0, 0, w, h).data : null;
    const cd = cur.data, ed = edited.data;
    for (let p = 0; p < w * h; p++) {
      let a = layerAlpha;
      if (maskData) a *= maskData[p * 4 + 3] / 255;
      if (baseData) a *= baseData[p * 4 + 3] / 255;
      if (a <= 0) continue;
      const i = p * 4;
      cd[i] = cd[i] * (1 - a) + ed[i] * a;
      cd[i + 1] = cd[i + 1] * (1 - a) + ed[i + 1] * a;
      cd[i + 2] = cd[i + 2] * (1 - a) + ed[i + 2] * a;
    }
    ctx.putImageData(cur, 0, 0);
  };
  EXT.drawLayer = (ctx, l) => {
    if (l.adj) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      NS.applyAdj(ctx, l);
      ctx.restore();
      return true;
    }
    if (l.clip) {
      const base = NS.clipBase(l);
      if (!base) return false;
      const w = App.docW, h = App.docH;
      const tmp = newDocCanvas();
      const tc = tmp.getContext("2d");
      tc.save();
      tc.globalAlpha = l.opacity / 100;
      tc.globalCompositeOperation = l.blendMode;
      drawLayerStyled(tc, l);
      tc.restore();
      const bd = base.canvas.getContext("2d").getImageData(0, 0, w, h).data;
      const td = tc.getImageData(0, 0, w, h);
      for (let p = 0; p < w * h; p++) td.data[p * 4 + 3] = Math.round(td.data[p * 4 + 3] * (bd[p * 4 + 3] / 255));
      tc.putImageData(td, 0, 0);
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(tmp, 0, 0);
      ctx.restore();
      return true;
    }
    return false;
  };
  /* fungsi penyesuaian (dipakai lapisan penyesuaian & dialog) */
  NS.ADJUST = {
    brightness: (d, p) => {
      const c = p.contrast * 2.55, f = (259 * (c + 255)) / (255 * (259 - c)), add = p.brightness * 2.55;
      for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) d[i + k] = clamp(f * (d[i + k] - 128) + 128 + add, 0, 255);
    },
    hsl: (d, p) => {
      for (let i = 0; i < d.length; i += 4) {
        let [h, s, l] = rgb2hsl(d[i], d[i + 1], d[i + 2]);
        h = (h + p.hue / 360 + 1) % 1;
        s = clamp(s * (1 + p.sat / 100), 0, 1);
        l = clamp(l * (1 + p.light / 100), 0, 1);
        const [r, g, b] = hsl2rgb(h, s, l);
        d[i] = r; d[i + 1] = g; d[i + 2] = b;
      }
    },
    levels: (d, p) => {
      const span = Math.max(1, p.white - p.black), gamma = Math.max(0.1, p.gamma / 10);
      const t = new Uint8ClampedArray(256);
      for (let i = 0; i < 256; i++) t[i] = clamp(255 * Math.pow(clamp((i - p.black) * 255 / span, 0, 255) / 255, 1 / gamma), 0, 255);
      for (let i = 0; i < d.length; i += 4) { d[i] = t[d[i]]; d[i + 1] = t[d[i + 1]]; d[i + 2] = t[d[i + 2]]; }
    },
    curves: (d, p) => {
      const t = NS.curveLUT(p.points);
      for (let i = 0; i < d.length; i += 4) { d[i] = t[d[i]]; d[i + 1] = t[d[i + 1]]; d[i + 2] = t[d[i + 2]]; }
    },
    exposure: (d, p) => {
      const m = Math.pow(2, p.ev);
      const off = p.offset || 0;
      for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) d[i + k] = clamp(d[i + k] * m + off, 0, 255);
    },
    vibrance: (d, p) => {
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        const sat = mx === 0 ? 0 : (mx - mn) / mx;
        const amt = (p.vibrance / 100) * (1 - sat);
        const g0 = 0.299 * r + 0.587 * g + 0.114 * b;
        d[i] = clamp(g0 + (r - g0) * (1 + amt + p.saturation / 100), 0, 255);
        d[i + 1] = clamp(g0 + (g - g0) * (1 + amt + p.saturation / 100), 0, 255);
        d[i + 2] = clamp(g0 + (b - g0) * (1 + amt + p.saturation / 100), 0, 255);
      }
    },
    colorbalance: (d, p) => {
      for (let i = 0; i < d.length; i += 4) {
        const v = (d[i] + d[i + 1] + d[i + 2]) / 3;
        const w = Math.abs((v - 127.5) / 127.5);
        const shadowW = clamp(1 - w * 2, 0, 1), highW = clamp(w * 2 - 1, 0, 1), midW = clamp(1 - shadowW - highW, 0, 1);
        const sr = (p.rs * shadowW + p.rm * midW + p.rh * highW) * 2.55;
        const sg = (p.gs * shadowW + p.gm * midW + p.gh * highW) * 2.55;
        const sb = (p.bs * shadowW + p.bm * midW + p.bh * highW) * 2.55;
        d[i] = clamp(d[i] + sr, 0, 255);
        d[i + 1] = clamp(d[i + 1] + sg, 0, 255);
        d[i + 2] = clamp(d[i + 2] + sb, 0, 255);
      }
    },
    threshold: (d, p) => {
      for (let i = 0; i < d.length; i += 4) {
        const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] > p.level ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = v;
      }
    },
    posterize: (d, p) => {
      const n = Math.max(2, p.levels);
      const t = new Uint8ClampedArray(256);
      for (let i = 0; i < 256; i++) t[i] = Math.round(Math.round(i / 255 * (n - 1)) / (n - 1) * 255);
      for (let i = 0; i < d.length; i += 4) { d[i] = t[d[i]]; d[i + 1] = t[d[i + 1]]; d[i + 2] = t[d[i + 2]]; }
    },
    gradientmap: (d, p) => {
      const [r0, g0, b0] = hexToRgbObj(p.from), [r1, g1, b1] = hexToRgbObj(p.to);
      for (let i = 0; i < d.length; i += 4) {
        const v = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
        d[i] = r0 + (r1 - r0) * v; d[i + 1] = g0 + (g1 - g0) * v; d[i + 2] = b0 + (b1 - b0) * v;
      }
    },
    photofilter: (d, p) => {
      const [r, g, b] = hexToRgbObj(p.color);
      const a = p.density / 100;
      for (let i = 0; i < d.length; i += 4) {
        let nr = d[i] * (1 - a) + r * a, ng = d[i + 1] * (1 - a) + g * a, nb = d[i + 2] * (1 - a) + b * a;
        if (p.preserve) {
          const l0 = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          const l1 = 0.299 * nr + 0.587 * ng + 0.114 * nb;
          const k = l1 === 0 ? 1 : l0 / l1;
          nr *= k; ng *= k; nb *= k;
        }
        d[i] = clamp(nr, 0, 255); d[i + 1] = clamp(ng, 0, 255); d[i + 2] = clamp(nb, 0, 255);
      }
    },
    channelmixer: (d, p) => {
      const rr = p.rr / 100, rg = p.rg / 100, rb = p.rb / 100;
      const gr = p.gr / 100, gg = p.gg / 100, gb = p.gb / 100;
      const br = p.br / 100, bg = p.bg / 100, bb = p.bb / 100;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        d[i] = clamp(r * rr + g * rg + b * rb, 0, 255);
        d[i + 1] = clamp(r * gr + g * gg + b * gb, 0, 255);
        d[i + 2] = clamp(r * br + g * bg + b * bb, 0, 255);
      }
      if (p.mono) for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = d[i];
    },
    selective: (d, p) => {
      const ranges = {
        merah: (r, g, b) => r > g && r > b, kuning: (r, g, b) => r > 100 && g > 100 && b < g * 0.8,
        hijau: (r, g, b) => g > r && g > b, cyan: (r, g, b) => g > 100 && b > 100 && r < g * 0.8,
        biru: (r, g, b) => b > r && b > g, magenta: (r, g, b) => r > 100 && b > 100 && g < r * 0.8,
        netral: (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx - mn < 40 && mx > 40 && mx < 220; },
        putih: (r, g, b) => r > 220 && g > 220 && b > 220, hitam: (r, g, b) => r < 40 && g < 40 && b < 40,
      };
      const test = ranges[p.range] || (() => true);
      for (let i = 0; i < d.length; i += 4) {
        if (!test(d[i], d[i + 1], d[i + 2])) continue;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        d[i] = clamp(r - p.cyan * 2.55 * 0.6 + p.red * 2.55 * 0.6 - p.magenta * 2.55 * 0.4, 0, 255);
        d[i + 1] = clamp(g - p.magenta * 2.55 * 0.6 + p.green * 2.55 * 0.6 - p.yellow * 2.55 * 0.4, 0, 255);
        d[i + 2] = clamp(b - p.yellow * 2.55 * 0.6 + p.blue * 2.55 * 0.6 - p.cyan * 2.55 * 0.4, 0, 255);
        if (p.black !== 0) { const f = 1 + p.black / 100; d[i] = clamp(r * f, 0, 255); d[i + 1] = clamp(g * f, 0, 255); d[i + 2] = clamp(b * f, 0, 255); }
      }
    },
    shadowshigh: (d, p) => {
      const t = new Uint8ClampedArray(256);
      for (let i = 0; i < 256; i++) {
        const v = i / 255;
        const shadow = p.shadows * (1 - v) * (1 - v);
        const high = p.highlights * v * v;
        t[i] = clamp((v + (shadow + high) / 100) * 255, 0, 255);
      }
      for (let i = 0; i < d.length; i += 4) { d[i] = t[d[i]]; d[i + 1] = t[d[i + 1]]; d[i + 2] = t[d[i + 2]]; }
      if (p.midtone) NS.ADJUST.brightness(d, { brightness: p.midtone * 0.4, contrast: p.contrast || 0 });
    },
  };
  function hexToRgbObj(hex) {
    const n = parseInt((hex || "#000000").slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  NS.curveLUT = (points) => {
    const pts = (points && points.length >= 2) ? [...points].sort((a, b) => a[0] - b[0]) : [[0, 0], [255, 255]];
    const t = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) {
      let v = i;
      for (let k = 0; k < pts.length - 1; k++) {
        const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
        if (i >= x0 && i <= x1 && x1 > x0) { v = y0 + (y1 - y0) * (i - x0) / (x1 - x0); break; }
      }
      t[i] = clamp(Math.round(v), 0, 255);
    }
    return t;
  };

  /* ---------- ROTASI TAMPILAN ---------- */
  NS.setViewRot = (deg) => {
    App.viewRotDeg = ((Math.round(deg) % 360) + 360) % 360;
    App.viewRot = App.viewRotDeg * Math.PI / 180;
    App.dirty = true;
    toast("Rotasi tampilan: " + App.viewRotDeg + "°");
    updateOptionsBar();
  };
  NS.dialogRotation = () => {
    showModal("Rotasi Tampilan Kanvas", `
      <label class="adj-label">Sudut <span class="adj-val" id="rotv">${App.viewRotDeg}°</span>
        <input type="range" id="rot-r" min="-180" max="180" value="${App.viewRotDeg}">
      </label>
      <p style="color:var(--text2)">Rotasi hanya untuk tampilan (tidak mengubah berkas).</p>`, [
      { label: "Reset", onClick: () => NS.setViewRot(0) },
      { label: "Oke", primary: true, onClick: () => {} },
    ]);
    $("#rot-r").addEventListener("input", e => { $("#rotv").textContent = e.target.value + "°"; NS.setViewRot(+e.target.value); });
  };
  NS.rotateViewBy = (d) => NS.setViewRot(App.viewRotDeg + d);

  /* ---------- BADGE LAPISAN ---------- */
  window.extBadges = function (l) {
    let s = "";
    if (l.adj) s += '<span class="badge abadge" title="Lapisan penyesuaian (non-destruktif)">◐</span>';
    if (l.clip) s += '<span class="badge cbadge" title="Clipping mask — hanya tampil di area lapisan bawah">⌐</span>';
    return s;
  };

  /* ---------- OPTIONS BAR ---------- */
  NS.optSlider = (id, label, min, max, val, unit = "") =>
    `<label>${label}<input type="range" class="ext-range" id="ex-${id}" min="${min}" max="${max}" value="${val}"><span class="val" id="exv-${id}">${val}${unit}</span></label>`;
  NS.bindSlider = (id, key, unit = "") => {
    const el = $("#ex-" + id);
    if (!el) return;
    el.addEventListener("input", () => {
      App[key] = +el.value;
      const v = $("#exv-" + id);
      if (v) v.textContent = el.value + unit;
      App.dirty = true;
    });
  };
  NS.brushOpts = () => NS.optSlider("size", "Ukuran", 1, 300, App.brushSize, "px") + NS.optSlider("op", "Opasitas", 1, 100, App.toolOpacity, "%") + NS.optSlider("hard", "Kekerasan", 0, 100, App.hardness, "%");
  EXT.optionsBar = (t) => {
    if (t === "clone" || t === "heal") {
      const html = NS.brushOpts()
        + `<label class="chk"><input type="checkbox" id="ex-align" ${App.cloneAligned ? "checked" : ""}>Sejajar</label>`
        + (t === "heal" ? NS.optSlider("heal", "Kekuatan", 10, 100, App.healStrength, "%") : "")
        + `<span style="color:var(--text2)">Alt+klik = tetapkan sumber${App.cloneSrc ? ` (${Math.round(App.cloneSrc.x)}, ${Math.round(App.cloneSrc.y)})` : ""}</span>`;
      return { html, bind: () => { NS.bindSlider("size", "brushSize", "px"); NS.bindSlider("op", "toolOpacity", "%"); NS.bindSlider("hard", "hardness", "%"); NS.bindSlider("heal", "healStrength", "%"); const a = $("#ex-align"); if (a) a.addEventListener("change", () => App.cloneAligned = a.checked); } };
    }
    if (t === "dodge" || t === "burn") {
      const html = NS.brushOpts() + NS.optSlider("exp", "Kekuatan", 1, 100, App.dodgeExposure, "%");
      return { html, bind: () => { NS.bindSlider("size", "brushSize", "px"); NS.bindSlider("op", "toolOpacity", "%"); NS.bindSlider("hard", "hardness", "%"); NS.bindSlider("exp", "dodgeExposure", "%"); } };
    }
    if (t === "sponge") {
      const html = NS.brushOpts() + NS.optSlider("exp", "Kekuatan", 1, 100, App.dodgeExposure, "%")
        + `<div class="radio-group" id="ex-sponge"><button data-v="desat" class="${App.spongeMode === "desat" ? "on" : ""}">Kurangi Warna</button><button data-v="sat" class="${App.spongeMode === "sat" ? "on" : ""}">Tambah Warna</button></div>`;
      return { html, bind: () => { NS.bindSlider("size", "brushSize", "px"); NS.bindSlider("op", "toolOpacity", "%"); NS.bindSlider("hard", "hardness", "%"); NS.bindSlider("exp", "dodgeExposure", "%"); const g = $("#ex-sponge"); g && g.querySelectorAll("button").forEach(b => b.addEventListener("click", () => { App.spongeMode = b.dataset.v; updateOptionsBar(); })); } };
    }
    if (t === "smudge") {
      const html = NS.brushOpts() + NS.optSlider("sm", "Kekuatan", 5, 100, App.smudgeStrength, "%");
      return { html, bind: () => { NS.bindSlider("size", "brushSize", "px"); NS.bindSlider("op", "toolOpacity", "%"); NS.bindSlider("hard", "hardness", "%"); NS.bindSlider("sm", "smudgeStrength", "%"); } };
    }
    if (t === "blurbrush" || t === "sharpenbrush") {
      const html = NS.brushOpts() + `<span style="color:var(--text2)">Sapukan di kanvas untuk ${t === "blurbrush" ? "mengaburkan" : "mempertajam"} area lokal</span>`;
      return { html, bind: () => { NS.bindSlider("size", "brushSize", "px"); NS.bindSlider("op", "toolOpacity", "%"); NS.bindSlider("hard", "hardness", "%"); } };
    }
    if (t === "quickselect") {
      const html = NS.brushOpts() + NS.optSlider("qtol", "Toleransi", 1, 120, App.quickTol)
        + `<div class="radio-group" id="ex-qmode">
             <button data-v="new" class="${App.quickMode === "new" ? "on" : ""}">Baru</button>
             <button data-v="add" class="${App.quickMode === "add" ? "on" : ""}">Tambah</button>
             <button data-v="sub" class="${App.quickMode === "sub" ? "on" : ""}">Kurangi</button>
           </div>
           <label class="chk"><input type="checkbox" id="ex-qall" ${App.quickSampleAll ? "checked" : ""}>Semua Lapisan</label>`
        + `<button class="opt-btn" id="ex-qdone">Buat Seleksi</button>`;
      return { html, bind: () => { NS.bindSlider("size", "brushSize", "px"); NS.bindSlider("op", "toolOpacity", "%"); NS.bindSlider("hard", "hardness", "%"); NS.bindSlider("qtol", "quickTol"); const g = $("#ex-qmode"); g && g.querySelectorAll("button").forEach(b => b.addEventListener("click", () => { App.quickMode = b.dataset.v; updateOptionsBar(); })); const q = $("#ex-qall"); q && q.addEventListener("change", () => App.quickSampleAll = q.checked); const d = $("#ex-qdone"); d && d.addEventListener("click", NS.finishQuickSelect); } };
    }
    if (t === "pen") {
      const html = `<button class="opt-btn primary" id="ex-pen-sel">Buat Seleksi</button>
        <button class="opt-btn" id="ex-pen-fill">Isi</button>
        <button class="opt-btn" id="ex-pen-stroke">Tepi</button>
        <button class="opt-btn" id="ex-pen-clear">Hapus Jalur</button>
        <span style="color:var(--text2)">${App.penPts.length} titik — klik awal untuk menutup, Enter = seleksi, Esc = batal</span>`;
      return { html, bind: () => { $("#ex-pen-sel").addEventListener("click", NS.penToSelection); $("#ex-pen-fill").addEventListener("click", () => NS.penFill(false)); $("#ex-pen-stroke").addEventListener("click", () => NS.penFill(true)); $("#ex-pen-clear").addEventListener("click", NS.penClear); } };
    }
    return null;
  };

  /* Enter / Esc untuk pena */
  document.addEventListener("keydown", e => {
    if (e.target.matches("input, textarea, select")) return;
    if (App.tool !== "pen") return;
    if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); NS.penToSelection(); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); NS.penClear(); }
  }, true);

  NS.init = () => { NS.initPanels && NS.initPanels(); };
  void NS.init;
})();
