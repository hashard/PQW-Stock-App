import { useState, useMemo } from 'react';
import { Search, Download, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { useStore } from '../../store';
import { Button } from '../ui/Button';
import { api } from '../../api/client';

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const typeLabel: Record<string, string> = {
  add: 'Add', remove: 'Remove', set: 'Set',
  transfer_to_woo: 'To Woo', woo_edit: 'Woo Edit', sheet_import: 'Sheet Import',
};

function DiffChip({ diff }: { diff: number }) {
  if (diff > 0) return (
    <span className="inline-flex items-center gap-0.5 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
      <ArrowUp className="h-3 w-3" />+{diff}
    </span>
  );
  if (diff < 0) return (
    <span className="inline-flex items-center gap-0.5 font-mono text-xs font-semibold text-red-600 dark:text-red-400">
      <ArrowDown className="h-3 w-3" />{diff}
    </span>
  );
  return <span className="inline-flex items-center gap-0.5 font-mono text-xs text-slate-400"><Minus className="h-3 w-3" />0</span>;
}

export function AdjustmentLog() {
  const { adjustments } = useStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const filtered = useMemo(() => {
    let list = [...adjustments];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a => a.product_name.toLowerCase().includes(q) || a.sku.toLowerCase().includes(q) || a.user_name.toLowerCase().includes(q));
    }
    if (typeFilter !== 'all') list = list.filter(a => a.adjustment_type === typeFilter);
    return list;
  }, [adjustments, search, typeFilter]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search product, SKU, or staff…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
        >
          <option value="all">All types</option>
          <option value="add">Add</option>
          <option value="remove">Remove</option>
          <option value="set">Set</option>
          <option value="transfer_to_woo">Move to Woo</option>
          <option value="woo_edit">Woo Edit</option>
          <option value="sheet_import">Sheet Import</option>
        </select>
        <span className="text-xs text-slate-500">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        <Button size="sm" variant="secondary" onClick={api.export.adjustments} className="ml-auto">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80">
            <tr className="border-b border-slate-200 dark:border-slate-700">
              {['Product', 'SKU', 'Type', 'Change', 'Prev', 'New', 'Reason', 'Staff', 'Time'].map(h => (
                <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center text-sm text-slate-400">
                  {adjustments.length === 0 ? 'No adjustments recorded yet.' : 'No adjustments match your filters.'}
                </td>
              </tr>
            ) : filtered.slice(0, 200).map(a => (
              <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100 max-w-[180px] truncate">{a.product_name}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{a.sku}</td>
                <td className="px-4 py-3">
                  <span className={[
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    a.adjustment_type === 'add'             ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    a.adjustment_type === 'remove'          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    a.adjustment_type === 'transfer_to_woo' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' :
                    a.adjustment_type === 'woo_edit'        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                    a.adjustment_type === 'sheet_import'    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                              'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                  ].join(' ')}>
                    {typeLabel[a.adjustment_type]}
                  </span>
                </td>
                <td className="px-4 py-3"><DiffChip diff={a.quantity_change} /></td>
                <td className="px-4 py-3 font-mono text-slate-500">{a.previous_stock}</td>
                <td className="px-4 py-3 font-mono font-semibold text-slate-800 dark:text-slate-100">{a.new_stock}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={a.reason}>{a.reason}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{a.user_name}</td>
                <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{fmt(a.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
