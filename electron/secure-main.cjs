/* HPMS LAN security + zero-config local-network discovery bootstrap. */
const http = require("node:http");
const os = require("node:os");
const dgram = require("node:dgram");
const { app, ipcMain } = require("electron");
const sqldb = require("./db.cjs");

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const DISCOVERY_PORT = 41234;
const DISCOVERY_REQUEST = "HPMS_DISCOVER_V1";
const sessions = new Map();
let discoveryServerPort = null;

function privateHost() {
  const candidates = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) for (const entry of entries || []) {
    if (entry.family !== "IPv4" || entry.internal) continue;
    const p = entry.address.split(".").map(Number);
    const isPrivate = p[0] === 10 || (p[0] === 192 && p[1] === 168) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31);
    const isLinkLocal = p[0] === 169 && p[1] === 254;
    if (!isPrivate && !isLinkLocal) continue;
    const lower = name.toLowerCase();
    const ethernet = /ethernet|eth|en\d/.test(lower) ? 0 : /wi-?fi|wlan/.test(lower) ? 1 : 2;
    candidates.push({ address: entry.address, ethernet, linkLocal: isLinkLocal });
  }
  candidates.sort((a, b) => a.ethernet - b.ethernet || Number(a.linkLocal) - Number(b.linkLocal));
  return candidates[0]?.address || "127.0.0.1";
}

function isPrivateClient(address) {
  const raw = String(address || "").replace(/^::ffff:/, "");
  if (raw === "127.0.0.1" || raw === "::1") return true;
  const p = raw.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  return p[0] === 10 || p[0] === 192 && p[1] === 168 || p[0] === 172 && p[1] >= 16 && p[1] <= 31 || p[0] === 169 && p[1] === 254;
}

function tokenFrom(req) { const value = req.headers["x-hpms-session"]; return typeof value === "string" ? value : ""; }
function validSession(token) {
  const s = sessions.get(token);
  if (!s) return false;
  if (s.expiresAt <= Date.now()) { sessions.delete(token); return false; }
  s.expiresAt = Date.now() + SESSION_TTL_MS;
  return true;
}
function jsonError(res, status, error, extra = {}) {
  const body = JSON.stringify({ error, ...extra });
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(body) });
  res.end(body);
}
function corsOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return null;
  if (origin === "null" || origin === "http://localhost:8080" || origin === "http://127.0.0.1:8080") return origin;
  return null;
}

const discoverySocket = dgram.createSocket("udp4");
discoverySocket.on("error", (err) => console.error("[server] discovery socket error:", err));
discoverySocket.on("message", (message, rinfo) => {
  if (message.toString("utf8") !== DISCOVERY_REQUEST || !discoveryServerPort || !isPrivateClient(rinfo.address)) return;
  const response = Buffer.from(JSON.stringify({ type: "HPMS_SERVER_V1", port: discoveryServerPort }));
  discoverySocket.send(response, 0, response.length, rinfo.port, rinfo.address);
});
discoverySocket.bind(DISCOVERY_PORT, "0.0.0.0", () => {
  try { discoverySocket.setBroadcast(true); } catch {}
  console.log(`[server] HPMS discovery listening on UDP :${DISCOVERY_PORT}`);
});

ipcMain.handle("server:discover", async () => {
  const socket = dgram.createSocket("udp4");
  const found = new Map();
  const message = Buffer.from(DISCOVERY_REQUEST);
  const broadcasts = new Set(["255.255.255.255"]);
  for (const entries of Object.values(os.networkInterfaces())) for (const entry of entries || []) {
    if (entry.family !== "IPv4" || entry.internal || !entry.netmask) continue;
    const ip = entry.address.split(".").map(Number);
    const mask = entry.netmask.split(".").map(Number);
    broadcasts.add(ip.map((n, i) => (n & mask[i]) | (255 ^ mask[i])).join("."));
  }
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 1600);
      socket.on("error", reject);
      socket.on("message", (buf, rinfo) => {
        try {
          const data = JSON.parse(buf.toString("utf8"));
          if (data?.type === "HPMS_SERVER_V1" && Number.isInteger(data.port) && isPrivateClient(rinfo.address)) found.set(`${rinfo.address}:${data.port}`, { host: rinfo.address, port: data.port });
        } catch {}
      });
      socket.bind(0, () => {
        try { socket.setBroadcast(true); } catch {}
        for (const address of broadcasts) socket.send(message, 0, message.length, DISCOVERY_PORT, address);
      });
      socket.once("close", () => clearTimeout(timer));
    });
  } catch (err) { console.error("[server] discovery failed:", err); }
  finally { try { socket.close(); } catch {} }
  return [...found.values()];
});

const originalCreateServer = http.createServer;
http.createServer = function secureCreateServer(...args) {
  const originalListener = typeof args[0] === "function" ? args[0] : null;
  if (!originalListener) return originalCreateServer.apply(http, args);
  args[0] = (req, res) => {
    const pathname = (() => { try { return new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname; } catch { return ""; } })();
    const origin = corsOrigin(req);
    const originalSetHeader = res.setHeader.bind(res);
    res.setHeader = (name, value) => {
      const key = String(name).toLowerCase();
      if (key === "access-control-allow-origin" && origin) return originalSetHeader(name, origin);
      if (key === "access-control-allow-headers") return originalSetHeader(name, "content-type, x-hpms-session, x-hpms-revision");
      return originalSetHeader(name, value);
    };
    if (origin) originalSetHeader("Access-Control-Allow-Origin", origin);
    originalSetHeader("Vary", "Origin");
    originalSetHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
    originalSetHeader("Access-Control-Allow-Headers", "content-type, x-hpms-session, x-hpms-revision");
    if (req.method === "OPTIONS") {
      if (!origin && req.headers.origin) return jsonError(res, 403, "Origin not allowed");
      res.writeHead(204); res.end(); return;
    }
    if (!isPrivateClient(req.socket.remoteAddress)) return jsonError(res, 403, "LAN access only");

    const originalEnd = res.end.bind(res);
    const originalWrite = res.write.bind(res);
    const chunks = [];
    res.write = function captureWrite(chunk, ...rest) { if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))); return originalWrite(chunk, ...rest); };
    res.end = function captureEnd(chunk, ...rest) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (parsed?.sessionId && pathname === "/login") sessions.set(parsed.sessionId, { expiresAt: Date.now() + SESSION_TTL_MS });
      } catch {}
      return originalEnd(chunk, ...rest);
    };

    if (pathname === "/health" || pathname === "/login") return originalListener(req, res);
    const token = tokenFrom(req);
    if (!validSession(token)) return jsonError(res, 401, "Authentication required");
    if (pathname === "/logout" && req.method === "POST") {
      const result = originalListener(req, res);
      sessions.delete(token);
      return result;
    }
    if (pathname === "/project" && req.method === "PUT") {
      sqldb.open(app.getPath("userData"));
      const expected = Number(req.headers["x-hpms-revision"]);
      const current = sqldb.getRevision();
      if (!Number.isInteger(expected) || expected !== current) return jsonError(res, 409, "Project changed on the server; pull the latest data before saving.", { revision: current });
    }
    return originalListener(req, res);
  };

  const server = originalCreateServer.apply(http, args);
  const originalListen = server.listen.bind(server);
  server.listen = function secureListen(...listenArgs) {
    const port = typeof listenArgs[0] === "number" ? listenArgs[0] : null;
    const result = (typeof listenArgs[0] === "number" && typeof listenArgs[1] === "function") ? originalListen(listenArgs[0], privateHost(), listenArgs[1]) : (typeof listenArgs[0] === "number" && listenArgs.length === 1) ? originalListen(listenArgs[0], privateHost()) : originalListen(...listenArgs);
    if (port) discoveryServerPort = port;
    return result;
  };
  const originalClose = server.close.bind(server);
  server.close = function secureClose(...closeArgs) { discoveryServerPort = null; return originalClose(...closeArgs); };
  return server;
};

require("./main.cjs");
