/* ============================================================
   PS Lite — BOOTSTRAP FITUR LANJUTAN
   Dipanggil terakhir: memperluas menu, membangun ulang UI,
   mengaktifkan panel baru, dan mengaitkan overlay.
   Dimuat setelah semua ext-*.js.
   ============================================================ */
(function () {
  "use strict";
  const NS = (window.EXTNS = window.EXTNS || {});

  /* panel tambahan ke aside */
  try { NS.initPanels && NS.initPanels(); } catch (e) { console.error("initPanels", e); }

  /* menu tambahan */
  try { NS.installLayersMenu && NS.installLayersMenu(); } catch (e) { console.error("installLayersMenu", e); }
  try { NS.installAdjustMenu && NS.installAdjustMenu(); } catch (e) { console.error("installAdjustMenu", e); }
  try { NS.installDocMenu && NS.installDocMenu(); } catch (e) { console.error("installDocMenu", e); }

  /* bangun ulang UI agar tool & menu baru muncul */
  try {
    buildMenus();
    buildToolbar();
    buildAdjustGrid();
    updateOptionsBar();
    updateUI();
  } catch (e) { console.error("rebuild UI", e); }

  /* dokumen tab */
  try { NS.initDocs && NS.initDocs(); } catch (e) { console.error("initDocs", e); }

  /* overlay: ikut menggambar & memperbarui panel tiap frame render */
  const _overlay = EXT.overlayScreen;
  EXT.overlayScreen = (ctx, vw, vh) => {
    if (_overlay) _overlay(ctx, vw, vh);
    if (NS.tickPanels) NS.tickPanels();
  };

  /* pintasan dokumen baru (Ctrl+Alt+N) */
  document.addEventListener("keydown", e => {
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "n") {
      e.preventDefault(); e.stopPropagation();
      NS.newDocTab && NS.newDocTab();
    }
  }, true);

  /* sinkronisasi label navigator & status mode secara berkala */
  setInterval(() => {
    const zv = $("#nav-zv"), zs = $("#nav-zoom");
    if (zs) {
      const pct = Math.round(App.zoom * 100);
      if (document.activeElement !== zs) zs.value = clamp(pct, 5, 800);
      if (zv) zv.textContent = pct + "%";
    }
    NS.renderDocTabs && NS.renderDocTabs();
  }, 400);

  console.log("[PS Lite] Ekstensi lanjutan aktif:", Object.keys(NS).filter(k => typeof NS[k] === "function").length, "fungsi");
})();
