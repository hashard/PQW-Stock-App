import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  RefreshCw, CheckCircle, AlertCircle, Moon, Sun, Loader2, Menu, X,
  Upload, Download, Sheet, ArrowDownToLine, ArrowUpFromLine,
} from 'lucide-react';
import { Sidebar } from './Sidebar';
import { AdjustModal } from '../products/AdjustModal';
import { ProductDrawer } from '../products/ProductDrawer';
import { useStore } from '../../store';
import { useSync } from '../../hooks/useSync';
import { Button } from '../ui/Button';
import { api } from '../../api/client';

function SyncBadge() {
  const { syncStatus } = useStore();
  const { state, last_synced_at, message, synced_count } = syncStatus;
  if (state === 'idle') return null;

  const cfg = {
    syncing: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, color: 'text-brand-600 dark:text-brand-400',     label: message || 'Syncing…' },
    success: { icon: <CheckCircle className="h-3.5 w-3.5" />,           color: 'text-emerald-600 dark:text-emerald-400', label: `Synced ${synced_count} products` },
    error:   { icon: <AlertCircle className="h-3.5 w-3.5" />,           color: 'text-red-600 dark:text-red-400',          label: message || 'Sync failed' },
  }[state];

  return (
    <span className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
      {cfg.icon}{cfg.label}
      {state === 'success' && last_synced_at && (
        <span className="text-slate-400">· {new Date(last_synced_at).toLocaleTimeString()}</span>
      )}
    </span>
  );
}

function SheetsBadge() {
  const { sheetsStatus } = useStore();
  const { state, message } = sheetsStatus;
  if (state === 'idle') return null;

  const cfg = {
    busy:  { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, color: 'text-green-600 dark:text-green-400',     label: message || 'Updating sheet…' },
    ok:    { icon: <CheckCircle className="h-3.5 w-3.5" />,           color: 'text-green-600 dark:text-green-400',     label: message },
    error: { icon: <AlertCircle className="h-3.5 w-3.5" />,           color: 'text-red-600 dark:text-red-400',          label: message },
  }[state];

  if (!cfg) return null;

  return (
    <span className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
      <Sheet className="h-3.5 w-3.5" />{cfg.icon}{cfg.label}
    </span>
  );
}

export function Layout() {
  const { isDarkMode, toggleDarkMode, syncStatus, settings, setProducts, setSheetsStatus, setAdjustments } = useStore();
  const { runPull, runPush } = useSync();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [pushingSheet, setPushingSheet] = useState(false);
  const [pullingSheet, setPullingSheet] = useState(false);

  const sheetsEnabled = settings.sheets_enabled && settings.sheets_id && settings.sheets_credentials_json;

  async function handleSheetsPush() {
    setPushingSheet(true);
    setSheetsStatus({ state: 'busy', message: 'Pushing to sheet…' });
    try {
      const result = await api.sheets.push();
      setSheetsStatus({ state: 'ok', message: `Sheet updated — ${result.rows} rows` });
      setTimeout(() => setSheetsStatus({ state: 'idle', message: '' }), 4000);
    } catch (err) {
      setSheetsStatus({ state: 'error', message: err instanceof Error ? err.message : 'Push failed' });
    } finally {
      setPushingSheet(false);
    }
  }

  async function handleSheetsPull() {
    if (!confirm('This will overwrite cutting room stock values from the Google Sheet. Continue?')) return;
    setPullingSheet(true);
    setSheetsStatus({ state: 'busy', message: 'Pulling from sheet…' });
    try {
      const result = await api.sheets.pull();
      setProducts(result.products);
      // Refresh adjustments to include the sheet_import entries
      const adj = await api.adjustments.list();
      setAdjustments(adj);
      setSheetsStatus({ state: 'ok', message: `Pulled — ${result.updated} products updated` });
      setTimeout(() => setSheetsStatus({ state: 'idle', message: '' }), 4000);
    } catch (err) {
      setSheetsStatus({ state: 'error', message: err instanceof Error ? err.message : 'Pull failed' });
    } finally {
      setPullingSheet(false);
    }
  }

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="flex h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">

        {/* Mobile sidebar overlay */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-30 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
            <div className="absolute left-0 top-0 h-full"><Sidebar /></div>
          </div>
        )}

        {/* Desktop sidebar */}
        <div className="hidden lg:flex"><Sidebar /></div>

        {/* Main content */}
        <div className="flex flex-1 flex-col min-w-0">

          {/* Top header */}
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-brand-100 bg-white px-4 dark:border-brand-900 dark:bg-slate-900 gap-2">
            <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setMobileSidebarOpen(v => !v)}>
              {mobileSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            <div className="flex-1" />

            {/* Status badges */}
            <SyncBadge />
            <SheetsBadge />

            {/* Sheets buttons — only shown when sheets is configured */}
            {sheetsEnabled && (
              <>
                <Button variant="secondary" size="sm" loading={pullingSheet} onClick={handleSheetsPull} title="Pull cutting room stock from Google Sheet">
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Pull Sheet</span>
                </Button>
                <Button variant="secondary" size="sm" loading={pushingSheet} onClick={handleSheetsPush} title="Push all stock to Google Sheet">
                  <Upload className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Push Sheet</span>
                </Button>
              </>
            )}

            {/* Woo push */}
            <Button
              variant="secondary" size="sm"
              loading={syncStatus.state === 'syncing'}
              onClick={() => {
                if (confirm('Push all local WooCommerce stock values to the live store?')) runPush();
              }}
              title="Push local stock values to WooCommerce"
            >
              <ArrowUpFromLine className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Push Woo</span>
            </Button>

            {/* Woo pull */}
            <Button
              variant="secondary" size="sm"
              loading={syncStatus.state === 'syncing'}
              onClick={runPull}
              title="Pull latest stock from WooCommerce"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Pull Woo</span>
            </Button>

            {/* Dark mode */}
            <Button variant="ghost" size="sm" onClick={toggleDarkMode} aria-label="Toggle dark mode">
              {isDarkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-500" />}
            </Button>
          </header>

          <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>

        <AdjustModal />
        <ProductDrawer />
      </div>
    </div>
  );
}
