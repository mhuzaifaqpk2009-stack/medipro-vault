const { contextBridge, ipcRenderer, safeStorage } = require("electron");
const dgram = require("node:dgram");
const os = require("node:os");
const secrets = {
  available: () => { try { return safeStorage.isEncryptionAvailable(); } catch { return false; } },
  encrypt: (value) => { if (typeof value !== "string" || !value) return null; try { return safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(value).toString("base64") : null; } catch { return null; } },
  decrypt: (encoded) => { if (typeof encoded !== "string" || !encoded) return null; try { return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(encoded, "base64")) : null; } catch { return null; } },
};

const DISCOVERY_PORT = 4001;
const DISCOVERY_REQUEST = "HPMS_DISCOVER_V1";
let discoveryResponder = null;

function stopDiscoveryResponder() {
  if (!discoveryResponder) return;
  try { discoveryResponder.close(); } catch {}
  discoveryResponder = null;
}

function startDiscoveryResponder(pharmacyName, httpPort) {
  stopDiscoveryResponder();
  const socket = dgram.createSocket("udp4");
  discoveryResponder = socket;
  socket.on("error", () => { try { socket.close(); } catch {} discoveryResponder = null; });
  socket.on("message", (message, remote) => {
    if (message.toString("utf8") !== DISCOVERY_REQUEST) return;
    const response = Buffer.from(JSON.stringify({
      type: "HPMS_SERVER_V1",
      pharmacyName: String(pharmacyName || "Huzaifa Pharmacy"),
      port: Number(httpPort || 4000),
    }));
    socket.send(response, remote.port, remote.address);
  });
  socket.bind(DISCOVERY_PORT, "0.0.0.0", () => {
    try { socket.setBroadcast(true); } catch {}
  });
}

function discoverServers(timeoutMs = 2500) {
  return new Promise((resolve) => {
    const found = new Map();
    const socket = dgram.createSocket("udp4");
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      try { socket.close(); } catch {}
      resolve(Array.from(found.values()));
    };
    const timer = setTimeout(finish, Math.max(500, timeoutMs));
    socket.on("error", () => { clearTimeout(timer); finish(); });
    socket.on("message", (message, remote) => {
      try {
        const data = JSON.parse(message.toString("utf8"));
        if (data?.type !== "HPMS_SERVER_V1") return;
        const host = remote.address;
        const key = `${host}:${Number(data.port || 4000)}`;
        found.set(key, {
          host,
          port: Number(data.port || 4000),
          pharmacyName: String(data.pharmacyName || "HPMS Server"),
          connection: "LAN / Cable or Wi-Fi",
        });
      } catch {}
    });
    socket.bind(0, "0.0.0.0", () => {
      try { socket.setBroadcast(true); } catch {}
      const packet = Buffer.from(DISCOVERY_REQUEST);
      socket.send(packet, DISCOVERY_PORT, "255.255.255.255");
      // Also send to interface-specific broadcast addresses where Windows
      // exposes them. This improves direct-Ethernet discovery on networks
      // that don't forward the global broadcast address.
      try {
        for (const list of Object.values(os.networkInterfaces())) {
          for (const info of list || []) {
            if (!info || info.family !== "IPv4" || info.internal) continue;
            const parts = info.address.split(".");
            const mask = (info.netmask || "255.255.255.0").split(".").map(Number);
            const ip = parts.map(Number);
            const broadcast = ip.map((n, i) => (n & mask[i]) | (255 ^ mask[i])).join(".");
            socket.send(packet, DISCOVERY_PORT, broadcast);
          }
        }
      } catch {}
    });
  });
}

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
  configure: async (opts) => {
    const result = await ipcRenderer.invoke("server:configure", opts);
    if (opts?.deployMode === "server") startDiscoveryResponder(opts?.pharmacyName, opts?.port || 4000);
    else stopDiscoveryResponder();
    return result;
  },
  syncUsers: (users) => ipcRenderer.invoke("server:syncUsers", users),
  status: () => ipcRenderer.invoke("server:status"),
  discover: (timeoutMs) => discoverServers(timeoutMs),
  onRevisionBumped: (cb) => { const listener = (_e, rev) => cb(rev); ipcRenderer.on("server:revision-bumped", listener); return () => ipcRenderer.removeListener("server:revision-bumped", listener); },
});
