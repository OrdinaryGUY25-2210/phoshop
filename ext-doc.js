/* ============================================================
   PS Lite — FITUR LANJUTAN (dokumen & berbagi)
   Multi-dokumen (tab), mode warna RGB/Grayscale,
   dialog simpan/buka bawaan desktop (Electron IPC).
   Dimuat setelah ext-core.js.
   ============================================================ */
(function () {
  "use strict";
  const NS = (window.EXTNS = window.EXTNS || {});

  /* ---------- MULTI DOKUMEN (TAB) ---------- */
  let docSeq = 1;
  NS.snapshotDoc = () => ({
    state: serializeProject(),
    viewRot: App.viewRot || 0,
    viewRotDeg: App.viewRotDeg || 0,
    guides: (App.guides || []).map(g => ({ axis: g.axis, pos: g.pos })),
    mode: App.mode || "rgb",
  });
  NS.restoreDoc = async (snap) => {
    await applyProjectData(snap.state);
    App.viewRot = snap.viewRot || 0;
    App.viewRotDeg = snap.viewRotDeg || 0;
    App.guides = (snap.guides || []).map(g => ({ ...g }));
    App.mode = snap.mode || "rgb";
    App.dirty = true;
    updateUI();
  };
  NS.currentDoc = () => App.docs && App.docs.find(d => d.id === App.activeDocId);
  NS.saveCurrentDoc = () => { const d = NS.currentDoc(); if (d) d.state = NS.snapshotDoc(); };

  NS.initDocs = () => {
    App.docs = [{ id: 1, name: "Tanpa Judul 1", state: NS.snapshotDoc() }];
    App.activeDocId = 1;
    docSeq = 1;
    NS.renderDocTabs();
  };
  NS.newDocTab = () => {
    NS.saveCurrentDoc();
    newDocument(800, 600, "white", true);
    docSeq++;
    const last = App.docs[App.docs.length - 1];
    const id = Math.max(docSeq, (last ? last.id : 0) + 1);
    App.docs.push({ id, name: "Tanpa Judul " + id, state: NS.snapshotDoc() });
    App.activeDocId = id;
    NS.renderDocTabs();
  };
  NS.switchDoc = async (id) => {
    if (id === App.activeDocId) return;
    NS.saveCurrentDoc();
    const d = App.docs.find(x => x.id === id);
    if (!d) return;
    App.activeDocId = id;
    try { await NS.restoreDoc(d.state); } catch (e) { toast("Gagal membuka dokumen: " + e.message, true); }
    NS.renderDocTabs();
    toast("Dokumen: " + d.name);
  };
  NS.closeDoc = async (id) => {
    if (App.docs.length <= 1) return toast("Minimal satu dokumen", true);
    const i = App.docs.findIndex(x => x.id === id);
    if (i < 0) return;
    App.docs.splice(i, 1);
    if (App.activeDocId === id) {
      const next = App.docs[Math.min(i, App.docs.length - 1)];
      App.activeDocId = next.id;
      try { await NS.restoreDoc(next.state); } catch (e) {}
    }
    NS.renderDocTabs();
  };
  NS.renderDocTabs = () => {
    const box = $("#doc-tabs");
    if (!box || !App.docs) return;
    box.innerHTML = "";
    App.docs.forEach(d => {
      const tab = document.createElement("div");
      tab.className = "doc-tab" + (d.id === App.activeDocId ? " active" : "");
      tab.innerHTML = `<span>${d.name}</span><b title="Tutup">✕</b>`;
      tab.addEventListener("click", () => NS.switchDoc(d.id));
      tab.querySelector("b").addEventListener("click", e => { e.stopPropagation(); NS.closeDoc(d.id); });
      box.appendChild(tab);
    });
    const add = document.createElement("button");
    add.className = "doc-add";
    add.textContent = "＋";
    add.title = "Dokumen baru";
    add.addEventListener("click", NS.newDocTab);
    box.appendChild(add);
  };

  /* ---------- MODE WARNA ---------- */
  NS.setMode = (mode) => {
    if (mode === "gray") {
      const before = App.layers.map(l => cloneCanvas(l.canvas));
      App.layers.forEach(l => { if (!l.isGroup && !l.adj) applyGrayscaleToLayer(l); });
      App.mode = "gray";
      pushHistory("Mode: Grayscale");
      toast("Mode Grayscale (semua lapisan dikonversi)");
      updateLayerThumbs();
      App.dirty = true;
    } else if (mode === "cmyk") {
      App.mode = "cmyk";
      toast("Mode CMYK: pratinjau — ekspor tetap RGB");
    } else {
      App.mode = "rgb";
      toast("Mode RGB");
    }
    App.dirty = true;
  };
  function applyGrayscaleToLayer(l) {
    const img = l.ctx.getImageData(0, 0, App.docW, App.docH);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      d[i] = d[i + 1] = d[i + 2] = g;
    }
    l.ctx.putImageData(img, 0, 0);
  }

  /* ---------- DESKTOP IPC (dialog bawaan) ---------- */
  const native = window.psNative || null;
  NS.hasNative = !!(native && native.isDesktop);

  NS.deskSavePNG = async () => {
    if (!NS.hasNative) return savePNG();
    const c = compositeToCanvas(false);
    const dataUrl = c.toDataURL("image/png");
    const nameGuess = (NS.currentDoc() ? NS.currentDoc().name : "pslite-editan") + ".png";
    const res = await native.saveFile({ name: nameGuess, dataUrl, filters: [{ name: "PNG", extensions: ["png"] }] });
    if (res && res.ok) toast("Disimpan: " + res.path);
    else if (res && res.error) toast("Gagal menyimpan: " + res.error, true);
  };
  NS.buildPSDBytes = (depth) => {
    depth = depth === 16 ? 16 : 8;
    const w = App.docW, h = App.docH;
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
    return buildPSD({ w, h, records, comp, depth });
  };
  NS.deskSavePSD = async (depth) => {
    depth = depth === 16 ? 16 : 8;
    if (!NS.hasNative) return exportPSD(depth);
    let base64;
    try {
      const bytes = NS.buildPSDBytes(depth);
      let s = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      base64 = btoa(s);
    } catch (e) { toast("Gagal membuat PSD: " + e.message, true); return; }
    const name = (NS.currentDoc() ? NS.currentDoc().name : "pslite") + (depth === 16 ? "-16bit" : "") + ".psd";
    const res = await native.saveFile({ name, base64, filters: [{ name: "Photoshop", extensions: ["psd"] }] });
    if (res && res.ok) toast("Disimpan: " + res.path);
    else if (res && res.error) toast("Gagal menyimpan: " + res.error, true);
  };
  NS.deskOpen = async () => {
    if (!NS.hasNative) return $("#file-input").click();
    const res = await native.openFile({ filters: [{ name: "Gambar / PSD / Proyek", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "psd", "json"] }] });
    if (!res || !res.ok) { if (res && res.error) toast("Gagal membuka: " + res.error, true); return; }
    try {
      const blob = await (await fetch(res.dataUrl)).blob();
      const file = new File([blob], res.name, { type: blob.type || "application/octet-stream" });
      openAnyFile(file);
    } catch (e) { toast("Gagal membaca berkas: " + e.message, true); }
  };

  NS.installDocMenu = () => {
    MENUS.Berkas.unshift(
      { label: "Dokumen Baru (tab)", sc: "Ctrl+Alt+N", fn: NS.newDocTab },
      { label: "Tutup Dokumen", fn: () => NS.closeDoc(App.activeDocId) },
      { sep: 1 }
    );
    if (NS.hasNative) {
      MENUS.Berkas.unshift(
        { label: "Buka (dialog desktop)…", fn: NS.deskOpen },
        { label: "Simpan PNG (dialog desktop)…", fn: NS.deskSavePNG },
        { label: "Simpan PSD 8-bit (dialog desktop)…", fn: () => NS.deskSavePSD(8) },
        { label: "Simpan PSD 16-bit (dialog desktop)…", fn: () => NS.deskSavePSD(16) },
        { sep: 1 }
      );
    }
    MENUS.Mode = [
      { label: () => (App.mode === "rgb" ? "✓ " : "   ") + "RGB", fn: () => NS.setMode("rgb") },
      { label: () => (App.mode === "gray" ? "✓ " : "   ") + "Grayscale", fn: () => NS.setMode("gray") },
      { label: () => (App.mode === "cmyk" ? "✓ " : "   ") + "CMYK (pratinjau)", fn: () => NS.setMode("cmyk") },
    ];
  };
})();
