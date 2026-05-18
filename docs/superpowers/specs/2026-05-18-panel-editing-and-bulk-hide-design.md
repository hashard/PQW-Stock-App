# Panel Editing + Bulk Hide — Design Spec

**Date:** 2026-05-18
**Status:** Draft

---

## Overview

Add full editing capability to the NeedsLaserCut and LowStock dashboard panels, and add a bulk "Hide" action to all bulk edit bars.

---

## Feature 1: Panels — Click to Open ProductDrawer

### NeedsLaserCutPanel

- Clicking any product `<tr>` opens the ProductDrawer for that product via `openDrawer(p.id)`.
- Add `cursor-pointer` to rows.
- The existing ProductDrawer supports all editing (thresholds, minimums, notes, visibility toggle, adjust button). No drawer changes needed.

### LowStockPanel

- Same change: click row → `openDrawer(p.id)`.
- Add `cursor-pointer` to rows.

---

## Feature 2: Panels — Bulk Mode

Both panels get a bulk mode that mirrors the main ProductTable's bulk bar.

### Panel Header

- Add a **"Select" toggle button** next to the collapse chevron.
- When toggled on, `isBulkMode` is set to `true` and checkboxes appear on rows.

### Bulk Action Bar

Appears below the table when `isBulkMode` is on AND `selectedIds.size > 0`:

**Fields:**

| Field | Stock actions (Add/Remove/Set) | Hide action |
|---|---|---|
| Count label | "N selected" | "N selected" |
| Action type select | Add, Remove, Set to, Hide | Add, Remove, Set to, Hide |
| Quantity input | Visible, required | Hidden |
| Staff name | Visible | Visible |
| Reason | Visible, required | Hidden |
| Description | — | "Hide selected products from dashboard" |
| Apply button | Calls `api.adjustments.create()` per ID | Calls `api.products.update(id, { hidden: true })` per ID |
| Clear (X) button | Clears selection | Clears selection |

### State Sharing

Reuses the same Zustand store fields: `isBulkMode`, `selectedIds`, `toggleSelectedId`, `clearSelected`, `toggleBulkMode`. This means activating bulk mode in any panel or the main table activates it everywhere — intentional shared state.

---

## Feature 3: Bulk Hide in ProductTable

- Add `"Hide"` as a fourth option in the existing bulk action `<select>` dropdown.
- When selected: hide quantity input and reason input, show description text, call `api.products.update(id, { hidden: true })` per selected ID on Apply.

---

## Unhiding (out of scope for now)

Unhiding uses existing mechanisms:
- Toggle `showHidden` on in the ProductTable, then click per-product "Unhide" button
- Use the ProductDrawer's visibility toggle

---

## Files Changed

| File | Changes |
|---|---|
| `src/components/dashboard/NeedsLaserCutPanel.tsx` | Click-to-drawer, bulk select toggle, bulk action bar |
| `src/components/dashboard/LowStockPanel.tsx` | Click-to-drawer, bulk select toggle, bulk action bar |
| `src/components/products/ProductTable.tsx` | Add "Hide" option to bulk action dropdown |

---

## Reuse of Existing Components

- **ProductDrawer** — no changes needed
- **AdjustModal** — no changes needed
- **API client** (`src/api/client.ts`) — no changes; `products.update` and `adjustments.create` already support the needed operations
- **Zustand store** — no changes; `isBulkMode`, `selectedIds`, `toggleSelectedId`, `clearSelected`, `toggleBulkMode`, `openDrawer` already exist

---

## Server

No server changes needed. The `hidden` field already exists on products and is persisted. The `needs_laser_cut` computation already excludes hidden products. Bulk hide operations use the existing `PUT /api/products/:id` endpoint.

---

## Testing Checklist

- [ ] Click a row in NeedsLaserCutPanel → ProductDrawer opens
- [ ] Click a row in LowStockPanel → ProductDrawer opens
- [ ] Adjust button in panels still opens AdjustModal
- [ ] Bulk select toggle in panels shows checkboxes
- [ ] Bulk bar appears when items selected
- [ ] Stock actions (add/remove/set) work in panel bulk bar
- [ ] Hide action works in panel bulk bar — products disappear from panels
- [ ] Hide action in ProductTable bulk bar works
- [ ] Hidden products excluded from panels on next render
- [ ] Staff name is captured in bulk operations
