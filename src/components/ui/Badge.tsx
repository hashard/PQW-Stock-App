import type { StockStatus } from '../../types';

interface BadgeProps { status: StockStatus; }

const cfg: Record<StockStatus, { dot: string; pill: string; label: string }> = {
  in_stock:     { dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-800',  label: 'In Stock' },
  low_stock:    { dot: 'bg-amber-500',   pill: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-800',             label: 'Low Stock' },
  out_of_stock: { dot: 'bg-red-500',     pill: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-800',                          label: 'Out of Stock' },
};

export function StatusBadge({ status }: BadgeProps) {
  const c = cfg[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${c.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
