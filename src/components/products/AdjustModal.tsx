import { useState } from 'react';
import { Minus, Plus, Hash, ArrowRightLeft, ShoppingCart } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useStore } from '../../store';
import { api } from '../../api/client';
import type { AdjustmentType } from '../../types';

type Mode = 'adjust' | 'transfer' | 'woo';
type SubType = 'add' | 'remove' | 'set';

export function AdjustModal() {
  const { adjustProductId, products, closeAdjustModal, updateProduct, addAdjustment } = useStore();
  const product = products.find(p => p.id === adjustProductId);

  const [mode, setMode]       = useState<Mode>('adjust');
  const [type, setType]       = useState<SubType>('add');
  const [qty, setQty]         = useState('');
  const [reason, setReason]   = useState('');
  const [user, setUser]       = useState(() => localStorage.getItem('pqw_last_user') ?? '');
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');

  function reset() {
    setMode('adjust'); setType('add'); setQty(''); setReason(''); setErr('');
  }

  function handleClose() { reset(); closeAdjustModal(); }

  function switchMode(m: Mode) { setMode(m); setQty(''); setErr(''); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');

    const quantity = Number(qty);
    if (!qty || isNaN(quantity) || quantity < 0) { setErr('Enter a valid quantity (≥ 0).'); return; }
    if (!reason.trim()) { setErr('Reason is required.'); return; }
    if (!user.trim())   { setErr('Staff name is required.'); return; }

    if (mode === 'transfer' && quantity > (product?.cutting_room_stock ?? 0)) {
      setErr(`Not enough cutting room stock. Available: ${product?.cutting_room_stock ?? 0}`);
      return;
    }

    setLoading(true);
    try {
      let result;

      if (mode === 'transfer') {
        result = await api.transfer.run({ product_id: product!.id, quantity, reason: reason.trim(), user_name: user.trim() });
      } else if (mode === 'woo') {
        result = await api.wooStock.adjust({ product_id: product!.id, adjustment_type: type, quantity, reason: reason.trim(), user_name: user.trim() });
      } else {
        result = await api.adjustments.create({ product_id: product!.id, adjustment_type: type as AdjustmentType, quantity, reason: reason.trim(), user_name: user.trim() });
      }

      localStorage.setItem('pqw_last_user', user.trim());
      updateProduct(result.product);
      addAdjustment(result.adjustment);
      handleClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setLoading(false);
    }
  }

  const subTypeOptions: { value: SubType; label: string; icon: React.ReactNode; color: string }[] = [
    { value: 'add',    label: 'Add',    icon: <Plus  className="h-4 w-4" />, color: 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
    { value: 'remove', label: 'Remove', icon: <Minus className="h-4 w-4" />, color: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    { value: 'set',    label: 'Set to', icon: <Hash  className="h-4 w-4" />, color: 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  ];

  // Live preview
  const preview = () => {
    if (!product) return null;
    const q = Number(qty) || 0;

    if (mode === 'transfer') {
      return {
        rows: [
          { label: 'Cutting room', prev: product.cutting_room_stock, next: product.cutting_room_stock - q, color: 'red' },
          { label: 'WooCommerce',  prev: product.woo_stock,          next: product.woo_stock + q,          color: 'green' },
        ],
        footer: { label: 'Combined (unchanged)', value: product.combined_stock },
      };
    }

    if (mode === 'woo') {
      const prev = product.woo_stock;
      const next = type === 'add' ? prev + q : type === 'remove' ? Math.max(0, prev - q) : q;
      return {
        rows: [{ label: 'WooCommerce', prev, next, color: next > prev ? 'green' : next < prev ? 'red' : 'none' }],
        footer: null,
      };
    }

    // adjust mode
    const prev = product.cutting_room_stock;
    const next = type === 'add' ? prev + q : type === 'remove' ? Math.max(0, prev - q) : q;
    return {
      rows: [{ label: 'Cutting room', prev, next, color: next > prev ? 'green' : next < prev ? 'red' : 'none' }],
      footer: null,
    };
  };
  const pv = preview();

  const noWooId = !product?.woo_product_id;

  return (
    <Modal open={!!adjustProductId} onClose={handleClose} title="Manage Stock">
      {product && (
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Product info */}
          <div className="rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{product.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{product.sku}</p>
            <div className="mt-2 flex gap-4 text-xs text-slate-600 dark:text-slate-400">
              <span>Woo: <strong className="font-mono">{product.woo_stock}</strong></span>
              <span>Cutting room: <strong className="font-mono">{product.cutting_room_stock}</strong></span>
              <span>Combined: <strong className="font-mono">{product.combined_stock}</strong></span>
            </div>
          </div>

          {/* Mode tabs */}
          <div className="flex rounded-lg border border-slate-200 p-1 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 gap-1">
            {([
              { key: 'adjust',   label: 'Cutting Room',  icon: null },
              { key: 'transfer', label: 'Move to Woo',   icon: <ArrowRightLeft className="h-3.5 w-3.5" /> },
              { key: 'woo',      label: 'Edit Woo Stock', icon: <ShoppingCart   className="h-3.5 w-3.5" /> },
            ] as { key: Mode; label: string; icon: React.ReactNode }[]).map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => switchMode(tab.key)}
                className={[
                  'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all',
                  mode === tab.key
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
                ].join(' ')}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {/* Mode info banners */}
          {mode === 'transfer' && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300 space-y-1">
              <p className="font-semibold">Moves stock from cutting room → WooCommerce</p>
              <p>Cutting room decreases · WooCommerce increases · Combined total stays the same.</p>
              <p>Updates local values only — use <strong>Push Woo</strong> in Settings to sync to the live store.</p>
            </div>
          )}
          {mode === 'woo' && (
            <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-xs text-violet-700 dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-300 space-y-1">
              <p className="font-semibold">Edits WooCommerce stock value</p>
              <p>Updates local values only — use <strong>Push Woo</strong> in Settings to sync changes to the live store.</p>
            </div>
          )}

          {/* Sub-type selector (adjust + woo modes) */}
          {(mode === 'adjust' || mode === 'woo') && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Type</label>
              <div className="flex gap-2">
                {subTypeOptions.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setType(o.value)}
                    className={[
                      'flex flex-1 items-center justify-center gap-1.5 rounded-lg border-2 py-2 text-sm font-medium transition-all',
                      type === o.value ? o.color : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400',
                    ].join(' ')}
                  >
                    {o.icon} {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              {mode === 'transfer' ? 'Quantity to move' : type === 'set' ? 'New absolute value' : 'Quantity'}
            </label>
            <input
              type="number" min="0"
              max={mode === 'transfer' ? product.cutting_room_stock : undefined}
              step="1"
              value={qty}
              onChange={e => setQty(e.target.value)}
              placeholder="0"
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />

            {/* Preview */}
            {pv && qty && Number(qty) > 0 && (
              <div className="mt-2 rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs space-y-1">
                {pv.rows.map(row => (
                  <div key={row.label} className="flex justify-between">
                    <span className="text-slate-500">{row.label}</span>
                    <span>
                      <span className="font-mono">{row.prev}</span>
                      <span className="text-slate-400 mx-1">→</span>
                      <span className={`font-mono font-semibold ${
                        row.color === 'green' ? 'text-emerald-600 dark:text-emerald-400' :
                        row.color === 'red'   ? 'text-red-600 dark:text-red-400' :
                                                'text-slate-800 dark:text-slate-100'
                      }`}>{row.next}</span>
                      <span className={`font-mono ml-1 ${
                        row.next - row.prev > 0 ? 'text-emerald-500' :
                        row.next - row.prev < 0 ? 'text-red-500' : 'text-slate-400'
                      }`}>
                        ({row.next - row.prev > 0 ? '+' : ''}{row.next - row.prev})
                      </span>
                    </span>
                  </div>
                ))}
                {pv.footer && (
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1 mt-1">
                    <span className="text-slate-500">{pv.footer.label}</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{pv.footer.value}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Staff name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Staff Name <span className="text-red-500">*</span></label>
            <input
              type="text" value={user} onChange={e => setUser(e.target.value)} placeholder="Your name"
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Reason / Note <span className="text-red-500">*</span></label>
            <textarea
              rows={2} value={reason} onChange={e => setReason(e.target.value)}
              placeholder={
                mode === 'transfer' ? 'e.g. Moving to website for online orders…' :
                mode === 'woo'      ? 'e.g. Correcting stock count after stock take…' :
                                     'e.g. Received new shipment, used in order #1234…'
              }
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white resize-none"
            />
          </div>

          {err && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">{err}</p>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>Cancel</Button>
            <Button
              type="submit" variant="primary" className="flex-1" loading={loading}
              disabled={false}
            >
              {mode === 'transfer' ? <><ArrowRightLeft className="h-4 w-4" /> Move to WooCommerce</> :
               mode === 'woo'      ? <><ShoppingCart   className="h-4 w-4" /> Update Woo Stock</> :
                                     'Save Adjustment'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
