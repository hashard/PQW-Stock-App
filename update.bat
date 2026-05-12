@echo off
title PQW Stock Dashboard — Updater
color 0A

echo.
echo  =======================================
echo    PQW Stock Dashboard — Update Tool
echo  =======================================
echo.

cd /d "%~dp0"

echo  [1/4] Pulling latest changes from GitHub...
git pull
if errorlevel 1 (
    color 0C
    echo.
    echo  ERROR: Git pull failed.
    echo  Check your internet connection and try again.
    echo.
    pause
    exit /b 1
)

echo.
echo  [2/4] Installing any new packages...
npm install --silent
if errorlevel 1 (
    color 0C
    echo.
    echo  ERROR: npm install failed.
    echo.
    pause
    exit /b 1
)

echo.
echo  [3/4] Building the app...
npm run build
if errorlevel 1 (
    color 0C
    echo.
    echo  ERROR: Build failed. Check the output above for details.
    echo.
    pause
    exit /b 1
)

echo.
echo  [4/4] Restarting the server...
pm2 restart pqw-stock >nul 2>&1
if errorlevel 1 (
    echo  Server is not running via PM2.
    echo  Please restart it manually:  node server.js
) else (
    echo  Server restarted successfully via PM2.
)

echo.
echo  =======================================
echo    Update complete! Your data is safe.
echo  =======================================
echo.
pause
