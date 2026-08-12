/*
 * HPMS security bootstrap.
 * main.cjs remains the application entry point; this wrapper hardens its
 * existing LAN HTTP server without changing the UI or single-computer mode.
 */
const http = require("node:http");
const os = require("node:os");

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map();
let revision = 0;

function privateHost() {
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const entry of entries || []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      const p = entry.address.split(".").map(Number);
      if (p[0] === 10 || (p[0] === 192 && p[1] === 168) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31)) return entry.address;
    }
  }
  return "127.0.0.1";
}

function tokenFrom(req) {
  const value = req.headers["x-hpms-session"];
  return typeof value === "string" ? value : "";
}

function validSession(token) {
  const s = sessions.get(token);
  if (!s) return false;
  if (s.expiresAt <= Date.now()) {
    sessions.delete(token);
    return false;
  }
  s.expiresAt = Date.now() + SESSION_TTL_MS;
  return true;
}

function jsonError(res, status, error) {
  const body = JSON.stringify({ error });
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(body) });
  res.end(body);
}

const originalCreateServer = http.createServer;
http.createServer = function secureCreateServer(...args) {
  const originalListener = typeof args[0] === "function" ? args[0] : null;
  if (!originalListener) return originalCreateServer.apply(http, args);

  args[0] = (req, res) => {
    const pathname = (() => {
      try { return new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname; }
      catch { return ""; }
    })();

    const originalEnd = res.end.bind(res);
    const originalWrite = res.write.bind(res);
    const chunks = [];
    res.write = function captureWrite(chunk, ...rest) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      return originalWrite(chunk, ...rest);
    };
    res.end = function captureEnd(chunk, ...rest) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (parsed?.sessionId && pathname === "/login") {
          sessions.set(parsed.sessionId, { expiresAt: Date.now() + SESSION_TTL_MS });
        }
        if (typeof parsed?.revision === "number") revision = parsed.revision;
        if (pathname === "/logout" && req.method === "POST") sessions.delete(tokenFrom(req));
      } catch {}
      return originalEnd(chunk, ...rest);
    };

    // These are deliberately public: health is used to discover the server,
    // and login is the endpoint that establishes the authenticated session.
    if (pathname === "/health" || pathname === "/login") return originalListener(req, res);
    if (req.method === "OPTIONS") return originalListener(req, res);

    if (!validSession(tokenFrom(req))) return jsonError(res, 401, "Authentication required");

    // A client may only replace the project if it still has the revision it
    // last pulled. This prevents stale whole-snapshot writes from erasing a
    // change made by another computer.
    if (pathname === "/project" && req.method === "PUT") {
      const expected = Number(req.headers["x-hpms-revision"]);
      if (!Number.isFinite(expected) || expected !== revision) {
        return jsonError(res, 409, "Project changed on the server; pull the latest data before saving.");
      }
    }

    return originalListener(req, res);
  };

  const server = originalCreateServer.apply(http, args);
  const originalListen = server.listen.bind(server);
  server.listen = function secureListen(...listenArgs) {
    // main.cjs uses listen(port, callback), so inject the private LAN address.
    if (typeof listenArgs[0] === "number" && typeof listenArgs[1] === "function") {
      return originalListen(listenArgs[0], privateHost(), listenArgs[1]);
    }
    if (typeof listenArgs[0] === "number" && listenArgs.length === 1) {
      return originalListen(listenArgs[0], privateHost());
    }
    return originalListen(...listenArgs);
  };
  return server;
};

require("./main.cjs");
