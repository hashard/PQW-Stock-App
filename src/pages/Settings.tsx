import { useState, useEffect } from 'react';
import {
  Save, Eye, EyeOff, CheckCircle, AlertCircle, Sheet, ExternalLink,
  ArrowDownToLine, ArrowUpFromLine, Upload, Download, Loader2, Smartphone, Copy,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useStore } from '../store';
import { api } from '../api/client';
import { useSync } from '../hooks/useSync';
import { Button } from '../components/ui/Button';

export function Settings() {
  const { settings, setSettings, syncStatus, sheetsStatus, setSheetsStatus, setProducts, setAdjustments } = useStore();
  const { runPull, runPush } = useSync();

  const [form, setForm]             = useState(settings);
  const [saving, setSaving]         = useState(false);
  const [showKey, setShowKey]       = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [saved, setSaved]           = useState(false);
  const [err, setErr]               = useState('');

  const [pushingSheet, setPushingSheet]           = useState(false);
  const [pullingSheet, setPullingSheet]           = useState(false);
  const [testingSheets, setTestingSheets]         = useState(false);
  const [sheetsTestResult, setSheetsTestResult]   = useState<{ ok: boolean; message: string } | null>(null);
  const [localUrl, setLocalUrl]                   = useState('');
  const [urlCopied, setUrlCopied]                 = useState(false);

  useEffect(() => { setForm(settings); }, [settings]);

  useEffect(() => {
    api.localUrl().then(r => setLocalUrl(r.url)).catch(() => {});
  }, []);

  const sheetsEnabled = settings.sheets_enabled && settings.sheets_id && settings.sheets_credentials_json;

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

  async function handleTestSheets() {
    setTestingSheets(true);
    setSheetsTestResult(null);
    try {
      await api.settings.update(form);
      const result = await api.sheets.test();
      setSheetsTestResult({ ok: true, message: `Connected — sheet: "${result.title}"` });
    } catch (e) {
      setSheetsTestResult({ ok: false, message: e instanceof Error ? e.message : 'Connection failed' });
    } finally {
      setTestingSheets(false);
    }
  }

  const inputCls = 'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white';

  const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      {hint && <p className="mb-1.5 text-xs text-slate-500">{hint}</p>}
      {children}
    </div>
  );

  const SyncAction = ({
    icon, title, description, buttonLabel, buttonVariant = 'secondary', onClick, loading, danger,
  }: {
    icon: React.ReactNode; title: string; description: string; buttonLabel: string;
    buttonVariant?: 'primary' | 'secondary' | 'danger'; onClick: () => void; loading?: boolean; danger?: boolean;
  }) => (
    <div className={`flex items-center justify-between gap-4 rounded-lg border p-4 ${
      danger
        ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10'
        : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 rounded-lg p-2 ${danger ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400'}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
        </div>
      </div>
      <Button variant={buttonVariant} size="sm" loading={loading} onClick={onClick} className="shrink-0">
        {buttonLabel}
      </Button>
    </div>
  );

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Sync controls, WooCommerce, Google Sheets, and dashboard defaults</p>
      </div>

      {/* ── Sync & Transfer ──────────────────────────────────────────────── */}
      <section className="rounded-xl border-2 border-brand-200 bg-white p-5 dark:border-brand-800 dark:bg-slate-800 space-y-3">
        <div>
          <h2 className="text-sm font-bold text-brand-700 dark:text-brand-300 uppercase tracking-wider">Sync &amp; Transfer</h2>
          <p className="text-xs text-slate-500 mt-0.5">Use these carefully — they read from or write to live systems.</p>
        </div>

        {/* Woo */}
        <SyncAction
          icon={<ArrowDownToLine className="h-4 w-4" />}
          title="Pull from WooCommerce"
          description="Fetch latest stock levels from your WooCommerce store into the dashboard."
          buttonLabel="Pull Woo"
          loading={syncStatus.state === 'syncing'}
          onClick={runPull}
        />
        <SyncAction
          icon={<ArrowUpFromLine className="h-4 w-4" />}
          title="Push to WooCommerce"
          description="Send all current WooCommerce stock values from the dashboard back to the live store."
          buttonLabel="Push Woo"
          loading={syncStatus.state === 'syncing'}
          onClick={() => { if (confirm('Push all local WooCommerce stock values to the live store?')) runPush(); }}
          danger
        />

        {/* Sync feedback */}
        {syncStatus.state === 'success' && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <CheckCircle className="h-3.5 w-3.5 shrink-0" /> {syncStatus.message}
          </div>
        )}
        {syncStatus.state === 'error' && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {syncStatus.message}
          </div>
        )}
        {syncStatus.state === 'syncing' && (
          <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> {syncStatus.message}
          </div>
        )}

        {/* Sheets — only shown when configured */}
        {sheetsEnabled && (
          <>
            <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-1" />
            <SyncAction
              icon={<Download className="h-4 w-4" />}
              title="Pull from Google Sheet"
              description="Import cutting room stock values from the sheet. Overwrites current cutting room values."
              buttonLabel="Pull Sheet"
              loading={pullingSheet}
              onClick={handleSheetsPull}
              danger
            />
            <SyncAction
              icon={<Upload className="h-4 w-4" />}
              title="Push to Google Sheet"
              description="Export all current stock levels to the Google Sheet."
              buttonLabel="Push Sheet"
              loading={pushingSheet}
              onClick={handleSheetsPush}
            />
            {sheetsStatus.state === 'ok' && (
              <div className="flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                <CheckCircle className="h-3.5 w-3.5 shrink-0" /> {sheetsStatus.message}
              </div>
            )}
            {sheetsStatus.state === 'error' && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {sheetsStatus.message}
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Mobile Access QR Code ────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center gap-2 mb-4">
          <Smartphone className="h-4 w-4 text-brand-500" />
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Mobile Access</h2>
        </div>

        {localUrl ? (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* QR code */}
            <div className="shrink-0 rounded-xl border border-slate-200 dark:border-slate-600 bg-white p-3">
              <QRCodeSVG
                value={localUrl}
                size={160}
                fgColor="#1E1240"
                bgColor="#ffffff"
                level="M"
              />
            </div>

            {/* Instructions */}
            <div className="space-y-3 text-center sm:text-left">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Scan with your phone's camera to open the dashboard on any device connected to the same Wi-Fi network.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs font-mono text-slate-700 dark:text-slate-300 truncate">
                  {localUrl}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(localUrl);
                    setUrlCopied(true);
                    setTimeout(() => setUrlCopied(false), 2000);
                  }}
                  className="shrink-0 rounded-lg border border-slate-200 dark:border-slate-600 p-1.5 text-slate-500 hover:text-brand-600 hover:border-brand-300 transition-colors"
                  title="Copy URL"
                >
                  {urlCopied ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Make sure this PC and your phone are on the same network. The server must be running.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Detecting local network address…
          </div>
        )}
      </section>

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
              <Sheet className="h-4 w-4 text-teal-600" />
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Google Sheets Sync</h2>
            </div>
            <button
              type="button"
              onClick={() => update('sheets_enabled', !form.sheets_enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${form.sheets_enabled ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.sheets_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {form.sheets_enabled && (
            <>
              <Field label="Google Sheet ID" hint="The long ID from your sheet URL: docs.google.com/spreadsheets/d/[THIS PART]/edit">
                <input type="text" value={form.sheets_id ?? ''} onChange={e => update('sheets_id', e.target.value)}
                  placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" className={`${inputCls} font-mono text-xs`} />
              </Field>

              <Field label="Sheet Tab Name" hint='Name of the tab inside the spreadsheet (default: "Stock")'>
                <input type="text" value={form.sheets_tab ?? 'Stock'} onChange={e => update('sheets_tab', e.target.value)}
                  placeholder="Stock" className={`${inputCls} w-40`} />
              </Field>

              <Field label="Service Account Credentials (JSON)" hint="Paste the full contents of your service account key file below.">
                <textarea
                  rows={6}
                  value={form.sheets_credentials_json ?? ''}
                  onChange={e => update('sheets_credentials_json', e.target.value)}
                  placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  ...\n}'}
                  className={`${inputCls} font-mono text-xs resize-none`}
                />
              </Field>

              <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-400 space-y-1.5">
                <p className="font-semibold">Setup steps:</p>
                <p>1. Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-brand-600 underline inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink className="h-3 w-3" /></a></p>
                <p>2. Create a project → Enable <strong>Google Sheets API</strong></p>
                <p>3. Go to <strong>IAM & Admin → Service Accounts</strong> → Create a service account</p>
                <p>4. Create a key (JSON type) → download → paste its contents above</p>
                <p>5. Share your Google Sheet with the service account email as <strong>Editor</strong></p>
              </div>

              {sheetsTestResult && (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${sheetsTestResult.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
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

          <Field label="Default Cutting Room Minimum" hint="Applied to new products on first sync. When cutting room stock drops to or below this number, the product is flagged for laser cutting.">
            <input type="number" min="0" value={form.default_cutting_room_minimum ?? 0}
              onChange={e => update('default_cutting_room_minimum', Number(e.target.value))}
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

        <Button type="submit" variant="primary" loading={saving}>
          <Save className="h-4 w-4" /> Save Settings
        </Button>
      </form>
    </div>
  );
}
