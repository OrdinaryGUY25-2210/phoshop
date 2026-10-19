"use strict";
/* Engine brush komik/webtoon — preset & stamping */
const TIP_CACHE = {};
function mkCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function tip(key, gen) { if (!TIP_CACHE[key]) TIP_CACHE[key] = gen(); return TIP_CACHE[key]; }

const TIP_GENS = {
  soft: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, "#000"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return c; },
  hard: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.fillStyle = "#000"; x.beginPath(); x.arc(32, 32, 28, 0, 7); x.fill(); return c; },
  cloud: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); for (let i = 0; i < 14; i++) { const g = x.createRadialGradient(Math.random() * 64, Math.random() * 64, 1, 32, 32, 30); g.addColorStop(0, "rgba(0,0,0,.5)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); } return c; },
  grain: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(0,0,0,${.25 + Math.random() * .75})`; const r = Math.random() * 1.6 + .3; x.fillRect(Math.random() * 64, Math.random() * 64, r, r); } return c; },
  spray: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); for (let i = 0; i < 90; i++) { const a = Math.random() * Math.PI * 2, d = Math.random() * 30; x.fillStyle = `rgba(0,0,0,${.12 + Math.random() * .3})`; x.beginPath(); x.arc(32 + Math.cos(a) * d, 32 + Math.sin(a) * d, Math.random() * 1.8 + .4, 0, 7); x.fill(); } return c; },
  hatch: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.strokeStyle = "rgba(0,0,0,.85)"; x.lineWidth = 1.6; for (let i = -4; i < 9; i++) { x.beginPath(); x.moveTo(i * 10, 0); x.lineTo(i * 10 + 50, 64); x.stroke(); } return c; },
  star: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.fillStyle = "#000"; x.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 8 : 28; x[i ? "lineTo" : "moveTo"](32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.closePath(); x.fill(); return c; },
  splat: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.fillStyle = "#000"; x.beginPath(); x.arc(32, 32, 12, 0, 7); x.fill(); for (let i = 0; i < 12; i++) { const a = Math.random() * 7, d = 14 + Math.random() * 17; x.beginPath(); x.arc(32 + Math.cos(a) * d, 32 + Math.sin(a) * d, 1 + Math.random() * 4, 0, 7); x.fill(); } return c; },
  streak: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); const g = x.createLinearGradient(0, 32, 64, 32); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(.5, "#000"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 29, 64, 6); return c; },
  scratch: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.strokeStyle = "#000"; for (let i = 0; i < 7; i++) { x.lineWidth = .8 + Math.random() * 2.2; x.beginPath(); const y = 6 + Math.random() * 52; x.moveTo(2, y); x.quadraticCurveTo(32, y + (Math.random() - .5) * 18, 62, y + (Math.random() - .5) * 12); x.stroke(); } return c; },
  dotsTile: (n, r) => () => { const c = mkCanvas(n, n), x = c.getContext("2d"); x.fillStyle = "#000"; x.beginPath(); x.arc(n / 2, n / 2, r, 0, 7); x.fill(); return c; },
  linesTile: (n) => () => { const c = mkCanvas(n, n), x = c.getContext("2d"); x.strokeStyle = "#000"; x.lineWidth = Math.max(1.5, n / 12); x.beginPath(); x.moveTo(0, n / 2); x.lineTo(n, n / 2); x.stroke(); return c; },
  crossTile: (n) => () => { const c = mkCanvas(n, n), x = c.getContext("2d"); x.strokeStyle = "#000"; x.lineWidth = Math.max(1.2, n / 14); x.beginPath(); x.moveTo(0, 0); x.lineTo(n, n); x.moveTo(n, 0); x.lineTo(0, n); x.stroke(); return c; },
};

const BRUSH_PRESETS = [
  { id: "gpen", cat: "Pena Komik", name: "G-Pen", type: "circle", hardness: 94, size: 8, opacity: 100, scatter: 0, spacing: .07, pressure: 1 },
  { id: "mapping", cat: "Pena Komik", name: "Mapping Pen", type: "circle", hardness: 100, size: 3, opacity: 100, scatter: 0, spacing: .09, pressure: 1 },
  { id: "maru", cat: "Pena Komik", name: "R-Pen Maru", type: "circle", hardness: 100, size: 5, opacity: 100, scatter: 0, spacing: .08, pressure: 1 },
  { id: "brushpen", cat: "Pena Komik", name: "Brush Pen", type: "circle", hardness: 42, size: 24, opacity: 92, scatter: 0, spacing: .1, pressure: 1 },
  { id: "inkwash", cat: "Pena Komik", name: "Tinta Air", type: "cloud", size: 34, hardness: 30, opacity: 55, scatter: .3, spacing: .14, jitter: .35, pressure: .6 },
  { id: "pencil", cat: "Tekstur", name: "Pensil", type: "grain", size: 12, hardness: 80, opacity: 85, scatter: .18, spacing: .1 },
  { id: "water", cat: "Tekstur", name: "Cat Air", type: "cloud", size: 44, hardness: 20, opacity: 42, scatter: .22, spacing: .12, jitter: .3 },
  { id: "airbrush", cat: "Tekstur", name: "Airbrush", type: "spray", size: 60, hardness: 10, opacity: 38, scatter: .7, spacing: .06 },
  { id: "charcoal", cat: "Tekstur", name: "Arang", type: "hatch", size: 26, hardness: 70, opacity: 72, scatter: .28, spacing: .12, rotJit: .5 },
  { id: "tone-l", cat: "Screentone", name: "Tone Titik Besar", type: "tile", tile: 36, tipKey: "d36-13", gen: TIP_GENS.dotsTile(36, 13), size: 36, hardness: 100, opacity: 100, spacing: 1, align: 1 },
  { id: "tone-m", cat: "Screentone", name: "Tone Titik Sedang", type: "tile", tile: 28, tipKey: "d28-8", gen: TIP_GENS.dotsTile(28, 8), size: 28, hardness: 100, opacity: 100, spacing: 1, align: 1 },
  { id: "tone-s", cat: "Screentone", name: "Tone Titik Halus", type: "tile", tile: 20, tipKey: "d20-5", gen: TIP_GENS.dotsTile(20, 5), size: 20, hardness: 100, opacity: 100, spacing: 1, align: 1 },
  { id: "tone-line", cat: "Screentone", name: "Tone Garis", type: "tile", tile: 24, tipKey: "l24", gen: TIP_GENS.linesTile(24), size: 24, hardness: 100, opacity: 100, spacing: 1, align: 1 },
  { id: "tone-cross", cat: "Screentone", name: "Tone Silang", type: "tile", tile: 26, tipKey: "c26", gen: TIP_GENS.crossTile(26), size: 26, hardness: 100, opacity: 100, spacing: 1, align: 1 },
  { id: "speed", cat: "Efek Webtoon", name: "Speed Lines", type: "streak", size: 18, hardness: 60, opacity: 88, scatter: .55, spacing: .09, rotJit: .12 },
  { id: "sparkle", cat: "Efek Webtoon", name: "Kilau / Star", type: "star", size: 20, hardness: 90, opacity: 92, scatter: .8, spacing: .5, rotJit: 3.1, jitter: .5 },
  { id: "splat", cat: "Efek Webtoon", name: "Cipratan", type: "splat", size: 22, hardness: 90, opacity: 95, scatter: .6, spacing: .35, rotJit: 3.1, jitter: .4 },
  { id: "smoke", cat: "Efek Webtoon", name: "Asap / Kabut", type: "cloud", size: 56, hardness: 15, opacity: 32, scatter: .5, spacing: .12, jitter: .4 },
  { id: "abstract", cat: "Efek Webtoon", name: "Gores Abstrak", type: "scratch", size: 40, hardness: 80, opacity: 80, scatter: .45, spacing: .22, rotJit: 3.1, jitter: .35 },
  { id: "glow", cat: "Efek Webtoon", name: "Cahaya Lembut", type: "soft", size: 70, hardness: 5, opacity: 26, scatter: .2, spacing: .08 },
];

const BrushFX = {
  tipFor(p) {
    if (p.type === "tile") return tip(p.tipKey, p.gen);
    if (p.type === "soft" || p.type === "glow") return tip("soft", TIP_GENS.soft);
    return tip(p.type, TIP_GENS[p.type] || TIP_GENS.hard);
  },
  stamp(ctx, x, y, o) {
    const p = o.preset;
    let s = o.size;
    if (p.pressure && o.pressure < 1) s *= .28 + .72 * o.pressure;
    s = Math.max(1, s);
    const sc = p.scatter || 0;
    if (p.align && p.type === "tile") {
      const t = p.tile;
      const gx = Math.round(x / t) * t, gy = Math.round(y / t) * t;
      const key = gx + "," + gy;
      if (o.cells) { if (o.cells.has(key)) return; o.cells.add(key); }
      ctx.drawImage(BrushFX.tipFor(p), gx - t / 2, gy - t / 2, t, t);
      return;
    }
    const jx = (Math.random() - .5) * s * sc * 2, jy = (Math.random() - .5) * s * sc * 2;
    const sz = s * (1 - Math.random() * (p.jitter || 0));
    if (p.type === "circle") {
      const hard = (p.hardness ?? 100) / 100;
      const g = ctx.createRadialGradient(x + jx, y + jy, Math.max(.5, sz / 2 * hard), x + jx, y + jy, sz / 2);
      g.addColorStop(0, o.color); g.addColorStop(1, o.colorHexA0);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x + jx, y + jy, sz / 2, 0, 7); ctx.fill();
    } else {
      ctx.save();
      ctx.translate(x + jx, y + jy);
      ctx.rotate((o.angle || 0) + (Math.random() - .5) * (p.rotJit ?? .6));
      const f = sz / 64 * (p.type === "tile" ? 1 : 1);
      ctx.scale(f, f);
      ctx.drawImage(BrushFX.tipFor(p), -32, -32);
      ctx.restore();
    }
  },
};
