/**
 * MediCore — Electron main.
 * Owns the BrowserWindow, native dialogs, atomic file I/O, dirty-state
 * tracking, close-guard prompt, and crash-recovery snapshots.
 */
const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const fssync = require("fs");
const http = require("node:http");
const nodeCrypto = require("node:crypto");

const isDev = !app.isPackaged;
let mainWindow = null;

/* -------- state -------- */
let dirty = false;
let forceQuit = false;
let pendingCloseSource = null;

const RECOVERY_DIR = path.join(app.getPath("userData"), "recovery");
try { fssync.mkdirSync(RECOVERY_DIR, { recursive: true }); } catch {}

function createWindow() {
  const iconPath = path.join(__dirname, "..", "public", "favicon.png");
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: "Huzaifa Software — Pharmacy Management",
    backgroundColor: "#f6f8fa",
    show: false,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  if (isDev && process.env.MEDICORE_DEV_URL) mainWindow.loadURL(process.env.MEDICORE_DEV_URL);
  else mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.on("close", (e) => {
    if (forceQuit || !dirty) return;
    e.preventDefault();
    handleUnsavedPrompt("close");
  });
  Menu.setApplicationMenu(null);
}

app.on("before-quit", (e) => {
  if (forceQuit || !dirty) return;
  e.preventDefault();
  handleUnsavedPrompt("quit");
});
app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

async function handleUnsavedPrompt(source) {
  if (pendingCloseSource) return;
  pendingCloseSource = source;
  const choice = await showUnsavedDialog();
  if (choice === "cancel") { pendingCloseSource = null; return; }
  if (choice === "discard") {
    forceQuit = true;
    pendingCloseSource = null;
    if (mainWindow) mainWindow.destroy();
    app.quit();
    return;
  }
  if (mainWindow) mainWindow.webContents.send("app:save-and-quit");
}

async function showUnsavedDialog(opts = {}) {
  const res = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    buttons: ["Save", "Don't Save", "Cancel"],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
    title: opts.title || "MediCore",
    message: opts.message || "Do you want to save changes to this project?",
    detail: opts.detail || "Your changes will be lost if you don't save them.",
  });
  return ["save", "discard", "cancel"][res.response];
}

ipcMain.handle("dialog:save", (_e, o) => dialog.showSaveDialog(mainWindow, o ?? {}));
ipcMain.handle("dialog:open", (_e, o) => dialog.showOpenDialog(mainWindow, o ?? {}));
ipcMain.handle("dialog:message", (_e, o) => dialog.showMessageBox(mainWindow, o ?? {}));
ipcMain.handle("dialog:unsaved", (_e, o) => showUnsavedDialog(o ?? {}));
ipcMain.handle("project:read", async (_e, filePath) => new Uint8Array(await fs.readFile(filePath)));
ipcMain.handle("project:write", async (_e, filePath, bytes) => {
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, Buffer.from(bytes));
  await fs.rename(tmp, filePath);
  return true;
});
ipcMain.handle("app:setDirty", (_e, v) => { dirty = !!v; return true; });
ipcMain.handle("app:save-completed", (_e, ok) => {
  if (ok) {
    dirty = false;
    forceQuit = true;
    const src = pendingCloseSource;
    pendingCloseSource = null;
    if (mainWindow) mainWindow.destroy();
    if (src === "quit") app.quit();
  } else pendingCloseSource = null;
  return true;
});

ipcMain.handle("recovery:write", async (_e, id, snapshot) => {
  const p = path.join(RECOVERY_DIR, `${sanitize(id)}.json`);
  const tmp = `${p}.tmp`;
  await fs.writeFile(tmp, snapshot);
  await fs.rename(tmp, p);
  return true;
});
ipcMain.handle("recovery:clear", async (_e, id) => {
  const p = path.join(RECOVERY_DIR, `${sanitize(id)}.json`);
  try { await fs.unlink(p); } catch {}
  return true;
});
ipcMain.handle("recovery:list", async () => {
  try {
    const files = await fs.readdir(RECOVERY_DIR);
    const out = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const full = path.join(RECOVERY_DIR, f);
      try {
        const raw = await fs.readFile(full, "utf8");
        const j = JSON.parse(raw);
        const st = await fs.stat(full);
        out.push({ id: j.id, name: j.name, fsPath: j.fsPath, savedAt: st.mtimeMs });
      } catch {}
    }
    return out;
  } catch { return []; }
});
ipcMain.handle("recovery:read", async (_e, id) => JSON.parse(await fs.readFile(path.join(RECOVERY_DIR, `${sanitize(id)}.json`), "utf8")));
ipcMain.handle("system:userData", () => app.getPath("userData"));

const sqldb = require("./db.cjs");
function ensureDb() {
  sqldb.open(app.getPath("userData"));
  if (sqldb.available() && typeof sqldb.getRevision === "function") revision = sqldb.getRevision();
  return sqldb.available();
}

ipcMain.handle("db:available", () => ensureDb());
ipcMain.handle("db:loadProject", () => (ensureDb() ? sqldb.loadProject() : null));
ipcMain.handle("db:saveProject", (_e, data) => {
  if (!ensureDb()) return false;
  const ok = sqldb.saveProject(data);
  if (ok) bumpRevision();
  return ok;
});
ipcMain.handle("db:clearProject", () => (ensureDb() ? sqldb.clearProject() : false));
ipcMain.handle("db:list", (_e, entity) => (ensureDb() ? sqldb[entity]?.list?.() ?? [] : []));
ipcMain.handle("db:get", (_e, entity, id) => (ensureDb() ? sqldb[entity]?.get?.(id) ?? null : null));
ipcMain.handle("db:save", (_e, entity, row) => {
  if (!ensureDb()) return null;
  const result = sqldb[entity]?.save?.(row) ?? null;
  if (result !== null) bumpRevision();
  return result;
});
ipcMain.handle("db:remove", (_e, entity, id) => {
  if (!ensureDb()) return false;
  const ok = sqldb[entity]?.remove?.(id) ?? false;
  if (ok) bumpRevision();
  return ok;
});
ipcMain.handle("db:getSettings", () => (ensureDb() ? sqldb.settings.get() : null));
ipcMain.handle("db:saveSettings", (_e, meta, s) => {
  if (!ensureDb()) return false;
  const ok = sqldb.settings.save(meta, s);
  if (ok) bumpRevision();
  return ok;
});
ipcMain.handle("db:auditLog:add", (_e, entry) => (ensureDb() ? sqldb.auditLog.add(entry) : false));
ipcMain.handle("db:auditLog:forEntity", (_e, entityType, entityId) => ensureDb() ? sqldb.auditLog.forEntity(entityType, entityId) : []);
ipcMain.handle("db:auditLog:since", (_e, isoTimestamp) => ensureDb() ? sqldb.auditLog.since(isoTimestamp) : []);

let lanServer = null;
let currentPharmacyName = "";
let revision = 0;
const activeSessions = new Map();
let serverUsers = [];
const SERVER_USERS_FILE = path.join(app.getPath("userData"), "server-users.json");
try { serverUsers = JSON.parse(fssync.readFileSync(SERVER_USERS_FILE, "utf8")); } catch { serverUsers = []; }

function bumpRevision() {
  revision = typeof sqldb.bumpRevision === "function" ? sqldb.bumpRevision() : revision + 1;
  return revision;
}

function verifyPasswordNode(password, saltHex, hashHex) {
  const salt = Buffer.from(saltHex, "hex");
  const derived = nodeCrypto.pbkdf2Sync(password, salt, 200_000, 32, "sha256");
  return derived.toString("hex") === hashHex;
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "content-type": "application/json", "content-length": Buffer.byteLength(body) });
  res.end(body);
}

function startLanServer(port) {
  if (lanServer) return;
  lanServer = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type, x-hpms-session, x-hpms-revision");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      let url;
      try { url = new URL(req.url, `http://${req.headers.host}`); }
      catch { return sendJson(res, 400, { error: "Bad request" }); }
      try {
        if (url.pathname === "/health" && req.method === "GET") return sendJson(res, 200, { ok: true, pharmacyName: currentPharmacyName });
        if (url.pathname === "/login" && req.method === "POST") {
          const { username, password } = JSON.parse(body || "{}");
          const uname = String(username || "").trim().toLowerCase();
          const user = serverUsers.find((u) => u.username.toLowerCase() === uname);
          if (!user || !verifyPasswordNode(password || "", user.saltHex, user.hashHex)) return sendJson(res, 401, { error: "Wrong username or password" });
          const snapshot = ensureDb() ? sqldb.loadProject() : null;
          const singleSessionOnly = snapshot?.settings?.singleSessionOnly === true;
          if (singleSessionOnly) for (const s of activeSessions.values()) if (s.userId === user.id) return sendJson(res, 409, { error: "This account is already signed in on another computer. Sign out there first." });
          const sessionId = nodeCrypto.randomUUID();
          activeSessions.set(sessionId, { userId: user.id, username: user.username, loginAt: Date.now() });
          return sendJson(res, 200, { ok: true, user, sessionId });
        }
        if (url.pathname === "/logout" && req.method === "POST") {
          const { sessionId } = JSON.parse(body || "{}");
          activeSessions.delete(sessionId);
          return sendJson(res, 200, { ok: true });
        }
        if (url.pathname === "/project" && req.method === "GET") {
          if (!ensureDb()) return sendJson(res, 503, { error: "Server database unavailable" });
          const data = sqldb.loadProject();
          if (!data) return sendJson(res, 404, { error: "No project data yet" });
          revision = sqldb.getRevision();
          return sendJson(res, 200, { ok: true, data, revision });
        }
        if (url.pathname === "/project" && req.method === "PUT") {
          if (!ensureDb()) return sendJson(res, 503, { error: "Server database unavailable" });
          const expected = Number(req.headers["x-hpms-revision"]);
          const { data } = JSON.parse(body || "{}");
          const result = sqldb.saveProjectIfRevision(data, expected);
          if (!result.ok && result.reason === "conflict") return sendJson(res, 409, { error: "Project changed on the server; pull the latest data before saving.", revision: result.revision });
          if (!result.ok) return sendJson(res, 400, { error: "Invalid project data" });
          revision = result.revision;
          if (mainWindow) mainWindow.webContents.send("server:revision-bumped", revision);
          return sendJson(res, 200, { ok: true, revision });
        }
        if (url.pathname === "/revision" && req.method === "GET") {
          revision = ensureDb() ? sqldb.getRevision() : revision;
          return sendJson(res, 200, { ok: true, revision });
        }
        if (url.pathname === "/audit" && req.method === "POST") {
          if (!ensureDb()) return sendJson(res, 503, { error: "Server database unavailable" });
          const ok = sqldb.auditLog.add(JSON.parse(body || "{}"));
          return sendJson(res, ok ? 200 : 500, ok ? { ok: true } : { error: "Failed to log" });
        }
        if (url.pathname === "/audit" && req.method === "GET") {
          if (!ensureDb()) return sendJson(res, 503, { error: "Server database unavailable" });
          const entityType = url.searchParams.get("entityType") || "";
          const entityId = url.searchParams.get("entityId") || "";
          return sendJson(res, 200, { ok: true, entries: sqldb.auditLog.forEntity(entityType, entityId) });
        }
        if (url.pathname === "/audit/recent" && req.method === "GET") {
          if (!ensureDb()) return sendJson(res, 503, { error: "Server database unavailable" });
          const since = url.searchParams.get("since") || "1970-01-01T00:00:00.000Z";
          return sendJson(res, 200, { ok: true, entries: sqldb.auditLog.since(since) });
        }
        return sendJson(res, 404, { error: "Not found" });
      } catch (err) {
        console.error("[server] request error:", err);
        return sendJson(res, 500, { error: String((err && err.message) || err) });
      }
    });
  });
  lanServer.on("error", (err) => { console.error("[server] failed to start:", err); lanServer = null; });
  lanServer.listen(port, () => console.log(`[server] LAN server listening on :${port}`));
}

function stopLanServer() { if (!lanServer) return; lanServer.close(); lanServer = null; }

ipcMain.handle("server:configure", (_e, opts) => {
  const { deployMode, port, pharmacyName } = opts || {};
  currentPharmacyName = pharmacyName || currentPharmacyName;
  if (deployMode === "server") { ensureDb(); startLanServer(port || 4000); }
  else stopLanServer();
  return true;
});
ipcMain.handle("server:syncUsers", (_e, users) => {
  serverUsers = Array.isArray(users) ? users : [];
  try { fssync.writeFileSync(SERVER_USERS_FILE, JSON.stringify(serverUsers)); } catch {}
  return true;
});
ipcMain.handle("server:status", () => ({ running: !!lanServer, port: lanServer ? lanServer.address()?.port ?? null : null }));

const STORE_FILE = path.join(app.getPath("userData"), "medicore-data.bin");
ipcMain.handle("store:read", async () => { try { return new Uint8Array(await fs.readFile(STORE_FILE)); } catch { return null; } });
ipcMain.handle("store:write", async (_e, bytes) => { const tmp = `${STORE_FILE}.tmp`; await fs.writeFile(tmp, Buffer.from(bytes)); await fs.rename(tmp, STORE_FILE); return true; });
ipcMain.handle("store:clear", async () => { try { await fs.unlink(STORE_FILE); } catch {} return true; });

ipcMain.handle("backup:pickFolder", async () => {
  const res = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory", "createDirectory"] });
  if (!res || res.canceled || !res.filePaths?.[0]) return null;
  return res.filePaths[0];
});
ipcMain.handle("backup:write", async (_e, dir, fileName, bytes) => {
  await fs.mkdir(dir, { recursive: true });
  const full = path.join(dir, fileName);
  const tmp = `${full}.tmp`;
  await fs.writeFile(tmp, Buffer.from(bytes));
  await fs.rename(tmp, full);
  return full;
});

ipcMain.handle("app:list-printers", async () => {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return { ok: false, printers: [] };
    const printers = await win.webContents.getPrintersAsync();
    return { ok: true, printers: (printers || []).map((p) => ({ name: p.name, isDefault: !!p.isDefault, status: p.status })) };
  } catch (err) {
    console.error("[print] list printers failed:", err);
    return { ok: false, printers: [], error: String((err && err.message) || err) };
  }
});

ipcMain.handle("app:print-html", async (_e, html) => {
  if (typeof html !== "string" || !html) return { ok: false, error: "empty html" };
  let win = null;
  try {
    win = new BrowserWindow({ show: false, webPreferences: { offscreen: false, sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false } });
    await new Promise((resolve, reject) => {
      const onFail = (_ev, code, desc) => reject(new Error(`load failed ${code}: ${desc}`));
      win.webContents.once("did-finish-load", resolve);
      win.webContents.once("did-fail-load", onFail);
      win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html)).catch(reject);
    });
    await new Promise((r) => setTimeout(r, 120));
    const result = await new Promise((resolve) => win.webContents.print({ silent: false, printBackground: true, margins: { marginType: "minimum" } }, (success, failureReason) => resolve({ success, failureReason })));
    if (!result.success && result.failureReason && result.failureReason !== "cancelled") return { ok: false, error: result.failureReason };
    return { ok: true };
  } catch (err) {
    console.error("[print] error:", err);
    return { ok: false, error: String(err && err.message || err) };
  } finally { try { if (win && !win.isDestroyed()) win.destroy(); } catch {} }
});

function sanitize(s) { return String(s).replace(/[^\w.-]+/g, "_"); }
