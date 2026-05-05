import { useState } from 'react';
import { Scissors, ChevronDown, ChevronUp, Edit2 } from 'lucide-react';
import { useStore } from '../../store';
import { StatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';

export function NeedsLaserCutPanel() {
  const { products, openAdjustModal } = useStore();
  const [collapsed, setCollapsed] = useState(false);

  const needsCut = products
    .filter(p => p.needs_laser_cut)
    .sort((a, b) => a.cutting_room_stock - b.cutting_room_stock);

  if (needsCut.length === 0) return null;

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-900/10">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
      >
        <div className="flex items-center gap-2.5">
          <Scissors className="h-4 w-4 text-red-600 dark:text-red-400" />
          <span className="text-sm font-semibold text-red-800 dark:text-red-300">
            {needsCut.length} product{needsCut.length !== 1 ? 's' : ''} need laser cutting
          </span>
        </div>
        {collapsed
          ? <ChevronDown className="h-4 w-4 text-red-600" />
          : <ChevronUp   className="h-4 w-4 text-red-600" />}
      </button>

      {!collapsed && (
        <div className="border-t border-red-200 dark:border-red-800/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-red-200 dark:border-red-800/40">
                {['Product', 'SKU', 'Cutting Room', 'Minimum', 'Combined', ''].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-red-700 dark:text-red-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {needsCut.map(p => (
                <tr key={p.id} className="border-b border-red-100 last:border-0 dark:border-red-800/20">
                  <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]">{p.name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{p.sku}</td>
                  <td className="px-4 py-2 font-mono font-bold text-red-700 dark:text-red-400">{p.cutting_room_stock}</td>
                  <td className="px-4 py-2 font-mono text-slate-500">{p.cutting_room_minimum}</td>
                  <td className="px-4 py-2 font-mono text-slate-600 dark:text-slate-400">{p.combined_stock}</td>
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
