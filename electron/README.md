# MediCore — Electron Desktop Packaging

The web app is a fully-working standalone MediCore. To ship as a Windows
desktop application, wrap it with Electron.

## One-time setup

```bash
npm i --save-dev electron @electron/packager
```

Also set `base: './'` in `vite.config.ts` before your first Electron build so
the produced `dist/index.html` loads assets via relative paths (Electron uses
`file://`).

Add these scripts to `package.json`:

```json
"main": "electron/main.cjs",
"scripts": {
  "electron:dev": "MEDICORE_DEV_URL=http://localhost:8080 electron .",
  "electron:build": "vite build && electron-packager . MediCore --platform=win32 --arch=x64 --out=electron-release --overwrite --ignore='^/src' --ignore='^/public' --ignore='^/electron-release'"
}
```

## Run in dev

```bash
bun dev                # in one terminal
npm run electron:dev   # in another
```

## Build a distributable Windows app

```bash
npm run electron:build
```

The packaged app appears in `electron-release/MediCore-win32-x64/`.
