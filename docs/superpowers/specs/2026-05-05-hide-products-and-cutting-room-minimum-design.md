# Hide Products & Cutting Room Minimum — Design

**Date**: 2026-05-05
**Status**: Approved

## Overview

Two features:
1. Hide products that don't require stock management (events, classes, services)
2. Per-product cutting room minimum that flags products for laser cutting

---

## Data Model

### Product — new fields

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `hidden` | `boolean` | `false` | Removes product from dashboard |
| `cutting_room_minimum` | `number` | `0` | Trigger laser-cut flag when `cutting_room_stock <=` this |

### AppSettings — new field

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `default_cutting_room_minimum` | `number` | `0` | Pre-fills `cutting_room_minimum` on new synced products |

### Derived field (server-computed)

`needs_laser_cut: boolean` — `!hidden && cutting_room_stock <= cutting_room_minimum`

Hidden products are excluded from the laser cut calculation so they don't pollute the panel.

---

## Server Changes (`server.js`)

1. `computeProduct()` — add `needs_laser_cut` derived field
2. `PUT /api/products/:id` — accept `hidden` and `cutting_room_minimum`
3. Sync (`POST /api/sync`) — set `cutting_room_minimum` from `settings.default_cutting_room_minimum` on new products
4. CSV export (`/api/export/products`) — add Cutting Room Minimum column
5. Sheets push — add Cutting Room Minimum to output columns
6. Sheets pull — optionally read Cutting Room Minimum from sheet (if present)

---

## UI Changes

### Dashboard (`src/pages/Dashboard.tsx`)

New "Needs Laser Cut" panel above LowStockPanel:
- Red/magenta theme (`border-red-200 bg-red-50`)
- Collapsible, same pattern as LowStockPanel
- Icon: `Scissors` (lucide) or `AlertTriangle` in red
- Columns: Product, SKU, Cutting Room, Minimum, Combined, Adjust button
- Sorted by cutting room stock ascending (worst first)
- Hidden when zero products need cutting

### Product Table (`src/components/products/ProductTable.tsx`)

**Filter bar additions:**
- "Laser Cut" option in status dropdown
- "Hidden" toggle button with eye-off icon next to filters — when active, hidden products appear

**Hidden product rows:**
- Greyed out (`opacity-50`)
- Row actions replaced with "Unhide" button
- No checkbox in bulk mode (can't bulk-edit hidden products)

**Laser cut indicator:**
- Small scissors icon next to product name for items needing cutting

### Settings (`src/pages/Settings.tsx`)

New field in "Dashboard Defaults" section:
- "Default Cutting Room Minimum" — number input
- Hint: "Applied to new products on first sync. When cutting room stock drops to or below this number, the product is flagged for laser cutting."

### Product Drawer (detail panel)

Two new editable fields:
- Hide/Unhide toggle switch
- Cutting Room Minimum number input

---

## Edge Cases

- **Hidden + laser cut**: hidden products excluded from laser cut panel via derived field
- **Zero minimum**: when `cutting_room_minimum` is 0, `needs_laser_cut` triggers when cutting room stock is exactly 0 (matches <= comparison)
- **Sync**: newly synced products get the global default; existing products keep their per-product value
- **Sheets round-trip**: Cutting Room Minimum persisted in sheet column so values survive pull/push cycles
