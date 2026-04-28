import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  RefreshCw, CheckCircle, AlertCircle, Moon, Sun, Loader2, Menu, X,
} from 'lucide-react';
import { Sidebar } from './Sidebar';
import { AdjustModal } from '../products/AdjustModal';
import { ProductDrawer } from '../products/ProductDrawer';
import { useStore } from '../../store';
import { useSync } from '../../hooks/useSync';
import { Button } from '../ui/Button';

function SyncBadge() {
  const { syncStatus } = useStore();
  const { state, last_synced_at, message, synced_count } = syncStatus;

  if (state === 'idle') return null;

  const cfg = {
    syncing: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, color: 'text-blue-600 dark:text-blue-400',    label: message || 'Syncing…' },
    success: { icon: <CheckCircle className="h-3.5 w-3.5" />,          color: 'text-emerald-600 dark:text-emerald-400', label: `Synced ${synced_count} products` },
    error:   { icon: <AlertCircle className="h-3.5 w-3.5" />,          color: 'text-red-600 dark:text-red-400',         label: message || 'Sync failed' },
  }[state];

  return (
    <span className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
      {state === 'success' && last_synced_at && (
        <span className="text-slate-400">· {new Date(last_synced_at).toLocaleTimeString()}</span>
      )}
    </span>
  );
}

export function Layout() {
  const { isDarkMode, toggleDarkMode, syncStatus } = useStore();
  const { runSync } = useSync();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="flex h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">

        {/* Mobile sidebar overlay */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-30 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
            <div className="absolute left-0 top-0 h-full">
              <Sidebar />
            </div>
          </div>
        )}

        {/* Desktop sidebar */}
        <div className="hidden lg:flex">
          <Sidebar />
        </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col min-w-0">

          {/* Top header */}
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-900 gap-3">
            {/* Mobile menu btn */}
            <Button
              variant="ghost" size="sm"
              className="lg:hidden"
              onClick={() => setMobileSidebarOpen(v => !v)}
            >
              {mobileSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            <div className="flex-1" />

            {/* Sync status */}
            <SyncBadge />

            {/* Sync now button */}
            <Button
              variant="secondary"
              size="sm"
              loading={syncStatus.state === 'syncing'}
              onClick={runSync}
              title="Sync from WooCommerce"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sync Now</span>
            </Button>

            {/* Dark mode toggle */}
            <Button variant="ghost" size="sm" onClick={toggleDarkMode} aria-label="Toggle dark mode">
              {isDarkMode
                ? <Sun  className="h-4 w-4 text-amber-400" />
                : <Moon className="h-4 w-4 text-slate-500" />}
            </Button>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>

        {/* Modals & drawers (rendered outside main for correct stacking) */}
        <AdjustModal />
        <ProductDrawer />
      </div>
    </div>
  );
}
