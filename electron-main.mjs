import { app, Tray, Menu, shell, nativeImage } from 'electron';
import { autoUpdater } from 'electron-updater';
import { EventEmitter } from 'events';
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

// ── Auto-updater ───────────────────────────────────────────────────

function setupUpdater() {
  const emitter = new EventEmitter();

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update',  ()     => emitter.emit('line', 'Checking for updates…'));
  autoUpdater.on('update-not-available', ()     => { emitter.emit('line', 'Already up to date.'); emitter.emit('done', 0); });
  autoUpdater.on('update-available',     (info) => emitter.emit('line', `Update found: v${info.version} — downloading…`));
  autoUpdater.on('download-progress',    (p)    => emitter.emit('line', `Downloading… ${Math.round(p.percent)}%`));
  autoUpdater.on('update-downloaded',    ()     => {
    emitter.emit('line', 'Download complete — restarting…');
    emitter.emit('done', 0);
    setTimeout(() => autoUpdater.quitAndInstall(true, true), 1500);
  });
  autoUpdater.on('error', (err) => {
    emitter.emit('line', `Update error: ${err.message}`);
    emitter.emit('done', 1);
  });

  // Expose to server.js (same process)
  global.pqwUpdater = {
    emitter,
    check: () => autoUpdater.checkForUpdates(),
  };
}

// ── Startup ────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Expose app version and data dir to server.js
  process.env.APP_VERSION = app.getVersion();
  process.env.DATA_DIR = getDataDir();
  ensureDataDir();

  // Set up auto-updater (packaged builds only — no git in dev)
  if (app.isPackaged) setupUpdater();

  // Import server — it starts listening on import (top-level app.listen)
  await import('./server.js');

  createTray();
});

// Prevent Electron from quitting when all windows close (tray-only app)
app.on('window-all-closed', (event) => {
  // Do nothing — keep running in tray
});
