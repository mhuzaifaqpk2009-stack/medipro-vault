const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const https = require("node:https");
const { spawn } = require("node:child_process");

const REPO = "mhuzaifaqpk2009-stack/medipro-vault";
const BRANCH = "main";
const ZIP_URL = `https://codeload.github.com/${REPO}/zip/refs/heads/${BRANCH}`;

let configured = false;
let activeJob = null;
let progressWindow = null;

function send(status) {
  for (const win of BrowserWindow.getAllWindows()) {
    try { win.webContents.send("updater:status", status); } catch {}
  }
}

function progress(percent, stage, detail = "") {
  const payload = { state: "working", percent: Math.max(0, Math.min(100, Math.round(percent))), stage, detail };
  send(payload);
  if (progressWindow && !progressWindow.isDestroyed()) {
    progressWindow.webContents.executeJavaScript(`window.__update(${JSON.stringify(payload)})`).catch(() => {});
  }
}

function createProgressWindow() {
  if (progressWindow && !progressWindow.isDestroyed()) { progressWindow.focus(); return; }
  progressWindow = new BrowserWindow({
    width: 540, height: 340, minWidth: 540, minHeight: 340,
    resizable: false, maximizable: false, minimizable: false, show: false,
    title: "Huzaifa Pharmacy — Updating",
    backgroundColor: "#f5fafb",
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  progressWindow.on("closed", () => { progressWindow = null; });
  progressWindow.webContents.on("will-navigate", (event, url) => {
    if (url === "medicore-updater://cancel") { event.preventDefault(); cancelUpdate(); return; }
    event.preventDefault();
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:28px;font-family:Segoe UI,Arial,sans-serif;background:#f5fafb;color:#102a33}.card{background:#fff;border:1px solid #d8e8eb;border-radius:18px;padding:24px;box-shadow:0 8px 28px rgba(15,60,70,.08)}h1{font-size:20px;margin:0 0 6px}.sub{font-size:13px;color:#60777e;margin-bottom:22px}.stage{font-size:14px;font-weight:600;margin-bottom:8px}.detail{font-size:12px;color:#71878d;min-height:18px;margin-bottom:12px}.track{height:12px;border-radius:99px;background:#e5eff1;overflow:hidden}.bar{height:100%;width:0;background:#078b91;border-radius:99px;transition:width .25s ease}.row{display:flex;align-items:center;justify-content:space-between;margin-top:10px}.pct{font-weight:700;color:#078b91}.cancel{border:1px solid #d7a3a3;background:#fff;color:#a63c3c;border-radius:9px;padding:8px 14px;font-weight:600;cursor:pointer}.note{font-size:11px;color:#82949a;margin-top:18px;line-height:1.45}</style></head><body><div class="card"><h1>Updating Huzaifa Pharmacy</h1><div class="sub">Downloading, installing dependencies, testing, building and preparing the new installer.</div><div id="stage" class="stage">Starting…</div><div id="detail" class="detail">Please keep this window open.</div><div class="track"><div id="bar" class="bar"></div></div><div class="row"><span id="pct" class="pct">0%</span><button class="cancel" onclick="location.href='medicore-updater://cancel'">Cancel update</button></div><div class="note">Cancel stops the active process and removes the temporary downloaded source and build files. Your pharmacy data is not deleted.</div></div><script>window.__update=p=>{document.getElementById('bar').style.width=p.percent+'%';document.getElementById('pct').textContent=p.percent+'%';document.getElementById('stage').textContent=p.stage||'Working…';document.getElementById('detail').textContent=p.detail||''};</script></body></html>`;
  progressWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).then(() => {
    if (progressWindow && !progressWindow.isDestroyed()) progressWindow.show();
  }).catch(() => {});
}

function request(url, signal) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "Huzaifa-Pharmacy-Updater", Accept: "application/zip" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        request(new URL(res.headers.location, url).toString(), signal).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`GitHub download failed with HTTP ${res.statusCode}.`));
        return;
      }
      const type = String(res.headers["content-type"] || "").toLowerCase();
      if (!type.includes("zip") && !type.includes("octet-stream")) {
        res.resume();
        reject(new Error(`GitHub returned an unexpected archive type (${type || "unknown"}).`));
        return;
      }
      resolve(res);
    });
    req.on("error", reject);
    if (signal) signal.addEventListener("abort", () => req.destroy(new Error("Update canceled.")), { once: true });
  });
}

async function downloadZip(target, signal) {
  const response = await request(ZIP_URL, signal);
  const total = Number(response.headers["content-length"] || 0);
  let received = 0;
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(target);
    const fail = (error) => { try { out.destroy(); } catch {} reject(error); };
    response.on("data", (chunk) => {
      received += chunk.length;
      const pct = total ? received / total : 0;
      progress(5 + pct * 25, "Downloading latest source", `${Math.round(received / 1024 / 1024)} MB${total ? ` of ${Math.round(total / 1024 / 1024)} MB` : ""}`);
    });
    response.on("error", fail);
    out.on("error", fail);
    out.on("finish", resolve);
    response.pipe(out);
    signal.addEventListener("abort", () => { try { response.destroy(); } catch {} try { out.destroy(); } catch {} reject(new Error("Update canceled.")); }, { once: true });
  });
  const stat = await fsp.stat(target);
  if (!stat.isFile() || stat.size < 1024) throw new Error("GitHub returned an empty or incomplete source archive.");
}

function quoteWindowsArg(value) {
  const text = String(value);
  if (!/[\s"]/.test(text)) return text;
  return `"${text.replace(/(\\*)"/g, "$1$1\\\"").replace(/(\\+)$/g, "$1$1")}"`;
}

function runCommand(command, args, cwd, signal, onOutput) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === "win32";
    const executable = isWindows ? (process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe") : command;
    const spawnArgs = isWindows ? ["/d", "/s", "/c", [command, ...args].map(quoteWindowsArg).join(" ")] : args;
    let child;
    try { child = spawn(executable, spawnArgs, { cwd, windowsHide: true, shell: false, env: { ...process.env, CI: "1" }, stdio: ["ignore", "pipe", "pipe"] }); }
    catch (error) { reject(error); return; }
    if (activeJob) activeJob.child = child;
    let stderr = "";
    child.stdout?.on("data", (b) => onOutput?.(b.toString()));
    child.stderr?.on("data", (b) => { stderr += b.toString(); onOutput?.(b.toString()); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr.trim().split(/\r?\n/).filter(Boolean).slice(-10).join("\n") || `${command} exited with code ${code}`)));
    signal.addEventListener("abort", () => killProcessTree(child), { once: true });
  });
}

function killProcessTree(child) {
  if (!child || child.killed || !child.pid) return;
  if (process.platform === "win32") {
    try { spawn(process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe", ["/d", "/s", "/c", `taskkill.exe /pid ${Number(child.pid)} /t /f`], { windowsHide: true, stdio: "ignore" }); } catch {}
  } else { try { child.kill("SIGTERM"); } catch {} }
}

async function findSourceRoot(targetDir) {
  const queue = [{ dir: targetDir, depth: 0 }];
  while (queue.length) {
    const { dir, depth } = queue.shift();
    let entries;
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { continue; }
    const packageEntry = entries.find((e) => e.isFile() && e.name.toLowerCase() === "package.json");
    const srcEntry = entries.find((e) => e.isDirectory() && e.name.toLowerCase() === "src");
    if (packageEntry && srcEntry) {
      const packagePath = path.join(dir, packageEntry.name);
      let pkg;
      try { pkg = JSON.parse(await fsp.readFile(packagePath, "utf8")); } catch { throw new Error("The downloaded package.json is invalid JSON."); }
      if (!pkg || typeof pkg !== "object" || !pkg.scripts || typeof pkg.scripts.dist !== "string") throw new Error("The downloaded source has no usable npm dist script.");
      return dir;
    }
    if (depth >= 5) continue;
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.toLowerCase() === "node_modules" || entry.name.startsWith(".")) continue;
      queue.push({ dir: path.join(dir, entry.name), depth: depth + 1 });
    }
  }
  throw new Error("The GitHub archive was downloaded, but no valid project root was found. Expected package.json and src in the same folder.");
}

async function extractZip(zipPath, targetDir, signal) {
  await fsp.mkdir(targetDir, { recursive: true });
  const escapedZip = zipPath.replace(/'/g, "''");
  const escapedTarget = targetDir.replace(/'/g, "''");
  const ps = `$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath '${escapedZip}' -DestinationPath '${escapedTarget}' -Force`;
  await runCommand("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps], targetDir, signal, () => {});
  return findSourceRoot(targetDir);
}

async function findInstaller(releaseDir) {
  const entries = await fsp.readdir(releaseDir, { withFileTypes: true }).catch(() => []);
  const installers = entries.filter((e) => e.isFile() && /\.exe$/i.test(e.name) && !/uninstall/i.test(e.name));
  if (!installers.length) throw new Error("Build finished, but no Windows installer (.exe) was created in release/.");
  installers.sort((a, b) => b.name.length - a.name.length);
  return path.join(releaseDir, installers[0].name);
}

async function cleanup(dir) {
  if (!dir) return;
  try { await fsp.rm(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }); } catch {}
}

function launchInstallerAfterExit(installer, workDir) {
  const file = installer.replace(/'/g, "''");
  const dir = workDir.replace(/'/g, "''");
  const ps = `$ErrorActionPreference='SilentlyContinue'; Start-Sleep -Seconds 2; $p=Start-Process -FilePath '${file}' -ArgumentList '/S' -PassThru; $p.WaitForExit(); Remove-Item -LiteralPath '${dir}' -Recurse -Force`;
  spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps], { detached: true, stdio: "ignore", windowsHide: true }).unref();
}

async function performUpdate() {
  if (activeJob) return { supported: true, state: "error", message: "An update is already running." };
  if (!app.isPackaged) return { supported: false, state: "dev", currentVersion: app.getVersion() };

  const controller = new AbortController();
  const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), "huzaifa-pharmacy-update-"));
  activeJob = { controller, workDir, child: null };
  const zipPath = path.join(workDir, "source.zip");
  const extractDir = path.join(workDir, "source");
  createProgressWindow();

  try {
    progress(2, "Preparing update", "Creating a clean temporary workspace…");
    progress(5, "Downloading latest source", "Connecting to GitHub…");
    await downloadZip(zipPath, controller.signal);

    progress(32, "Extracting source", "Unpacking the GitHub archive…");
    const sourceDir = await extractZip(zipPath, extractDir, controller.signal);
    progress(38, "Checking source", "package.json and src were found. Checking the build configuration…");

    progress(40, "Installing dependencies", "Running npm install…");
    await runCommand("npm.cmd", ["install", "--no-audit", "--no-fund", "--package-lock=false"], sourceDir, controller.signal, () => {});

    progress(54, "Verifying required UI package", "Ensuring @radix-ui/react-scroll-area is installed…");
    await runCommand("npm.cmd", ["install", "@radix-ui/react-scroll-area@^1.2.18", "--no-audit", "--no-fund", "--package-lock=false"], sourceDir, controller.signal, () => {});

    progress(62, "Running tests", "Checking the updated application before packaging…");
    await runCommand("npm.cmd", ["test"], sourceDir, controller.signal, () => {});

    progress(70, "Building the application", "Running npm run dist…");
    let buildPercent = 70;
    await runCommand("npm.cmd", ["run", "dist"], sourceDir, controller.signal, (text) => {
      if (/vite|transformed|building/i.test(text)) { buildPercent = Math.min(84, buildPercent + 1); progress(buildPercent, "Building the application", "Vite is compiling the production application…"); }
      if (/electron-builder|packaging|nsis/i.test(text)) { buildPercent = Math.max(buildPercent, 88); progress(buildPercent, "Creating Windows installer", "electron-builder is packaging the installer…"); }
    });

    progress(96, "Preparing installation", "Checking that the installer exists…");
    const installer = await findInstaller(path.join(sourceDir, "release"));
    progress(100, "Update ready", "Closing the application and starting the new installer…");
    send({ state: "downloaded", percent: 100, version: "source-build", installer });
    launchInstallerAfterExit(installer, workDir);
    setTimeout(() => { try { app.quit(); } catch {} }, 600);
    return { supported: true, state: "downloaded", currentVersion: app.getVersion(), version: "source-build" };
  } catch (error) {
    const canceled = controller.signal.aborted || /update canceled/i.test(error?.message || "");
    await cleanup(workDir);
    const message = canceled ? "Update canceled. Temporary files were deleted." : (error?.message || String(error));
    send({ state: "error", message });
    return { supported: true, state: "error", currentVersion: app.getVersion(), message };
  } finally {
    activeJob = null;
    if (progressWindow && !progressWindow.isDestroyed()) {
      setTimeout(() => { try { progressWindow.close(); } catch {} }, 1000);
    }
  }
}

function cancelUpdate() {
  if (!activeJob) return;
  activeJob.controller.abort();
  killProcessTree(activeJob.child);
  progress(0, "Canceling update", "Stopping the current process and deleting temporary files…");
}

function configure() {
  if (configured) return;
  configured = true;
  ipcMain.handle("updater:status", () => ({ supported: app.isPackaged, currentVersion: app.getVersion(), running: Boolean(activeJob) }));
  ipcMain.handle("updater:check", () => performUpdate());
  ipcMain.handle("updater:cancel", () => { cancelUpdate(); return { ok: true }; });
  ipcMain.handle("updater:install", () => ({ ok: true, state: "handled-by-updater" }));
}

app.whenReady().then(configure).catch(() => {});
