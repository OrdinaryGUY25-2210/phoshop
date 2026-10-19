/* ============================================================
   PS Lite — FITUR LANJUTAN (penyesuaian & filter destruktif)
   Kurva, Gradient Map, Selective Color, Bayangan/Sorotan,
   Photo Filter, Channel Mixer, serta filter baru:
   pikselasi, cat minyak, tepi menyala, halftone, radial/zoom
   blur, sharp more, dust & scratches, sketsa, isi sadar-konten.
   Dimuat setelah ext-core.js.
   ============================================================ */
(function () {
  "use strict";
  const NS = (window.EXTNS = window.EXTNS || {});

  const guard = () => {
    const l = activeLayer();
    if (!l || l.isGroup || l.locked) { toast("Lapisan terkunci / tidak ada", true); return null; }
    return l;
  };

  /* penyesuaian destruktif berbasis tabel kontrol */
  const destructive = (title, type, ctrls) => {
    const l = guard(); if (!l) return;
    const controls = ctrls.map(c => ({ id: c.k, label: c.label, min: c.min, max: c.max, value: c.val, step: c.step }));
    openAdjustDialog(title, controls, (orig, v) => {
      const img = l.ctx.createImageData(orig.width, orig.height);
      img.data.set(orig.data);
      NS.ADJUST[type](img.data, v, orig.width, orig.height);
      l.ctx.putImageData(img, 0, 0);
    });
  };

  NS.installAdjustMenu = () => {
    const F = (label, fn) => ({ label, fn });
    MENUS.Filter.push(
      { sep: 1 },
      F("Kurva…", NS.dialogCurvesDestructive),
      F("Gradient Map…", NS.dialogGradientMapDestructive),
      F("Selective Color…", NS.dialogSelectiveDestructive),
      F("Bayangan/Sorotan…", () => destructive("Bayangan/Sorotan", "shadowshigh",
        NS.ADJ_DEFS.shadowshigh.ctrls)),
      F("Photo Filter…", NS.dialogPhotoFilterDestructive),
      F("Channel Mixer…", NS.dialogChannelMixerDestructive),
      { sep: 1 },
      F("Pikselasi…", NS.dialogPixelate),
      F("Cat Minyak", NS.applyOilPaint),
      F("Tepi Menyala", NS.applyGlowingEdges),
      F("Halftone…", NS.dialogHalftone),
      F("Radial Blur…", NS.dialogRadialBlur),
      F("Zoom Blur…", NS.dialogZoomBlur),
      F("Sharpen More", NS.applySharpenMore),
      F("Dust & Scratches…", NS.dialogDustScratches),
      F("Sketsa Pensil", NS.applySketch),
      F("Isi Sadar-Konten (perkiraan)", NS.applyContentAwareFill)
    );
  };

  /* ---------- KURVA DESTRUKTIF ---------- */
  NS.dialogCurvesDestructive = () => {
    const l = guard(); if (!l) return;
    const orig = l.ctx.getImageData(0, 0, App.docW, App.docH);
    let points = [[0, 0], [255, 255]];
    const W = 220;
    showModal("Kurva", `
      <canvas id="curve-cv" width="${W}" height="${W}" style="background:#1b1b1b;border:1px solid #3a3a3a;border-radius:6px;cursor:crosshair"></canvas>
      <p style="color:var(--text2);margin-top:6px">Klik menambah titik • seret untuk geser • klik kanan menghapus titik</p>`, [
      { label: "Batal", onClick: () => { l.ctx.putImageData(orig, 0, 0); App.dirty = true; } },
      { label: "Reset", onClick: () => { points = [[0, 0], [255, 255]]; run(); } },
      { label: "Oke", primary: true, onClick: () => { pushHistory("Kurva"); updateLayerThumbs(); } },
    ]);
    const cv = $("#curve-cv"), cx = cv.getContext("2d");
    const toXY = ([x, y]) => [x / 255 * W, W - y / 255 * W];
    let drag = -1;
    const run = () => {
      const lut = NS.curveLUT(points);
      const img = l.ctx.createImageData(orig.width, orig.height);
      img.data.set(orig.data);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; }
      l.ctx.putImageData(img, 0, 0);
      draw();
      App.dirty = true;
    };
    function draw() {
      cx.clearRect(0, 0, W, W);
      cx.strokeStyle = "#333";
      for (let i = 0; i <= 4; i++) { const q = i / 4 * W; cx.beginPath(); cx.moveTo(q, 0); cx.lineTo(q, W); cx.moveTo(0, q); cx.lineTo(W, q); cx.stroke(); }
      cx.strokeStyle = "#666"; cx.beginPath(); cx.moveTo(0, W); cx.lineTo(W, 0); cx.stroke();
      const lut = NS.curveLUT(points);
      cx.strokeStyle = "#7ec8ff"; cx.lineWidth = 2; cx.beginPath();
      for (let x = 0; x < W; x++) { const y = W - lut[Math.round(x / W * 255)] / 255 * W; x === 0 ? cx.moveTo(x, y) : cx.lineTo(x, y); }
      cx.stroke();
      cx.fillStyle = "#fff"; cx.strokeStyle = "#1f6fb2";
      points.forEach(pt => { const [px, py] = toXY(pt); cx.beginPath(); cx.arc(px, py, 4, 0, 7); cx.fill(); cx.stroke(); });
    }
    const pick = (mx, my) => {
      let best = -1, bd = 1e9;
      points.forEach((pt, i) => { const [px, py] = toXY(pt); const dd = Math.hypot(px - mx, py - my); if (dd < bd) { bd = dd; best = i; } });
      return bd < 12 ? best : -1;
    };
    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener("pointerdown", e => {
      const [mx, my] = pos(e);
      const hit = pick(mx, my);
      if (e.button === 2) { if (hit > 0 && hit < points.length - 1) { points.splice(hit, 1); run(); } return; }
      if (hit >= 0) drag = hit;
      else {
        points.push([clamp(Math.round(mx / W * 255), 0, 255), clamp(Math.round((W - my) / W * 255), 0, 255)]);
        points.sort((a, b) => a[0] - b[0]);
        drag = points.findIndex(q => q[0] === clamp(Math.round(mx / W * 255), 0, 255));
        run();
      }
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener("pointermove", e => {
      if (drag < 0) return;
      const [mx, my] = pos(e);
      const nx = clamp(Math.round(mx / W * 255), 0, 255), ny = clamp(Math.round((W - my) / W * 255), 0, 255);
      const isEnd = drag === 0 || drag === points.length - 1;
      points[drag] = isEnd ? [drag === 0 ? 0 : 255, ny] : [nx, ny];
      run();
    });
    cv.addEventListener("pointerup", () => { drag = -1; });
    cv.addEventListener("contextmenu", e => e.preventDefault());
    draw();
  };

  /* ---------- GRADIENT MAP DESTRUKTIF ---------- */
  NS.dialogGradientMapDestructive = () => {
    const l = guard(); if (!l) return;
    const orig = l.ctx.getImageData(0, 0, App.docW, App.docH);
    const params = { from: "#001a4d", to: "#ffd9a0" };
    const run = () => {
      const img = l.ctx.createImageData(orig.width, orig.height);
      img.data.set(orig.data);
      NS.ADJUST.gradientmap(img.data, params, orig.width, orig.height);
      l.ctx.putImageData(img, 0, 0);
      App.dirty = true;
    };
    showModal("Gradient Map", `
      <div class="field-row">
        <div class="field"><label>Bayangan</label><input type="color" id="gm-from" value="${params.from}"></div>
        <div class="field"><label>Sorotan</label><input type="color" id="gm-to" value="${params.to}"></div>
      </div>
      <div id="gm-prev" style="height:24px;border-radius:6px;border:1px solid #3a3a3a"></div>`, [
      { label: "Batal", onClick: () => { l.ctx.putImageData(orig, 0, 0); App.dirty = true; } },
      { label: "Oke", primary: true, onClick: () => { pushHistory("Gradient Map"); updateLayerThumbs(); } },
    ]);
    const upd = () => {
      params.from = $("#gm-from").value; params.to = $("#gm-to").value;
      $("#gm-prev").style.background = `linear-gradient(90deg,${params.from},${params.to})`;
      run();
    };
    $("#gm-from").addEventListener("input", upd);
    $("#gm-to").addEventListener("input", upd);
    upd();
  };

  /* ---------- SELECTIVE COLOR DESTRUKTIF ---------- */
  NS.dialogSelectiveDestructive = () => {
    const l = guard(); if (!l) return;
    const orig = l.ctx.getImageData(0, 0, App.docW, App.docH);
    const ranges = ["merah", "kuning", "hijau", "cyan", "biru", "magenta", "netral", "putih", "hitam"];
    const params = { range: "merah", cyan: 0, magenta: 0, yellow: 0, black: 0, red: 0, green: 0, blue: 0 };
    const ctrls = [["cyan", "Cyan"], ["magenta", "Magenta"], ["yellow", "Kuning"], ["black", "Hitam"]];
    const run = () => {
      const img = l.ctx.createImageData(orig.width, orig.height);
      img.data.set(orig.data);
      NS.ADJUST.selective(img.data, params, orig.width, orig.height);
      l.ctx.putImageData(img, 0, 0);
      App.dirty = true;
    };
    showModal("Selective Color", `
      <div class="field"><label>Rentang</label><select id="sel-range">${ranges.map(r => `<option value="${r}">${r}</option>`).join("")}</select></div>
      ${ctrls.map(([k, lab]) => `<label class="adj-label">${lab} <span class="adj-val" id="selv-${k}">0</span>
        <input type="range" id="sel-${k}" min="-100" max="100" value="0"></label>`).join("")}`, [
      { label: "Batal", onClick: () => { l.ctx.putImageData(orig, 0, 0); App.dirty = true; } },
      { label: "Oke", primary: true, onClick: () => { pushHistory("Selective Color"); updateLayerThumbs(); } },
    ]);
    $("#sel-range").addEventListener("change", e => { params.range = e.target.value; run(); });
    ctrls.forEach(([k]) => {
      const el = $("#sel-" + k);
      el.addEventListener("input", () => { params[k] = +el.value; $("#selv-" + k).textContent = el.value; run(); });
    });
  };

  /* ---------- PHOTO FILTER DESTRUKTIF ---------- */
  NS.dialogPhotoFilterDestructive = () => {
    const l = guard(); if (!l) return;
    const orig = l.ctx.getImageData(0, 0, App.docW, App.docH);
    const params = { color: "#ec8a00", density: 25, preserve: true };
    const run = () => {
      const img = l.ctx.createImageData(orig.width, orig.height);
      img.data.set(orig.data);
      NS.ADJUST.photofilter(img.data, params, orig.width, orig.height);
      l.ctx.putImageData(img, 0, 0);
      App.dirty = true;
    };
    showModal("Photo Filter", `
      <div class="field"><label>Warna</label><input type="color" id="pf-color" value="${params.color}"></div>
      <label class="adj-label">Kepadatan <span class="adj-val" id="pfv">25%</span>
        <input type="range" id="pf-d" min="1" max="100" value="25"></label>
      <label class="chk"><input type="checkbox" id="pf-p" checked> Jaga kecerahan</label>`, [
      { label: "Batal", onClick: () => { l.ctx.putImageData(orig, 0, 0); App.dirty = true; } },
      { label: "Oke", primary: true, onClick: () => { pushHistory("Photo Filter"); updateLayerThumbs(); } },
    ]);
    $("#pf-color").addEventListener("input", e => { params.color = e.target.value; run(); });
    $("#pf-d").addEventListener("input", e => { params.density = +e.target.value; $("#pfv").textContent = e.target.value + "%"; run(); });
    $("#pf-p").addEventListener("change", e => { params.preserve = e.target.checked; run(); });
    run();
  };

  /* ---------- CHANNEL MIXER DESTRUKTIF ---------- */
  NS.dialogChannelMixerDestructive = () => {
    const l = guard(); if (!l) return;
    const orig = l.ctx.getImageData(0, 0, App.docW, App.docH);
    const params = { rr: 100, rg: 0, rb: 0, gr: 0, gg: 100, gb: 0, br: 0, bg: 0, bb: 100, mono: false };
    const band = (title, arr) => `<div class="cm-band"><b>${title}</b>` + arr.map(([k, lab]) =>
      `<label class="adj-label">${lab} <span class="adj-val" id="cmv-${k}">${params[k]}</span>
        <input type="range" id="cm-${k}" min="-200" max="200" value="${params[k]}"></label>`).join("") + `</div>`;
    const run = () => {
      const img = l.ctx.createImageData(orig.width, orig.height);
      img.data.set(orig.data);
      NS.ADJUST.channelmixer(img.data, params, orig.width, orig.height);
      l.ctx.putImageData(img, 0, 0);
      App.dirty = true;
    };
    showModal("Channel Mixer",
      band("Output Merah", [["rr", "Merah"], ["rg", "Hijau"], ["rb", "Biru"]]) +
      band("Output Hijau", [["gr", "Merah"], ["gg", "Hijau"], ["gb", "Biru"]]) +
      band("Output Biru", [["br", "Merah"], ["bg", "Hijau"], ["bb", "Biru"]]) +
      `<label class="chk"><input type="checkbox" id="cm-mono"> Monokrom</label>`, [
      { label: "Batal", onClick: () => { l.ctx.putImageData(orig, 0, 0); App.dirty = true; } },
      { label: "Oke", primary: true, onClick: () => { pushHistory("Channel Mixer"); updateLayerThumbs(); } },
    ]);
    [["rr"], ["rg"], ["rb"], ["gr"], ["gg"], ["gb"], ["br"], ["bg"], ["bb"]].forEach(([k]) => {
      const el = $("#cm-" + k);
      el.addEventListener("input", () => { params[k] = +el.value; $("#cmv-" + k).textContent = el.value; run(); });
    });
    $("#cm-mono").addEventListener("change", e => { params.mono = e.target.checked; run(); });
  };

  /* ---------- FILTER BARU ---------- */
  const filterActive = (label, fn) => {
    const l = guard(); if (!l) return;
    const img = l.ctx.getImageData(0, 0, App.docW, App.docH);
    fn(img.data, App.docW, App.docH);
    l.ctx.putImageData(img, 0, 0);
    pushHistory(label);
    updateLayerThumbs();
    App.dirty = true;
  };

  NS.dialogPixelate = () => {
    const l = guard(); if (!l) return;
    const orig = cloneCanvas(l.canvas);
    showModal("Pikselasi", `
      <label class="adj-label">Ukuran blok <span class="adj-val" id="pv">12</span>
        <input type="range" id="px" min="2" max="80" value="12"></label>`, [
      { label: "Batal", onClick: () => { l.ctx.clearRect(0, 0, App.docW, App.docH); l.ctx.drawImage(orig, 0, 0); App.dirty = true; } },
      { label: "Oke", primary: true, onClick: () => { pushHistory("Pikselasi"); updateLayerThumbs(); } },
    ]);
    const run = n => {
      const small = document.createElement("canvas");
      small.width = Math.max(1, Math.round(App.docW / n));
      small.height = Math.max(1, Math.round(App.docH / n));
      const sx = small.getContext("2d");
      sx.imageSmoothingEnabled = true;
      sx.drawImage(orig, 0, 0, small.width, small.height);
      l.ctx.clearRect(0, 0, App.docW, App.docH);
      l.ctx.imageSmoothingEnabled = false;
      l.ctx.drawImage(small, 0, 0, App.docW, App.docH);
      l.ctx.imageSmoothingEnabled = true;
      App.dirty = true;
    };
    $("#px").addEventListener("input", e => { $("#pv").textContent = e.target.value; run(+e.target.value); });
    run(12);
  };

  NS.applyOilPaint = () => filterActive("Cat Minyak", (d, w, h) => {
    const src = new Uint8ClampedArray(d);
    const rad = 3;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const bins = new Array(8).fill(0).map(() => [0, 0, 0, 0]);
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
        const nx = clamp(x + dx, 0, w - 1), ny = clamp(y + dy, 0, h - 1);
        const p = (ny * w + nx) * 4;
        const lum = (src[p] * 0.299 + src[p + 1] * 0.587 + src[p + 2] * 0.114) / 255;
        const bin = Math.min(7, Math.floor(lum * 8));
        const b = bins[bin];
        b[0] += src[p]; b[1] += src[p + 1]; b[2] += src[p + 2]; b[3]++;
      }
      let best = bins[0], bestC = -1;
      for (const b of bins) if (b[3] > bestC) { best = b; bestC = b[3]; }
      const i = (y * w + x) * 4;
      d[i] = best[0] / (best[3] || 1); d[i + 1] = best[1] / (best[3] || 1); d[i + 2] = best[2] / (best[3] || 1);
    }
  });

  NS.applyGlowingEdges = () => filterActive("Tepi Menyala", (d, w, h) => {
    const src = new Uint8ClampedArray(d);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      let gx = 0, gy = 0;
      for (let c = 0; c < 3; c++) {
        const lum = (xx, yy) => { const p = (yy * w + xx) * 4; return src[p] * 0.299 + src[p + 1] * 0.587 + src[p + 2] * 0.114; };
        gx += lum(x + 1, y) - lum(x - 1, y);
        gy += lum(x, y + 1) - lum(x, y - 1);
      }
      const mag = clamp(255 - Math.hypot(gx, gy) * 1.4, 0, 255);
      d[i] = mag; d[i + 1] = mag; d[i + 2] = mag;
    }
  });

  NS.dialogHalftone = () => {
    const l = guard(); if (!l) return;
    const orig = l.ctx.getImageData(0, 0, App.docW, App.docH);
    showModal("Halftone", `
      <label class="adj-label">Jarak titik <span class="adj-val" id="hv">6</span>
        <input type="range" id="hd" min="3" max="20" value="6"></label>`, [
      { label: "Batal", onClick: () => { l.ctx.putImageData(orig, 0, 0); App.dirty = true; } },
      { label: "Oke", primary: true, onClick: () => { pushHistory("Halftone"); updateLayerThumbs(); } },
    ]);
    const run = step => {
      const img = l.ctx.createImageData(orig.width, orig.height);
      const s = orig.data, d = img.data;
      for (let y = 0; y < App.docH; y++) for (let x = 0; x < App.docW; x++) {
        const i = (y * App.docW + x) * 4;
        const gx = (x % step) - step / 2, gy = (y % step) - step / 2;
        const lum = (s[i] * 0.299 + s[i + 1] * 0.587 + s[i + 2] * 0.114) / 255;
        const r = Math.sqrt(gx * gx + gy * gy);
        const v = lum * step / 2 > r ? 0 : 255;
        d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
      }
      l.ctx.putImageData(img, 0, 0);
      App.dirty = true;
    };
    $("#hd").addEventListener("input", e => { $("#hv").textContent = e.target.value; run(+e.target.value); });
    run(6);
  };

  const blurDialog = (title, radial) => {
    const l = guard(); if (!l) return;
    const orig = cloneCanvas(l.canvas);
    showModal(title, `
      <label class="adj-label">Kekuatan <span class="adj-val" id="bv">12</span>
        <input type="range" id="bs" min="1" max="40" value="12"></label>`, [
      { label: "Batal", onClick: () => { l.ctx.clearRect(0, 0, App.docW, App.docH); l.ctx.drawImage(orig, 0, 0); App.dirty = true; } },
      { label: "Oke", primary: true, onClick: () => { pushHistory(title); updateLayerThumbs(); } },
    ]);
    const run = n => {
      l.ctx.clearRect(0, 0, App.docW, App.docH);
      l.ctx.drawImage(orig, 0, 0);
      l.ctx.save();
      l.ctx.globalAlpha = 0.14;
      const steps = Math.max(2, Math.round(n / 3));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const sc = radial ? 1 + t * n / 100 : 1;
        const a = 2 * Math.PI * t * (radial ? 1 : 0);
        const dx = radial ? 0 : Math.cos(a) * t * n;
        const dy = radial ? 0 : Math.sin(a) * t * n;
        l.ctx.save();
        l.ctx.translate(App.docW / 2, App.docH / 2);
        l.ctx.scale(sc, sc);
        l.ctx.drawImage(orig, -App.docW / 2 + dx, -App.docH / 2 + dy);
        l.ctx.restore();
      }
      l.ctx.restore();
      App.dirty = true;
    };
    $("#bs").addEventListener("input", e => { $("#bv").textContent = e.target.value; run(+e.target.value); });
    run(12);
  };
  NS.dialogRadialBlur = () => blurDialog("Radial Blur", true);
  NS.dialogZoomBlur = () => blurDialog("Zoom Blur", true);

  NS.applySharpenMore = () => filterActive("Sharpen More", (d, w, h) => {
    const src = new Uint8ClampedArray(d);
    const k = [0, -1, 0, -1, 6, -1, 0, -1, 0];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const p = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        let sum = 0, ki = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += src[((y + dy) * w + (x + dx)) * 4 + c] * k[ki++];
        d[p + c] = clamp(sum, 0, 255);
      }
    }
  });

  NS.dialogDustScratches = () => {
    const l = guard(); if (!l) return;
    const orig = l.ctx.getImageData(0, 0, App.docW, App.docH);
    showModal("Dust & Scratches", `
      <label class="adj-label">Radius <span class="adj-val" id="dv">2</span>
        <input type="range" id="dr" min="1" max="6" value="2"></label>`, [
      { label: "Batal", onClick: () => { l.ctx.putImageData(orig, 0, 0); App.dirty = true; } },
      { label: "Oke", primary: true, onClick: () => { pushHistory("Dust & Scratches"); updateLayerThumbs(); } },
    ]);
    const run = rad => {
      const img = l.ctx.createImageData(orig.width, orig.height);
      const s = orig.data, d = img.data; d.set(s);
      for (let y = 0; y < App.docH; y++) for (let x = 0; x < App.docW; x++) {
        const i = (y * App.docW + x) * 4;
        for (let c = 0; c < 3; c++) {
          const vals = [];
          for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
            const nx = clamp(x + dx, 0, App.docW - 1), ny = clamp(y + dy, 0, App.docH - 1);
            vals.push(s[(ny * App.docW + nx) * 4 + c]);
          }
          vals.sort((a, b) => a - b);
          d[i + c] = vals[Math.floor(vals.length / 2)];
        }
      }
      l.ctx.putImageData(img, 0, 0);
      App.dirty = true;
    };
    $("#dr").addEventListener("input", e => { $("#dv").textContent = e.target.value; run(+e.target.value); });
    run(2);
  };

  NS.applySketch = () => filterActive("Sketsa Pensil", (d, w, h) => {
    const src = new Uint8ClampedArray(d);
    const gray = new Uint8ClampedArray(d.length);
    for (let i = 0; i < d.length; i += 4) {
      const g = src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114;
      gray[i] = gray[i + 1] = gray[i + 2] = g; gray[i + 3] = src[i + 3];
    }
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      if (!src[i + 3]) { d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = 0; continue; }
      let minL = 255;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        minL = Math.min(minL, gray[((y + dy) * w + (x + dx)) * 4]);
      }
      const div = clamp(gray[i] / (minL + 1), 0, 1);
      const v = clamp(255 * div, 0, 255);
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = src[i + 3];
    }
  });

  NS.applyContentAwareFill = () => {
    const l = guard(); if (!l) return;
    if (!App.selection) return toast("Buat seleksi dulu", true);
    const mask = selectionMask(App.selection);
    const b = App.selection.type === "mask" ? maskBBox(mask) : App.selection;
    const pad = 24;
    const bx = clamp(Math.round(b.x - pad), 0, App.docW), by = clamp(Math.round(b.y - pad), 0, App.docH);
    const bw = clamp(Math.round(b.w + pad * 2), 1, App.docW - bx), bh = clamp(Math.round(b.h + pad * 2), 1, App.docH - by);
    const region = newDocCanvas();
    const rc = region.getContext("2d", { willReadFrequently: true });
    rc.drawImage(l.canvas, 0, 0);
    const full = rc.getImageData(0, 0, App.docW, App.docH);
    const md = mask.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, App.docW, App.docH).data;
    const regionData = rc.getImageData(bx, by, bw, bh);
    const rd = regionData.data;
    for (let pass = 0; pass < 6; pass++) {
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        const gx = bx + x, gy = by + y;
        if (!md[(gy * App.docW + gx) * 4 + 3]) continue;
        let r = 0, g = 0, bl = 0, n = 0;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
          const ngx = bx + nx, ngy = by + ny;
          if (md[(ngy * App.docW + ngx) * 4 + 3]) continue;
          const p = (ny * bw + nx) * 4;
          r += rd[p]; g += rd[p + 1]; bl += rd[p + 2]; n++;
        }
        if (!n) continue;
        const p = (y * bw + x) * 4;
        rd[p] = r / n; rd[p + 1] = g / n; rd[p + 2] = bl / n; rd[p + 3] = 255;
      }
    }
    rc.putImageData(regionData, bx, by);
    const out = newDocCanvas();
    const oc = out.getContext("2d");
    oc.drawImage(l.canvas, 0, 0);
    oc.drawImage(region, 0, 0);
    oc.globalCompositeOperation = "destination-in";
    oc.drawImage(mask, 0, 0);
    l.ctx.drawImage(out, 0, 0);
    pushHistory("Isi Sadar-Konten");
    updateLayerThumbs();
    App.dirty = true;
    toast("Isi sadar-konten diterapkan (perkiraan)");
  };
})();
