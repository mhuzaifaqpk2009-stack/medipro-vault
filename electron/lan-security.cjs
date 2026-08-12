const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function createLanSecurity(options = {}) {
  const ttlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  const sessions = new Map();
  let latestRevision = 0;

  function rememberLogin(sessionId, now = Date.now()) {
    if (!sessionId) return;
    sessions.set(sessionId, { expiresAt: now + ttlMs });
  }

  function revoke(sessionId) {
    if (sessionId) sessions.delete(sessionId);
  }

  function valid(sessionId, now = Date.now()) {
    if (!sessionId) return false;
    const session = sessions.get(sessionId);
    if (!session) return false;
    if (session.expiresAt <= now) {
      sessions.delete(sessionId);
      return false;
    }
    return true;
  }

  function recordRevision(revision) {
    const n = Number(revision);
    if (Number.isFinite(n) && n >= latestRevision) latestRevision = n;
  }

  function getRevision() {
    return latestRevision;
  }

  return { rememberLogin, revoke, valid, recordRevision, getRevision };
}

function firstPrivateIPv4() {
  const os = require("node:os");
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      const parts = entry.address.split(".").map(Number);
      const [a, b] = parts;
      const privateRange = a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
      if (privateRange) candidates.push(entry.address);
    }
  }
  return candidates[0] || "127.0.0.1";
}

module.exports = { createLanSecurity, firstPrivateIPv4, DEFAULT_SESSION_TTL_MS };
