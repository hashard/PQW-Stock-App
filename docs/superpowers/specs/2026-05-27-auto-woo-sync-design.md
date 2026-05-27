# Auto Woo Sync — Design Spec

**Date:** 2026-05-27  
**Status:** Draft

---

## 1. Overview

Add an `auto_woo_enabled` setting that, when toggled on, enables automatic bidirectional sync with WooCommerce:

- **Push** (local → WC): immediate, event-driven on every local stock change
- **Pull** (WC → local): scheduled on the existing `auto_sync_interval` timer
- **Google Sheets**: unaffected — never auto-syncs

---

## 2. New Setting

**Field:** `auto_woo_enabled` (boolean)  
**Location:** `settings.json`, stored alongside existing settings  
**Default:** `false` (existing users not affected)

**Persistence:** Saved when user toggles it. Survives restarts and updates.

**UI location:** Settings page, near the existing `auto_sync_interval` control.

---

## 3. Behavior

### 3a. Push — Local changes push to WC automatically

On every local stock change, if `auto_woo_enabled === true` the system immediately calls `POST /api/push-woo` (or equivalent internal helper) for affected products that have a `woo_product_id`.

**Triggering actions:**
- Stock adjustment (cutting room stock change)
- Manual WooCommerce stock edit
- Transfer from cutting room → WooCommerce

**Condition:** Only pushes if:
1. `auto_woo_enabled === true`
2. Product has `woo_product_id` (i.e., it's linked to WC)

**No push for:**
- Products without a WC link
- Hidden products (as per current design — they stay local)
- Google Sheets-only changes (never pushes anywhere)

**Error handling:** Silent failure — failures log to console only. No blocking UI.

### 3b. Pull — WC syncs to local on interval

When the existing `auto_sync_interval` timer fires, it calls `POST /api/sync` as it does today. This behavior is unchanged.

**Important:** Hidden products are NOT updated by the pull (even if they'd overwritten by sync). Sync already upserts by SKU, so this means hidden products retain their local state permanently.

### 3c. Google Sheets — Unchanged

`silentSheetsPush()` continues to fire on every local change. The new `auto_woo_enabled` has no effect on sheet sync behavior — it neither triggers pulls from sheets nor prevents pushes to sheets.

---

## 4. UI — Settings

**Section:** "WooCommerce Automation" (new collapsible section or grouped with existing WC settings)

```
☐ Enable Auto Woo Sync
  When enabled:
  • Local stock changes push to WooCommerce automatically
  • WooCommerce inventory pulled every [auto_sync_interval] minutes
  • Google Sheets are never touched automatically
```

Below the toggle, show the current `auto_sync_interval` value with a note:
> "Pull interval: every X minutes (configure in WooCommerce Settings)"

---

## 5. Persistence & Migration

**Default settings** always include `auto_woo_enabled: false` (line 8 of store/index.ts and wherever defaults are set in server.js).

**Migration:** No data migration needed. New field defaults to `false`.

---

## 6. Existing Timer Cleanup (Known Issue)

The current auto-sync timer has a known issue: when `auto_sync_interval` is changed in Settings, the old timer leaks and a new one is created without cancelling the original. This fix is out of scope for this spec — the `auto_woo_enabled` toggle inherits the existing timer behavior as-is.

---

## 7. Implementation Checklist

1. Add `auto_woo_enabled: false` to `DEFAULT_SETTINGS` in `src/store/index.ts`
2. Add `auto_woo_enabled: boolean` to the `AppSettings` type in `src/types/index.ts`
3. Add the toggle UI in the Settings component (WooSettings or new AutoWooSettings)
4. Wire `auto_woo_enabled` into the push-side of every stock-changing action
5. Confirm `auto_sync_interval` pull behavior is unchanged — just gated by the existing timer
6. Update MEMORY.md with new setting and behavior

---

## 8. Out of Scope

- Google Sheets automation toggle (sheets stay as-is: pull manual only, silent push on changes)
- Fixing the existing `auto_sync_interval` timer leak bug
- Auto-hiding products that are out of stock on WC
- Per-product sync preferences
