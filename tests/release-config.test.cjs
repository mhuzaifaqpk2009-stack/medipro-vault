const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

test("Windows distribution uses the production build and never publishes automatically", () => {
  assert.equal(pkg.scripts.dist, "npm run build && electron-builder --win nsis --publish never");
  assert.equal(pkg.scripts["electron:build"], "npm run dist");
  assert.equal(pkg.build.win.target, "nsis");
  assert.equal(pkg.build.appId, "com.huzaifa.pharmacy");
});

test("portable data paths are present", () => {
  const settings = fs.readFileSync(path.join(root, "src", "routes", "app.settings.tsx"), "utf8");
  const reports = fs.readFileSync(path.join(root, "src", "components", "reports", "ReportExplorer.tsx"), "utf8");
  assert.match(settings, /runBackupNow/);
  assert.match(settings, /restoreFromBytes/);
  assert.match(reports, /function exportCSV/);
  assert.match(reports, /text\/csv/);
});

test("FBR integration remains intentionally absent from the current release", () => {
  const sourceFiles = ["src/routes/app.settings.tsx", "src/components/PharmacyControls.tsx"];
  for (const file of sourceFiles) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    assert.doesNotMatch(text, /FBR|NTN|STRN/i);
  }
});
