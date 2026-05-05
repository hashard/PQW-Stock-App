# Electron Exe Packaging — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the PQW Stock Dashboard as a single portable `PQW Stock.exe` with system tray icon, auto-start on boot, and browser-based UI.

**Architecture:** Thin Electron shell (ESM) directly imports the existing Express server. Electron handles the tray icon + menu, and auto-start via `app.setLoginItemSettings()`. The server runs in the Electron main process — no child process complexity. Data files live in a `data/` folder next to the exe.

**Tech Stack:** Electron, electron-builder (portable target), electron-store, existing Express + React

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `electron-main.mjs` | Create | Electron main process: tray, server lifecycle, auto-start |
| `server.js` | Modify | Accept `DATA_DIR` env var, export `start()` function |
| `package.json` | Modify | Add electron deps, main entry, scripts, build config |
| `scripts/generate-icons.mjs` | Modify | Add tray icon generation |
| `public/icon-tray.png` | Create (generated) | 32x32 PNG for tray icon |

---

### Task 1: Install dependencies and update package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Electron and related packages**

```bash
npm install --save-dev electron electron-builder
npm install electron-store
```

- [ ] **Step 2: Update package.json**

Read current `package.json`, add these fields:

Top level — add `"main"` pointing to the electron entry:
```json
"main": "electron-main.mjs",
```

In `"scripts"` — add electron dev and package commands:
```json
"electron": "electron .",
"package": "npm run build && electron-builder build --win portable"
```

Add `"build"` configuration as a top-level key:
```json
"build": {
  "appId": "com.pqw.stock-dashboard",
  "productName": "PQW Stock",
  "directories": {
    "output": "dist-electron"
  },
  "files": [
    "dist/**/*",
    "server.js",
    "data/**/*",
    "public/**/*",
    "electron-main.mjs",
    "node_modules/**/*",
    "!node_modules/.cache",
    "!node_modules/electron",
    "!node_modules/electron-builder"
  ],
  "win": {
    "target": "portable",
    "icon": "public/icon-tray.png"
  },
  "portable": {
    "artifactName": "PQW Stock.exe"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add Electron and electron-builder dependencies"
```

---

### Task 2: Refactor server.js to export without auto-starting

**Files:**
- Modify: `server.js`

The last line of `server.js` calls `app.listen(PORT, ...)`. In Electron mode, we need to control when this happens (to set DATA_DIR first). Wrap the listen call in a function and export it, while keeping standalone `node server.js` working.

- [ ] **Step 1: Move the listen call into an exported `start()` function**

Find the last lines of `server.js`:
```js
app.listen(PORT, () => {
  console.log(`\n  PQW Stock Dashboard → http://localhost:${PORT}\n`);
});
```

Replace with:
```js
export function start(port = PORT) {
  app.listen(port, () => {
    console.log(`\n  PQW Stock Dashboard → http://localhost:${port}\n`);
  });
}

// Auto-start when run directly (node server.js)
if (process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  start();
}
```

Wait — that `import.meta.url` check is fragile on Windows. Simpler approach: use a CLI flag:

Actually, the cleanest approach: just export the app and have a separate entry point call start(). Or even simpler — check if we're being imported vs run directly using `process.env.ELECTRON_RUN_AS_NODE` or a custom flag.

Simplest reliable approach — use a flag file or env var. In electron-main.mjs we set an env var before importing:

Replace the listen line with:
```js
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`\n  PQW Stock Dashboard → http://localhost:${PORT}\n`);
});
```

(Keep it as-is — Electron will import server.js, the listen call fires, and it works. We just need DATA_DIR set before the import happens, which we do in electron-main.mjs.)

So actually server.js only needs one change — the DATA_DIR env var support. The listen call stays as-is.

- [ ] **Step 2: Just add DATA_DIR support**

Find:
```js
const DATA_DIR = path.join(__dirname, 'data');
```

Replace with:
```js
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
```

- [ ] **Step 3: Verify server still starts standalone**

```bash
node server.js
# Expected: PQW Stock Dashboard → http://localhost:3001
# Ctrl+C to stop
```

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat: support DATA_DIR env var for configurable data path"
```

---

### Task 3: Create electron-main.mjs

**Files:**
- Create: `electron-main.mjs`

- [ ] **Step 1: Create the Electron main process**

Since the project has `"type": "module"`, we use ESM syntax. Electron will load this as the main entry point.

The key insight: we set `DATA_DIR` before the first import of server.js, so server.js uses the data directory next to the exe (not inside the packaged ASAR).

```js
import { app, Tray, Menu, shell, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let tray = null;

function getDataDir() {
  if (app.isPackaged) {
    // In packaged exe: data/ folder next to the exe
    return path.join(path.dirname(app.getPath('exe')), 'data');
  }
  // In dev: use the existing data/ folder
  return path.join(__dirname, 'data');
}

function ensureDataDir() {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function createTray() {
  const iconPath = path.join(__dirname, 'public', 'icon-tray.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);

  const store = new Store({ defaults: { startOnBoot: false } });

  function updateStartOnBoot(enable) {
    store.set('startOnBoot', enable);
    app.setLoginItemSettings({
      openAtLogin: enable,
      path: process.execPath,
    });
  }

  const startOnBoot = store.get('startOnBoot');
  // Apply stored preference on startup
  app.setLoginItemSettings({
    openAtLogin: startOnBoot,
    path: process.execPath,
  });

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Dashboard',
      click: () => { shell.openExternal('http://localhost:3001'); },
    },
    {
      label: 'Settings',
      click: () => { shell.openExternal('http://localhost:3001'); },
    },
    { type: 'separator' },
    {
      label: 'Start on Boot',
      type: 'checkbox',
      checked: startOnBoot,
      click: (menuItem) => { updateStartOnBoot(menuItem.checked); },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => { app.quit(); },
    },
  ]);

  tray.setToolTip('PQW Stock Dashboard');
  tray.setContextMenu(contextMenu);

  // Double-click tray icon → open dashboard
  tray.on('double-click', () => {
    shell.openExternal('http://localhost:3001');
  });
}

// ── Startup ────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Set data directory BEFORE importing server
  process.env.DATA_DIR = getDataDir();
  ensureDataDir();

  // Import server — it starts listening on import (top-level app.listen)
  await import('./server.js');

  createTray();
});

// Prevent Electron from quitting when all windows close (tray-only app)
app.on('window-all-closed', (event) => {
  // Do nothing — keep running in tray
});
```

- [ ] **Step 2: Commit**

```bash
git add electron-main.mjs
git commit -m "feat: add Electron main process with tray and server management"
```

---

### Task 4: Generate tray icon

**Files:**
- Modify: `scripts/generate-icons.mjs`
- Create: `public/icon-tray.png` (generated)

- [ ] **Step 1: Read `scripts/generate-icons.mjs` to understand its structure and imports**

- [ ] **Step 2: Add tray icon PNG generation at the end of the script**

The script already imports `sharp` and `writeFileSync`. Add after the existing icon generation:

```js
// ── Tray icon (32×32 PNG for Electron system tray) ──────────────────
const iconTrayPath = fileURLToPath(new URL('../public/icon-tray.png', import.meta.url));
const trayResized = await sharp(inputPath)
  .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
writeFileSync(iconTrayPath, trayResized);
console.log('  ✓ icon-tray.png (32×32 tray icon)');
```

The `inputPath` variable name might differ — check the existing code and match its name.

- [ ] **Step 3: Run the script**

```bash
node scripts/generate-icons.mjs
```

Expected: generates `public/icon-tray.png`

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-icons.mjs public/icon-tray.png
git commit -m "feat: generate tray icon PNG from PQW logo"
```

---

### Task 5: Test Electron dev mode

- [ ] **Step 1: Build the React frontend**

```bash
npm run build
```

- [ ] **Step 2: Verify Electron starts in dev mode**

```bash
npx electron .
```

Expected: Server starts, tray icon appears in the system tray. Right-click shows menu. "Open Dashboard" opens browser. Verify data loads correctly.

- [ ] **Step 3: Fix any issues before proceeding to build**

---

### Task 6: Build and test the portable exe

- [ ] **Step 1: Package as portable exe**

```bash
npm run package
```

Output appears in `dist-electron/` as `PQW Stock.exe`.

- [ ] **Step 2: Test the exe**

- Copy `PQW Stock.exe` to a test folder (e.g., `Desktop\PQW Test\`)
- Double-click to run
- Verify tray icon appears
- Verify "Open Dashboard" opens browser to localhost:3001
- Verify `data/` folder is created next to the exe
- Verify Settings page loads
- Verify "Start on Boot" toggles
- Right-click tray → Quit, verify app exits

- [ ] **Step 3: Commit any build config tweaks**

```bash
git add package.json
git commit -m "chore: finalize electron-builder portable config"
```

---

### Task 7: Final verification

- [ ] **Step 1: Clean build from scratch**

```bash
rm -rf dist dist-electron
npm run build
npx electron-builder build --win portable
```

Confirm `dist-electron/PQW Stock.exe` exists and is a single .exe file.

- [ ] **Step 2: Final commit**

```bash
git add -A
git commit -m "chore: final Electron packaging verification"
```
