const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("psNative", {
  isDesktop: true,
  saveFile: (opts) => ipcRenderer.invoke("pslite:save-file", opts || {}),
  openFile: (opts) => ipcRenderer.invoke("pslite:open-file", opts || {}),
});
