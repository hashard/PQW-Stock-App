import { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useStore } from '../store';
import { api } from '../api/client';
import { useSync } from '../hooks/useSync';
import { Button } from '../components/ui/Button';

export function Settings() {
  const { settings, setSettings, syncStatus } = useStore();
  const { runSync } = useSync();

  const [form, setForm] = useState(settings);
  const [saving, setSaving]         = useState(false);
  const [showKey, setShowKey]       = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [saved, setSaved]           = useState(false);
  const [err, setErr]               = useState('');

  useEffect(() => { setForm(settings); }, [settings]);

  function update(k: keyof typeof form, v: string | number) {
    setForm(f => ({ ...f, [k]: v }));
    setSaved(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      const updated = await api.settings.update(form);
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      {hint && <p className="mb-1.5 text-xs text-slate-500">{hint}</p>}
      {children}
    </div>
  );

  const inputCls = 'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white';

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Configure your WooCommerce connection and dashboard defaults</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* WooCommerce */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800 space-y-4">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">WooCommerce API</h2>

          <Field label="Store URL" hint="Your WordPress site URL, e.g. https://yourstore.com">
            <input
              type="url"
              value={form.woo_url}
              onChange={e => update('woo_url', e.target.value)}
              placeholder="https://yourstore.com"
              className={inputCls}
            />
          </Field>

          <Field label="Consumer Key" hint="Found in WooCommerce → Settings → Advanced → REST API">
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={form.consumer_key}
                onChange={e => update('consumer_key', e.target.value)}
                placeholder="ck_xxxxxxxxxxxx"
                className={`${inputCls} pr-10 font-mono`}
              />
              <button type="button" onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <Field label="Consumer Secret">
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={form.consumer_secret}
                onChange={e => update('consumer_secret', e.target.value)}
                placeholder="cs_xxxxxxxxxxxx"
                className={`${inputCls} pr-10 font-mono`}
              />
              <button type="button" onClick={() => setShowSecret(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-400 space-y-1">
            <p className="font-medium">How to get API keys:</p>
            <p>1. In WordPress, go to <strong>WooCommerce → Settings → Advanced → REST API</strong></p>
            <p>2. Click <strong>Add key</strong>, set permissions to <strong>Read</strong></p>
            <p>3. Copy the Consumer Key and Secret above</p>
          </div>
        </section>

        {/* Defaults */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800 space-y-4">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Dashboard Defaults</h2>

          <Field label="Default Low Stock Threshold" hint="Applied to new products on first sync. Can be overridden per product.">
            <input
              type="number" min="0"
              value={form.default_threshold}
              onChange={e => update('default_threshold', Number(e.target.value))}
              className={`${inputCls} w-32`}
            />
          </Field>

          <Field label="Auto-Sync Interval (minutes)" hint="Set to 0 to disable auto-sync. Recommended: 30 or 60.">
            <input
              type="number" min="0"
              value={form.auto_sync_interval}
              onChange={e => update('auto_sync_interval', Number(e.target.value))}
              className={`${inputCls} w-32`}
            />
          </Field>
        </section>

        {err && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" /> {err}
          </div>
        )}

        {saved && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <CheckCircle className="h-4 w-4 shrink-0" /> Settings saved successfully.
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" variant="primary" loading={saving}>
            <Save className="h-4 w-4" /> Save Settings
          </Button>
          <Button
            type="button" variant="secondary"
            loading={syncStatus.state === 'syncing'}
            onClick={runSync}
            title="Save settings first, then sync"
          >
            <RefreshCw className="h-4 w-4" /> Test Sync
          </Button>
        </div>

        {syncStatus.state === 'error' && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" /> {syncStatus.message}
          </div>
        )}
        {syncStatus.state === 'success' && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <CheckCircle className="h-4 w-4 shrink-0" />
            Sync succeeded — {syncStatus.synced_count} products loaded from WooCommerce.
          </div>
        )}
      </form>
    </div>
  );
}
