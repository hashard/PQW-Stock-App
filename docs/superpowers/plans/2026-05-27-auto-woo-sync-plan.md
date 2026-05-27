# Auto Woo Sync Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement task-by-task.

**Goal:** Add `auto_woo_enabled` toggle that auto-pushes local stock changes to WooCommerce and auto-pulls WC stock on the existing `auto_sync_interval` timer.

**Architecture:** New boolean setting gates all automatic WooCommerce sync. Push is immediate on local change; pull uses existing timer. Google Sheets unaffected.

**Tech Stack:** Electron + Express + React/Vite + Zustand

---

## File Map

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `auto_woo_enabled: boolean` to `AppSettings` |
| `src/store/index.ts` | Add to `DEFAULT_SETTINGS` |
| `src/pages/Settings.tsx` | Add toggle UI in Stock Adjustment Behaviour section |
| `src/hooks/useInitialData.ts` | Modify auto-sync effect to also push to WC |
| `server.js` | Add `autoWooPush()` helper; call after `/api/adjustments`, `/api/woo-stock`, `/api/transfer` |

---

## Task 1: Add `auto_woo_enabled` to AppSettings type

**Files:**
- Modify: `src/types/index.ts:39-52`

**Steps:**

- [ ] **Step 1: Add field to AppSettings interface**

```typescript
export interface AppSettings {
  // ... existing fields ...
  auto_woo_enabled: boolean; // NEW
}
```

---

## Task 2: Add to DEFAULT_SETTINGS in store

**Files:**
- Modify: `src/store/index.ts:6-12`

**Steps:**

- [ ] **Step 1: Add `auto_woo_enabled: false` to DEFAULT_SETTINGS**

```typescript
const DEFAULT_SETTINGS: AppSettings = {
  // ... existing fields ...
  auto_woo_enabled: false,
};
```

---

## Task 3: Add toggle UI to Settings page

**Files:**
- Modify: `src/pages/Settings.tsx:435-454`

**Steps:**

- [ ] **Step 1: Add Auto Woo toggle after the `woo_push_instant` Toggle**

In the **Stock Adjustment Behaviour** section, after the `woo_push_instant` toggle:

```tsx
<div className="border-t border-slate-100 dark:border-slate-700" />

<Toggle
  checked={!!form.auto_woo_enabled}
  onChange={v => update('auto_woo_enabled', v)}
  label="Enable Auto Woo Sync"
  description="When on, stock changes automatically push to WooCommerce. Products are also pulled from WooCommerce on the auto-sync interval."
/>
```

---

## Task 4: Add `autoWooPush()` helper and wire it in server.js

**Files:**
- Modify: `server.js` — add helper near top, wire into the three endpoints

**Steps:**

- [ ] **Step 1: Add `autoWooPush()` helper function**

Place near the top of `server.js` after the existing helper functions (around line 50-60, after `silentSheetsPush`). This helper pushes a single product's `woo_stock` to WC:

```javascript
async function autoWooPush(product, settings) {
  if (!product.woo_product_id) return;
  const { woo_url, consumer_key, consumer_secret } = settings;
  if (!woo_url || !consumer_key || !consumer_secret) return;

  const base = woo_url.replace(/\/$/, '');
  const auth = Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64');
  const endpoint = product.woo_variation_id
    ? `${base}/wp-json/wc/v3/products/${product.woo_product_id}/variations/${product.woo_variation_id}`
    : `${base}/wp-json/wc/v3/products/${product.woo_product_id}`;

  try {
    await fetch(endpoint, {
      method: 'PUT',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock_quantity: product.woo_stock, manage_stock: true }),
    });
  } catch (err) {
    console.error(`[autoWooPush] Failed to push product ${product.id}:`, err.message);
  }
}
```

- [ ] **Step 2: Wire into `/api/adjustments`** (after `silentSheetsPush(products)`, around line 142)

After the line:
```javascript
silentSheetsPush(products);
res.json({ product: computeProduct(products[idx]), adjustment });
```

Add:
```javascript
// Auto Woo push — fires async, fire-and-forget
if (settings.auto_woo_enabled) {
  autoWooPush(products[idx], settings);
}
```

- [ ] **Step 3: Wire into `/api/woo-stock`** (after the local write, before the `res.json`)

The existing code at line 209 already writes the updated product. After:
```javascript
res.json({ product: computeProduct(products[idx]), adjustment });
```

Add:
```javascript
if (settings.auto_woo_enabled) {
  autoWooPush(products[idx], settings);
}
```

- [ ] **Step 4: Wire into `/api/transfer`** (after local write, before `res.json`)

Find the line after both local and WooCommerce stock are updated, before `res.json({ products: ... })`. Add the same `if (settings.auto_woo_enabled)` block calling `autoWooPush(updatedProduct, settings)`.

---

## Task 5: Modify useInitialData auto-sync effect for push

**Files:**
- Modify: `src/hooks/useInitialData.ts:34-53`

**Steps:**

- [ ] **Step 1: The existing auto-sync effect is unchanged** — it calls `api.sync.pull()` every `auto_sync_interval` minutes. The pull always reflects WC state. This behavior is preserved.

The push side is handled server-side in Task 4. No frontend changes needed for the push trigger.

- [ ] **Step 2: No changes to `useInitialData.ts` are required** for the push side — it is handled entirely in `server.js`.

---

## Task 6: Update MEMORY.md

**Files:**
- Modify: `MEMORY.md` (root and Obsidian vault copy)

**Steps:**

- [ ] **Step 1: Add `auto_woo_enabled` to Settings Defaults section**

```js
{
  // ... existing fields ...
  auto_woo_enabled: false,
}
```

- [ ] **Step 2: Add new Key Quirk**

```
11. **`auto_woo_enabled` gates all auto-sync** — when true, local stock changes push to WC immediately (server-side, fire-and-forget), and WC pull runs on `auto_sync_interval`. Google Sheets unaffected.
```

---

## Spec Coverage

| Spec item | Task |
|-----------|------|
| New `auto_woo_enabled` setting | Tasks 1, 2, 3 |
| Push on adjustments | Task 4.2 |
| Push on woo-stock | Task 4.3 |
| Push on transfer | Task 4.4 |
| Pull unchanged (existing timer) | Task 5 |
| Sheets unaffected | Server-side (no changes needed) |
| MEMORY.md | Task 6 |

---

## Execution Options

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task

**2. Inline Execution** — execute tasks in this session

Which approach?
