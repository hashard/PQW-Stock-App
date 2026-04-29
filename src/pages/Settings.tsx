import { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, RefreshCw, CheckCircle, AlertCircle, Sheet, ExternalLink } from 'lucide-react';
import { useStore } from '../store';
import { api } from '../api/client';
import { useSync } from '../hooks/useSync';
import { Button } from '../components/ui/Button';

export function Settings() {
  const { settings, setSettings, syncStatus } = useStore();
  const { runSync } = useSync();

  const [form, setForm]             = useState(settings);
  const [saving, setSaving]         = useState(false);
  const [showKey, setShowKey]       = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [saved, setSaved]           = useState(false);
  const [err, setErr]               = useState('');

  const [testingSheets, setTestingSheets] = useState(false);
  const [sheetsTestResult, setSheetsTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => { setForm(settings); }, [settings]);

  function update(k: keyof typeof form, v: string | number | boolean) {
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

  async function handleTestSheets() {
    setTestingSheets(true);
    setSheetsTestResult(null);
    try {
      // Save first so the server has the latest credentials
      await api.settings.update(form);
      const result = await api.sheets.test();
      setSheetsTestResult({ ok: true, message: `Connected — sheet: "${result.title}"` });
    } catch (e) {
      setSheetsTestResult({ ok: false, message: e instanceof Error ? e.message : 'Connection failed' });
    } finally {
      setTestingSheets(false);
    }
  }

  const inputCls = 'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white';

  const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      {hint && <p className="mb-1.5 text-xs text-slate-500">{hint}</p>}
      {children}
    </div>
  );

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Configure WooCommerce, Google Sheets, and dashboard defaults</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* ── WooCommerce ────────────────────────────────────────────────── */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800 space-y-4">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">WooCommerce API</h2>

          <Field label="Store URL" hint="Your WordPress site URL, e.g. https://yourstore.com">
            <input type="url" value={form.woo_url} onChange={e => update('woo_url', e.target.value)}
              placeholder="https://yourstore.com" className={inputCls} />
          </Field>

          <Field label="Consumer Key" hint="WooCommerce → Settings → Advanced → REST API">
            <div className="relative">
              <input type={showKey ? 'text' : 'password'} value={form.consumer_key}
                onChange={e => update('consumer_key', e.target.value)}
                placeholder="ck_xxxxxxxxxxxx" className={`${inputCls} pr-10 font-mono`} />
              <button type="button" onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <Field label="Consumer Secret">
            <div className="relative">
              <input type={showSecret ? 'text' : 'password'} value={form.consumer_secret}
                onChange={e => update('consumer_secret', e.target.value)}
                placeholder="cs_xxxxxxxxxxxx" className={`${inputCls} pr-10 font-mono`} />
              <button type="button" onClick={() => setShowSecret(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
        </section>

        {/* ── Google Sheets ──────────────────────────────────────────────── */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sheet className="h-4 w-4 text-green-600" />
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Google Sheets Sync</h2>
            </div>
            {/* Enable toggle */}
            <button
              type="button"
              onClick={() => update('sheets_enabled', !form.sheets_enabled)}
              className={[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                form.sheets_enabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600',
              ].join(' ')}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.sheets_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {form.sheets_enabled && (
            <>
              <div className="rounded-lg bg-green-50 px-4 py-3 text-xs text-green-800 dark:bg-green-900/20 dark:text-green-300 space-y-1">
                <p className="font-semibold">How it works:</p>
                <p>• Every stock change automatically updates the sheet in the background</p>
                <p>• Use <strong>Push Sheet</strong> in the header to force a full sync</p>
                <p>• Use <strong>Pull Sheet</strong> to import cutting room values from the sheet</p>
              </div>

              <Field label="Google Sheet ID" hint="The long ID from your sheet URL: docs.google.com/spreadsheets/d/[THIS PART]/edit">
                <input type="text" value={form.sheets_id ?? ''} onChange={e => update('sheets_id', e.target.value)}
                  placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" className={`${inputCls} font-mono text-xs`} />
              </Field>

              <Field label="Sheet Tab Name" hint='Name of the tab inside the spreadsheet (default: "Stock")'>
                <input type="text" value={form.sheets_tab ?? 'Stock'} onChange={e => update('sheets_tab', e.target.value)}
                  placeholder="Stock" className={`${inputCls} w-40`} />
              </Field>

              <Field
                label="Service Account Credentials (JSON)"
                hint="Paste the full contents of your service account key file below."
              >
                <textarea
                  rows={6}
                  value={form.sheets_credentials_json ?? ''}
                  onChange={e => update('sheets_credentials_json', e.target.value)}
                  placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  "private_key": "...",\n  ...\n}'}
                  className={`${inputCls} font-mono text-xs resize-none`}
                />
              </Field>

              <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-400 space-y-1.5">
                <p className="font-semibold">Setup steps:</p>
                <p>1. Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-blue-600 underline inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink className="h-3 w-3" /></a></p>
                <p>2. Create a project → Enable <strong>Google Sheets API</strong></p>
                <p>3. Go to <strong>IAM & Admin → Service Accounts</strong> → Create a service account</p>
                <p>4. Create a key (JSON type) → download the file → paste its contents above</p>
                <p>5. Copy the service account email (e.g. <em>name@project.iam.gserviceaccount.com</em>)</p>
                <p>6. Open your Google Sheet → Share → paste the email → give <strong>Editor</strong> access</p>
              </div>

              {sheetsTestResult && (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  sheetsTestResult.ok
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {sheetsTestResult.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  {sheetsTestResult.message}
                </div>
              )}

              <Button type="button" variant="secondary" size="sm" loading={testingSheets} onClick={handleTestSheets}>
                <Sheet className="h-3.5 w-3.5" /> Test Connection
              </Button>
            </>
          )}
        </section>

        {/* ── Defaults ───────────────────────────────────────────────────── */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800 space-y-4">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Dashboard Defaults</h2>

          <Field label="Default Low Stock Threshold" hint="Applied to new products on first sync.">
            <input type="number" min="0" value={form.default_threshold}
              onChange={e => update('default_threshold', Number(e.target.value))}
              className={`${inputCls} w-32`} />
          </Field>

          <Field label="Auto-Sync Interval (minutes)" hint="Set to 0 to disable. Recommended: 30 or 60.">
            <input type="number" min="0" value={form.auto_sync_interval}
              onChange={e => update('auto_sync_interval', Number(e.target.value))}
              className={`${inputCls} w-32`} />
          </Field>
        </section>

        {err && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" /> {err}
          </div>
        )}
        {saved && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <CheckCircle className="h-4 w-4 shrink-0" /> Settings saved.
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" variant="primary" loading={saving}>
            <Save className="h-4 w-4" /> Save Settings
          </Button>
          <Button type="button" variant="secondary" loading={syncStatus.state === 'syncing'} onClick={runSync}>
            <RefreshCw className="h-4 w-4" /> Test Woo Sync
          </Button>
        </div>

        {syncStatus.state === 'error' && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" /> {syncStatus.message}
          </div>
        )}
        {syncStatus.state === 'success' && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <CheckCircle className="h-4 w-4 shrink-0" /> Sync succeeded — {syncStatus.synced_count} products loaded.
          </div>
        )}
      </form>
    </div>
  );
}
