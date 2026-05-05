# Electron Exe Packaging — Design

**Date**: 2026-05-05
**Status**: Approved

## Overview

Package the PQW Stock Dashboard as a Windows exe with system tray icon, auto-start on boot, and browser-based UI.

## Architecture

Thin Electron wrapper around the existing Express server. Electron provides the system tray, auto-start, and packaging. The existing server and React frontend are completely untouched.

```
┌──────────────────────────────────────────┐
│  electron-main.js                        │
│  ┌─────────┐  ┌──────────────────────┐   │
│  │  Tray   │  │  Express Server      │   │
│  │  Icon   │  │  (server.js, :3001)  │   │
│  │  + Menu │  │                      │   │
│  └─────────┘  └──────────────────────┘   │
│       │                │                  │
│       ▼                ▼                  │
│  Open Browser     Serve API + React       │
│  to localhost     (existing code)         │
└──────────────────────────────────────────┘
```

## System Tray

**Icon:** PQW logo (reuse `public/cropped-PQW-Logo-RGB_resized-150px.jpg.webp`, converted to `.ico`).

**Menu:**
| Item | Action |
|------|--------|
| Open Dashboard | Open `http://localhost:3001` in default browser |
| Settings | Open `http://localhost:3001` in browser (Settings page) |
| — | Separator |
| Start on Boot | Checked toggle — writes/removes shortcut in `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup` |
| — | Separator |
| Quit | Stop server, exit Electron |

**Tooltip:** "PQW Stock Dashboard" when hovering the tray icon.

## Auto-Start

Creates a `.lnk` shortcut in the Windows Startup folder:
- Path: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\PQW Stock.lnk`
- Target: the exe itself
- Checked state stored in electron-store (simple key-value, persists to disk)

User can enable/disable from the tray menu at any time.

## Packaging

- **Tool:** `electron-builder` with `portable` target
- **Output:** A single `PQW Stock.exe` file — nothing else. Copy this one file to a USB drive or any folder and double-click to run
- **Build command:** `npm run package` (added to package.json)
- **Data storage:** On first launch the exe creates a `data/` folder next to itself containing `products.json`, `settings.json`, and `adjustments.json`. Everything is self-contained in one directory — move or delete the folder to remove completely
- **Distribution:** Give someone the exe, they put it in a folder and run it. That's it

## Files Changed/Created

| File | Action | Purpose |
|------|--------|---------|
| `electron-main.js` | Create | Electron main process (tray, server spawn, auto-start) |
| `electron-preload.js` | Create | Preload script |
| `scripts/generate-icon.mjs` | Modify | Add .ico generation |
| `package.json` | Modify | Add electron dependencies, main entry, build config, package script |
| `start.bat` | Modify | Update to mention exe option |
| `public/icon.ico` | Create | Tray icon (generated from PQW logo) |
