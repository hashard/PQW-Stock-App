import { useState } from 'react';
import { X, AlertTriangle, Clock, Edit2, Save } from 'lucide-react';
import { useStore } from '../../store';
import { StatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Toggle } from '../ui/Toggle';
import { api } from '../../api/client';

function timeAgo(iso: string | null) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function ProductDrawer() {
  const { drawerProductId, products, adjustments, closeDrawer, updateProduct, openAdjustModal } = useStore();
  const product = products.find(p => p.id === drawerProductId);

  const [editThreshold, setEditThreshold] = useState(false);
  const [threshold, setThreshold]         = useState('');
  const [editNotes, setEditNotes]         = useState(false);
  const [notes, setNotes]                 = useState('');
  const [saving, setSaving]               = useState(false);
  const [editCuttingMin, setEditCuttingMin] = useState(false);
  const [cuttingMin, setCuttingMin]         = useState('');

  if (!product) return null;

  const productAdj = adjustments
    .filter(a => a.product_id === product.id)
    .slice(0, 10);

  async function saveThreshold() {
    const val = Number(threshold);
    if (isNaN(val) || val < 0) return;
    setSaving(true);
    try {
      const updated = await api.products.update(product!.id, { low_stock_threshold: val });
      updateProduct(updated);
      setEditThreshold(false);
    } finally {
      setSaving(false);
    }
  }

  async function saveNotes() {
    setSaving(true);
    try {
      const updated = await api.products.update(product!.id, { notes });
      updateProduct(updated);
      setEditNotes(false);
    } finally {
      setSaving(false);
    }
  }

  async function saveCuttingMin() {
    const val = Number(cuttingMin);
    if (isNaN(val) || val < 0) return;
    setSaving(true);
    try {
      const updated = await api.products.update(product!.id, { cutting_room_minimum: val });
      updateProduct(updated);
      setEditCuttingMin(false);
    } finally {
      setSaving(false);
    }
  }

  async function toggleHidden() {
    setSaving(true);
    try {
      const updated = await api.products.update(product!.id, { hidden: !product!.hidden });
      updateProduct(updated);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={closeDrawer} />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {product.flagged && <span title="Missing or duplicate SKU"><AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" /></span>}
              <h2 className="truncate text-base font-semibold text-slate-900 dark:text-white">{product.name}</h2>
            </div>
            <p className="font-mono text-xs text-slate-500">{product.sku}</p>
          </div>
          <button onClick={closeDrawer} className="ml-3 shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

          {/* Stock overview */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Stock Overview</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'WooCommerce', value: product.woo_stock, note: 'read-only' },
                { label: 'Cutting Room', value: product.cutting_room_stock, note: 'editable' },
                { label: 'Combined', value: product.combined_stock, note: 'total', bold: true },
              ].map(s => (
                <div key={s.label} className="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-800">
                  <p className="text-xs text-slate-500">{s.label}</p>
                  <p className={`font-mono text-xl font-bold ${s.bold ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-100'}`}>{s.value}</p>
                  <p className="text-xs text-slate-400">{s.note}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Status & meta */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Details</h3>
            <dl className="space-y-2 text-sm">
              {[
                { label: 'Status', value: <StatusBadge status={product.status} /> },
                { label: 'Category', value: product.category },
                { label: 'Last Synced', value: timeAgo(product.last_synced_at) },
                { label: 'Last Updated', value: timeAgo(product.updated_at) },
                { label: 'Flagged', value: product.flagged ? 'Yes — missing SKU' : 'No' },
              ].map(d => (
                <div key={d.label} className="flex justify-between">
                  <dt className="text-slate-500">{d.label}</dt>
                  <dd className="font-medium text-slate-800 dark:text-slate-200">{d.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Threshold */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Low Stock Threshold</h3>
              {!editThreshold && (
                <Button size="xs" variant="ghost" onClick={() => { setThreshold(String(product.low_stock_threshold)); setEditThreshold(true); }}>
                  <Edit2 className="h-3 w-3" /> Edit
                </Button>
              )}
            </div>
            {editThreshold ? (
              <div className="flex gap-2">
                <input
                  type="number" min="0" value={threshold}
                  onChange={e => setThreshold(e.target.value)}
                  className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono dark:border-slate-600 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <Button size="sm" variant="primary" loading={saving} onClick={saveThreshold}><Save className="h-3.5 w-3.5" /> Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditThreshold(false)}>Cancel</Button>
              </div>
            ) : (
              <p className="font-mono text-2xl font-bold text-slate-800 dark:text-slate-100">{product.low_stock_threshold}</p>
            )}
          </div>

          {/* Cutting Room Minimum */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cutting Room Minimum</h3>
              {!editCuttingMin && (
                <Button size="xs" variant="ghost" onClick={() => { setCuttingMin(String(product.cutting_room_minimum ?? 0)); setEditCuttingMin(true); }}>
                  <Edit2 className="h-3 w-3" /> Edit
                </Button>
              )}
            </div>
            {editCuttingMin ? (
              <div className="flex gap-2">
                <input
                  type="number" min="0" value={cuttingMin}
                  onChange={e => setCuttingMin(e.target.value)}
                  className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono dark:border-slate-600 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <Button size="sm" variant="primary" loading={saving} onClick={saveCuttingMin}><Save className="h-3.5 w-3.5" /> Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditCuttingMin(false)}>Cancel</Button>
              </div>
            ) : (
              <p className="font-mono text-2xl font-bold text-slate-800 dark:text-slate-100">{product.cutting_room_minimum ?? 0}</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</h3>
              {!editNotes && (
                <Button size="xs" variant="ghost" onClick={() => { setNotes(product.notes ?? ''); setEditNotes(true); }}>
                  <Edit2 className="h-3 w-3" /> Edit
                </Button>
              )}
            </div>
            {editNotes ? (
              <div className="space-y-2">
                <textarea
                  rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="primary" loading={saving} onClick={saveNotes}><Save className="h-3.5 w-3.5" /> Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditNotes(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                {product.notes || <span className="italic text-slate-400">No notes</span>}
              </p>
            )}
          </div>

          {/* Hide / Unhide */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Visibility</h3>
            <Toggle
              checked={!product.hidden}
              onChange={() => toggleHidden()}
              disabled={saving}
              label={product.hidden ? 'Hidden from dashboard' : 'Visible on dashboard'}
              description="Hidden products don't appear in the main list. Use for discontinued or irrelevant items."
            />
          </div>

          {/* Recent adjustments */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Recent Adjustments</h3>
            {productAdj.length === 0 ? (
              <p className="text-sm italic text-slate-400">No adjustments recorded.</p>
            ) : (
              <div className="space-y-2">
                {productAdj.map(a => (
                  <div key={a.id} className="rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-slate-800">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${a.quantity_change > 0 ? 'text-emerald-600' : a.quantity_change < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                        {a.quantity_change > 0 ? '+' : ''}{a.quantity_change} cutting room
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />{timeAgo(a.created_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 truncate">{a.reason}</p>
                    <p className="text-xs text-slate-400">{a.user_name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-4 dark:border-slate-700">
          <Button
            variant="primary"
            className="w-full"
            onClick={() => { closeDrawer(); openAdjustModal(product.id); }}
          >
            <Edit2 className="h-4 w-4" /> Adjust Cutting Room Stock
          </Button>
        </div>
      </aside>
    </>
  );
}
