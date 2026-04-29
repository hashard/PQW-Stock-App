import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  CheckCircle, AlertCircle, Moon, Sun, Loader2, Menu, X, Sheet,
} from 'lucide-react';
import { Sidebar } from './Sidebar';
import { AdjustModal } from '../products/AdjustModal';
import { ProductDrawer } from '../products/ProductDrawer';
import { useStore } from '../../store';
import { Button } from '../ui/Button';

function SyncBadge() {
  const { syncStatus } = useStore();
  const { state, last_synced_at, message, synced_count } = syncStatus;
  if (state === 'idle') return null;

  const cfg = {
    syncing: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, color: 'text-brand-600 dark:text-brand-400',    label: message || 'Syncing…' },
    success: { icon: <CheckCircle className="h-3.5 w-3.5" />,          color: 'text-emerald-600 dark:text-emerald-400', label: `${synced_count} products synced` },
    error:   { icon: <AlertCircle className="h-3.5 w-3.5" />,          color: 'text-red-600 dark:text-red-400',         label: message || 'Sync failed' },
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
    busy:  { icon: <Loader2    className="h-3.5 w-3.5 animate-spin" />, color: 'text-teal-600 dark:text-teal-400',      label: message || 'Updating sheet…' },
    ok:    { icon: <CheckCircle className="h-3.5 w-3.5" />,             color: 'text-teal-600 dark:text-teal-400',      label: message },
    error: { icon: <AlertCircle className="h-3.5 w-3.5" />,             color: 'text-red-600 dark:text-red-400',        label: message },
  }[state];

  if (!cfg) return null;

  return (
    <span className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
      <Sheet className="h-3.5 w-3.5" />{cfg.icon}{cfg.label}
    </span>
  );
}

export function Layout() {
  const { isDarkMode, toggleDarkMode } = useStore();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
