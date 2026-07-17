# MediCore — Professional Pharmacy Management (Electron Desktop)

A fully offline Windows desktop app packaged with Electron, built on React + TypeScript + Vite + TanStack Router/Query + Tailwind + shadcn/ui. Data lives in a single portable project file the user chooses via native Save/Open dialogs — no cloud, no accounts, no internet.

## 1. Architecture Overview

```text
┌─────────────────────────────────────────────────────────┐
│  Electron Main (Node)                                   │
│   • BrowserWindow, menus, shortcuts                     │
│   • Native dialogs (Save As, Open, Confirm)             │
│   • File I/O (read/write .medicore project files)       │
│   • Recent projects registry (userData/recents.json)    │
│   • Auto-save scheduler, backup, crash recovery         │
│   • IPC handlers (contextBridge, no nodeIntegration)    │
├─────────────────────────────────────────────────────────┤
│  Preload (contextBridge)                                │
│   • window.medicore.{project, dialog, system, print}    │
├─────────────────────────────────────────────────────────┤
│  Renderer (React + Vite)                                │
│   • UI layer: shadcn/ui components, Tailwind theme      │
│   • Routing: TanStack Router (project-manager + app)    │
│   • Data layer: TanStack Query over in-memory store     │
│   • Domain layer: pure TS services (medicines, sales,   │
│     purchases, reports, inventory, backup)              │
│   • State: Zustand for session + dirty flag             │
└─────────────────────────────────────────────────────────┘
```

### Project file format (`.medicore`)
A single portable file the user places anywhere. Internally an AES-256-GCM encrypted JSON envelope (encryption only when a password is set; otherwise plain JSON with a magic header + version). Fully self-contained — copy the file to another machine and it just works.

```text
{ magic:"MEDICORE", version:1, encrypted:bool, salt?, iv?, payload:{
    settings, medicines[], categories[], suppliers[], customers[],
    purchases[], sales[], stockAdjustments[], loyalty, meta:{created,updated}
}}
```

### Folder layout
```text
electron/
  main.cjs            # BrowserWindow, IPC, dialogs, auto-save
  preload.cjs         # contextBridge API
src/
  routes/
    __root.tsx        # shell + global providers
    index.tsx         # ProjectManager (create/open/recent/delete/rename/dup)
    app/              # authenticated-into-project subtree
      route.tsx       # loads project, guards, top nav + sidebar
      index.tsx       # Dashboard
      medicines.tsx / sales.tsx / purchases.tsx / suppliers.tsx
      customers.tsx / categories.tsx / inventory.tsx
      reports.tsx / settings.tsx
  components/         # AppSidebar, Topbar, DirtyDot, dialogs, tables, POS
  domain/             # pure services: medicineService, salesService, ...
  store/              # projectStore (Zustand), dirty tracking, autosave hook
  lib/                # ipc.ts (wraps window.medicore), format, print, csv, pdf
  styles.css          # design tokens (oklch), typography, shadows
```

### Dirty state + close guard (Word-like)
Every mutating service call marks store dirty. Intercept:
- `beforeunload` in renderer
- `close`, before-open-project, before-create-project, before-logout in main
Show native 3-button dialog: Save / Don't Save / Cancel. Cancel aborts action.

### Auto-save
Renderer scheduler (1/2/5/10/15 min from settings) triggers `saveProject()` only if a file path exists and dirty. Writes atomically (`tmp` + rename) via IPC.

## 2. Design System

- Typography: Space Grotesk (display) + Inter (body) via `<link>` in root head.
- Palette: cool clinical — deep teal primary, slate surfaces, subtle mint accent, warning amber, danger rose. Full oklch tokens in `src/styles.css`, both light and dark.
- Motion: framer-motion for route transitions, dialog reveals, dashboard card stagger.
- Density: comfortable desktop density (tables 40px rows, 14px base), rounded-xl cards, soft layered shadows using `color-mix` on primary.
- Icons: lucide-react throughout.

## 3. Build Phases

Each phase is shipped complete and verified before the next.

1. **Foundations** — Vite/Tanstack scaffold cleanup, design tokens, shadcn variants, Electron main + preload + packaging scripts, IPC contract, project file codec (with AES-GCM), recent-projects registry.
2. **Project Manager** — Create (name + optional password → native Save As, cancel aborts), Open, Recent list, Rename, Duplicate, Delete, password prompt, error toasts. Route guard so `/app/*` requires a loaded project.
3. **App Shell** — Sidebar (collapsible), topbar with project name + DirtyDot + Save/Save As, keyboard shortcuts (Ctrl+S, Ctrl+O, Ctrl+N, Ctrl+F), close-guard dialog, auto-save engine wired to settings.
4. **Domain + Storage** — Zustand project store, per-entity services, TanStack Query wrappers, undo-safe mutations, importer/exporter (CSV/JSON).
5. **Medicines** — CRUD, search/sort/filter, barcode field, import/export CSV, print list, low-stock/expiry badges.
6. **Categories & Suppliers & Customers** — CRUD + histories + balances + loyalty points.
7. **Purchases** — Create purchase, line items, supplier picker, tax/discount, auto stock-in, printable invoice.
8. **POS / Sales** — Barcode scan input, medicine search, cart, discount, tax, split payments, auto stock-out, receipt print/reprint, cancel/return flow.
9. **Inventory** — Low stock, out of stock, near expiry, expired, stock adjustment, stock transfer between racks.
10. **Dashboard** — KPI cards (Total/Low/Expired/Today Sales/Today Profit/Monthly Sales/Monthly Profit/Customers/Suppliers), Recharts sales line, monthly revenue bar, top-selling list.
11. **Reports** — Daily/Weekly/Monthly/Yearly sales, profit, stock, expiry, purchase, supplier, customer. Export PDF (pdf-lib) + Excel (xlsx), print preview.
12. **Settings** — Pharmacy info, tax %, currency, receipt logo/footer, auto-save toggle+interval, theme (light/dark), shortcuts reference, manual/auto backup, restore.
13. **Backup / Restore** — Manual backup (copy `.medicore` to chosen path with timestamp), auto backup schedule to a chosen folder, restore from backup file.
14. **Printing** — Reusable print layouts: 80mm receipt, A4 invoice, A4 reports; PDF export path shared with reports.
15. **Polish & Packaging** — Empty states, loading skeletons, toasts, animations pass, perf review (virtualized tables for 10k+ medicines via @tanstack/react-virtual), Electron packaging via `@electron/packager` for Windows x64, README.

## 4. Technical Details

- Electron: `contextIsolation: true`, `nodeIntegration: false`, custom protocol not needed (loads `dist/index.html` with `base: './'`).
- Native dialogs via `dialog.showSaveDialog` / `showOpenDialog` / `showMessageBox`.
- Encryption: `crypto.scryptSync` for key derivation, `aes-256-gcm` for payload; password never stored.
- Atomic writes: write to `path.tmp` then `fs.rename`.
- Recent projects: `app.getPath('userData')/recents.json` — stores {path, name, lastOpened}. Purged if file missing.
- TanStack Query: single QueryClient, cache invalidated on project load; all queries source from in-memory project store (no network).
- TanStack Router: `/` = Project Manager, `/app` layout guards project-loaded, child routes for each module.
- Router guards: navigating away from `/app/*` when dirty triggers close-guard dialog.
- Dark mode: `class="dark"` on `<html>`, persisted to `userData/prefs.json` (app-level, not per-project).

## 5. Deliverable

Phase 1 in this turn: full architecture scaffold — design tokens, Electron main/preload, IPC + project codec, Project Manager UI with real native dialogs (create with Save As + cancel-aborts, open, recents, rename, duplicate, delete, password), app shell with sidebar/topbar/dirty/save/close-guard/auto-save, empty placeholder pages for each module. Subsequent phases ship one feature at a time per your rules.

Approve to proceed with Phase 1.
