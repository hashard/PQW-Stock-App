# Panel Editing + Bulk Hide — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add click-to-drawer navigation and bulk editing (including Hide) to the NeedsLaserCut and LowStock dashboard panels, and add a bulk Hide option to the ProductTable.

**Architecture:** Reuse the existing Zustand store's `isBulkMode`/`selectedIds` state across all three components (panels and main table share selection). Each panel gets its own inline bulk bar patterned after ProductTable's. The ProductTable's existing bulk dropdown gets a "Hide" option.

**Tech Stack:** React 18, TypeScript, Zustand, Tailwind CSS, existing `api` client, existing ProductDrawer/AdjustModal

---

### Task 1: Add Click-to-Drawer to NeedsLaserCutPanel

**Files:**
- Modify: `src/components/dashboard/NeedsLaserCutPanel.tsx`

- [ ] **Step 1: Replace `NeedsLaserCutPanel.tsx` with the updated version**

Replace the entire file:

```tsx
import { useState } from 'react';
import { Scissors, ChevronDown, ChevronUp, Edit2 } from 'lucide-react';
import { useStore } from '../../store';
import { StatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';

export function NeedsLaserCutPanel() {
  const { products, openAdjustModal, openDrawer } = useStore();
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
                <tr
                  key={p.id}
                  onClick={() => openDrawer(p.id)}
                  className="border-b border-red-100 last:border-0 dark:border-red-800/20 cursor-pointer hover:bg-red-100/50 dark:hover:bg-red-900/20"
                >
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
```

Only changes from original:
1. Added `openDrawer` to `useStore()` destructuring.
2. Added `onClick={() => openDrawer(p.id)}` to each `<tr>` with `cursor-pointer` and hover styling.
3. Wrapped Adjust button's `onClick` with `e.stopPropagation()` so it doesn't trigger the drawer.

- [ ] **Step 2: Verify build compiles**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/NeedsLaserCutPanel.tsx
git commit -m "feat: add click-to-drawer navigation in NeedsLaserCutPanel"
```

---

### Task 2: Add Click-to-Drawer to LowStockPanel

**Files:**
- Modify: `src/components/dashboard/LowStockPanel.tsx`

- [ ] **Step 1: Replace `LowStockPanel.tsx` with the updated version**

Replace the entire file:

```tsx
import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Edit2 } from 'lucide-react';
import { useStore } from '../../store';
import { StatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';

export function LowStockPanel() {
  const { products, openAdjustModal, openDrawer } = useStore();
  const [collapsed, setCollapsed] = useState(false);

  const flagged = products
    .filter(p => !p.hidden && (p.status === 'low_stock' || p.status === 'out_of_stock'))
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
                <tr
                  key={p.id}
                  onClick={() => openDrawer(p.id)}
                  className="border-b border-amber-100 last:border-0 dark:border-amber-800/20 cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/20"
                >
                  <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]">{p.name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{p.sku}</td>
                  <td className="px-4 py-2 font-mono font-bold text-slate-800 dark:text-slate-200">{p.combined_stock}</td>
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
```

Only changes from original:
1. Added `openDrawer` to `useStore()` destructuring.
2. Added `onClick={() => openDrawer(p.id)}` to each `<tr>` with `cursor-pointer` and hover styling.
3. Wrapped Adjust button's `onClick` with `e.stopPropagation()`.

- [ ] **Step 2: Verify build compiles**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/LowStockPanel.tsx
git commit -m "feat: add click-to-drawer navigation in LowStockPanel"
```

---

### Task 3: Add Bulk Hide to ProductTable

**Files:**
- Modify: `src/components/products/ProductTable.tsx`

- [ ] **Step 1: Change `bulkType` state to include `'hide'`**

Line 70, change:

```
const [bulkType,   setBulkType]   = useState<'add' | 'remove' | 'set'>('add');
```

To:

```
const [bulkType,   setBulkType]   = useState<'add' | 'remove' | 'set' | 'hide'>('add');
```

- [ ] **Step 2: Add the "Hide" option to the bulk type dropdown**

Lines 272-277, change the `<select>` from:

```tsx
<select value={bulkType} onChange={e => setBulkType(e.target.value as typeof bulkType)}
  className="h-8 rounded border border-brand-300 bg-white px-2 text-xs dark:border-brand-700 dark:bg-slate-800 dark:text-white">
  <option value="add">Add</option>
  <option value="remove">Remove</option>
  <option value="set">Set to</option>
</select>
```

To:

```tsx
<select value={bulkType} onChange={e => setBulkType(e.target.value as typeof bulkType)}
  className="h-8 rounded border border-brand-300 bg-white px-2 text-xs dark:border-brand-700 dark:bg-slate-800 dark:text-white">
  <option value="add">Add</option>
  <option value="remove">Remove</option>
  <option value="set">Set to</option>
  <option value="hide">Hide</option>
</select>
```

- [ ] **Step 3: Conditionally hide quantity/reason when bulkType is 'hide'**

Lines 278-283, change the quantity and reason inputs from:

```tsx
<input type="number" min="0" placeholder="Qty" value={bulkQty} onChange={e => setBulkQty(e.target.value)}
  className="h-8 w-20 rounded border border-blue-300 bg-white px-2 text-xs font-mono dark:border-blue-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
<input type="text" placeholder="Staff name" value={bulkUser} onChange={e => setBulkUser(e.target.value)}
  className="h-8 w-28 rounded border border-brand-300 bg-white px-2 text-xs dark:border-brand-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
<input type="text" placeholder="Reason (required)" value={bulkReason} onChange={e => setBulkReason(e.target.value)}
  className="h-8 flex-1 min-w-[140px] rounded border border-brand-300 bg-white px-2 text-xs dark:border-brand-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
```

To:

```tsx
{bulkType !== 'hide' && (
  <input type="number" min="0" placeholder="Qty" value={bulkQty} onChange={e => setBulkQty(e.target.value)}
    className="h-8 w-20 rounded border border-blue-300 bg-white px-2 text-xs font-mono dark:border-blue-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
)}
<input type="text" placeholder="Staff name" value={bulkUser} onChange={e => setBulkUser(e.target.value)}
  className="h-8 w-28 rounded border border-brand-300 bg-white px-2 text-xs dark:border-brand-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
{bulkType !== 'hide' && (
  <input type="text" placeholder="Reason (required)" value={bulkReason} onChange={e => setBulkReason(e.target.value)}
    className="h-8 flex-1 min-w-[140px] rounded border border-brand-300 bg-white px-2 text-xs dark:border-brand-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
)}
{bulkType === 'hide' && (
  <span className="text-xs text-slate-500">Hide selected products from dashboard</span>
)}
```

- [ ] **Step 4: Update `applyBulk` to handle the 'hide' action**

Lines 124-143, replace the `applyBulk` function from:

```tsx
async function applyBulk() {
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
```

To:

```tsx
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
```

- [ ] **Step 5: Update Apply button disabled condition**

Line 285, change:

```tsx
disabled={!bulkQty || !bulkReason.trim() || !bulkUser.trim()}
```

To:

```tsx
disabled={bulkType === 'hide' ? !bulkUser.trim() : !bulkQty || !bulkReason.trim() || !bulkUser.trim()}
```

- [ ] **Step 6: Verify build compiles**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/products/ProductTable.tsx
git commit -m "feat: add bulk Hide action to ProductTable"
```

---

### Task 4: Add Bulk Mode to NeedsLaserCutPanel

**Files:**
- Modify: `src/components/dashboard/NeedsLaserCutPanel.tsx`

- [ ] **Step 1: Replace `NeedsLaserCutPanel.tsx` with bulk mode version**

Replace the entire file:

```tsx
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
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={(e) => { e.stopPropagation(); toggleSelectedId(p.id); }}
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
```

- [ ] **Step 2: Verify build compiles**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/NeedsLaserCutPanel.tsx
git commit -m "feat: add bulk mode (including Hide) to NeedsLaserCutPanel"
```

---

### Task 5: Add Bulk Mode to LowStockPanel

**Files:**
- Modify: `src/components/dashboard/LowStockPanel.tsx`

- [ ] **Step 1: Replace `LowStockPanel.tsx` with bulk mode version**

Replace the entire file:

```tsx
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
    .filter(p => !p.hidden && (p.status === 'low_stock' || p.status === 'out_of_stock'))
    .sort((a, b) => a.combined_stock - b.combined_stock);

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
                {['Product', 'SKU', 'Combined', 'Threshold', 'Status', ''].map(h => (
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
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={(e) => { e.stopPropagation(); toggleSelectedId(p.id); }}
                        className="h-4 w-4 rounded border-slate-300 text-amber-600"
                      />
                    </td>
                  )}
                  <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]">{p.name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{p.sku}</td>
                  <td className="px-4 py-2 font-mono font-bold text-slate-800 dark:text-slate-200">{p.combined_stock}</td>
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
```

- [ ] **Step 2: Verify build compiles**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Final commit**

```bash
git add src/components/dashboard/LowStockPanel.tsx
git commit -m "feat: add bulk mode (including Hide) to LowStockPanel"
```
