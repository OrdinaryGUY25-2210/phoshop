/* ============================================================
   PS Lite — FITUR LANJUTAN (lapisan)
   Lapisan penyesuaian (non-destruktif), clipping mask,
   saluran seleksi, perataan lapisan, gabung terlihat,
   panel Saluran / Navigator / Info / Histogram.
   Dimuat setelah ext-core.js.
   ============================================================ */
(function () {
  "use strict";
  const NS = (window.EXTNS = window.EXTNS || {});

  /* ---------- DEFINISI LAPISAN PENYESUAIAN ---------- */
  const DEFS = {
    brightness: { title: "Kecerahan/Kontras", ctrls: [
      { k: "brightness", label: "Kecerahan", min: -100, max: 100, val: 0 },
      { k: "contrast", label: "Kontras", min: -100, max: 100, val: 0 }] },
    hsl: { title: "Rona/Saturasi", ctrls: [
      { k: "hue", label: "Rona", min: -180, max: 180, val: 0 },
      { k: "sat", label: "Saturasi", min: -100, max: 100, val: 0 },
      { k: "light", label: "Cahaya", min: -100, max: 100, val: 0 }] },
    levels: { title: "Levels", ctrls: [
      { k: "black", label: "Input Hitam", min: 0, max: 254, val: 0 },
      { k: "white", label: "Input Putih", min: 1, max: 255, val: 255 },
      { k: "gamma", label: "Gamma ×10", min: 1, max: 50, val: 10 }] },
    curves: { title: "Kurva", special: "curves" },
    exposure: { title: "Exposure", ctrls: [
      { k: "ev", label: "Exposure (EV)", min: -3, max: 3, step: 0.05, val: 0 },
      { k: "offset", label: "Offset", min: -100, max: 100, val: 0 }] },
    vibrance: { title: "Vibrance", ctrls: [
      { k: "vibrance", label: "Vibrance", min: -100, max: 100, val: 0 },
      { k: "saturation", label: "Saturasi", min: -100, max: 100, val: 0 }] },
    colorbalance: { title: "Color Balance", ctrls: [
      { k: "rs", label: "Bayangan: Cyan → Merah", min: -100, max: 100, val: 0 },
      { k: "gm", label: "Tengah: Magenta → Hijau", min: -100, max: 100, val: 0 },
      { k: "bh", label: "Sorotan: Kuning → Biru", min: -100, max: 100, val: 0 }] },
    threshold: { title: "Threshold", ctrls: [
      { k: "level", label: "Ambang", min: 1, max: 254, val: 128 }] },
    posterize: { title: "Posterize", ctrls: [
      { k: "levels", label: "Tingkat", min: 2, max: 64, val: 8 }] },
    gradientmap: { title: "Gradient Map", special: "gradientmap" },
    photofilter: { title: "Photo Filter", special: "photofilter" },
    channelmixer: { title: "Channel Mixer", special: "channelmixer" },
    selective: { title: "Selective Color", special: "selective" },
    shadowshigh: { title: "Bayangan/Sorotan", ctrls: [
      { k: "shadows", label: "Bayangan", min: -100, max: 100, val: 0 },
      { k: "highlights", label: "Sorotan", min: -100, max: 100, val: 0 },
      { k: "midtone", label: "Nada Tengah", min: -100, max: 100, val: 0 }] },
  };
  NS.ADJ_DEFS = DEFS;

  NS.defaultAdjParams = (type) => {
    const d = DEFS[type], p = {};
    if (d && d.ctrls) d.ctrls.forEach(c => p[c.k] = c.val);
    if (d && d.special === "curves") p.points = [[0, 0], [255, 255]];
    if (d && d.special === "gradientmap") Object.assign(p, { from: "#001a4d", to: "#ffd9a0" });
    if (d && d.special === "photofilter") Object.assign(p, { color: "#ec8a00", density: 25, preserve: true });
    if (d && d.special === "channelmixer") Object.assign(p, { rr: 100, rg: 0, rb: 0, gr: 0, gg: 100, gb: 0, br: 0, bg: 0, bb: 100, mono: false });
    if (d && d.special === "selective") Object.assign(p, { range: "merah", cyan: 0, magenta: 0, yellow: 0, black: 0, red: 0, green: 0, blue: 0 });
    return p;
  };

  NS.isAdjustLayer = (l) => !!(l && l.adj && NS.ADJUST && NS.ADJUST[l.adj.type]);

  NS.addAdjustLayer = (type, params) => {
    if (!DEFS[type]) { toast("Jenis penyesuaian tidak dikenal", true); return null; }
    const l = addLayer(DEFS[type].title);
    l.adj = { type, params: params || NS.defaultAdjParams(type) };
    App.activeLayerId = l.id;
    pushHistory("Lapisan Penyesuaian: " + DEFS[type].title);
    App.dirty = true;
    updateUI();
    return l;
  };

  NS.newAdjustDialog = (type) => {
    const l = NS.addAdjustLayer(type);
    NS.adjLayerDialog(l);
  };

  /* ---------- DIALOG PARAMETER LAPISAN PENYESUAIAN ---------- */
  NS.adjLayerDialog = (l) => {
    if (!l || !l.adj) return;
    const type = l.adj.type;
    const d = DEFS[type];
    if (!d) return;
    const redraw = () => { App.dirty = true; };
    if (d.special === "curves") return NS.curvesDialog(l);
    if (d.special === "gradientmap") return NS.gradientMapDialog(l);
    if (d.special === "photofilter") return NS.photoFilterDialog(l);
    if (d.special === "channelmixer") return NS.channelMixerDialog(l);
    if (d.special === "selective") return NS.selectiveDialog(l);
    const p = l.adj.params;
    const row = c => `<label class="adj-label">${c.label}<span class="adj-val" id="exv-${c.k}">${p[c.k]}</span>
      <input type="range" id="ex-${c.k}" min="${c.min}" max="${c.max}" step="${c.step || 1}" value="${p[c.k]}"></label>`;
    showModal("Lapisan Penyesuaian — " + d.title, d.ctrls.map(row).join("") +
      `<p style="color:var(--text2)">Perubahan bersifat non-destruktif. Nyalakan clipping (⌐) agar hanya memengaruhi lapisan di bawahnya.</p>`, [
      { label: "Selesai", primary: true, onClick: () => { updateLayerThumbs(); } },
    ]);
    d.ctrls.forEach(c => {
      const el = $("#ex-" + c.k);
      el.addEventListener("input", () => {
        p[c.k] = +el.value;
        $("#exv-" + c.k).textContent = el.value;
        redraw();
      });
    });
  };

  /* ---------- KURVA (editor interaktif) ---------- */
  NS.curvesDialog = (l) => {
    const p = l.adj.params;
    if (!p.points || p.points.length < 2) p.points = [[0, 0], [255, 255]];
    const W = 220;
    showModal("Lapisan Penyesuaian — Kurva", `
      <canvas id="curve-cv" width="${W}" height="${W}" style="background:#1b1b1b;border:1px solid #3a3a3a;border-radius:6px;cursor:crosshair"></canvas>
      <p style="color:var(--text2);margin-top:6px">Klik untuk menambah titik • seret titik untuk menggeser • klik kanan titik untuk menghapus</p>`, [
      { label: "Reset", onClick: () => { p.points = [[0, 0], [255, 255]]; draw(); App.dirty = true; } },
      { label: "Selesai", primary: true, onClick: () => { updateLayerThumbs(); } },
    ]);
    const cv = $("#curve-cv"), cx = cv.getContext("2d");
    const toXY = ([x, y]) => [x / 255 * W, W - y / 255 * W];
    let drag = -1;
    function draw() {
      cx.clearRect(0, 0, W, W);
      cx.strokeStyle = "#333";
      for (let i = 0; i <= 4; i++) {
        const q = i / 4 * W;
        cx.beginPath(); cx.moveTo(q, 0); cx.lineTo(q, W); cx.moveTo(0, q); cx.lineTo(W, q); cx.stroke();
      }
      cx.strokeStyle = "#666";
      cx.beginPath(); cx.moveTo(0, W); cx.lineTo(W, 0); cx.stroke();
      const lut = NS.curveLUT(p.points);
      cx.strokeStyle = "#7ec8ff"; cx.lineWidth = 2;
      cx.beginPath();
      for (let x = 0; x < W; x++) {
        const y = W - lut[Math.round(x / W * 255)] / 255 * W;
        x === 0 ? cx.moveTo(x, y) : cx.lineTo(x, y);
      }
      cx.stroke();
      cx.fillStyle = "#fff"; cx.strokeStyle = "#1f6fb2";
      p.points.forEach(pt => { const [px, py] = toXY(pt); cx.beginPath(); cx.arc(px, py, 4, 0, 7); cx.fill(); cx.stroke(); });
    }
    const pick = (mx, my) => {
      let best = -1, bd = 1e9;
      p.points.forEach((pt, i) => { const [px, py] = toXY(pt); const dd = Math.hypot(px - mx, py - my); if (dd < bd) { bd = dd; best = i; } });
      return bd < 12 ? best : -1;
    };
    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener("pointerdown", e => {
      const [mx, my] = pos(e);
      const hit = pick(mx, my);
      if (e.button === 2) { if (hit > 0 && hit < p.points.length - 1) { p.points.splice(hit, 1); draw(); App.dirty = true; } return; }
      if (hit >= 0) drag = hit;
      else {
        p.points.push([clamp(Math.round(mx / W * 255), 0, 255), clamp(Math.round((W - my) / W * 255), 0, 255)]);
        p.points.sort((a, b) => a[0] - b[0]);
        drag = p.points.findIndex(q => q[0] === clamp(Math.round(mx / W * 255), 0, 255));
        draw(); App.dirty = true;
      }
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener("pointermove", e => {
      if (drag < 0) return;
      const [mx, my] = pos(e);
      const nx = clamp(Math.round(mx / W * 255), 0, 255), ny = clamp(Math.round((W - my) / W * 255), 0, 255);
      const isEnd = drag === 0 || drag === p.points.length - 1;
      p.points[drag] = isEnd ? [drag === 0 ? 0 : 255, ny] : [nx, ny];
      draw(); App.dirty = true;
    });
    cv.addEventListener("pointerup", () => { drag = -1; });
    cv.addEventListener("contextmenu", e => e.preventDefault());
    draw();
  };

  /* ---------- GRADIENT MAP ---------- */
  NS.gradientMapDialog = (l) => {
    const p = l.adj.params;
    showModal("Lapisan Penyesuaian — Gradient Map", `
      <div class="field-row">
        <div class="field"><label>Bayangan</label><input type="color" id="gm-from" value="${p.from}"></div>
        <div class="field"><label>Sorotan</label><input type="color" id="gm-to" value="${p.to}"></div>
      </div>
      <div id="gm-prev" style="height:24px;border-radius:6px;border:1px solid #3a3a3a;background:linear-gradient(90deg,${p.from},${p.to})"></div>`, [
      { label: "Selesai", primary: true, onClick: () => { updateLayerThumbs(); } },
    ]);
    const upd = () => { p.from = $("#gm-from").value; p.to = $("#gm-to").value; $("#gm-prev").style.background = `linear-gradient(90deg,${p.from},${p.to})`; App.dirty = true; };
    $("#gm-from").addEventListener("input", upd);
    $("#gm-to").addEventListener("input", upd);
  };

  /* ---------- PHOTO FILTER ---------- */
  NS.photoFilterDialog = (l) => {
    const p = l.adj.params;
    showModal("Lapisan Penyesuaian — Photo Filter", `
      <div class="field"><label>Warna</label><input type="color" id="pf-color" value="${p.color}"></div>
      <label class="adj-label">Kepadatan <span class="adj-val" id="pfv">${p.density}%</span>
        <input type="range" id="pf-d" min="1" max="100" value="${p.density}"></label>
      <label class="chk"><input type="checkbox" id="pf-p" ${p.preserve ? "checked" : ""}> Jaga kecerahan</label>`, [
      { label: "Selesai", primary: true, onClick: () => { updateLayerThumbs(); } },
    ]);
    $("#pf-color").addEventListener("input", e => { p.color = e.target.value; App.dirty = true; });
    $("#pf-d").addEventListener("input", e => { p.density = +e.target.value; $("#pfv").textContent = e.target.value + "%"; App.dirty = true; });
    $("#pf-p").addEventListener("change", e => { p.preserve = e.target.checked; App.dirty = true; });
  };

  /* ---------- CHANNEL MIXER ---------- */
  NS.channelMixerDialog = (l) => {
    const p = l.adj.params;
    const R = [["rr", "Merah"], ["rg", "Hijau"], ["rb", "Biru"]];
    const G = [["gr", "Merah"], ["gg", "Hijau"], ["gb", "Biru"]];
    const B = [["br", "Merah"], ["bg", "Hijau"], ["bb", "Biru"]];
    const band = (title, arr) => `<div class="cm-band"><b>${title}</b>` + arr.map(([k, lab]) =>
      `<label class="adj-label">${lab} <span class="adj-val" id="cmv-${k}">${p[k]}</span>
        <input type="range" id="cm-${k}" min="-200" max="200" value="${p[k]}"></label>`).join("") + `</div>`;
    showModal("Lapisan Penyesuaian — Channel Mixer", band("Output Merah", R) + band("Output Hijau", G) + band("Output Biru", B) +
      `<label class="chk"><input type="checkbox" id="cm-mono" ${p.mono ? "checked" : ""}> Monokrom</label>`, [
      { label: "Selesai", primary: true, onClick: () => { updateLayerThumbs(); } },
    ]);
    [].concat(R, G, B).forEach(([k]) => {
      const el = $("#cm-" + k);
      el.addEventListener("input", () => { p[k] = +el.value; $("#cmv-" + k).textContent = el.value; App.dirty = true; });
    });
    $("#cm-mono").addEventListener("change", e => { p.mono = e.target.checked; App.dirty = true; });
  };

  /* ---------- SELECTIVE COLOR ---------- */
  NS.selectiveDialog = (l) => {
    const p = l.adj.params;
    const ranges = ["merah", "kuning", "hijau", "cyan", "biru", "magenta", "netral", "putih", "hitam"];
    const ctrls = [["cyan", "Cyan"], ["magenta", "Magenta"], ["yellow", "Kuning"], ["black", "Hitam"]];
    showModal("Lapisan Penyesuaian — Selective Color", `
      <div class="field"><label>Rentang Warna</label><select id="sel-range">${ranges.map(r => `<option value="${r}" ${p.range === r ? "selected" : ""}>${r}</option>`).join("")}</select></div>
      ${ctrls.map(([k, lab]) => `<label class="adj-label">${lab} <span class="adj-val" id="selv-${k}">${p[k]}</span>
        <input type="range" id="sel-${k}" min="-100" max="100" value="${p[k]}"></label>`).join("")}`, [
      { label: "Selesai", primary: true, onClick: () => { updateLayerThumbs(); } },
    ]);
    $("#sel-range").addEventListener("change", e => { p.range = e.target.value; App.dirty = true; });
    ctrls.forEach(([k]) => {
      const el = $("#sel-" + k);
      el.addEventListener("input", () => { p[k] = +el.value; $("#selv-" + k).textContent = el.value; App.dirty = true; });
    });
  };

  /* ---------- CLIPPING MASK ---------- */
  NS.toggleClip = () => {
    const l = activeLayer();
    if (!l || l.isGroup) return toast("Pilih lapisan biasa dulu", true);
    l.clip = !l.clip;
    pushHistory(l.clip ? "Clipping Mask Aktif" : "Clipping Mask Mati");
    App.dirty = true;
    renderLayerList();
    toast(l.clip ? "Clipping mask: hanya memengaruhi lapisan bawah" : "Clipping mask dimatikan");
  };

  /* ---------- SALURAN SELEKSI ---------- */
  App.channels = App.channels || [];
  NS.saveChannel = () => {
    if (!App.selection) return toast("Tidak ada seleksi aktif", true);
    const mask = selectionMask(App.selection);
    const c = newDocCanvas();
    c.getContext("2d").drawImage(mask, 0, 0);
    App.channels.push({ name: "Saluran " + (App.channels.length + 1), canvas: c });
    toast("Seleksi disimpan ke saluran");
    NS.renderChannels && NS.renderChannels();
  };
  NS.loadChannel = (i) => {
    const ch = App.channels[i];
    if (!ch) return;
    App.selection = NS.maskSelection(ch.canvas);
    App.dirty = true;
    toast("Saluran dimuat sebagai seleksi");
    updateUI();
  };
  NS.deleteChannel = (i) => {
    App.channels.splice(i, 1);
    NS.renderChannels && NS.renderChannels();
  };
  NS.loadCompositeChannel = (which) => {
    const c = newDocCanvas();
    const t = c.getContext("2d");
    t.drawImage(composite, 0, 0);
    const img = t.getImageData(0, 0, App.docW, App.docH);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = which === 0 ? d[i] : which === 1 ? d[i + 1] : d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    t.putImageData(img, 0, 0);
    const sel = newDocCanvas();
    sel.getContext("2d").drawImage(c, 0, 0);
    App.selection = NS.maskSelection(sel);
    toast("Saluran " + "RGB"[which] + " dimuat sebagai seleksi");
    App.dirty = true;
    updateUI();
  };

  /* ---------- PERATAAN LAPISAN ---------- */
  NS.contentBBoxPublic = (l) => (typeof contentBBox === "function" ? contentBBox(l) : null);
  NS.alignLayer = (how) => {
    const l = activeLayer();
    if (!l || l.isGroup || l.locked) return toast("Lapisan terkunci / tidak ada", true);
    const b = NS.contentBBoxPublic(l);
    if (!b || !b.w) return toast("Lapisan kosong", true);
    let dx = 0, dy = 0;
    if (how === "left") dx = -b.x;
    else if (how === "right") dx = App.docW - (b.x + b.w);
    else if (how === "hcenter") dx = (App.docW - b.w) / 2 - b.x;
    else if (how === "top") dy = -b.y;
    else if (how === "bottom") dy = App.docH - (b.y + b.h);
    else if (how === "vcenter") dy = (App.docH - b.h) / 2 - b.y;
    if (!dx && !dy) return;
    const snap = cloneCanvas(l.canvas);
    l.ctx.clearRect(0, 0, App.docW, App.docH);
    l.ctx.drawImage(snap, Math.round(dx), Math.round(dy));
    pushHistory("Perataan Lapisan");
    updateLayerThumbs();
    App.dirty = true;
  };

  /* ---------- GABUNG TERLIHAT ---------- */
  NS.mergeVisible = () => {
    const vis = App.layers.filter(l => l.visible !== false && !l.isGroup);
    if (vis.length < 2) return toast("Minimal 2 lapisan terlihat", true);
    const top = vis[vis.length - 1];
    const out = newDocCanvas();
    const t = out.getContext("2d");
    App.layers.forEach(l => {
      if (l.isGroup || l.visible === false) return;
      t.save();
      t.globalAlpha = (l.opacity == null ? 100 : l.opacity) / 100;
      t.globalCompositeOperation = l.blendMode || "source-over";
      if (l.adj) NS.applyAdj(t, l); else t.drawImage(l.canvas, 0, 0);
      t.restore();
    });
    App.layers = App.layers.filter(l => !(l.visible !== false && !l.isGroup) || l === top);
    top.ctx.clearRect(0, 0, App.docW, App.docH);
    top.ctx.drawImage(out, 0, 0);
    top.name = "Gabung Terlihat";
    top.adj = null;
    App.activeLayerId = top.id;
    pushHistory("Gabung Terlihat");
    updateUI();
    App.dirty = true;
  };

  /* ---------- MENU LAPISAN ---------- */
  NS.installLayersMenu = () => {
    const adjItems = Object.keys(DEFS).map(type => ({ label: DEFS[type].title, fn: () => NS.newAdjustDialog(type) }));
    MENUS.Lapisan = [
      { label: "Lapisan Penyesuaian Baru", fn: () => NS.pickAdjustDialog() },
      ...adjItems.map(it => ({ label: "   " + it.label, fn: it.fn })),
      { sep: 1 },
      { label: () => (activeLayer() && activeLayer().clip ? "✓ " : "   ") + "Clipping Mask", fn: NS.toggleClip },
      { label: "Simpan Seleksi ke Saluran", fn: NS.saveChannel, sc: "Ctrl+Shift+C" },
      { sep: 1 },
      { label: "Perata Kiri", fn: () => NS.alignLayer("left") },
      { label: "Perata Tengah (H)", fn: () => NS.alignLayer("hcenter") },
      { label: "Perata Kanan", fn: () => NS.alignLayer("right") },
      { label: "Perata Atas", fn: () => NS.alignLayer("top") },
      { label: "Perata Tengah (V)", fn: () => NS.alignLayer("vcenter") },
      { label: "Perata Bawah", fn: () => NS.alignLayer("bottom") },
      { sep: 1 },
      { label: "Gabung Semua Terlihat", fn: NS.mergeVisible },
    ];
  };

  NS.pickAdjustDialog = () => {
    const items = Object.keys(DEFS).map(type =>
      `<button class="opt-btn" data-adj="${type}">${DEFS[type].title}</button>`).join("");
    showModal("Lapisan Penyesuaian Baru", `<div class="btn-grid">${items}</div>`, [{ label: "Batal" }]);
    $$("#modal-root [data-adj]").forEach(b => b.addEventListener("click", () => {
      $("#modal-root").innerHTML = "";
      NS.newAdjustDialog(b.dataset.adj);
    }));
  };

  /* ---------- CONTEXT MENU TAMBAHAN ---------- */
  const _layerCtx = layerContextMenu;
  layerContextMenu = function (x, y, l) {
    if (!l) return _layerCtx(x, y, l);
    const al = l;
    if (al.isGroup) return _layerCtx(x, y, l);
    if (NS.isAdjustLayer(al)) {
      App.activeLayerId = al.id; renderLayerList(); syncLayerControls();
      return showContextMenu(x, y, [
        { label: "Edit Penyesuaian…", fn: () => NS.adjLayerDialog(al) },
        { label: (al.clip ? "   " : "✓ ") + "Clipping Mask", fn: NS.toggleClip },
        { label: "Ganti Nama…", fn: () => layerRenameDialog(al) },
        { label: "Hapus Lapisan", fn: deleteLayer },
        { sep: 1 },
        { label: "Naikkan", fn: () => moveLayer(1) },
        { label: "Turunkan", fn: () => moveLayer(-1) },
      ], "Lapisan: " + al.name);
    }
    const base = () => _layerCtx(x, y, l);
    base();
    const extra = [
      { label: (al.clip ? "   " : "✓ ") + "Clipping Mask", fn: NS.toggleClip },
      { label: "Simpan ke Saluran", fn: NS.saveChannel, disabled: !App.selection },
      { sep: 1 },
      { label: "Perata Kiri", fn: () => NS.alignLayer("left") },
      { label: "Perata Tengah (H)", fn: () => NS.alignLayer("hcenter") },
      { label: "Perata Kanan", fn: () => NS.alignLayer("right") },
      { label: "Perata Atas", fn: () => NS.alignLayer("top") },
      { label: "Perata Tengah (V)", fn: () => NS.alignLayer("vcenter") },
      { label: "Perata Bawah", fn: () => NS.alignLayer("bottom") },
    ];
    const el = ctxMenuEl;
    if (!el) return;
    const sep = document.createElement("div");
    sep.className = "sep";
    el.appendChild(sep);
    extra.forEach(it => {
      const row = document.createElement("div");
      row.className = "item" + (it.disabled ? " disabled" : "");
      row.innerHTML = `<span>${it.label}</span><span class="sc">${it.sc || ""}</span>`;
      if (!it.disabled) row.addEventListener("click", ev => { ev.stopPropagation(); hideContextMenu(); it.fn(); });
      el.appendChild(row);
    });
  };

  /* ---------- PANEL: SALURAN ---------- */
  NS.renderChannels = () => {
    const box = $("#channel-list");
    if (!box) return;
    box.innerHTML = "";
    ["R", "G", "B"].forEach((name, i) => {
      const row = document.createElement("div");
      row.className = "ch-row";
      row.innerHTML = `<canvas width="28" height="21"></canvas><span>${name}</span><em>komposit</em>`;
      const c = row.querySelector("canvas"), x = c.getContext("2d");
      x.drawImage(composite, 0, 0, 28, 21);
      x.globalCompositeOperation = "saturation";
      x.fillStyle = ["#f00", "#0f0", "#00f"][i];
      x.fillRect(0, 0, 28, 21);
      row.addEventListener("click", () => NS.loadCompositeChannel(i));
      box.appendChild(row);
    });
    App.channels.forEach((ch, i) => {
      const row = document.createElement("div");
      row.className = "ch-row saved";
      row.innerHTML = `<canvas width="28" height="21"></canvas><span>${ch.name}</span><button class="ch-del" title="Hapus">✕</button>`;
      row.querySelector("canvas").getContext("2d").drawImage(ch.canvas, 0, 0, 28, 21);
      row.addEventListener("click", () => NS.loadChannel(i));
      row.querySelector(".ch-del").addEventListener("click", e => { e.stopPropagation(); NS.deleteChannel(i); });
      box.appendChild(row);
    });
  };

  /* ---------- PANEL: NAVIGATOR ---------- */
  NS.renderNavigator = () => {
    const c = $("#nav-cv");
    if (!c) return;
    if (c.width !== 200) { c.width = 200; c.height = 130; }
    const x = c.getContext("2d");
    x.fillStyle = "#141414"; x.fillRect(0, 0, c.width, c.height);
    const s = Math.min(c.width / App.docW, c.height / App.docH);
    const w = App.docW * s, h = App.docH * s, ox = (c.width - w) / 2, oy = (c.height - h) / 2;
    x.drawImage(composite, ox, oy, w, h);
    const vw = viewport.clientWidth / App.zoom, vh = viewport.clientHeight / App.zoom;
    x.strokeStyle = "#7ec8ff"; x.lineWidth = 1.5;
    x.strokeRect(ox + (-App.panX / App.zoom) * s, oy + (-App.panY / App.zoom) * s, vw * s, vh * s);
    c._map = { s, ox, oy };
  };
  NS.bindNavigator = () => {
    const c = $("#nav-cv");
    if (!c) return;
    c.addEventListener("click", e => {
      const m = c._map; if (!m) return;
      const r = c.getBoundingClientRect();
      const dx = (e.clientX - r.left - m.ox) / m.s, dy = (e.clientY - r.top - m.oy) / m.s;
      App.panX = viewport.clientWidth / 2 - dx * App.zoom;
      App.panY = viewport.clientHeight / 2 - dy * App.zoom;
      App.dirty = true;
    });
    const zs = $("#nav-zoom");
    if (zs) zs.addEventListener("input", e => {
      const target = +e.target.value / 100;
      zoomAt(target / App.zoom, viewport.clientWidth / 2, viewport.clientHeight / 2);
    });
  };

  /* ---------- PANEL: INFO ---------- */
  NS.renderInfo = () => {
    const box = $("#info-body");
    if (!box) return;
    const d = screenToDoc(App.mouse.x, App.mouse.y);
    const px = clamp(Math.floor(d.x), 0, App.docW - 1), py = clamp(Math.floor(d.y), 0, App.docH - 1);
    let rgb = "-";
    try {
      const c = composite.getContext("2d", { willReadFrequently: true }).getImageData(px, py, 1, 1).data;
      rgb = `${c[0]}, ${c[1]}, ${c[2]}`;
    } catch (e) {}
    let sel = "—";
    if (App.selection) {
      const b = App.selection.type === "mask" ? maskBBox(App.selection.mask) : App.selection;
      sel = `${Math.round(b.w)} × ${Math.round(b.h)} px`;
    }
    box.innerHTML = `
      <div class="info-row"><span>X, Y</span><b>${Math.round(d.x)}, ${Math.round(d.y)}</b></div>
      <div class="info-row"><span>RGB</span><b>${rgb}</b></div>
      <div class="info-row"><span>Ukuran</span><b>${App.docW} × ${App.docH}</b></div>
      <div class="info-row"><span>Seleksi</span><b>${sel}</b></div>`;
  };

  /* ---------- PANEL: HISTOGRAM ---------- */
  let histTick = 0;
  NS.renderHistogram = () => {
    const c = $("#hist-cv");
    if (!c) return;
    if (++histTick % 4 !== 0) return;
    if (c.width !== 240) { c.width = 240; c.height = 90; }
    const x = c.getContext("2d");
    x.fillStyle = "#141414"; x.fillRect(0, 0, c.width, c.height);
    let data;
    try {
      const tmp = document.createElement("canvas");
      tmp.width = 160; tmp.height = 120;
      const t = tmp.getContext("2d");
      t.drawImage(composite, 0, 0, 160, 120);
      data = t.getImageData(0, 0, 160, 120).data;
    } catch (e) { return; }
    const r = new Uint32Array(256), g = new Uint32Array(256), b = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) { r[data[i]]++; g[data[i + 1]]++; b[data[i + 2]]++; }
    let mx = 1;
    for (let i = 0; i < 256; i++) mx = Math.max(mx, r[i], g[i], b[i]);
    const plot = (arr, color, alpha) => {
      x.fillStyle = color; x.globalAlpha = alpha;
      for (let i = 0; i < 256; i++) {
        const h = arr[i] / mx * c.height;
        x.fillRect(i * c.width / 256, c.height - h, c.width / 256 + 1, h);
      }
      x.globalAlpha = 1;
    };
    x.globalCompositeOperation = "lighter";
    plot(r, "#f33", .55); plot(g, "#3f3", .55); plot(b, "#39f", .55);
    x.globalCompositeOperation = "source-over";
  };

  /* ---------- TICK PANEL (dipanggil tiap render) ---------- */
  NS.tickPanels = () => {
    NS.renderNavigator();
    NS.renderHistogram();
    NS.renderInfo();
  };

  /* ---------- PANEL MARKUP ---------- */
  NS.panelsHTML = () => `
    <section class="panel" data-panel="channels">
      <h3>Saluran</h3>
      <div class="panel-body">
        <div id="channel-list" class="channel-list"></div>
        <button class="opt-btn" id="ch-save">Simpan Seleksi Ke Saluran</button>
      </div>
    </section>
    <section class="panel" data-panel="navigator">
      <h3>Navigator</h3>
      <div class="panel-body">
        <canvas id="nav-cv" width="200" height="130"></canvas>
        <label class="adj-label">Zoom <span class="adj-val" id="nav-zv">${Math.round(App.zoom * 100)}%</span>
          <input type="range" id="nav-zoom" min="5" max="800" value="${Math.round(App.zoom * 100)}"></label>
      </div>
    </section>
    <section class="panel" data-panel="info">
      <h3>Info</h3>
      <div class="panel-body"><div id="info-body"></div></div>
    </section>
    <section class="panel" data-panel="histogram">
      <h3>Histogram</h3>
      <div class="panel-body"><canvas id="hist-cv" width="240" height="90"></canvas></div>
    </section>`;

  NS.initPanels = () => {
    const aside = $("#panels");
    if (!aside || $("#panels [data-panel='channels']")) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = NS.panelsHTML();
    while (wrap.firstElementChild) aside.appendChild(wrap.firstElementChild);
    const s = $("#ch-save");
    if (s) s.addEventListener("click", NS.saveChannel);
    NS.bindNavigator();
    try { initPanelLayout && initPanelLayout(); } catch (e) {}
    NS.renderChannels();
  };
})();
