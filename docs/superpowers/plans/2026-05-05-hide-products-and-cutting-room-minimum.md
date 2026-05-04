# Hide Products & Cutting Room Minimum — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add product hiding for non-stock items and per-product cutting room minimums that flag products for laser cutting.

**Architecture:** Two new fields on Product (`hidden`, `cutting_room_minimum`), one on AppSettings (`default_cutting_room_minimum`), a server-computed `needs_laser_cut` derived field, a new NeedsLaserCutPanel component, and filter/drawer additions to the existing UI.

**Tech Stack:** React 18, TypeScript, Zustand, Express, Tailwind CSS, Lucide icons

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types/index.ts` | Modify | Add `hidden`, `cutting_room_minimum`, `needs_laser_cut`, `default_cutting_room_minimum` |
| `src/store/index.ts` | Modify | Add filter for laser cut, hidden toggle state, default settings |
| `server.js` | Modify | Compute `needs_laser_cut`, accept new fields, sync default, export/sheets columns |
| `src/components/dashboard/NeedsLaserCutPanel.tsx` | **Create** | Red-themed collapsible panel for products needing laser cut |
| `src/components/products/ProductTable.tsx` | Modify | Laser cut indicator, hidden toggle, "Laser Cut" filter option, hidden row styling |
| `src/pages/Dashboard.tsx` | Modify | Wire NeedsLaserCutPanel above LowStockPanel |
| `src/components/products/ProductDrawer.tsx` | Modify | Hide/unhide toggle, cutting room minimum input |
| `src/pages/Settings.tsx` | Modify | Default cutting room minimum field |

---

### Task 1: Types — add new fields

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add `hidden` and `cutting_room_minimum` to Product, `needs_laser_cut` as optional, and `default_cutting_room_minimum` to AppSettings**

```typescript
// In Product interface, add after `notes`:
  hidden:                boolean;
  cutting_room_minimum:  number;
  needs_laser_cut?:      boolean; // computed by server

// In AppSettings interface, add after `default_threshold`:
  default_cutting_room_minimum: number;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors related to the new fields (may have pre-existing errors in other files; only concerned with types/index.ts)

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add hidden, cutting_room_minimum, and needs_laser_cut to types"
```

---

### Task 2: Server — computeProduct and sync

**Files:**
- Modify: `server.js:53-58` (computeProduct), `server.js:70-82` (PUT endpoint), `server.js:365-416` (sync)

- [ ] **Step 1: Update `computeProduct` to add `needs_laser_cut`**

In `server.js`, replace the `computeProduct` function (lines 53-58):

```js
function computeProduct(p) {
  const combined  = (p.woo_stock ?? 0) + (p.cutting_room_stock ?? 0);
  const threshold = p.low_stock_threshold ?? 5;
  const status    = combined === 0 ? 'out_of_stock' : combined <= threshold ? 'low_stock' : 'in_stock';
  const needs_laser_cut = !p.hidden && (p.cutting_room_stock ?? 0) <= (p.cutting_room_minimum ?? 0);
  return { ...p, combined_stock: combined, status, needs_laser_cut };
}
```

- [ ] **Step 1.5: Strip `needs_laser_cut` from PUT endpoint**

In the PUT `/api/products/:id` handler (around line 78), add `needs_laser_cut` to the computed fields being deleted:

```js
delete updated.combined_stock;
delete updated.status;
delete updated.needs_laser_cut;
```

- [ ] **Step 2: Update sync to set `cutting_room_minimum` on new products**

In the sync endpoint, in the `else` branch where new products are created (around line 388), add `cutting_room_minimum`:

```js
bySkuMap.set(key, {
  id:                uid(),
  woo_product_id:    wp.id,
  name:              wp.name,
  sku:               sku || `NO-SKU-${wp.id}`,
  category,
  woo_stock:         wooStock,
  cutting_room_stock: 0,
  low_stock_threshold: settings.default_threshold ?? 5,
  cutting_room_minimum: settings.default_cutting_room_minimum ?? 0,
  last_synced_at:    syncedAt,
  updated_at:        syncedAt,
  flagged:           !sku,
  notes:             '',
  hidden:            false,
});
```

- [ ] **Step 3: Verify server starts without errors**

Run: `node server.js` (then Ctrl+C after it prints the listening message)
Expected: `PQW Stock Dashboard → http://localhost:3001`

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat: add needs_laser_cut computation and cutting_room_minimum to sync"
```

---

### Task 3: Server — PUT endpoint and exports

**Files:**
- Modify: `server.js:70-82` (PUT products), `server.js:659-668` (CSV export), `server.js:479-505` (sheets push), `server.js:532-609` (sheets pull)

- [ ] **Step 1: CSV export — add Cutting Room Minimum column**

In the CSV export endpoint, update headers and row mapping:

```js
app.get('/api/export/products', (_req, res) => {
  const products = readData('products').map(computeProduct);
  const csv = toCSV(
    ['Name', 'SKU', 'Category', 'Woo Stock', 'Cutting Room', 'Combined', 'Status', 'Threshold', 'Cutting Room Min', 'Hidden', 'Last Synced'],
    products.map(p => [p.name, p.sku, p.category, p.woo_stock, p.cutting_room_stock, p.combined_stock, p.status, p.low_stock_threshold, p.cutting_room_minimum, p.hidden ? 'Yes' : 'No', p.last_synced_at ?? '']),
  );
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=pqw-inventory.csv');
  res.send(csv);
});
```

- [ ] **Step 2: Sheets push — add Cutting Room Minimum column**

Update `SHEET_HEADERS` and the row mapping in `pushAllToSheets`:

```js
const SHEET_HEADERS = [
  'Product Name', 'SKU', 'Category',
  'Woo Stock', 'Cutting Room', 'Combined',
  'Status', 'Threshold', 'Cutting Room Min', 'Hidden', 'Last Updated',
];

// In the rows mapping (inside pushAllToSheets):
const rows = products.map(computeProduct).map(p => [
  p.name, p.sku, p.category,
  p.woo_stock, p.cutting_room_stock, p.combined_stock,
  p.status, p.low_stock_threshold, p.cutting_room_minimum, p.hidden ? 'Yes' : 'No', now,
]);
```

Also update the sheets pull range from `A:I` to `A:K` and the column indices. In the pull endpoint, update the range and add cutting room min import:

```js
// Change range from A:I to A:K
range: `${tabName}!A:K`,
```

After the existing `cuttingCol` logic, add:

```js
const cuttingMinCol = headers.indexOf('Cutting Room Min');
const hiddenCol    = headers.indexOf('Hidden');
```

And in the pull loop, after `const newCutting = sheetMap.get(p.sku);`:

```js
let newCuttingMin = p.cutting_room_minimum;
if (cuttingMinCol !== -1) {
  const row = rows.slice(1).find(r => (r[skuCol] || '').trim() === p.sku);
  if (row) {
    const min = parseInt(row[cuttingMinCol], 10);
    if (!isNaN(min)) newCuttingMin = min;
  }
}
```

And update the product assignment:

```js
products[i] = { ...p, cutting_room_stock: newCutting, cutting_room_minimum: newCuttingMin, updated_at: now };
```

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: add cutting room min and hidden to CSV export and sheets push/pull"
```

---

### Task 4: Store — filter state, hidden toggle, default settings

**Files:**
- Modify: `src/store/index.ts`

- [ ] **Step 1: Add `default_cutting_room_minimum` to DEFAULT_SETTINGS and hidden filter state**

In `src/store/index.ts`, update `DEFAULT_SETTINGS`:

```typescript
const DEFAULT_SETTINGS: AppSettings = {
  woo_url: '', consumer_key: '', consumer_secret: '',
  default_threshold: 5, default_cutting_room_minimum: 0,
  auto_sync_interval: 0,
  sheets_enabled: false, sheets_id: '', sheets_tab: 'Stock', sheets_credentials_json: '',
};
```

Add `showHidden` to the Store interface (in the Table section):

```typescript
showHidden: boolean;
```

Add the setter in the Table actions section of the interface:

```typescript
setShowHidden: (v: boolean) => void;
```

Add the initial value in `create<Store>`:

```typescript
showHidden: false,
```

Add the setter:

```typescript
setShowHidden: (showHidden) => set({ showHidden }),
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add src/store/index.ts
git commit -m "feat: add showHidden state, default_cutting_room_minimum to store"
```

---

### Task 5: NeedsLaserCutPanel component

**Files:**
- Create: `src/components/dashboard/NeedsLaserCutPanel.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/NeedsLaserCutPanel.tsx
git commit -m "feat: add NeedsLaserCutPanel component"
```

---

### Task 6: ProductTable — laser cut indicator, hidden toggle, filter

**Files:**
- Modify: `src/components/products/ProductTable.tsx`

- [ ] **Step 1: Import `Scissors` and `EyeOff` icons, add `showHidden`/`setShowHidden` to store destructuring**

At the top of `ProductTable`, update the lucide import to include `Scissors` and `EyeOff`:

```tsx
import {
  ChevronUp, ChevronDown, ChevronsUpDown, Edit2, Eye, AlertTriangle,
  Search, Filter, Download, Users, X, Scissors, EyeOff,
} from 'lucide-react';
```

In the store destructuring, add `showHidden` and `setShowHidden`:

```tsx
const {
  products, isLoading, filters, sort, page, showHidden,
  setFilters, setSort, setPage, openAdjustModal, openDrawer,
  isBulkMode, selectedIds, toggleSelectedId, clearSelected, toggleBulkMode,
  updateProduct, setShowHidden,
} = useStore();
```

- [ ] **Step 2: Add hidden product filtering and "Laser Cut" to the filter logic**

In the `filtered` useMemo, add the hidden filter (after the category filter) and the laser cut status filter:

```tsx
// After the category filter block:
if (!showHidden) {
  list = list.filter(p => !p.hidden);
}

// Handle "laser_cut" as a status filter option
if (filters.status === 'laser_cut') {
  list = list.filter(p => p.needs_laser_cut);
} else if (filters.status !== 'all') {
  list = list.filter(p => p.status === filters.status);
}
```

- [ ] **Step 3: Add "Laser Cut" to the status dropdown**

In the status filter `<select>`, add the option after the existing options:

```tsx
<option value="laser_cut">Laser Cut</option>
```

- [ ] **Step 4: Add "Hidden" toggle button in the filter bar**

Add after the category filter select, before the `ml-auto` div:

```tsx
<Button
  size="sm"
  variant={showHidden ? 'primary' : 'secondary'}
  onClick={() => setShowHidden(!showHidden)}
>
  <EyeOff className="h-3.5 w-3.5" /> {showHidden ? 'Hidden' : 'Hidden'}
</Button>
```

Actually, use a more explicit label:

```tsx
<Button
  size="sm"
  variant={showHidden ? 'primary' : 'secondary'}
  onClick={() => setShowHidden(!showHidden)}
  title={showHidden ? 'Hide hidden products' : 'Show hidden products'}
>
  <EyeOff className="h-3.5 w-3.5" /> Hidden
</Button>
```

- [ ] **Step 5: Update column count for empty state and add laser cut indicator**

The `colSpan` for the empty state should use a computed value or be updated. The table has 10 columns + 1 in bulk mode. Add a variable at the top of the render:

```tsx
const colSpan = isBulkMode ? 12 : 11;
```

Update the empty state `colSpan`:

```tsx
colSpan={colSpan}
```

Also update the second empty state:

```tsx
colSpan={products.length === 0 ? (isBulkMode ? 12 : 11) : (isBulkMode ? 12 : 11)}
```

Simpler just to use `colSpan`:

```tsx
<td colSpan={colSpan} className="py-16 text-center text-sm text-slate-400">
```

- [ ] **Step 6: Add laser cut indicator and hidden row styling in the table body**

In the product row, next to the existing `flagged` icon, add a laser cut indicator:

```tsx
{product.needs_laser_cut && (
  <span title="Needs laser cutting — cutting room stock at or below minimum">
    <Scissors className="h-3.5 w-3.5 shrink-0 text-red-500" />
  </span>
)}
```

For hidden products, add conditional opacity and replace row actions. On the `<tr>` element, add a conditional class:

```tsx
className={[
  'group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50',
  selectedIds.has(product.id) ? 'bg-brand-50 dark:bg-brand-900/20' : '',
  product.hidden ? 'opacity-50' : '',
].join(' ')}
```

In the actions cell (the last `<td>`), show "Unhide" for hidden products instead of the normal actions:

```tsx
<td className="px-4 py-3">
  {product.hidden ? (
    <Button
      size="xs"
      variant="ghost"
      onClick={async () => {
        const updated = await api.products.update(product.id, { hidden: false } as Partial<Product>);
        updateProduct(updated);
      }}
      title="Unhide product"
    >
      <EyeOff className="h-3.5 w-3.5" /> Unhide
    </Button>
  ) : (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <Button size="xs" variant="ghost" onClick={() => openAdjustModal(product.id)} title="Adjust stock">
        <Edit2 className="h-3.5 w-3.5" />
      </Button>
      <Button size="xs" variant="ghost" onClick={() => openDrawer(product.id)} title="View details">
        <Eye className="h-3.5 w-3.5" />
      </Button>
    </div>
  )}
</td>
```

- [ ] **Step 7: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 8: Commit**

```bash
git add src/components/products/ProductTable.tsx
git commit -m "feat: add laser cut indicator, hidden toggle, and hidden row styling to product table"
```

---

### Task 7: Dashboard — wire NeedsLaserCutPanel

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Import and add NeedsLaserCutPanel**

```tsx
import { NeedsLaserCutPanel } from '../components/dashboard/NeedsLaserCutPanel';
```

Add it between KPICards and LowStockPanel:

```tsx
<KPICards />
<NeedsLaserCutPanel />
<LowStockPanel />
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: wire NeedsLaserCutPanel into Dashboard"
```

---

### Task 8: ProductDrawer — hide toggle and cutting room minimum

**Files:**
- Modify: `src/components/products/ProductDrawer.tsx`

- [ ] **Step 1: Add hide/unhide toggle and cutting room minimum editor**

Add `EyeOff` to the lucide import:

```tsx
import { X, AlertTriangle, Clock, Edit2, Save, EyeOff } from 'lucide-react';
```

Add state for editing cutting room minimum:

```tsx
const [editCuttingMin, setEditCuttingMin] = useState(false);
const [cuttingMin, setCuttingMin]       = useState('');
```

Add save function for cutting room minimum:

```tsx
async function saveCuttingMin() {
  const val = Number(cuttingMin);
  if (isNaN(val) || val < 0) return;
  setSaving(true);
  try {
    const updated = await api.products.update(product!.id, { cutting_room_minimum: val });
    updateProduct(updated);
    setEditCuttingMin(false);
  } finally {
    setSaving(false);
  }
}
```

Add a hide/unhide toggle function:

```tsx
async function toggleHidden() {
  setSaving(true);
  try {
    const updated = await api.products.update(product!.id, { hidden: !product!.hidden });
    updateProduct(updated);
  } finally {
    setSaving(false);
  }
}
```

Add UI: after the "Low Stock Threshold" section, add a "Cutting Room Minimum" section (same pattern):

```tsx
{/* Cutting Room Minimum */}
<div>
  <div className="mb-2 flex items-center justify-between">
    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cutting Room Minimum</h3>
    {!editCuttingMin && (
      <Button size="xs" variant="ghost" onClick={() => { setCuttingMin(String(product.cutting_room_minimum ?? 0)); setEditCuttingMin(true); }}>
        <Edit2 className="h-3 w-3" /> Edit
      </Button>
    )}
  </div>
  {editCuttingMin ? (
    <div className="flex gap-2">
      <input
        type="number" min="0" value={cuttingMin}
        onChange={e => setCuttingMin(e.target.value)}
        className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono dark:border-slate-600 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <Button size="sm" variant="primary" loading={saving} onClick={saveCuttingMin}><Save className="h-3.5 w-3.5" /> Save</Button>
      <Button size="sm" variant="ghost" onClick={() => setEditCuttingMin(false)}>Cancel</Button>
    </div>
  ) : (
    <p className="font-mono text-2xl font-bold text-slate-800 dark:text-slate-100">{product.cutting_room_minimum ?? 0}</p>
  )}
</div>
```

Add hide/unhide toggle after the cutting room minimum section (or after notes):

```tsx
{/* Hide / Unhide */}
<div>
  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Stock Management</h3>
  <button
    onClick={toggleHidden}
    disabled={saving}
    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
      product.hidden
        ? 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800'
        : 'border-brand-300 text-brand-700 bg-brand-50 hover:bg-brand-100 dark:border-brand-700 dark:text-brand-300 dark:bg-brand-900/20'
    }`}
  >
    <EyeOff className="h-4 w-4" />
    {product.hidden ? 'Hidden from dashboard' : 'Visible on dashboard'}
  </button>
  <p className="mt-1 text-xs text-slate-400">
    {product.hidden ? 'This product does not appear in the main product list.' : 'Toggle to hide this product from the dashboard.'}
  </p>
</div>
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add src/components/products/ProductDrawer.tsx
git commit -m "feat: add hide toggle and cutting room minimum editor to product drawer"
```

---

### Task 9: Settings — default cutting room minimum

**Files:**
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Add "Default Cutting Room Minimum" field**

In the "Dashboard Defaults" section, after the "Default Low Stock Threshold" field, add:

```tsx
<Field label="Default Cutting Room Minimum" hint="Applied to new products on first sync. When cutting room stock drops to or below this number, the product is flagged for laser cutting.">
  <input type="number" min="0" value={form.default_cutting_room_minimum ?? 0}
    onChange={e => update('default_cutting_room_minimum', Number(e.target.value))}
    className={`${inputCls} w-32`} />
</Field>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "feat: add default cutting room minimum to settings"
```

---

### Task 10: Final verification

- [ ] **Step 1: Build check**

Run: `npm run build`
Expected: clean build with no errors

- [ ] **Step 2: Start server and spot-check**

Run: `node server.js`
- Open the app, verify the "Needs Laser Cut" panel doesn't show when no products need cutting
- Set a product's cutting room minimum to a high number via the drawer, verify it appears in the panel
- Hide a product via the drawer, verify it disappears from the table
- Click "Hidden" toggle, verify hidden products appear greyed out with "Unhide" action
- Verify "Laser Cut" filter option works in the status dropdown
- Verify settings page shows and saves the new default

- [ ] **Step 3: Commit any final tweaks**
