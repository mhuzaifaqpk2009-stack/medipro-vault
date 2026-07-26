/**
 * MediCore — Electron main.
 * Owns the BrowserWindow, native dialogs, atomic file I/O, dirty-state
 * tracking, close-guard prompt, and crash-recovery snapshots.
 */
const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const fssync = require("fs");

const isDev = !app.isPackaged;
let mainWindow = null;

/* -------- state -------- */
let dirty = false;               // renderer-reported unsaved state
let forceQuit = false;           // set once user confirmed close/quit
let pendingCloseSource = null;   // "close" | "quit"

const RECOVERY_DIR = path.join(app.getPath("userData"), "recovery");
try { fssync.mkdirSync(RECOVERY_DIR, { recursive: true }); } catch {}

/* -------- window -------- */
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

  if (isDev && process.env.MEDICORE_DEV_URL) {
    mainWindow.loadURL(process.env.MEDICORE_DEV_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  // Word-like close guard.
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
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

/* -------- unsaved prompt (native) -------- */
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
  // save → ask renderer to save, wait for result via IPC "app:save-completed"
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

/* -------- IPC -------- */
ipcMain.handle("dialog:save", (_e, o) => dialog.showSaveDialog(mainWindow, o ?? {}));
ipcMain.handle("dialog:open", (_e, o) => dialog.showOpenDialog(mainWindow, o ?? {}));
ipcMain.handle("dialog:message", (_e, o) => dialog.showMessageBox(mainWindow, o ?? {}));
ipcMain.handle("dialog:unsaved", (_e, o) => showUnsavedDialog(o ?? {}));

ipcMain.handle("project:read", async (_e, filePath) => {
  const buf = await fs.readFile(filePath);
  return new Uint8Array(buf);
});

// Atomic write: <path>.tmp then rename.
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
  } else {
    // Save cancelled/failed → abort close.
    pendingCloseSource = null;
  }
  return true;
});

/* -------- recovery snapshots -------- */
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
ipcMain.handle("recovery:read", async (_e, id) => {
  const p = path.join(RECOVERY_DIR, `${sanitize(id)}.json`);
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw);
});

ipcMain.handle("system:userData", () => app.getPath("userData"));

/* -------- printing -------- */
ipcMain.handle("app:print-html", async (_e, html) => {
  if (typeof html !== "string" || !html) {
    console.error("[print] empty html payload");
    return { ok: false, error: "empty html" };
  }
  let win = null;
  try {
    win = new BrowserWindow({
      show: false,
      webPreferences: { offscreen: false, sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false },
    });
    await new Promise((resolve, reject) => {
      const onFail = (_ev, code, desc) => reject(new Error(`load failed ${code}: ${desc}`));
      win.webContents.once("did-finish-load", resolve);
      win.webContents.once("did-fail-load", onFail);
      const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(html);
      win.loadURL(dataUrl).catch(reject);
    });
    // give layout a tick
    await new Promise((r) => setTimeout(r, 120));
    const result = await new Promise((resolve) => {
      win.webContents.print(
        { silent: false, printBackground: true, margins: { marginType: "minimum" } },
        (success, failureReason) => resolve({ success, failureReason }),
      );
    });
    if (!result.success && result.failureReason && result.failureReason !== "cancelled") {
      console.error("[print] webContents.print failed:", result.failureReason);
      return { ok: false, error: result.failureReason };
    }
    return { ok: true };
  } catch (err) {
    console.error("[print] error:", err);
    return { ok: false, error: String(err && err.message || err) };
  } finally {
    try { if (win && !win.isDestroyed()) win.destroy(); } catch {}
  }
});

function sanitize(s) { return String(s).replace(/[^\w.-]+/g, "_"); }
