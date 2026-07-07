# PQW Stock Dashboard — Codebase Memory

## Project Overview
Electron + Express + React/Vite stock management app for PQW. Manages WooCommerce products, cutting room stock, Google Sheets integration, NSIS installer with electron-updater auto-update.

**Stack:** Electron ^41.5.0 | Express ^4.18.2 | React ^18.2.0 | Vite ^5.0.8 | Zustand ^4.4.7 | TypeScript

**Data location:** Dev=`<repo>/data\` | Packaged=`%APPDATA%\pqw-stock-dashboard\data\`

**Repo:** `hashard/PQW-Stock-App` (public)

---

## 1. Startup Flow
```
electron-main.mjs (app.whenReady)
  → set env: APP_VERSION, DATA_DIR
  → ensureDataDir() + migration from old location
  → setupUpdater() [if packaged]
  → await import('./server.js')  [top-level await, requires "type":"module"]
  → server.js Express starts on :3001
  → createTray()
  → app.whenReady() callback registers window
```
Tray is the main UI surface — hidden Electron window. Double-click tray opens `http://localhost:3001` in external browser.

---

## 2. Data Files (DATA_DIR)
| File | Purpose |
|------|---------|
| `products.json` | Product catalog with computed + editable fields |
| `adjustments.json` | All stock adjustments (audit log) |
| `settings.json` | WooCommerce creds, thresholds, sheets config, auto-sync interval |

All file I/O is **synchronous** (`readFileSync`/`writeFileSync`). Each file initialized if missing.

---

## 3. Settings Defaults
```js
{
  woo_url, consumer_key, consumer_secret,
  default_threshold: 5,
  default_cutting_room_minimum: 0,
  auto_sync_interval: 0,   // 0 = disabled, else minutes
  sheets_enabled: false,
  sheets_id, sheets_tab: 'Stock',
  sheets_credentials_json: '',
  woo_push_instant: false,
  auto_woo_enabled: false,
  require_reason: true,
}
```

---

## 4. Three Operation Modes

### Dev (`npm run dev`)
- `concurrently "node server.js" "vite"` — separate processes
- Vite on :5173 with `/api` proxy to :3001
- No Electron, no tray, no auto-updater
- Data in `./data/`

### PM2/start-tray (`pm2 start start-tray.js`)
- `start-tray.js` spawns `electron` binary directly
- Electron `app.isPackaged = false` → `DATA_DIR = ./data`
- Update: SSE `/api/update` does `git pull && npm install && npm run build && process.exit(0)` — PM2 restarts
- Tray present

### Packaged EXE (`npm run package`)
- NSIS one-click installer, per-user
- `app.isPackaged = true` → `DATA_DIR = %APPDATA%\pqw-stock-dashboard\data\`
- Update: `electron-updater` via GitHub releases
- Tray present

---

## 5. Server Endpoints

### Products
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List all with computed fields (combined_stock, status, needs_laser_cut) |
| PUT | `/api/products/:id` | Update editable fields (computed fields stripped server-side) |

### Adjustments
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/adjustments` | List all sorted newest first |
| POST | `/api/adjustments` | Create adjustment → updates cutting_room_stock |

### WooCommerce
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sync` | Pull all WC products + variations, upsert by SKU |
| POST | `/api/push-woo` | Push local woo_stock to WC for all products with woo_product_id) |
| POST | `/api/woo-stock` | Edit WooCommerce stock (local ± optionally live) |
| POST | `/api/transfer` | Move cutting room → WooCommerce stock (local ± optionally live) |

### Google Sheets
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sheets/pull` | Pull sheet, merge editable fields into products (by SKU) |
| POST | `/api/sheets/push` | Push all products to sheet |
| POST | `/api/sheets/test` | Test connection + credentials |

### Version / Update
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/version` | { hash, git date, app version subject } |
| GET | `/api/update` | SSE stream — triggers update (git pull or electron-updater) |
| GET | `/api/local-url` | IPv4:3001 for QR code |

---

## 6. Product Computation (Server-Side)
```js
function computeProduct(p) {
  const combined = (p.woo_stock ?? 0) + (p.cutting_room_stock ?? 0);
  const threshold = p.low_stock_threshold ?? 5;
  const status = combined === 0 ? 'out_of_stock'
           : combined <= threshold ? 'low_stock'
           : 'in_stock';
  const needs_laser_cut = !p.hidden && (p.cutting_room_minimum ?? 0) > 0
        && (p.cutting_room_stock ?? 0) <= (p.cutting_room_minimum ?? 0);
  return { ...p, combined_stock: combined, status, needs_laser_cut };
}
```
Computed fields (`combined_stock`, `status`, `needs_laser_cut`) are **always deleted** on PUT so clients can't overwrite them.

---

## 7. Google Sheets Columns
**Push order:** Product Name | SKU | Category | Woo Stock | Cutting Room | Combined | Status | Threshold | Cutting Room Min | Hidden | Last Updated

**Pull column mapping (case-insensitive):**
| Sheet Column | Maps To | Notes |
|-------------|---------|-------|
| SKU | — | Primary key for matching |
| Cutting Room | cutting_room_stock | Logs adjustment type `sheet_import` |
| Cutting Room Min | cutting_room_minimum | Silent update |
| Woo Stock | woo_stock | Logs adjustment type `sheet_import` |
| Threshold | low_stock_threshold | Silent update |
| Hidden | hidden | Accepts yes/no/true/false/1/0 |

Unknown SKUs ignored. `silentSheetsPush()` fires (non-blocking) on every adjustment/woo-stock/transfer change.

---

## 8. WooCommerce Sync Flow
- Fetches all `status=publish` products, paginated 100/page
- Variable products: fetches all variations separately
- Upserts by SKU (new → `uid()`, existing → update fields)
- Missing SKUs in WC stay in local DB (no deletion)
- Products without SKU get `flagged: true`

---

## 9. Build System
`npm run package` → `vite build` + `electron-builder build --win nsis`

**electron-builder config:**
- `files`: `dist/**/*`, `server.js`, `public/**/*`, `electron-main.mjs`, `node_modules/**/*`
- `exclusions`: `.cache`, `node_modules/electron` (the package), `electron-builder` (the tool)
- `data/` explicitly NOT included — user data must survive updates
- `nsis.oneClick: true`, `perMachine: false`, `createDesktopShortcut: true`

**Important:** `package.json` has `"type": "module"` — `electron-main.mjs` uses ESM top-level `await import('./server.js')`.

---

## 10. Update Mechanism

### Packaged EXE — electron-updater
- Configured via `publish: { provider: "github", owner: "hashard", repo: "PQW-Stock-App" }`
- `autoDownload: true`, `autoInstallOnAppQuit: true`
- Progress streamed via SSE `/api/update` endpoint (`global.pqwUpdater.emitter`)
- On `update-downloaded`: 1.5s delay then `autoUpdater.quitAndInstall(true, true)`

### PM2 Mode — Git Pull SSE
- `git pull && npm install && npm run build && process.exit(0)`
- PM2 detects exit, restarts `start-tray.js`, which re-spawns Electron

---

## 11. Key Quirks
1. **Sync upserts by SKU** — new products created, existing updated, deleted WC products retained locally
2. **Transfer is pure local stock movement** — does NOT push live to WC
3. **woo_push_instant** is per-action-type: adjustments can never push live; woo-stock/transfer only if `true` + `woo_product_id` exists
4. **Hidden products kept** with `hidden: true`, filtered from default view
5. **`silentSheetsPush` is fire-and-forget** — failures log to console only
6. **No authentication** — internal use only
7. **Synchronous file I/O** throughout (fine for single-user)
8. **No deletion endpoints** — data only grows
9. **Tray opens external browser** (`shell.openExternal`), not an Electron window
10. **Auto-sync interval timer** — changing in Settings doesn't cancel/replace old timer (React effect cleanup returns, but original leaked if re-render didn't fire cleanup)
11. **`auto_woo_enabled` gates all automatic WooCommerce sync** — when true, local stock changes automatically push to WC (server-side, fire-and-forget) and WC stock is pulled on `auto_sync_interval`. Google Sheets unaffected.

---

## 12. Version Info
- Current: `1.1.0` — bug-fix + scheduled-backup release. Fixes: backup route un-shadowed (was after SPA catch-all), 25 MB JSON body limit (restore was 413-ing), no-reason crash when `require_reason` off, per-file atomic read-modify-write via `mutateData` (lost-update races), SKU-less sync dedup (`NO-SKU-<id>` key match), and secret masking in the `/api/backup` download. New: daily on-disk snapshots to `DATA_DIR/backups/` (keep 14, secrets included since local-only).
- `package-lock.json` header shows `"version": "1.0.0"` (generated at v1.0.0, not updated since)
- Notable deps: `electron-updater: ^6.8.3`, `electron-store: ^11.0.2`, `sharp: ^0.34.5` (dev, for icons)

---

## 13. File Structure
```
/
├── electron-main.mjs       — Electron main process, tray, updater setup
├── server.js               — Express API server (top-level await on import)
├── dist/                  — Built React app (Vite output)
├── public/                — Static assets (icons)
├── src/                   — React frontend
│   ├── main.tsx
│   ├── components/
│   │   ├── dashboard/     — NeedsLaserCutPanel, LowStockPanel
│   │   ├── products/      — ProductTable
│   │   ├── common/       — Drawer, StatCard
│   │   └── settings/     — WooSettings, SheetsSettings, etc.
│   ├── hooks/             — useInitialData, useUpdater
│   ├── services/          — api.ts
│   └── store/             — Zustand store
├── start-tray.js          — PM2 entry point for tray mode
└── data/                  — Dev data dir (excluded from build)
```

---

## 14. Critical Constraints
- Data MUST NOT be in the installer (`data/` excluded from build)
- User data at `%APPDATA%\pqw-stock-dashboard\` survives updates
- Migration logic in `electron-main.mjs` moves data from old per-exe location on first packaged run
- Repo must be public for electron-updater (no token required)
- NSIS one-click, per-user install — no admin rights needed on target PCs
