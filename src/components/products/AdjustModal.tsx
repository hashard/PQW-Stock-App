import { useState } from 'react';
import { Minus, Plus, Hash } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useStore } from '../../store';
import { api } from '../../api/client';
import type { AdjustmentType } from '../../types';

export function AdjustModal() {
  const { adjustProductId, products, closeAdjustModal, updateProduct, addAdjustment } = useStore();

  const product = products.find(p => p.id === adjustProductId);

  const [type, setType]       = useState<AdjustmentType>('add');
  const [qty, setQty]         = useState('');
  const [reason, setReason]   = useState('');
  const [user, setUser]       = useState(() => localStorage.getItem('pqw_last_user') ?? '');
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');

  function reset() {
    setType('add'); setQty(''); setReason(''); setErr('');
  }

  function handleClose() {
    reset();
    closeAdjustModal();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');

    const quantity = Number(qty);
    if (!qty || isNaN(quantity) || quantity < 0) { setErr('Enter a valid quantity (≥ 0).'); return; }
    if (!reason.trim()) { setErr('Reason is required.'); return; }
    if (!user.trim())   { setErr('Staff name is required.'); return; }

    setLoading(true);
    try {
      const result = await api.adjustments.create({
        product_id:      product!.id,
        adjustment_type: type,
        quantity,
        reason:          reason.trim(),
        user_name:       user.trim(),
      });
      localStorage.setItem('pqw_last_user', user.trim());
      updateProduct(result.product);
      addAdjustment(result.adjustment);
      handleClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save adjustment.');
    } finally {
      setLoading(false);
    }
  }

  const typeOptions: { value: AdjustmentType; label: string; icon: React.ReactNode; color: string }[] = [
    { value: 'add',    label: 'Add',    icon: <Plus  className="h-4 w-4" />, color: 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
    { value: 'remove', label: 'Remove', icon: <Minus className="h-4 w-4" />, color: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    { value: 'set',    label: 'Set to', icon: <Hash  className="h-4 w-4" />, color: 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  ];

  const preview = () => {
    if (!product) return null;
    const q = Number(qty) || 0;
    const prev = product.cutting_room_stock;
    let next: number;
    if (type === 'add')    next = prev + q;
    else if (type === 'remove') next = Math.max(0, prev - q);
    else next = Math.max(0, q);
    const diff = next - prev;
    return { prev, next, diff };
  };
  const p = preview();

  return (
    <Modal open={!!adjustProductId} onClose={handleClose} title="Adjust Cutting Room Stock">
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

          {/* Adjustment type */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Adjustment Type</label>
            <div className="flex gap-2">
              {typeOptions.map(o => (
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

          {/* Quantity */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Quantity{type === 'set' ? ' (new absolute value)' : ''}
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={qty}
              onChange={e => setQty(e.target.value)}
              placeholder="0"
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
            {p && qty && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Cutting room: <span className="font-mono font-medium">{p.prev}</span>
                {' → '}
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">{p.next}</span>
                <span className={`ml-1 font-mono ${p.diff > 0 ? 'text-emerald-600' : p.diff < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                  ({p.diff > 0 ? '+' : ''}{p.diff})
                </span>
              </p>
            )}
          </div>

          {/* Staff name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Staff Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={user}
              onChange={e => setUser(e.target.value)}
              placeholder="Your name"
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Reason / Note <span className="text-red-500">*</span></label>
            <textarea
              rows={2}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Received new shipment, Used in order #1234…"
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white resize-none"
            />
          </div>

          {err && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">{err}</p>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>Cancel</Button>
            <Button type="submit" variant="primary" className="flex-1" loading={loading}>Save Adjustment</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
