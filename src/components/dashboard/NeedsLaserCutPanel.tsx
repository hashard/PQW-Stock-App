import { useState } from 'react';
import { Scissors, ChevronDown, ChevronUp, Edit2, Users, X } from 'lucide-react';
import { useStore } from '../../store';
import { StatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { api } from '../../api/client';
import type { Product } from '../../types';

export function NeedsLaserCutPanel() {
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

  const needsCut = products
    .filter(p => p.needs_laser_cut)
    .sort((a, b) => a.cutting_room_stock - b.cutting_room_stock);

  if (needsCut.length === 0) return null;

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
    <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-900/10">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="flex flex-1 items-center gap-2.5 px-5 py-3.5 text-left"
        >
          <Scissors className="h-4 w-4 text-red-600 dark:text-red-400" />
          <span className="text-sm font-semibold text-red-800 dark:text-red-300">
            {needsCut.length} product{needsCut.length !== 1 ? 's' : ''} need laser cutting
          </span>
        </button>
        <div className="flex items-center gap-1 pr-3">
          <Button size="sm" variant={isBulkMode ? 'primary' : 'secondary'} onClick={toggleBulkMode}>
            <Users className="h-3.5 w-3.5" /> {isBulkMode ? 'Exit' : 'Select'}
          </Button>
          {collapsed
            ? <ChevronDown className="h-4 w-4 text-red-600 mr-2" />
            : <ChevronUp   className="h-4 w-4 text-red-600 mr-2" />}
        </div>
      </div>

      {!collapsed && (
        <div className="border-t border-red-200 dark:border-red-800/40">
          {isBulkMode && selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-red-200 dark:border-red-800/40 bg-red-100/50 dark:bg-red-900/10 px-4 py-2.5">
              <span className="text-sm font-medium text-red-700 dark:text-red-300">{selectedIds.size} selected</span>
              <select value={bulkType} onChange={e => setBulkType(e.target.value as typeof bulkType)}
                className="h-8 rounded border border-red-300 bg-white px-2 text-xs dark:border-red-700 dark:bg-slate-800 dark:text-white">
                <option value="add">Add</option>
                <option value="remove">Remove</option>
                <option value="set">Set to</option>
                <option value="hide">Hide</option>
              </select>
              {bulkType !== 'hide' && (
                <input type="number" min="0" placeholder="Qty" value={bulkQty} onChange={e => setBulkQty(e.target.value)}
                  className="h-8 w-20 rounded border border-red-300 bg-white px-2 text-xs font-mono dark:border-red-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500" />
              )}
              <input type="text" placeholder="Staff name" value={bulkUser} onChange={e => setBulkUser(e.target.value)}
                className="h-8 w-28 rounded border border-red-300 bg-white px-2 text-xs dark:border-red-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500" />
              {bulkType !== 'hide' && (
                <input type="text" placeholder="Reason (required)" value={bulkReason} onChange={e => setBulkReason(e.target.value)}
                  className="h-8 flex-1 min-w-[140px] rounded border border-red-300 bg-white px-2 text-xs dark:border-red-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500" />
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
              <tr className="border-b border-red-200 dark:border-red-800/40">
                {isBulkMode && <th className="w-10 px-4 py-2" />}
                {['Product', 'SKU', 'Cutting Room', 'Minimum', 'Combined', ''].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-red-700 dark:text-red-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {needsCut.map(p => (
                <tr
                  key={p.id}
                  onClick={() => openDrawer(p.id)}
                  className={[
                    'border-b border-red-100 last:border-0 dark:border-red-800/20 cursor-pointer hover:bg-red-100/50 dark:hover:bg-red-900/20',
                    selectedIds.has(p.id) ? 'bg-red-100 dark:bg-red-900/30' : '',
                  ].join(' ')}
                >
                  {isBulkMode && (
                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleSelectedId(p.id)}
                        className="h-4 w-4 rounded border-slate-300 text-red-600"
                      />
                    </td>
                  )}
                  <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]">{p.name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{p.sku}</td>
                  <td className="px-4 py-2 font-mono font-bold text-red-700 dark:text-red-400">{p.cutting_room_stock}</td>
                  <td className="px-4 py-2 font-mono text-slate-500">{p.cutting_room_minimum}</td>
                  <td className="px-4 py-2 font-mono text-slate-600 dark:text-slate-400">{p.combined_stock}</td>
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
