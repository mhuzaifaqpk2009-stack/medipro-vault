/**
 * MediCore — Electron main process.
 * Loads the built Vite output. Provides native Save/Open dialogs and file I/O
 * via IPC bridged through preload.cjs.
 *
 * Build & package (from project root):
 *   npm i --save-dev electron @electron/packager
 *   npx vite build
 *   npx @electron/packager . "MediCore" --platform=win32 --arch=x64 \
 *     --out=electron-release --overwrite --ignore='^/src' --ignore='^/public'
 */
const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs/promises");

const isDev = !app.isPackaged;

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#f6f8fa",
    show: false,
    autoHideMenuBar: true,
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

  // Prevent navigation to external URLs.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  Menu.setApplicationMenu(null);
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

/* -------- IPC handlers -------- */

ipcMain.handle("dialog:save", async (_e, options) => {
  return dialog.showSaveDialog(mainWindow, options ?? {});
});

ipcMain.handle("dialog:open", async (_e, options) => {
  return dialog.showOpenDialog(mainWindow, options ?? {});
});

ipcMain.handle("dialog:message", async (_e, options) => {
  return dialog.showMessageBox(mainWindow, options ?? {});
});

ipcMain.handle("project:read", async (_e, filePath) => {
  const buf = await fs.readFile(filePath);
  return new Uint8Array(buf);
});

ipcMain.handle("project:write", async (_e, filePath, bytes) => {
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, Buffer.from(bytes));
  await fs.rename(tmp, filePath);
  return true;
});

ipcMain.handle("system:userData", async () => app.getPath("userData"));
