import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Edit2, Users, X } from 'lucide-react';
import { useStore } from '../../store';
import { StatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { api } from '../../api/client';
import type { Product } from '../../types';

export function LowStockPanel() {
  const {
    products, openAdjustModal, openDrawer,
    isBulkMode, selectedIds, toggleSelectedId, clearSelected, toggleBulkMode,
    updateProduct,
  } = useStore();
  const [collapsed, setCollapsed] = useState(false);
  const [bulkUser,   setBulkUser]   = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkQty,    setBulkQty]    = useState('');
  const [bulkType,   setBulkType]   = useState<'add' | 'remove' | 'set' | 'hide'>('add');
  const [bulkLoading,setBulkLoading]= useState(false);

  const flagged = products
    .filter(p => !p.hidden && (
      p.status === 'low_stock' || p.status === 'out_of_stock' ||
      (p.low_stock_threshold > 0 && p.woo_stock <= p.low_stock_threshold) ||
      p.woo_stock <= 0
    ))
    .sort((a, b) => a.woo_stock - b.woo_stock);

  if (flagged.length === 0) return null;

  async function applyBulk() {
    if (bulkType === 'hide') {
      if (!bulkUser.trim()) return;
      setBulkLoading(true);
      try {
        for (const id of selectedIds) {
          const updated = await api.products.update(id, { hidden: true } as Partial<Product>);
          updateProduct(updated);
        }
        clearSelected();
      } finally {
        setBulkLoading(false);
      }
      return;
    }
    if (!bulkQty || !bulkReason.trim() || !bulkUser.trim()) return;
    setBulkLoading(true);
    try {
      for (const id of selectedIds) {
        const res = await api.adjustments.create({
          product_id:      id,
          adjustment_type: bulkType,
          quantity:        Number(bulkQty),
          reason:          bulkReason.trim(),
          user_name:       bulkUser.trim(),
        });
        updateProduct(res.product);
        useStore.getState().addAdjustment(res.adjustment);
      }
      clearSelected();
      setBulkQty(''); setBulkReason('');
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="flex flex-1 items-center gap-2.5 px-5 py-3.5 text-left"
        >
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            {flagged.length} product{flagged.length !== 1 ? 's' : ''} need attention
          </span>
        </button>
        <div className="flex items-center gap-1 pr-3">
          <Button size="sm" variant={isBulkMode ? 'primary' : 'secondary'} onClick={toggleBulkMode}>
            <Users className="h-3.5 w-3.5" /> {isBulkMode ? 'Exit' : 'Select'}
          </Button>
          {collapsed
            ? <ChevronDown className="h-4 w-4 text-amber-600 mr-2" />
            : <ChevronUp   className="h-4 w-4 text-amber-600 mr-2" />}
        </div>
      </div>

      {!collapsed && (
        <div className="border-t border-amber-200 dark:border-amber-800/40">
          {isBulkMode && selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-amber-200 dark:border-amber-800/40 bg-amber-100/50 dark:bg-amber-900/10 px-4 py-2.5">
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">{selectedIds.size} selected</span>
              <select value={bulkType} onChange={e => setBulkType(e.target.value as typeof bulkType)}
                className="h-8 rounded border border-amber-300 bg-white px-2 text-xs dark:border-amber-700 dark:bg-slate-800 dark:text-white">
                <option value="add">Add</option>
                <option value="remove">Remove</option>
                <option value="set">Set to</option>
                <option value="hide">Hide</option>
              </select>
              {bulkType !== 'hide' && (
                <input type="number" min="0" placeholder="Qty" value={bulkQty} onChange={e => setBulkQty(e.target.value)}
                  className="h-8 w-20 rounded border border-amber-300 bg-white px-2 text-xs font-mono dark:border-amber-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500" />
              )}
              <input type="text" placeholder="Staff name" value={bulkUser} onChange={e => setBulkUser(e.target.value)}
                className="h-8 w-28 rounded border border-amber-300 bg-white px-2 text-xs dark:border-amber-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500" />
              {bulkType !== 'hide' && (
                <input type="text" placeholder="Reason (required)" value={bulkReason} onChange={e => setBulkReason(e.target.value)}
                  className="h-8 flex-1 min-w-[140px] rounded border border-amber-300 bg-white px-2 text-xs dark:border-amber-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500" />
              )}
              {bulkType === 'hide' && (
                <span className="text-xs text-slate-500">Hide selected products from dashboard</span>
              )}
              <Button size="xs" variant="primary" loading={bulkLoading}
                disabled={bulkType === 'hide' ? !bulkUser.trim() : !bulkQty || !bulkReason.trim() || !bulkUser.trim()}
                onClick={applyBulk}>Apply</Button>
              <Button size="xs" variant="ghost" onClick={clearSelected}><X className="h-3 w-3" /></Button>
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-amber-200 dark:border-amber-800/40">
                {isBulkMode && <th className="w-10 px-4 py-2" />}
                {['Product', 'SKU', 'Woo Stock', 'Threshold', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-amber-700 dark:text-amber-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flagged.map(p => (
                <tr
                  key={p.id}
                  onClick={() => openDrawer(p.id)}
                  className={[
                    'border-b border-amber-100 last:border-0 dark:border-amber-800/20 cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/20',
                    selectedIds.has(p.id) ? 'bg-amber-100 dark:bg-amber-900/30' : '',
                  ].join(' ')}
                >
                  {isBulkMode && (
                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleSelectedId(p.id)}
                        className="h-4 w-4 rounded border-slate-300 text-amber-600"
                      />
                    </td>
                  )}
                  <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]">{p.name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{p.sku}</td>
                  <td className="px-4 py-2 font-mono font-bold text-slate-800 dark:text-slate-200">{p.woo_stock}</td>
                  <td className="px-4 py-2 font-mono text-slate-500">{p.low_stock_threshold}</td>
                  <td className="px-4 py-2"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-2">
                    <Button size="xs" variant="ghost" onClick={(e: React.MouseEvent) => { e.stopPropagation(); openAdjustModal(p.id); }}>
                      <Edit2 className="h-3 w-3" /> Adjust
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
