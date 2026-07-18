/**
 * MediCore preload — exposes a narrow bridge under window.medicore.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("medicore", {
  dialog: {
    showSaveDialog: (o) => ipcRenderer.invoke("dialog:save", o),
    showOpenDialog: (o) => ipcRenderer.invoke("dialog:open", o),
    showMessageBox: (o) => ipcRenderer.invoke("dialog:message", o),
    showUnsavedDialog: (o) => ipcRenderer.invoke("dialog:unsaved", o),
  },
  project: {
    readFile: (p) => ipcRenderer.invoke("project:read", p),
    writeFile: (p, b) => ipcRenderer.invoke("project:write", p, b),
  },
  app: {
    setDirty: (v) => ipcRenderer.invoke("app:setDirty", v),
    saveCompleted: (ok) => ipcRenderer.invoke("app:save-completed", ok),
    onSaveAndQuit: (cb) => {
      const listener = () => cb();
      ipcRenderer.on("app:save-and-quit", listener);
      return () => ipcRenderer.removeListener("app:save-and-quit", listener);
    },
  },
  recovery: {
    write: (id, snapshot) => ipcRenderer.invoke("recovery:write", id, snapshot),
    clear: (id) => ipcRenderer.invoke("recovery:clear", id),
    list: () => ipcRenderer.invoke("recovery:list"),
    read: (id) => ipcRenderer.invoke("recovery:read", id),
  },
  system: {
    userDataPath: () => ipcRenderer.invoke("system:userData"),
    platform: process.platform,
  },
});
