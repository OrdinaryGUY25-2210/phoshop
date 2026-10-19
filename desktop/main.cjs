const { app, BrowserWindow, Menu, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

function decode(opts) {
  if (opts.base64) return Buffer.from(opts.base64, "base64");
  if (opts.dataUrl) {
    const m = /^data:([^;]+);base64,(.*)$/s.exec(opts.dataUrl);
    if (m) return Buffer.from(m[2], "base64");
    return Buffer.from(opts.dataUrl, "utf8");
  }
  return Buffer.alloc(0);
}

ipcMain.handle("pslite:save-file", async (_e, opts) => {
  try {
    const win = BrowserWindow.getFocusedWindow();
    const r = await dialog.showSaveDialog(win, {
      defaultPath: opts.name || "pslite.png",
      filters: opts.filters || [{ name: "Semua berkas", extensions: ["*"] }],
    });
    if (r.canceled || !r.filePath) return { ok: false, canceled: true };
    fs.writeFileSync(r.filePath, decode(opts));
    return { ok: true, path: r.filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("pslite:open-file", async (_e, opts) => {
  try {
    const win = BrowserWindow.getFocusedWindow();
    const r = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: opts.filters || [{ name: "Semua berkas", extensions: ["*"] }],
    });
    if (r.canceled || !r.filePaths.length) return { ok: false, canceled: true };
    const p = r.filePaths[0];
    const buf = fs.readFileSync(p);
    const ext = path.extname(p).slice(1).toLowerCase();
    const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", bmp: "image/bmp", psd: "image/vnd.adobe.photoshop", json: "application/json" }[ext] || "application/octet-stream";
    return { ok: true, name: path.basename(p), dataUrl: `data:${mime};base64,${buf.toString("base64")}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 720,
    minHeight: 500,
    backgroundColor: "#1e1e1e",
    autoHideMenuBar: true,
    title: "PS Lite — Editor Foto",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  win.loadFile(path.join(__dirname, "..", "index.html"));
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
