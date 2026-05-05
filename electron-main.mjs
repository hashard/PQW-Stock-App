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
