const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");

let configured = false;
let downloadedVersion = null;

function send(event, payload = {}) {
  for (const win of BrowserWindow.getAllWindows()) {
    try { win.webContents.send(`updater:${event}`, payload); } catch {}
  }
}

function configure() {
  if (configured || !app.isPackaged) return;
  configured = true;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on("checking-for-update", () => send("status", { state: "checking", version: app.getVersion() }));
  autoUpdater.on("update-available", (info) => send("status", { state: "available", version: info.version, releaseNotes: info.releaseNotes || null }));
  autoUpdater.on("update-not-available", (info) => send("status", { state: "up-to-date", version: info?.version || app.getVersion() }));
  autoUpdater.on("download-progress", (progress) => send("status", { state: "downloading", version: downloadedVersion, percent: Math.round(progress.percent || 0), bytesPerSecond: progress.bytesPerSecond || 0 }));
  autoUpdater.on("update-downloaded", (info) => {
    downloadedVersion = info.version;
    send("status", { state: "downloaded", version: info.version });
  });
  autoUpdater.on("error", (error) => send("status", { state: "error", message: error?.message || String(error) }));
}

ipcMain.handle("updater:status", () => ({ supported: app.isPackaged, currentVersion: app.getVersion(), downloadedVersion }));

ipcMain.handle("updater:check", async () => {
  if (!app.isPackaged) return { supported: false, state: "dev", currentVersion: app.getVersion() };
  configure();
  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result?.updateInfo) return { supported: true, state: "up-to-date", currentVersion: app.getVersion() };
    downloadedVersion = result.updateInfo.version;
    await autoUpdater.downloadUpdate();
    return { supported: true, state: "downloaded", currentVersion: app.getVersion(), version: downloadedVersion };
  } catch (error) {
    const message = error?.message || String(error);
    send("status", { state: "error", message });
    return { supported: true, state: "error", currentVersion: app.getVersion(), message };
  }
});

ipcMain.handle("updater:install", async () => {
  if (!app.isPackaged || !downloadedVersion) return false;
  const result = await dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
    type: "info",
    buttons: ["Restart and install", "Later"],
    defaultId: 0,
    cancelId: 1,
    title: "Update ready",
    message: `Huzaifa Pharmacy ${downloadedVersion} is ready to install.`,
    detail: "The application will restart. Your saved pharmacy data will remain on this computer.",
  });
  if (result.response !== 0) return false;
  autoUpdater.quitAndInstall(false, true);
  return true;
});

app.whenReady().then(configure);
