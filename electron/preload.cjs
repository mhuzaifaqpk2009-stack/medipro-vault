const { contextBridge, ipcRenderer, safeStorage } = require("electron");
const secrets = {
  available: () => { try { return safeStorage.isEncryptionAvailable(); } catch { return false; } },
  encrypt: (value) => { if (typeof value !== "string" || !value) return null; try { return safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(value).toString("base64") : null; } catch { return null; } },
  decrypt: (encoded) => { if (typeof encoded !== "string" || !encoded) return null; try { return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(encoded, "base64")) : null; } catch { return null; } },
};
contextBridge.exposeInMainWorld("medicore", {
  secrets,
  dialog: { showSaveDialog: (o) => ipcRenderer.invoke("dialog:save", o), showOpenDialog: (o) => ipcRenderer.invoke("dialog:open", o), showMessageBox: (o) => ipcRenderer.invoke("dialog:message", o), showUnsavedDialog: (o) => ipcRenderer.invoke("dialog:unsaved", o) },
  project: { readFile: (p) => ipcRenderer.invoke("project:read", p), writeFile: (p, b) => ipcRenderer.invoke("project:write", p, b) },
  app: { setDirty: (v) => ipcRenderer.invoke("app:setDirty", v), saveCompleted: (ok) => ipcRenderer.invoke("app:save-completed", ok), onSaveAndQuit: (cb) => { const listener = () => cb(); ipcRenderer.on("app:save-and-quit", listener); return () => ipcRenderer.removeListener("app:save-and-quit", listener); } },
  recovery: { write: (id, snapshot) => ipcRenderer.invoke("recovery:write", id, snapshot), clear: (id) => ipcRenderer.invoke("recovery:clear", id), list: () => ipcRenderer.invoke("recovery:list"), read: (id) => ipcRenderer.invoke("recovery:read", id) },
  store: { read: () => ipcRenderer.invoke("store:read"), write: (b) => ipcRenderer.invoke("store:write", b), clear: () => ipcRenderer.invoke("store:clear") },
  backup: { pickFolder: () => ipcRenderer.invoke("backup:pickFolder"), write: (dir, name, bytes) => ipcRenderer.invoke("backup:write", dir, name, bytes) },
  system: { userDataPath: () => ipcRenderer.invoke("system:userData"), platform: process.platform },
  print: { html: (html) => ipcRenderer.invoke("app:print-html", html), printers: () => ipcRenderer.invoke("app:list-printers") },
});
const entity = (name) => ({ list: () => ipcRenderer.invoke("db:list", name), get: (id) => ipcRenderer.invoke("db:get", name, id), save: (row) => ipcRenderer.invoke("db:save", name, row), remove: (id) => ipcRenderer.invoke("db:remove", name, id) });
contextBridge.exposeInMainWorld("electronAPI", {
  isAvailable: () => ipcRenderer.invoke("db:available"), loadProject: () => ipcRenderer.invoke("db:loadProject"), saveProject: (data) => ipcRenderer.invoke("db:saveProject", data), clearProject: () => ipcRenderer.invoke("db:clearProject"), getSettings: () => ipcRenderer.invoke("db:getSettings"), saveSettings: (meta, settings) => ipcRenderer.invoke("db:saveSettings", meta, settings),
  medicines: entity("medicines"), sales: entity("sales"), purchases: entity("purchases"), customers: entity("customers"), suppliers: entity("suppliers"), categories: entity("categories"), stockAdjustments: entity("stockAdjustments"),
  auditLog: { add: (entry) => ipcRenderer.invoke("db:auditLog:add", entry), forEntity: (entityType, entityId) => ipcRenderer.invoke("db:auditLog:forEntity", entityType, entityId), since: (isoTimestamp) => ipcRenderer.invoke("db:auditLog:since", isoTimestamp) },
});
contextBridge.exposeInMainWorld("medicoreServer", {
  configure: (opts) => ipcRenderer.invoke("server:configure", opts), syncUsers: (users) => ipcRenderer.invoke("server:syncUsers", users), status: () => ipcRenderer.invoke("server:status"),
  onRevisionBumped: (cb) => { const listener = (_e, rev) => cb(rev); ipcRenderer.on("server:revision-bumped", listener); return () => ipcRenderer.removeListener("server:revision-bumped", listener); },
});
