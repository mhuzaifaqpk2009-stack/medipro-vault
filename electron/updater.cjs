const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const https = require("node:https");
const { spawn } = require("node:child_process");

const REPO = "mhuzaifaqpk2009-stack/medipro-vault";
const BRANCH = "main";
const ZIP_URL = `https://github.com/${REPO}/archive/refs/heads/${BRANCH}.zip`;

let configured = false;
let activeJob = null;
let progressWindow = null;

function send(event, payload = {}) {
  for (const win of BrowserWindow.getAllWindows()) {
    try { win.webContents.send(`updater:${event}`, payload); } catch {}
  }
}

function updateProgress(percent, stage, detail = "") {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  const payload = { state: "working", percent: value, stage, detail };
  send("status", payload);
  if (progressWindow && !progressWindow.isDestroyed()) {
    progressWindow.webContents.executeJavaScript(`window.__update(${JSON.stringify(payload)})`).catch(() => {});
  }
}

function createProgressWindow() {
  if (progressWindow && !progressWindow.isDestroyed()) {
    progressWindow.focus();
    return;
  }
  progressWindow = new BrowserWindow({
    width: 520,
    height: 330,
    minWidth: 520,
    minHeight: 330,
    resizable: false,
    maximizable: false,
    minimizable: false,
    show: false,
    title: "Huzaifa Pharmacy — Updating",
    backgroundColor: "#f5fafb",
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  progressWindow.on("closed", () => { progressWindow = null; });
  progressWindow.webContents.on("will-navigate", (event, url) => {
    if (url === "medicore-updater://cancel") {
      event.preventDefault();
      cancelUpdate();
      return;
    }
    event.preventDefault();
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;padding:28px;font-family:Segoe UI,Arial,sans-serif;background:#f5fafb;color:#102a33}
    .card{background:#fff;border:1px solid #d8e8eb;border-radius:18px;padding:24px;box-shadow:0 8px 28px rgba(15,60,70,.08)}
    h1{font-size:20px;margin:0 0 6px}.sub{font-size:13px;color:#60777e;margin-bottom:22px}.stage{font-size:14px;font-weight:600;margin-bottom:8px}.detail{font-size:12px;color:#71878d;min-height:18px;margin-bottom:12px}
    .track{height:12px;border-radius:99px;background:#e5eff1;overflow:hidden}.bar{height:100%;width:0;background:#078b91;border-radius:99px;transition:width .25s ease}.row{display:flex;align-items:center;justify-content:space-between;margin-top:10px}.pct{font-weight:700;color:#078b91}.cancel{border:1px solid #d7a3a3;background:#fff;color:#a63c3c;border-radius:9px;padding:8px 14px;font-weight:600;cursor:pointer}.cancel:hover{background:#fff3f3}.note{font-size:11px;color:#82949a;margin-top:18px;line-height:1.45}
  </style></head><body><div class="card"><h1>Updating Huzaifa Pharmacy</h1><div class="sub">The latest software is being downloaded, rebuilt, and prepared for installation.</div><div id="stage" class="stage">Starting…</div><div id="detail" class="detail">Please keep this window open.</div><div class="track"><div id="bar" class="bar"></div></div><div class="row"><span id="pct" class="pct">0%</span><button id="cancel" class="cancel" onclick="location.href='medicore-updater://cancel'">Cancel update</button></div><div class="note">Cancel stops the current build process and permanently removes the downloaded temporary source/build files. Your installed pharmacy data is not removed.</div></div><script>window.__update=(p)=>{document.getElementById('bar').style.width=p.percent+'%';document.getElementById('pct').textContent=p.percent+'%';document.getElementById('stage').textContent=p.stage||'Working…';document.getElementById('detail').textContent=p.detail||''};</script></body></html>`;
  progressWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).then(() => {
    if (progressWindow && !progressWindow.isDestroyed()) progressWindow.show();
  }).catch(() => {});
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "Huzaifa-Pharmacy-Updater" }, ...options }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        request(new URL(res.headers.location, url).toString(), options).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`GitHub returned HTTP ${res.statusCode}`));
        return;
      }
      resolve(res);
    });
    req.on("error", reject);
    if (options.signal) options.signal.addEventListener("abort", () => req.destroy(new Error("Update canceled")), { once: true });
  });
}

async function downloadZip(target, signal) {
  const response = await request(ZIP_URL, { signal });
  const total = Number(response.headers["content-length"] || 0);
  let received = 0;
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(target);
    response.on("data", (chunk) => {
      received += chunk.length;
      const percent = total ? received / total : 0;
      updateProgress(5 + percent * 25, "Downloading latest source", `${Math.round(received / 1024 / 1024)} MB${total ? ` of ${Math.round(total / 1024 / 1024)} MB` : ""}`);
    });
    response.on("error", reject); out.on("error", reject); out.on("finish", resolve); response.pipe(out);
    signal.addEventListener("abort", () => { response.destroy(); out.destroy(); reject(new Error("Update canceled")); }, { once: true });
  });
}

function runCommand(command, args, cwd, signal, onOutput) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, shell: false, env: { ...process.env, CI: "1" } });
    if (activeJob) activeJob.child = child;
    let stderr = "";
    child.stdout?.on("data", (buf) => onOutput?.(buf.toString()));
    child.stderr?.on("data", (buf) => { stderr += buf.toString(); onOutput?.(buf.toString()); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr.trim().split(/\r?\n/).filter(Boolean).slice(-8).join("\n") || `${command} exited with code ${code}`)));
    signal.addEventListener("abort", () => killProcessTree(child), { once: true });
  });
}

function killProcessTree(child) {
  if (!child || child.killed) return;
  if (process.platform === "win32") {
    try { spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true }); } catch {}
  } else {
    try { child.kill("SIGTERM"); } catch {}
  }
}

async function extractZip(zipPath, targetDir, signal) {
  await fsp.mkdir(targetDir, { recursive: true });
  const ps = `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${targetDir.replace(/'/g, "''")}' -Force`;
  await runCommand("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps], targetDir, signal, () => {});
  const entries = await fsp.readdir(targetDir, { withFileTypes: true });
  const root = entries.find((entry) => entry.isDirectory());
  if (!root) throw new Error("GitHub archive did not contain a source folder.");
  return path.join(targetDir, root.name);
}

async function findInstaller(releaseDir) {
  const entries = await fsp.readdir(releaseDir, { withFileTypes: true });
  const installers = entries.filter((e) => e.isFile() && /\.exe$/i.test(e.name) && !/uninstall/i.test(e.name));
  if (!installers.length) throw new Error("Build completed but no Windows installer was found in the release folder.");
  installers.sort((a, b) => b.name.length - a.name.length);
  return path.join(releaseDir, installers[0].name);
}

async function cleanup(dir) {
  if (!dir) return;
  try { await fsp.rm(dir, { recursive: true, force: true, maxRetries: 4, retryDelay: 250 }); } catch {}
}

async function performUpdate() {
  if (activeJob) return { supported: true, state: "error", message: "An update is already running." };
  if (!app.isPackaged) return { supported: false, state: "dev", currentVersion: app.getVersion() };

  const controller = new AbortController();
  const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), "huzaifa-pharmacy-update-"));
  const zipPath = path.join(workDir, "source.zip");
  const extractDir = path.join(workDir, "source");
  activeJob = { controller, workDir, child: null };
  createProgressWindow();

  try {
    updateProgress(2, "Preparing update", "Creating a clean temporary build folder…");
    updateProgress(5, "Downloading latest source", "Connecting to GitHub…");
    await downloadZip(zipPath, controller.signal);

    updateProgress(32, "Extracting source", "Unpacking the latest main branch…");
    const sourceDir = await extractZip(zipPath, extractDir, controller.signal);

    updateProgress(40, "Installing dependencies", "Running npm install…");
    await runCommand("npm.cmd", ["install"], sourceDir, controller.signal, (text) => {
      if (/added|up to date|audited/i.test(text)) updateProgress(45, "Installing dependencies", "npm install is finishing…");
    });

    updateProgress(55, "Installing required UI dependency", "Running npm install @radix-ui/react-scroll-area…");
    await runCommand("npm.cmd", ["install", "@radix-ui/react-scroll-area"], sourceDir, controller.signal, () => {});

    updateProgress(65, "Building the application", "Running npm run dist…");
    let lastBuildUpdate = 65;
    await runCommand("npm.cmd", ["run", "dist"], sourceDir, controller.signal, (text) => {
      if (/vite|building|transformed/i.test(text)) { lastBuildUpdate = Math.min(82, lastBuildUpdate + 1); updateProgress(lastBuildUpdate, "Building the application", "Vite is compiling the production app…"); }
      if (/electron-builder|packaging|nsis/i.test(text)) { lastBuildUpdate = Math.max(lastBuildUpdate, 88); updateProgress(lastBuildUpdate, "Creating Windows installer", "electron-builder is packaging the installer…"); }
    });

    updateProgress(96, "Preparing installation", "Locating the new Windows installer…");
    const installer = await findInstaller(path.join(sourceDir, "release"));
    updateProgress(100, "Update ready", "Launching the installer and closing the current application…");

    send("status", { state: "downloaded", version: "source-build", percent: 100, installer });
    setTimeout(() => {
      try {
        spawn(installer, ["/S"], { detached: true, stdio: "ignore", windowsHide: false }).unref();
      } catch (error) {
        send("status", { state: "error", message: `Could not launch installer: ${error?.message || String(error)}` });
        return;
      }
      setTimeout(() => {
        cleanup(workDir);
        app.quit();
      }, 700);
    }, 400);

    return { supported: true, state: "downloaded", currentVersion: app.getVersion(), version: "source-build" };
  } catch (error) {
    const canceled = controller.signal.aborted || /canceled/i.test(error?.message || "");
    await cleanup(workDir);
    const message = canceled ? "Update canceled. Downloaded and temporary build files were deleted." : (error?.message || String(error));
    send("status", { state: canceled ? "error" : "error", message });
    return { supported: true, state: "error", currentVersion: app.getVersion(), message };
  } finally {
    activeJob = null;
    if (progressWindow && !progressWindow.isDestroyed()) {
      if (!controller.signal.aborted) setTimeout(() => { try { progressWindow.close(); } catch {} }, 1200);
      else { try { progressWindow.close(); } catch {} }
    }
  }
}

function cancelUpdate() {
  if (!activeJob) return;
  activeJob.controller.abort();
  killProcessTree(activeJob.child);
  updateProgress(0, "Canceling update", "Stopping the current process and deleting temporary files…");
}

function configure() {
  if (configured) return;
  configured = true;
}

ipcMain.handle("updater:status", () => ({ supported: app.isPackaged, currentVersion: app.getVersion(), running: Boolean(activeJob) }));
ipcMain.handle("updater:check", () => performUpdate());
ipcMain.handle("updater:cancel", () => { cancelUpdate(); return true; });
ipcMain.handle("updater:install", () => false);

app.whenReady().then(configure);
