import { Package, ShoppingCart, Scissors, Layers, AlertTriangle, XCircle } from 'lucide-react';
import { useStore } from '../../store';
import { SkeletonCard } from '../ui/Skeleton';

interface KPI {
  label: string;
  value: number | string;
  icon:  React.ReactNode;
  color: string;
  bg:    string;
  note?: string;
}

export function KPICards() {
  const { products, isLoading } = useStore();

  if (isLoading && products.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  const visible      = products.filter(p => !p.hidden);
  const totalWoo      = visible.reduce((s, p) => s + (p.woo_stock ?? 0), 0);
  const totalCutting  = visible.reduce((s, p) => s + (p.cutting_room_stock ?? 0), 0);
  const totalCombined = visible.reduce((s, p) => s + (p.combined_stock ?? 0), 0);
  const lowCount      = visible.filter(p => p.status === 'low_stock').length;
  const outCount      = visible.filter(p => p.status === 'out_of_stock').length;

  const kpis: KPI[] = [
    {
      label: 'Total SKUs',
      value: visible.length.toLocaleString(),
      icon:  <Package className="h-5 w-5" />,
      color: 'text-brand-600 dark:text-brand-400',
      bg:    'bg-brand-50 dark:bg-brand-900/20',
    },
    {
      label: 'WooCommerce Stock',
      value: totalWoo.toLocaleString(),
      icon:  <ShoppingCart className="h-5 w-5" />,
      color: 'text-teal-600 dark:text-teal-400',
      bg:    'bg-teal-50 dark:bg-teal-900/20',
      note:  'from WooCommerce',
    },
    {
      label: 'Cutting Room Stock',
      value: totalCutting.toLocaleString(),
      icon:  <Scissors className="h-5 w-5" />,
      color: 'text-brand-500 dark:text-brand-300',
      bg:    'bg-brand-50 dark:bg-brand-900/20',
      note:  'manually tracked',
    },
    {
      label: 'Total Combined',
      value: totalCombined.toLocaleString(),
      icon:  <Layers className="h-5 w-5" />,
      color: 'text-teal-600 dark:text-teal-400',
      bg:    'bg-teal-50 dark:bg-teal-900/20',
      note:  'Woo + cutting room',
    },
    {
      label: 'Low Stock',
      value: lowCount,
      icon:  <AlertTriangle className="h-5 w-5" />,
      color: lowCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400',
      bg:    lowCount > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-slate-50 dark:bg-slate-800',
      note:  'needs attention',
    },
    {
      label: 'Out of Stock',
      value: outCount,
      icon:  <XCircle className="h-5 w-5" />,
      color: outCount > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400',
      bg:    outCount > 0 ? 'bg-rose-50 dark:bg-rose-900/20' : 'bg-slate-50 dark:bg-slate-800',
      note:  'zero combined stock',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
      {kpis.map(k => (
        <div
          key={k.label}
          className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800"
        >
          <div className={`mb-3 inline-flex rounded-lg p-2 ${k.bg}`}>
            <span className={k.color}>{k.icon}</span>
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{k.label}</p>
          <p className={`mt-0.5 font-mono text-2xl font-bold ${k.color}`}>{k.value}</p>
          {k.note && <p className="mt-1 text-xs text-slate-400">{k.note}</p>}
        </div>
      ))}
    </div>
  );
}
