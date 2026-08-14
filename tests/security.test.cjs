const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const secureMain = fs.readFileSync(path.join(root, "electron", "secure-main.cjs"), "utf8");
const install = fs.readFileSync(path.join(root, "src", "lib", "install.ts"), "utf8");

test("LAN server requires a session for every route except health/login", () => {
  assert.match(secureMain, /if \(pathname === "\/health" \|\| pathname === "\/login"\) return originalListener/);
  assert.match(secureMain, /if \(!validSession\(token\)\) return jsonError\(res, 401/);
  assert.match(secureMain, /x-hpms-session/);
  assert.match(secureMain, /SESSION_TTL_MS/);
});

test("LAN server restricts clients to private/local networks and avoids wildcard CORS", () => {
  assert.match(secureMain, /function isPrivateClient/);
  assert.match(secureMain, /if \(!isPrivateClient\(req\.socket\.remoteAddress\)\) return jsonError\(res, 403/);
  assert.match(secureMain, /origin === "null"/);
  assert.doesNotMatch(secureMain, /Access-Control-Allow-Origin.*\*/);
});

test("project writes use a revision header and return a conflict on stale data", () => {
  assert.match(secureMain, /x-hpms-revision/);
  assert.match(secureMain, /return jsonError\(res, 409/);
  assert.match(fs.readFileSync(path.join(root, "electron", "db.cjs"), "utf8"), /saveProjectIfRevision/);
});

test("password salt decoding explicitly uses hexadecimal radix", () => {
  assert.match(install, /parseInt\(hex\.substr\(i \* 2, 2\), 16\)/);
});
