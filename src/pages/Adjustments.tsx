import { AdjustmentLog } from '../components/adjustments/AdjustmentLog';

export function Adjustments() {
  return (
    <div className="space-y-4 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Adjustment History</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Full audit trail of all cutting room stock changes
        </p>
      </div>
      <AdjustmentLog />
    </div>
  );
}
