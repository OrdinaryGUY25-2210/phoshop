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
  dotsTileDense: (n, r) => () => {
    const c = mkCanvas(n, n), x = c.getContext("2d"); x.fillStyle = "#000";
    for (const [px, py] of [[n / 4, n / 4], [3 * n / 4, 3 * n / 4]]) { x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); }
    return c;
  },
  linesTile: (n) => () => { const c = mkCanvas(n, n), x = c.getContext("2d"); x.strokeStyle = "#000"; x.lineWidth = Math.max(1.5, n / 12); x.beginPath(); x.moveTo(0, n / 2); x.lineTo(n, n / 2); x.stroke(); return c; },
  linesTileV: (n) => () => { const c = mkCanvas(n, n), x = c.getContext("2d"); x.strokeStyle = "#000"; x.lineWidth = Math.max(1.5, n / 12); x.beginPath(); x.moveTo(n / 2, 0); x.lineTo(n / 2, n); x.stroke(); return c; },
  crossTile: (n) => () => { const c = mkCanvas(n, n), x = c.getContext("2d"); x.strokeStyle = "#000"; x.lineWidth = Math.max(1.2, n / 14); x.beginPath(); x.moveTo(0, 0); x.lineTo(n, n); x.moveTo(n, 0); x.lineTo(0, n); x.stroke(); return c; },
  gridTile: (n) => () => {
    const c = mkCanvas(n, n), x = c.getContext("2d"); x.strokeStyle = "#000"; x.lineWidth = Math.max(1.2, n / 14);
    x.beginPath(); x.moveTo(n / 2, 0); x.lineTo(n / 2, n); x.moveTo(0, n / 2); x.lineTo(n, n / 2); x.stroke();
    return c;
  },
  noiseTile: (n) => () => {
    const c = mkCanvas(n, n), x = c.getContext("2d"); x.fillStyle = "#000";
    const cnt = Math.round(n * n / 24);
    for (let i = 0; i < cnt; i++) {
      const px = Math.random() * n, py = Math.random() * n, r = .5 + Math.random() * 1.3;
      for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) { x.beginPath(); x.arc(px + dx, py + dy, r, 0, 7); x.fill(); }
    }
    return c;
  },
  ink: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.fillStyle = "#000"; x.beginPath(); for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, r = 26 + (Math.random() - .5) * 2.6; x[i ? "lineTo" : "moveTo"](32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.closePath(); x.fill(); return c; },
  dry: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); for (let i = 0; i < 28; i++) { const y = 6 + Math.random() * 52, len = 8 + Math.random() * 30, sx = 4 + Math.random() * (60 - len); x.strokeStyle = `rgba(0,0,0,${.25 + Math.random() * .6})`; x.lineWidth = .6 + Math.random() * 1.6; x.beginPath(); x.moveTo(sx, y); x.lineTo(sx + len, y + (Math.random() - .5) * 3); x.stroke(); } return c; },
  chalk: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); for (let i = 0; i < 230; i++) { x.fillStyle = `rgba(0,0,0,${.2 + Math.random() * .7})`; const s = 1 + Math.random() * 2.6; x.fillRect(Math.random() * 64, Math.random() * 64, s, s); } return c; },
  sponge: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); for (let i = 0; i < 48; i++) { const a = Math.random() * 7, d = Math.random() * 24; x.fillStyle = `rgba(0,0,0,${.3 + Math.random() * .55})`; x.beginPath(); x.arc(32 + Math.cos(a) * d, 32 + Math.sin(a) * d, .7 + Math.random() * 2.2, 0, 7); x.fill(); } return c; },
  pastel: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); const g = x.createRadialGradient(32, 32, 3, 32, 32, 29); g.addColorStop(0, "#000"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); for (let i = 0; i < 130; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * .5})`; x.fillRect(Math.random() * 64, Math.random() * 64, 1.4, 1.4); } return c; },
  star4: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.fillStyle = "#000"; x.beginPath(); const pts = [[32, 2], [37, 27], [62, 32], [37, 37], [32, 62], [27, 37], [2, 32], [27, 27]]; pts.forEach((q, i) => x[i ? "lineTo" : "moveTo"](q[0], q[1])); x.closePath(); x.fill(); return c; },
  bolt: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.strokeStyle = "#000"; x.lineWidth = 4; x.lineJoin = "miter"; x.beginPath(); x.moveTo(38, 10); x.lineTo(26, 34); x.lineTo(34, 34); x.lineTo(24, 58); x.lineTo(40, 30); x.lineTo(31, 30); x.closePath(); x.stroke(); return c; },
  burst: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.strokeStyle = "rgba(0,0,0,.85)"; for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, r0 = 7 + Math.random() * 5, r1 = 22 + Math.random() * 9; x.lineWidth = .8 + Math.random() * 1.6; x.beginPath(); x.moveTo(32 + Math.cos(a) * r0, 32 + Math.sin(a) * r0); x.lineTo(32 + Math.cos(a) * r1, 32 + Math.sin(a) * r1); x.stroke(); } return c; },
  wave: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.strokeStyle = "#000"; x.lineCap = "round"; for (let k = 0; k < 4; k++) { x.lineWidth = 2.4 - k * .4; x.beginPath(); for (let i = 0; i <= 64; i += 2) { const y = 10 + k * 14 + Math.sin(i / 8 + k) * 5; x[i ? "lineTo" : "moveTo"](i, y); } x.stroke(); } return c; },
  zigzag: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.strokeStyle = "#000"; x.lineWidth = 3; x.lineJoin = "miter"; x.beginPath(); for (let i = 0; i <= 8; i++) { x[i ? "lineTo" : "moveTo"](i * 8, i % 2 ? 56 : 8); } x.stroke(); return c; },
  spiral: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.strokeStyle = "#000"; x.lineWidth = 2.4; x.lineCap = "round"; x.beginPath(); for (let a = 0; a < Math.PI * 7; a += .15) { const r = 1 + a * 2.4; x[a ? "lineTo" : "moveTo"](32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.stroke(); return c; },
  blob: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.fillStyle = "#000"; x.beginPath(); for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2, r = 18 + Math.random() * 12; x[i ? "lineTo" : "moveTo"](32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.closePath(); x.fill(); return c; },
  marble: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); for (let i = 0; i < 22; i++) { x.strokeStyle = `rgba(0,0,0,${.15 + Math.random() * .5})`; x.lineWidth = .6 + Math.random() * 2; x.beginPath(); const y = Math.random() * 64; x.moveTo(0, y); x.bezierCurveTo(20, y + (Math.random() - .5) * 30, 44, y + (Math.random() - .5) * 30, 64, y + (Math.random() - .5) * 20); x.stroke(); } return c; },
  ribbon: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.fillStyle = "#000"; x.beginPath(); x.moveTo(4, 40); x.bezierCurveTo(20, 4, 44, 60, 60, 24); x.bezierCurveTo(48, 42, 30, 30, 20, 46); x.bezierCurveTo(12, 54, 6, 52, 4, 40); x.closePath(); x.fill(); return c; },
  confetti: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); for (let i = 0; i < 22; i++) { x.save(); x.translate(Math.random() * 64, Math.random() * 64); x.rotate(Math.random() * 7); x.fillStyle = `rgba(0,0,0,${.4 + Math.random() * .6})`; x.fillRect(-1, -3, 2 + Math.random() * 3, 5 + Math.random() * 4); x.restore(); } return c; },
  mesh: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.strokeStyle = "rgba(0,0,0,.8)"; x.lineWidth = 1.4; for (let i = -64; i < 128; i += 9) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 64, 64); x.moveTo(i, 64); x.lineTo(i + 64, 0); x.stroke(); } return c; },
  flame: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.fillStyle = "#000"; x.beginPath(); x.moveTo(32, 4); x.bezierCurveTo(50, 26, 52, 40, 32, 60); x.bezierCurveTo(12, 40, 14, 26, 32, 4); x.closePath(); x.fill(); x.globalCompositeOperation = "destination-out"; x.beginPath(); x.moveTo(32, 24); x.bezierCurveTo(40, 36, 40, 44, 32, 54); x.bezierCurveTo(24, 44, 24, 36, 32, 24); x.closePath(); x.fill(); return c; },
  droplet: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.fillStyle = "#000"; x.beginPath(); x.moveTo(32, 6); x.bezierCurveTo(46, 30, 46, 42, 32, 54); x.bezierCurveTo(18, 42, 18, 30, 32, 6); x.closePath(); x.fill(); return c; },
  crack: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.strokeStyle = "#000"; x.lineCap = "round"; const draw = (px, py, a, len, w, depth) => { if (depth <= 0 || len < 4) return; const ex = px + Math.cos(a) * len, ey = py + Math.sin(a) * len; x.lineWidth = w; x.beginPath(); x.moveTo(px, py); x.lineTo(ex, ey); x.stroke(); draw(ex, ey, a + (Math.random() - .5) * 1.1, len * (.6 + Math.random() * .3), w * .68, depth - 1); if (Math.random() < .6) draw(ex, ey, a + (Math.random() - .5) * 1.6, len * .5, w * .55, depth - 1); }; draw(32, 4, Math.PI / 2, 22, 3.4, 5); return c; },
  shatter: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.strokeStyle = "rgba(0,0,0,.85)"; x.lineWidth = 1.4; for (let i = 0; i < 14; i++) { const a = Math.random() * 7; x.beginPath(); x.moveTo(32, 32); x.lineTo(32 + Math.cos(a) * 30, 32 + Math.sin(a) * 30); x.stroke(); } for (const r of [6, 13, 22]) { x.beginPath(); x.arc(32, 32, r, 0, 7); x.stroke(); } return c; },
  spark6: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.fillStyle = "#000"; x.beginPath(); for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, r = i % 2 ? 7 : 30; x[i ? "lineTo" : "moveTo"](32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.closePath(); x.fill(); return c; },
  sparkle: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.fillStyle = "#000"; x.beginPath(); x.moveTo(32, 2); x.quadraticCurveTo(36, 28, 62, 32); x.quadraticCurveTo(36, 36, 32, 62); x.quadraticCurveTo(28, 36, 2, 32); x.quadraticCurveTo(28, 28, 32, 2); x.closePath(); x.fill(); return c; },
  rings: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.strokeStyle = "#000"; for (let r = 6; r <= 30; r += 6) { x.lineWidth = Math.max(1, 4 - r / 12); x.beginPath(); x.arc(32, 32, r, 0, 7); x.stroke(); } return c; },
  dotburst: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.fillStyle = "#000"; for (let i = 0; i < 90; i++) { const a = Math.random() * 7, d = Math.pow(Math.random(), .6) * 30; const r = 2.6 * (1 - d / 34) + .3; x.beginPath(); x.arc(32 + Math.cos(a) * d, 32 + Math.sin(a) * d, Math.max(.3, r), 0, 7); x.fill(); } return c; },
  arrow: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.fillStyle = "#000"; x.beginPath(); x.moveTo(4, 26); x.lineTo(38, 26); x.lineTo(38, 12); x.lineTo(60, 32); x.lineTo(38, 52); x.lineTo(38, 38); x.lineTo(4, 38); x.closePath(); x.fill(); return c; },
  crown: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.strokeStyle = "#000"; x.lineWidth = 3; x.lineJoin = "miter"; x.beginPath(); x.moveTo(32, 6); const spikes = 10; for (let i = 1; i < spikes; i++) { const a = -Math.PI / 2 + i / spikes * Math.PI * 2, r = i % 2 ? 12 : 28; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.closePath(); x.stroke(); return c; },
  action: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.strokeStyle = "rgba(0,0,0,.85)"; for (let i = 0; i < 40; i++) { const a = Math.random() * 7, r0 = 10 + Math.random() * 6, r1 = 24 + Math.random() * 8; x.lineWidth = .6 + Math.random() * 1.6; x.beginPath(); x.moveTo(32 + Math.cos(a) * r0, 32 + Math.sin(a) * r0); x.lineTo(32 + Math.cos(a) * r1, 32 + Math.sin(a) * r1); x.stroke(); } return c; },
  puff: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); for (let i = 0; i < 7; i++) { const g = x.createRadialGradient(32 + (Math.random() - .5) * 20, 32 + (Math.random() - .5) * 20, 1, 32, 32, 26); g.addColorStop(0, "rgba(0,0,0,.7)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); } return c; },
  halftone: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.fillStyle = "#000"; for (let gx = 0; gx < 64; gx += 9) for (let gy = 0; gy < 64; gy += 9) { const d = Math.hypot(gx - 32, gy - 32), r = Math.max(0, 3.6 - d / 12); if (r > .3) { x.beginPath(); x.arc(gx, gy, r, 0, 7); x.fill(); } } return c; },
  splatRing: () => { const c = mkCanvas(64, 64), x = c.getContext("2d"); x.fillStyle = "#000"; x.beginPath(); x.arc(32, 32, 26, 0, 7); x.fill(); x.globalCompositeOperation = "destination-out"; for (let i = 0; i < 22; i++) { const a = Math.random() * 7, d = 20 + Math.random() * 15; x.beginPath(); x.arc(32 + Math.cos(a) * d, 32 + Math.sin(a) * d, 2 + Math.random() * 5, 0, 7); x.fill(); } x.beginPath(); x.arc(32, 32, 13, 0, 7); x.fill(); return c; },
};

const BRUSH_PRESETS = [
  { id: "gpen", cat: "Pena Komik", name: "G-Pen", type: "circle", hardness: 94, size: 8, opacity: 100, scatter: 0, spacing: .07, pressure: 1 },
  { id: "mapping", cat: "Pena Komik", name: "Mapping Pen", type: "circle", hardness: 100, size: 3, opacity: 100, scatter: 0, spacing: .09, pressure: 1 },
  { id: "maru", cat: "Pena Komik", name: "R-Pen Maru", type: "circle", hardness: 100, size: 5, opacity: 100, scatter: 0, spacing: .08, pressure: 1 },
  { id: "brushpen", cat: "Pena Komik", name: "Brush Pen", type: "circle", hardness: 42, size: 24, opacity: 92, scatter: 0, spacing: .1, pressure: 1 },
  { id: "inkwash", cat: "Pena Komik", name: "Tinta Air", type: "cloud", size: 34, hardness: 30, opacity: 55, scatter: .3, spacing: .14, jitter: .35, pressure: .6 },
  { id: "feather", cat: "Pena Komik", name: "Pena Bulu", type: "circle", hardness: 55, size: 18, opacity: 95, scatter: 0, spacing: .08, pressure: 1 },
  { id: "drypen", cat: "Pena Komik", name: "Pena Kering", type: "dry", size: 10, opacity: 90, scatter: .1, spacing: .12, pressure: .8 },
  { id: "speedink", cat: "Pena Komik", name: "Tinta Cepat", type: "streak", size: 12, opacity: 85, scatter: .25, spacing: .09, rotJit: .2, pressure: .7 },
  { id: "ink", cat: "Pena Komik", name: "Tinta Tebal", type: "ink", size: 14, opacity: 100, scatter: 0, spacing: .07, pressure: 1 },
  { id: "fineliner", cat: "Pena Komik", name: "Fineliner", type: "circle", hardness: 100, size: 2, opacity: 100, scatter: 0, spacing: .1, pressure: .8 },
  { id: "pencil", cat: "Tekstur", name: "Pensil", type: "grain", size: 12, hardness: 80, opacity: 85, scatter: .18, spacing: .1 },
  { id: "water", cat: "Tekstur", name: "Cat Air", type: "cloud", size: 44, hardness: 20, opacity: 42, scatter: .22, spacing: .12, jitter: .3 },
  { id: "airbrush", cat: "Tekstur", name: "Airbrush", type: "spray", size: 60, hardness: 10, opacity: 38, scatter: .7, spacing: .06 },
  { id: "charcoal", cat: "Tekstur", name: "Arang", type: "hatch", size: 26, hardness: 70, opacity: 72, scatter: .28, spacing: .12, rotJit: .5 },
  { id: "pastel", cat: "Tekstur", name: "Pastel", type: "pastel", size: 22, hardness: 60, opacity: 70, scatter: .15, spacing: .1 },
  { id: "crayon", cat: "Tekstur", name: "Krayon", type: "chalk", size: 26, hardness: 70, opacity: 75, scatter: .2, spacing: .12, rotJit: .4 },
  { id: "sponge", cat: "Tekstur", name: "Spons", type: "sponge", size: 40, hardness: 50, opacity: 60, scatter: .3, spacing: .12 },
  { id: "drybrush", cat: "Tekstur", name: "Kuas Kering", type: "dry", size: 34, hardness: 60, opacity: 80, scatter: .35, spacing: .14, rotJit: .3 },
  { id: "chalk", cat: "Tekstur", name: "Kapur", type: "chalk", size: 18, hardness: 70, opacity: 80, scatter: .18, spacing: .1 },
  { id: "tone-l", cat: "Screentone", name: "Tone Titik Besar", type: "tile", tile: 36, tipKey: "d36-13", gen: TIP_GENS.dotsTile(36, 13), size: 36, hardness: 100, opacity: 100, spacing: 1, align: 1 },
  { id: "tone-m", cat: "Screentone", name: "Tone Titik Sedang", type: "tile", tile: 28, tipKey: "d28-8", gen: TIP_GENS.dotsTile(28, 8), size: 28, hardness: 100, opacity: 100, spacing: 1, align: 1 },
  { id: "tone-s", cat: "Screentone", name: "Tone Titik Halus", type: "tile", tile: 20, tipKey: "d20-5", gen: TIP_GENS.dotsTile(20, 5), size: 20, hardness: 100, opacity: 100, spacing: 1, align: 1 },
  { id: "tone-line", cat: "Screentone", name: "Tone Garis", type: "tile", tile: 24, tipKey: "l24", gen: TIP_GENS.linesTile(24), size: 24, hardness: 100, opacity: 100, spacing: 1, align: 1 },
  { id: "tone-cross", cat: "Screentone", name: "Tone Silang", type: "tile", tile: 26, tipKey: "c26", gen: TIP_GENS.crossTile(26), size: 26, hardness: 100, opacity: 100, spacing: 1, align: 1 },
  { id: "tone-45", cat: "Screentone", name: "Tone 45°", type: "tile", tile: 24, tipKey: "d45-24-6", gen: TIP_GENS.dotsTileDense(24, 6), size: 24, hardness: 100, opacity: 100, spacing: 1, align: 1 },
  { id: "tone-dense", cat: "Screentone", name: "Tone Rapat", type: "tile", tile: 16, tipKey: "d16-4", gen: TIP_GENS.dotsTile(16, 4), size: 16, hardness: 100, opacity: 100, spacing: 1, align: 1 },
  { id: "tone-jumbo", cat: "Screentone", name: "Tone Jumbo", type: "tile", tile: 48, tipKey: "d48-18", gen: TIP_GENS.dotsTile(48, 18), size: 48, hardness: 100, opacity: 100, spacing: 1, align: 1 },
  { id: "tone-v", cat: "Screentone", name: "Tone Garis Tegak", type: "tile", tile: 22, tipKey: "lv22", gen: TIP_GENS.linesTileV(22), size: 22, hardness: 100, opacity: 100, spacing: 1, align: 1 },
  { id: "tone-grid", cat: "Screentone", name: "Tone Kisi", type: "tile", tile: 24, tipKey: "g24", gen: TIP_GENS.gridTile(24), size: 24, hardness: 100, opacity: 100, spacing: 1, align: 1 },
  { id: "tone-noise", cat: "Screentone", name: "Tone Bintik", type: "tile", tile: 32, tipKey: "n32", gen: TIP_GENS.noiseTile(32), size: 32, hardness: 100, opacity: 100, spacing: 1, align: 1 },
  { id: "speed", cat: "Efek Webtoon", name: "Speed Lines", type: "streak", size: 18, hardness: 60, opacity: 88, scatter: .55, spacing: .09, rotJit: .12 },
  { id: "sparkle", cat: "Efek Webtoon", name: "Kilau / Star", type: "star", size: 20, hardness: 90, opacity: 92, scatter: .8, spacing: .5, rotJit: 3.1, jitter: .5 },
  { id: "splat", cat: "Efek Webtoon", name: "Cipratan", type: "splat", size: 22, hardness: 90, opacity: 95, scatter: .6, spacing: .35, rotJit: 3.1, jitter: .4 },
  { id: "smoke", cat: "Efek Webtoon", name: "Asap / Kabut", type: "cloud", size: 56, hardness: 15, opacity: 32, scatter: .5, spacing: .12, jitter: .4 },
  { id: "abstract", cat: "Efek Webtoon", name: "Gores Abstrak", type: "scratch", size: 40, hardness: 80, opacity: 80, scatter: .45, spacing: .22, rotJit: 3.1, jitter: .35 },
  { id: "glow", cat: "Efek Webtoon", name: "Cahaya Lembut", type: "soft", size: 70, hardness: 5, opacity: 26, scatter: .2, spacing: .08 },
  { id: "impact", cat: "Efek Webtoon", name: "Ledakan", type: "burst", size: 60, hardness: 90, opacity: 85, scatter: .6, spacing: .5, rotJit: 3.1 },
  { id: "shoujo", cat: "Efek Webtoon", name: "Garis Vertikal", type: "streak", angle: Math.PI / 2, size: 20, hardness: 60, opacity: 80, scatter: .55, spacing: .2 },
  { id: "spark4", cat: "Efek Webtoon", name: "Kilau Bintang", type: "star4", size: 22, hardness: 90, opacity: 92, scatter: .85, spacing: .5, rotJit: 3.1, jitter: .4 },
  { id: "bolt", cat: "Efek Webtoon", name: "Kilat", type: "bolt", size: 30, hardness: 90, opacity: 92, scatter: .5, spacing: .35, rotJit: 1.2 },
  { id: "bokeh", cat: "Efek Webtoon", name: "Bintik Cahaya", type: "soft", size: 26, hardness: 10, opacity: 50, scatter: 1, spacing: .2, jitter: .5 },
  { id: "heavysmoke", cat: "Efek Webtoon", name: "Asap Tebal", type: "cloud", size: 90, hardness: 10, opacity: 45, scatter: .45, spacing: .12, jitter: .35 },
  { id: "expression", cat: "Efek Webtoon", name: "Goresan Emosi", type: "scratch", size: 30, hardness: 80, opacity: 85, scatter: .6, spacing: .25, rotJit: 3.1, jitter: .4 },
  { id: "bigsplat", cat: "Efek Webtoon", name: "Cipratan Besar", type: "splat", size: 48, hardness: 90, opacity: 95, scatter: .65, spacing: .4, rotJit: 3.1, jitter: .45 },
  { id: "ringSplat", cat: "Efek Webtoon", name: "Cincin Ciprat", type: "splatRing", size: 44, hardness: 90, opacity: 92, scatter: .5, spacing: .4, rotJit: 3.1, jitter: .3 },

  { id: "absMarble", cat: "Abstrak", name: "Marmar Alir", type: "marble", size: 40, hardness: 80, opacity: 80, scatter: .35, spacing: .18, rotJit: .3, jitter: .2 },
  { id: "absRibbon", cat: "Abstrak", name: "Pita Mengalir", type: "ribbon", size: 34, hardness: 90, opacity: 88, scatter: .3, spacing: .16, rotJit: .6, jitter: .25 },
  { id: "absWave", cat: "Abstrak", name: "Gelombang", type: "wave", size: 38, hardness: 90, opacity: 85, scatter: .4, spacing: .14, rotJit: 1.4 },
  { id: "absZigzag", cat: "Abstrak", name: "Zigzag Tajam", type: "zigzag", size: 34, hardness: 90, opacity: 88, scatter: .4, spacing: .16, rotJit: 1.2 },
  { id: "absSpiral", cat: "Abstrak", name: "Pilin Spiral", type: "spiral", size: 30, hardness: 90, opacity: 85, scatter: .5, spacing: .2, rotJit: 3.1, jitter: .3 },
  { id: "absBlob", cat: "Abstrak", name: "Gumpal Organik", type: "blob", size: 30, hardness: 90, opacity: 70, scatter: .55, spacing: .3, rotJit: 3.1, jitter: .4 },
  { id: "absConfetti", cat: "Abstrak", name: "Konfeti", type: "confetti", size: 22, hardness: 90, opacity: 85, scatter: .8, spacing: .35, rotJit: 3.1, jitter: .5 },
  { id: "absMesh", cat: "Abstrak", name: "Jaring Silang", type: "mesh", size: 40, hardness: 90, opacity: 75, scatter: .35, spacing: .22, rotJit: 3.1 },
  { id: "absRings", cat: "Abstrak", name: "Cincin Abstrak", type: "rings", size: 30, hardness: 90, opacity: 80, scatter: .5, spacing: .3, rotJit: 3.1, jitter: .35 },
  { id: "absDots", cat: "Abstrak", name: "Hamburan Titik", type: "dotburst", size: 44, hardness: 90, opacity: 80, scatter: .5, spacing: .22, rotJit: 3.1 },
  { id: "absHalftone", cat: "Abstrak", name: "Halfton Radial", type: "halftone", size: 48, hardness: 100, opacity: 85, scatter: .3, spacing: .18, rotJit: .4 },
  { id: "absFlame", cat: "Abstrak", name: "Nyala Abstrak", type: "flame", size: 30, hardness: 90, opacity: 85, scatter: .4, spacing: .16, rotJit: 1.2, jitter: .25 },
  { id: "absShatter", cat: "Abstrak", name: "Pecahan Kaca", type: "shatter", size: 42, hardness: 90, opacity: 80, scatter: .5, spacing: .4, rotJit: 3.1 },
  { id: "absCrack", cat: "Abstrak", name: "Rekahan", type: "crack", size: 34, hardness: 90, opacity: 85, scatter: .5, spacing: .3, rotJit: 3.1 },
  { id: "absDroplet", cat: "Abstrak", name: "Tetes", type: "droplet", size: 18, hardness: 90, opacity: 85, scatter: .7, spacing: .3, rotJit: 3.1, jitter: .45 },
  { id: "absPuff", cat: "Abstrak", name: "Kabut Lembut", type: "puff", size: 60, hardness: 10, opacity: 35, scatter: .5, spacing: .14, jitter: .4 },
  { id: "absSprinkle", cat: "Abstrak", name: "Taburan Bintang", type: "spark6", size: 22, hardness: 90, opacity: 88, scatter: .9, spacing: .45, rotJit: 3.1, jitter: .6 },
  { id: "absDrip", cat: "Abstrak", name: "Goresan Tetes", type: "droplet", size: 26, hardness: 80, opacity: 70, scatter: .6, spacing: .18, rotJit: 1.4, jitter: .3 },

  { id: "sfxImpact", cat: "SFX Komik", name: "SFX Dampak", type: "action", size: 70, hardness: 90, opacity: 88, scatter: .55, spacing: .5, rotJit: 3.1 },
  { id: "sfxStar", cat: "SFX Komik", name: "SFX Bintang", type: "spark6", size: 26, hardness: 90, opacity: 92, scatter: .85, spacing: .5, rotJit: 3.1, jitter: .4 },
  { id: "sfxSparkle", cat: "SFX Komik", name: "SFX Kilau", type: "sparkle", size: 20, hardness: 90, opacity: 92, scatter: .85, spacing: .45, rotJit: 3.1, jitter: .5 },
  { id: "sfxFlash", cat: "SFX Komik", name: "SFX Kilat Cahaya", type: "rings", size: 66, hardness: 90, opacity: 82, scatter: .45, spacing: .5, rotJit: 3.1 },
  { id: "sfxBurst", cat: "SFX Komik", name: "SFX Ledakan Titik", type: "dotburst", size: 64, hardness: 90, opacity: 88, scatter: .5, spacing: .5, rotJit: 3.1 },
  { id: "sfxShockRing", cat: "SFX Komik", name: "SFX Gelombang Kejut", type: "splatRing", size: 60, hardness: 90, opacity: 88, scatter: .4, spacing: .5, rotJit: 3.1 },
  { id: "sfxCrack", cat: "SFX Komik", name: "SFX Keretakan", type: "crack", size: 60, hardness: 90, opacity: 90, scatter: .5, spacing: .45, rotJit: 3.1 },
  { id: "sfxShatter", cat: "SFX Komik", name: "SFX Pecah", type: "shatter", size: 56, hardness: 90, opacity: 88, scatter: .5, spacing: .45, rotJit: 3.1 },
  { id: "sfxCrown", cat: "SFX Komik", name: "SFX Runcing", type: "crown", size: 28, hardness: 90, opacity: 92, scatter: .85, spacing: .5, rotJit: 3.1, jitter: .35 },
  { id: "sfxArrow", cat: "SFX Komik", name: "SFX Panah", type: "arrow", size: 26, hardness: 90, opacity: 92, scatter: .5, spacing: .5, rotJit: 3.1 },
  { id: "sfxFire", cat: "SFX Komik", name: "SFX Api", type: "flame", size: 40, hardness: 90, opacity: 88, scatter: .5, spacing: .2, rotJit: 1.4, jitter: .3 },
  { id: "sfxSmoke", cat: "SFX Komik", name: "SFX Asap Puff", type: "puff", size: 74, hardness: 10, opacity: 42, scatter: .5, spacing: .14, jitter: .4 },
  { id: "sfxWater", cat: "SFX Komik", name: "SFX Ciprat Air", type: "droplet", size: 20, hardness: 85, opacity: 88, scatter: .85, spacing: .3, rotJit: 3.1, jitter: .5 },
  { id: "sfxWave", cat: "SFX Komik", name: "SFX Gelombang Suara", type: "wave", size: 40, hardness: 90, opacity: 85, scatter: .4, spacing: .16, rotJit: 1.2 },
  { id: "sfxZig", cat: "SFX Komik", name: "SFX Getaran", type: "zigzag", size: 34, hardness: 90, opacity: 88, scatter: .45, spacing: .18, rotJit: 1.2 },
  { id: "sfxSpiral", cat: "SFX Komik", name: "SFX Pusing", type: "spiral", size: 34, hardness: 90, opacity: 82, scatter: .5, spacing: .22, rotJit: 3.1, jitter: .3 },
  { id: "sfxConfetti", cat: "SFX Komik", name: "SFX Sorak", type: "confetti", size: 24, hardness: 90, opacity: 88, scatter: .9, spacing: .35, rotJit: 3.1, jitter: .5 },
  { id: "sfxFlashBurst", cat: "SFX Komik", name: "SFX Kilau Ledak", type: "burst", size: 66, hardness: 90, opacity: 85, scatter: .6, spacing: .5, rotJit: 3.1 },
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
      ctx.rotate((o.angle || 0) + (p.angle || 0) + (Math.random() - .5) * (p.rotJit ?? .6));
      const f = sz / 64 * (p.type === "tile" ? 1 : 1);
      ctx.scale(f, f);
      ctx.drawImage(BrushFX.tipFor(p), -32, -32);
      ctx.restore();
    }
  },
};
