/**
 * start-tray.js
 * Launched by PM2. Spawns Electron, which starts the server AND the system-tray icon.
 * When the server calls process.exit(0) (e.g. after an in-app update), Electron exits,
 * this process exits, and PM2 automatically restarts it — relaunching everything cleanly.
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const electronCmd = path.join(__dirname, 'node_modules', '.bin', 'electron.cmd');

console.log('[tray] Starting PQW Stock Dashboard...');

const proc = spawn(electronCmd, ['.'], {
  stdio: 'inherit',
  shell: false,
  cwd: __dirname,
});

proc.on('error', (err) => {
  console.error('[tray] Failed to start Electron:', err.message);
  process.exit(1);
});

proc.on('exit', (code) => {
  console.log(`[tray] Exited with code ${code} — PM2 will restart`);
  process.exit(code ?? 0);
});
