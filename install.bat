@echo off
title PQW Stock Dashboard — Installer
color 0A
setlocal EnableDelayedExpansion

echo.
echo  ============================================
echo    PQW Stock Dashboard — Installer
echo  ============================================
echo.

:: ── Check for winget (built into Windows 10/11) ──────────────────────────────
where winget >nul 2>&1
if errorlevel 1 (
    color 0E
    echo  Windows Package Manager (winget) was not found.
    echo  Please make sure Windows is up to date, then run this installer again.
    echo.
    pause
    exit /b 1
)

:: ── Install Git ───────────────────────────────────────────────────────────────
where git >nul 2>&1
if errorlevel 1 (
    echo  [1/6] Installing Git...
    echo.
    winget install Git.Git --silent --accept-source-agreements --accept-package-agreements
    if errorlevel 1 (
        color 0C
        echo.
        echo  ERROR: Git installation failed.
        echo  Please install manually from https://git-scm.com then run this again.
        pause
        exit /b 1
    )
    echo.
    echo  Git installed.
) else (
    echo  [1/6] Git is already installed. Skipping.
)

:: ── Install Node.js ───────────────────────────────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
    echo  [2/6] Installing Node.js...
    echo.
    winget install OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
    if errorlevel 1 (
        color 0C
        echo.
        echo  ERROR: Node.js installation failed.
        echo  Please install manually from https://nodejs.org then run this again.
        pause
        exit /b 1
    )
    echo.
    echo  Node.js installed.
) else (
    echo  [2/6] Node.js is already installed. Skipping.
)

:: ── Refresh PATH from registry so git and node are usable immediately ─────────
echo.
echo  Refreshing environment variables...
for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "MACHINE_PATH=%%b"
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USER_PATH=%%b"
set "PATH=%MACHINE_PATH%;%USER_PATH%"

:: ── Clone or update the app ───────────────────────────────────────────────────
echo.
cd /d "%USERPROFILE%"

if exist "Stock\.git" (
    echo  [3/6] App folder found — pulling latest version...
    cd Stock
    git pull
) else (
    if exist "Stock" (
        echo  [3/6] A Stock folder already exists but is not a git repo.
        echo  Rename or move C:\Users\%USERNAME%\Stock and run this installer again.
        pause
        exit /b 1
    )
    echo  [3/6] Downloading the app from GitHub...
    git clone https://github.com/hashard/PQW-Stock-App.git Stock
    if errorlevel 1 (
        color 0C
        echo.
        echo  ERROR: Could not download the app. Check your internet connection.
        pause
        exit /b 1
    )
    cd Stock
)

:: ── Copy data folder (stock levels) ──────────────────────────────────────────
echo.
echo  ============================================
echo.
echo  OPTIONAL — Copy existing stock data
echo.
echo  If you have a data\ folder from another PC
echo  (containing products.json, adjustments.json,
echo  settings.json), copy it into:
echo.
echo    C:\Users\%USERNAME%\Stock\data\
echo.
echo  Do this NOW before pressing any key.
echo  If this is a fresh install, just press Enter.
echo.
echo  ============================================
echo.
pause

:: ── Install packages ──────────────────────────────────────────────────────────
echo.
echo  [4/6] Installing packages...
call npm install
if errorlevel 1 (
    color 0C
    echo.
    echo  ERROR: Package installation failed.
    pause
    exit /b 1
)

:: ── Build the app ─────────────────────────────────────────────────────────────
echo.
echo  [5/6] Building the app...
call npm run build
if errorlevel 1 (
    color 0C
    echo.
    echo  ERROR: Build failed. Check the output above.
    pause
    exit /b 1
)

:: ── Set up auto-start with PM2 ────────────────────────────────────────────────
echo.
echo  [6/6] Setting up auto-start on Windows boot...
call npm install -g pm2 >nul 2>&1
call npm install -g pm2-windows-startup >nul 2>&1
call pm2 start server.js --name pqw-stock >nul 2>&1
call pm2 save >nul 2>&1
call pm2-startup install >nul 2>&1

echo.
echo  ============================================
echo    Installation complete!
echo  ============================================
echo.
echo  The app is now running at:
echo    http://localhost:3001
echo.
echo  It will start automatically every time
echo  this PC boots.
echo.
:: ── Create desktop + Start Menu shortcuts ─────────────────────────────────────
echo  Creating shortcuts...
(
  echo [InternetShortcut]
  echo URL=http://localhost:3001
  echo IconIndex=0
) > "%USERPROFILE%\Desktop\PQW Stock Dashboard.url"

if not exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\PQW" (
    mkdir "%APPDATA%\Microsoft\Windows\Start Menu\Programs\PQW"
)
(
  echo [InternetShortcut]
  echo URL=http://localhost:3001
  echo IconIndex=0
) > "%APPDATA%\Microsoft\Windows\Start Menu\Programs\PQW\PQW Stock Dashboard.url"

echo  To pin to the taskbar: right-click the desktop shortcut ^> "Pin to taskbar"
echo.
echo  Opening browser...
start http://localhost:3001
echo.
pause
