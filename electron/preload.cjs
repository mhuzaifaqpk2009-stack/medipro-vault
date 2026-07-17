/**
 * MediCore — Electron preload. Exposes a narrow, typed bridge to the
 * renderer under window.medicore. No Node modules leak into the renderer.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("medicore", {
  dialog: {
    showSaveDialog: (opts) => ipcRenderer.invoke("dialog:save", opts),
    showOpenDialog: (opts) => ipcRenderer.invoke("dialog:open", opts),
    showMessageBox: (opts) => ipcRenderer.invoke("dialog:message", opts),
  },
  project: {
    readFile: (path) => ipcRenderer.invoke("project:read", path),
    writeFile: (path, bytes) => ipcRenderer.invoke("project:write", path, bytes),
  },
  system: {
    userDataPath: () => ipcRenderer.invoke("system:userData"),
    platform: process.platform,
  },
});
