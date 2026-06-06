# Backup/Restore + Product Photos Implementation Plan

## Feature 7: Backup & Restore Data

**Goal:** One-click backup/restore of all app data via zip file.

### Changes:
1. **Backend:** Add `POST /api/backup` endpoint in `server.js` — reads `products.json`, `adjustments.json`, `settings.json` and streams a zip file
2. **Backend:** Add `POST /api/restore` endpoint — accepts multipart upload, validates JSON, extracts to data dir
3. **Frontend:** Add Export/Import buttons to Settings page (`src/pages/Settings.tsx`)
4. **Frontend:** Add import confirmation modal

### Validation:
- Backup zip contains exactly: `products.json`, `adjustments.json`, `settings.json`
- Restore validates all 3 are valid JSON before overwriting
- Restore shows progress and confirmation

---

## Feature 8: Product Photos from WooCommerce

**Goal:** Display WooCommerce product images in the app.

### Changes:
1. **Types:** Add `image_url: string | null` to `Product` interface
2. **Backend:** In `/api/sync` (`server.js`), when fetching WC products, also read `images[0]?.src` and include it during upsert
3. **Backend:** Ensure `image_url` survives PUT updates (or re-add it if server strips unknown fields)
4. **Frontend:** Show thumbnail image in `ProductTable` (small, with placeholder if missing)
5. **Frontend:** Show larger image in `ProductDrawer` (with placeholder if missing)

### Notes:
- Use `<img>` with `object-cover` styling
- Placeholder: a generic Lucide `ImageOff` icon with gray background
- Gracefully handle missing images — most products may not have them
