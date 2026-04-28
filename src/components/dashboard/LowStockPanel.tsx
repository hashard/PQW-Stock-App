import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Edit2 } from 'lucide-react';
import { useStore } from '../../store';
import { StatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';

export function LowStockPanel() {
  const { products, openAdjustModal } = useStore();
  const [collapsed, setCollapsed] = useState(false);

  const flagged = products
    .filter(p => p.status === 'low_stock' || p.status === 'out_of_stock')
    .sort((a, b) => a.combined_stock - b.combined_stock);

  if (flagged.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
      >
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            {flagged.length} product{flagged.length !== 1 ? 's' : ''} need attention
          </span>
        </div>
        {collapsed
          ? <ChevronDown className="h-4 w-4 text-amber-600" />
          : <ChevronUp   className="h-4 w-4 text-amber-600" />}
      </button>

      {!collapsed && (
        <div className="border-t border-amber-200 dark:border-amber-800/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-amber-200 dark:border-amber-800/40">
                {['Product', 'SKU', 'Combined', 'Threshold', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-amber-700 dark:text-amber-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flagged.map(p => (
                <tr key={p.id} className="border-b border-amber-100 last:border-0 dark:border-amber-800/20">
                  <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]">{p.name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{p.sku}</td>
                  <td className="px-4 py-2 font-mono font-bold text-slate-800 dark:text-slate-200">{p.combined_stock}</td>
                  <td className="px-4 py-2 font-mono text-slate-500">{p.low_stock_threshold}</td>
                  <td className="px-4 py-2"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-2">
                    <Button size="xs" variant="ghost" onClick={() => openAdjustModal(p.id)}>
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
