import { useStore } from '../store';
import { KPICards } from '../components/dashboard/KPICards';
import { LowStockPanel } from '../components/dashboard/LowStockPanel';
import { NeedsLaserCutPanel } from '../components/dashboard/NeedsLaserCutPanel';
import { ProductTable } from '../components/products/ProductTable';
import { AlertCircle } from 'lucide-react';

export function Dashboard() {
  const { error } = useStore();

  return (
    <div className="space-y-6 max-w-[1600px]">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Inventory Overview</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Combined WooCommerce + cutting room stock</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <KPICards />
      <NeedsLaserCutPanel />
      <LowStockPanel />

      <div>
        <div className="mb-3">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Products</h2>
        </div>
        <ProductTable />
      </div>
    </div>
  );
}
