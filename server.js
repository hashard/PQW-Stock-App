import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// ── Data directory ────────────────────────────────────────────────────────────
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const FILES = {
  products:    path.join(DATA_DIR, 'products.json'),
  adjustments: path.join(DATA_DIR, 'adjustments.json'),
  settings:    path.join(DATA_DIR, 'settings.json'),
};

const DEFAULTS = {
  products:    [],
  adjustments: [],
  settings: {
    woo_url: '',
    consumer_key: '',
    consumer_secret: '',
    default_threshold: 5,
    auto_sync_interval: 0,
    sheets_enabled: false,
    sheets_id: '',
    sheets_tab: 'Stock',
    sheets_credentials_json: '',
    woo_push_instant: false,
    require_reason: true,
  },
};

function initFile(key) {
  if (!fs.existsSync(FILES[key])) {
    atomicWrite(FILES[key], DEFAULTS[key]);
  }
}
Object.keys(FILES).forEach(initFile);

// ── Safe persistence ────────────────────────────────────────────────────────────
function atomicWrite(filePath, data) {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

// Per-file write queue to serialize concurrent reads/writes and prevent races.
const fileQueues = {};
function withFile(key, fn) {
  fileQueues[key] ||= Promise.resolve();
  const next = fileQueues[key].then(fn, fn);
  fileQueues[key] = next;
  return next;
}

const readData  = (key) => JSON.parse(fs.readFileSync(FILES[key], 'utf8'));
function writeData(key, data) {
  return withFile(key, () => atomicWrite(FILES[key], data));
}

// Atomic read-modify-write: the read, mutation, and write all run inside the
// per-file queue so concurrent requests can't clobber each other's changes.
// The mutator receives the current data and returns the value to persist
// (return undefined to skip the write). Resolves to the persisted value.
function mutateData(key, mutator) {
  return withFile(key, () => {
    const current = JSON.parse(fs.readFileSync(FILES[key], 'utf8'));
    const next = mutator(current);
    if (next !== undefined) atomicWrite(FILES[key], next);
    return next;
  });
}
const uid       = () => crypto.randomUUID();

function computeProduct(p) {
  const combined  = (p.woo_stock ?? 0) + (p.cutting_room_stock ?? 0);
  const threshold = p.low_stock_threshold ?? 5;
  const status    = combined === 0 ? 'out_of_stock' : combined <= threshold ? 'low_stock' : 'in_stock';
  const needs_laser_cut = !p.hidden && (p.cutting_room_minimum ?? 0) > 0 && (p.cutting_room_stock ?? 0) <= (p.cutting_room_minimum ?? 0);
  return { ...p, combined_stock: combined, status, needs_laser_cut };
}

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
    const wooRes = await fetch(endpoint, {
      method: 'PUT',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock_quantity: product.woo_stock, manage_stock: true }),
    });
    if (!wooRes.ok) {
      const body = await wooRes.text().catch(() => '');
      console.error(`[autoWooPush] WooCommerce returned ${wooRes.status} for product ${product.id}: ${body}`);
    }
  } catch (err) {
    console.error(`[autoWooPush] Failed to push product ${product.id}:`, err.message);
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

// ── Products ──────────────────────────────────────────────────────────────────
app.get('/api/products', (_req, res) => {
  res.json(readData('products').map(computeProduct));
});

app.put('/api/products/:id', async (req, res) => {
  const allowed = ['name','category','woo_stock','cutting_room_stock','low_stock_threshold','cutting_room_minimum','notes','hidden'];
  const patch = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) patch[key] = req.body[key];
  }

  let updated = null;
  await mutateData('products', (products) => {
    const idx = products.findIndex(p => p.id === req.params.id);
    if (idx === -1) return undefined; // not found — skip write
    updated = { ...products[idx], ...patch, updated_at: new Date().toISOString() };
    // Prevent accidentally overwriting computed fields via PUT
    delete updated.combined_stock;
    delete updated.status;
    delete updated.needs_laser_cut;
    products[idx] = updated;
    return products;
  });

  if (!updated) return res.status(404).json({ error: 'Product not found' });
  res.json(computeProduct(updated));
});

// ── Adjustments ───────────────────────────────────────────────────────────────
app.get('/api/adjustments', (_req, res) => {
  const adj = readData('adjustments');
  res.json(adj.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
});

app.post('/api/adjustments', async (req, res) => {
  const { product_id, adjustment_type, quantity, reason, user_name } = req.body;
  const settings = readData('settings');

  if (!product_id || !adjustment_type || quantity === undefined || !user_name?.trim()) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (settings.require_reason !== false && !reason?.trim()) {
    return res.status(400).json({ error: 'Reason is required.' });
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty < 0) {
    return res.status(400).json({ error: 'Quantity must be a non-negative number.' });
  }
  if (!['add','remove','set'].includes(adjustment_type)) {
    return res.status(400).json({ error: 'Invalid adjustment_type' });
  }

  const now = new Date().toISOString();
  let updatedProduct = null, previous = 0, newStock = 0;

  const products = await mutateData('products', (products) => {
    const idx = products.findIndex(p => p.id === product_id);
    if (idx === -1) return undefined; // not found — skip write
    const product = products[idx];
    previous = product.cutting_room_stock ?? 0;

    if (adjustment_type === 'add')         newStock = previous + qty;
    else if (adjustment_type === 'remove') newStock = Math.max(0, previous - qty);
    else if (adjustment_type === 'set')    newStock = qty;

    products[idx] = { ...product, cutting_room_stock: newStock, updated_at: now };
    updatedProduct = products[idx];
    return products;
  });

  if (!updatedProduct) return res.status(404).json({ error: 'Product not found' });

  const adjustment = {
    id:             uid(),
    product_id,
    sku:            updatedProduct.sku,
    product_name:   updatedProduct.name,
    adjustment_type,
    quantity_change: newStock - previous,
    previous_stock:  previous,
    new_stock:       newStock,
    reason:          (reason ?? '').trim(),
    user_name:       user_name.trim(),
    created_at:      now,
  };

  await mutateData('adjustments', (adjustments) => { adjustments.push(adjustment); return adjustments; });

  silentSheetsPush(products);
  if (settings.auto_woo_enabled) {
    autoWooPush(updatedProduct, settings);
  }
  res.json({ product: computeProduct(updatedProduct), adjustment });
});

// ── Settings ──────────────────────────────────────────────────────────────────
function sanitizeSettings(raw) {
  const masked = { ...raw };
  // Never return live secrets to the client.
  if (masked.consumer_key)     masked.consumer_key     = '*'.repeat(8);
  if (masked.consumer_secret)  masked.consumer_secret  = '*'.repeat(8);
  if (masked.sheets_credentials_json) {
    try {
      const creds = JSON.parse(masked.sheets_credentials_json);
      masked.sheets_credentials_json = JSON.stringify({ ...creds, private_key: '*'.repeat(8), client_email: creds.client_email ?? '' });
    } catch {
      masked.sheets_credentials_json = '*'.repeat(8);
    }
  }
  return masked;
}

function normalizeSettings(raw) {
  return { ...DEFAULTS.settings, ...raw };
}

const SECRET_FIELDS = ['consumer_key', 'consumer_secret', 'sheets_credentials_json'];

// True when an incoming secret value is a masked placeholder (from sanitizeSettings),
// meaning the client/backup never had the real secret and we must keep the existing one.
function isSecretMasked(key, v) {
  if (typeof v !== 'string') return false;
  if (/^\*+$/.test(v)) return true;
  if (key === 'sheets_credentials_json') {
    try {
      const creds = JSON.parse(v);
      return typeof creds.private_key === 'string' && /^\*+$/.test(creds.private_key);
    } catch {
      return false;
    }
  }
  return false;
}

// Merge incoming settings over existing, preserving existing secrets when the
// incoming value is a masked placeholder. Shared by PUT /settings and restore.
function mergeSettings(existing, incoming = {}) {
  const next = { ...existing };
  for (const key of Object.keys(existing)) {
    if (incoming[key] === undefined) continue;
    next[key] = (SECRET_FIELDS.includes(key) && isSecretMasked(key, incoming[key]))
      ? existing[key]
      : incoming[key];
  }
  return next;
}

app.get('/api/settings', (_req, res) => res.json(sanitizeSettings(normalizeSettings(readData('settings')))));

app.put('/api/settings', async (req, res) => {
  const next = await mutateData('settings', (raw) =>
    mergeSettings(normalizeSettings(raw), req.body || {}),
  );
  res.json(sanitizeSettings(next));
});

// ── Edit WooCommerce Stock ────────────────────────────────────────────────────
// Pushes live immediately if settings.woo_push_instant is true, otherwise local only.
app.post('/api/woo-stock', async (req, res) => {
  const { product_id, adjustment_type, quantity, reason, user_name } = req.body;
  const settings = readData('settings');

  if (!product_id || !adjustment_type || quantity === undefined || !user_name?.trim()) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (settings.require_reason !== false && !reason?.trim()) {
    return res.status(400).json({ error: 'Reason is required.' });
  }

  const qty = Number(quantity);
  if (isNaN(qty) || qty < 0 || !Number.isFinite(qty)) {
    return res.status(400).json({ error: 'Quantity must be 0 or more.' });
  }
  if (!['add','remove','set'].includes(adjustment_type)) {
    return res.status(400).json({ error: 'Invalid adjustment_type.' });
  }

  const products = readData('products');
  const idx = products.findIndex(p => p.id === product_id);
  if (idx === -1) return res.status(404).json({ error: 'Product not found.' });

  const product = products[idx];

  const previousWoo = product.woo_stock ?? 0;
  let newWooStock;
  if (adjustment_type === 'add')         newWooStock = previousWoo + qty;
  else if (adjustment_type === 'remove') newWooStock = Math.max(0, previousWoo - qty);
  else if (adjustment_type === 'set')    newWooStock = qty;

  // Optionally push live to WooCommerce immediately
  if (settings.woo_push_instant && product.woo_product_id) {
    const { woo_url, consumer_key, consumer_secret } = settings;
    if (woo_url && consumer_key && consumer_secret) {
      const base = woo_url.replace(/\/$/, '');
      const auth = Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64');
      const endpoint = product.woo_variation_id
        ? `${base}/wp-json/wc/v3/products/${product.woo_product_id}/variations/${product.woo_variation_id}`
        : `${base}/wp-json/wc/v3/products/${product.woo_product_id}`;
      try {
        const wooRes = await fetch(endpoint, {
          method: 'PUT',
          headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ stock_quantity: newWooStock, manage_stock: true }),
        });
        if (!wooRes.ok) {
          const body = await wooRes.text();
          return res.status(500).json({ error: `WooCommerce API error ${wooRes.status}: ${body}` });
        }
      } catch (err) {
        return res.status(500).json({ error: `Failed to update WooCommerce: ${err.message}` });
      }
    }
  }

  const now = new Date().toISOString();
  const adjustment = {
    id:              uid(),
    product_id,
    sku:             product.sku,
    product_name:    product.name,
    adjustment_type: 'woo_edit',
    quantity_change: newWooStock - previousWoo,
    previous_stock:  previousWoo,
    new_stock:       newWooStock,
    reason:          (reason ?? '').trim(),
    user_name:       user_name.trim(),
    created_at:      now,
  };

  let updatedProduct = null;
  const updatedProducts = await mutateData('products', (products) => {
    const i = products.findIndex(p => p.id === product_id);
    if (i === -1) return undefined;
    products[i] = { ...products[i], woo_stock: newWooStock, updated_at: now };
    updatedProduct = products[i];
    return products;
  });

  if (!updatedProduct) return res.status(404).json({ error: 'Product not found.' });

  await mutateData('adjustments', (adjustments) => { adjustments.push(adjustment); return adjustments; });

  silentSheetsPush(updatedProducts);
  if (settings.auto_woo_enabled) {
    autoWooPush(updatedProduct, settings);
  }
  res.json({ product: computeProduct(updatedProduct), adjustment });
});

// ── Transfer: Cutting Room → WooCommerce ─────────────────────────────────────
// Pushes live immediately if settings.woo_push_instant is true, otherwise local only.
app.post('/api/transfer', async (req, res) => {
  const { product_id, quantity, reason, user_name } = req.body;
  const settings = readData('settings');

  if (!product_id || !quantity || !user_name?.trim()) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (settings.require_reason !== false && !reason?.trim()) {
    return res.status(400).json({ error: 'Reason is required.' });
  }

  const qty = Number(quantity);
  if (isNaN(qty) || qty <= 0 || !Number.isFinite(qty)) {
    return res.status(400).json({ error: 'Quantity must be a positive number.' });
  }

  const products = readData('products');
  const idx = products.findIndex(p => p.id === product_id);
  if (idx === -1) return res.status(404).json({ error: 'Product not found.' });

  const product = products[idx];

  const cuttingStock = product.cutting_room_stock ?? 0;
  if (qty > cuttingStock) {
    return res.status(400).json({ error: `Not enough cutting room stock. Available: ${cuttingStock}` });
  }

  const newWooStock = (product.woo_stock ?? 0) + qty;

  // Optionally push live to WooCommerce immediately
  if (settings.woo_push_instant && product.woo_product_id) {
    const { woo_url, consumer_key, consumer_secret } = settings;
    if (woo_url && consumer_key && consumer_secret) {
      const base = woo_url.replace(/\/$/, '');
      const auth = Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64');
      const endpoint = product.woo_variation_id
        ? `${base}/wp-json/wc/v3/products/${product.woo_product_id}/variations/${product.woo_variation_id}`
        : `${base}/wp-json/wc/v3/products/${product.woo_product_id}`;
      try {
        const wooRes = await fetch(endpoint, {
          method: 'PUT',
          headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ stock_quantity: newWooStock, manage_stock: true }),
        });
        if (!wooRes.ok) {
          const body = await wooRes.text();
          return res.status(500).json({ error: `WooCommerce API error ${wooRes.status}: ${body}` });
        }
      } catch (err) {
        return res.status(500).json({ error: `Failed to update WooCommerce: ${err.message}` });
      }
    }
  }

  // Update local data
  const previousCutting = cuttingStock;
  const newCutting = cuttingStock - qty;
  const now = new Date().toISOString();

  const adjustment = {
    id:              uid(),
    product_id,
    sku:             product.sku,
    product_name:    product.name,
    adjustment_type: 'transfer_to_woo',
    quantity_change: -qty,
    previous_stock:  previousCutting,
    new_stock:       newCutting,
    reason:          (reason ?? '').trim(),
    user_name:       user_name.trim(),
    created_at:      now,
  };

  let updatedProduct = null;
  const updatedProducts = await mutateData('products', (products) => {
    const i = products.findIndex(p => p.id === product_id);
    if (i === -1) return undefined;
    products[i] = {
      ...products[i],
      cutting_room_stock: newCutting,
      woo_stock:          newWooStock,
      updated_at:         now,
    };
    updatedProduct = products[i];
    return products;
  });

  if (!updatedProduct) return res.status(404).json({ error: 'Product not found.' });

  await mutateData('adjustments', (adjustments) => { adjustments.push(adjustment); return adjustments; });

  silentSheetsPush(updatedProducts);
  if (settings.auto_woo_enabled) {
    autoWooPush(updatedProduct, settings);
  }
  res.json({ product: computeProduct(updatedProduct), adjustment });
});

// ── WooCommerce Sync ──────────────────────────────────────────────────────────
async function fetchAllWooProducts(settings) {
  const { woo_url, consumer_key, consumer_secret } = settings;
  if (!woo_url || !consumer_key || !consumer_secret) {
    throw new Error('WooCommerce credentials are not configured. Go to Settings first.');
  }

  const base = woo_url.replace(/\/$/, '');
  const auth = Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64');

  // Helper: paginate any WooCommerce list endpoint
  async function paginate(endpoint) {
    let all = [], page = 1;
    while (true) {
      const res = await fetch(`${base}${endpoint}&page=${page}`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`WooCommerce API error ${res.status}: ${body}`);
      }
      const batch = await res.json();
      if (!batch.length) break;
      all = all.concat(batch);
      if (batch.length < 100) break;
      page++;
    }
    return all;
  }

  // Fetch top-level products (simple + variable parents)
  const allProducts = await paginate('/wp-json/wc/v3/products?per_page=100&status=publish');

  // Separate simple products from variable parents
  const simpleProducts = allProducts.filter(p => p.type !== 'variable');
  const variableParents = allProducts.filter(p => p.type === 'variable');

  // Fetch variations for each variable parent
  const variationItems = [];
  for (const parent of variableParents) {
    try {
      const vars = await paginate(`/wp-json/wc/v3/products/${parent.id}/variations?per_page=100`);
      for (const v of vars) {
        variationItems.push({
          ...v,
          _parentId:       parent.id,
          _parentName:     parent.name,
          _parentCategory: parent.categories?.[0]?.name ?? 'Uncategorized',
        });
      }
    } catch (e) {
      console.warn(`Could not fetch variations for product ${parent.id}: ${e.message}`);
    }
  }

  return { simpleProducts, variationItems };
}

app.post('/api/sync', async (_req, res) => {
  try {
    const settings   = readData('settings');
    const { simpleProducts, variationItems } = await fetchAllWooProducts(settings);
    const syncedAt   = new Date().toISOString();

    // Synthetic key for products WooCommerce exposes without a SKU. Must match the
    // `sku` we store for them below, so a subsequent sync updates instead of duplicating.
    const noSkuKey = (variationId, id) => `NO-SKU-${variationId ?? id}`;

    // Build the merged catalog atomically against the freshest on-disk products,
    // so an adjustment made during the (slow) WooCommerce fetch isn't clobbered.
    const finalProducts = await mutateData('products', (existing) => {
    const bySkuMap   = new Map(existing.map(p => [p.sku, p]));

    // Helper: upsert one item into the map
    function upsert({ id, variationId, name, sku, category, wooStock, flagged, imageUrl }) {
      const key = sku || noSkuKey(variationId, id);
      if (bySkuMap.has(key)) {
        const prev = bySkuMap.get(key);
        bySkuMap.set(key, {
          ...prev,
          woo_product_id:    id,
          woo_variation_id:  variationId ?? prev.woo_variation_id ?? null,
          name,
          sku:               sku || prev.sku,
          category,
          woo_stock:         wooStock,
          image_url:         imageUrl ?? prev.image_url ?? null,
          last_synced_at:    syncedAt,
          updated_at:        syncedAt,
          flagged,
        });
      } else {
        bySkuMap.set(key, {
          id:                   uid(),
          woo_product_id:       id,
          woo_variation_id:     variationId ?? null,
          name,
          sku:                  sku || noSkuKey(variationId, id),
          category,
          woo_stock:            wooStock,
          image_url:            imageUrl ?? null,
          cutting_room_stock:   0,
          low_stock_threshold:  settings.default_threshold ?? 5,
          cutting_room_minimum: settings.default_cutting_room_minimum ?? 0,
          last_synced_at:       syncedAt,
          updated_at:           syncedAt,
          flagged,
          notes:                '',
          hidden:               false,
        });
      }
    }

    // Process simple products
    for (const wp of simpleProducts) {
      const sku      = (wp.sku || '').trim();
      const wooStock = wp.manage_stock
        ? (wp.stock_quantity ?? 0)
        : (wp.stock_status === 'instock' ? 999 : 0);
      upsert({
        id:       wp.id,
        name:     wp.name,
        sku,
        category: wp.categories?.[0]?.name ?? 'Uncategorized',
        wooStock,
        flagged:  !sku,
        imageUrl: wp.images?.[0]?.src ?? null,
      });
    }

    // Process variations — name includes the attribute options (e.g. "Red - Large")
    for (const v of variationItems) {
      const sku      = (v.sku || '').trim();
      const wooStock = v.manage_stock
        ? (v.stock_quantity ?? 0)
        : (v.stock_status === 'instock' ? 999 : 0);
      const attrStr  = v.attributes?.length
        ? v.attributes.map(a => a.option).join(' / ')
        : `Variation ${v.id}`;
      upsert({
        id:          v._parentId,
        variationId: v.id,
        name:        `${v._parentName} — ${attrStr}`,
        sku,
        category:    v._parentCategory,
        wooStock,
        flagged:     !sku,
        imageUrl:    v.image?.src ?? null, // variations may have their own image
      });
    }

      return Array.from(bySkuMap.values());
    });

    const totalSynced = simpleProducts.length + variationItems.length;
    res.json({
      products:     finalProducts.map(computeProduct),
      synced_count: totalSynced,
      synced_at:    syncedAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── WooCommerce Push (local → WooCommerce) ────────────────────────────────────
app.post('/api/push-woo', async (_req, res) => {
  try {
    const settings = readData('settings');
    const { woo_url, consumer_key, consumer_secret } = settings;
    if (!woo_url || !consumer_key || !consumer_secret) {
      return res.status(400).json({ error: 'WooCommerce credentials are not configured. Go to Settings first.' });
    }

    const base = woo_url.replace(/\/$/, '');
    const auth = Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64');
    const products = readData('products');
    const pushable = products.filter(p => p.woo_product_id);

    if (!pushable.length) {
      return res.status(400).json({ error: 'No products have a WooCommerce ID. Run a Pull first.' });
    }

    let pushed = 0;
    const errors = [];

    // A timed-out or dropped request may still have been applied by WooCommerce.
    // Before counting it as failed, read the product back and compare stock.
    async function verifyPushed(endpoint, expectedStock) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const wooRes = await fetch(endpoint, {
          signal: controller.signal,
          headers: { Authorization: `Basic ${auth}` },
        });
        clearTimeout(timeout);
        if (!wooRes.ok) return false;
        const data = await wooRes.json();
        return Number(data.stock_quantity) === Number(expectedStock);
      } catch {
        return false; // couldn't verify — treat as failed
      }
    }

    // Limit concurrency so the server stays responsive and we don't hammer WooCommerce.
    const CONCURRENCY = 5;
    const queue = [...pushable];
    async function runBatch() {
      while (queue.length) {
        const product = queue.shift();
        const endpoint = product.woo_variation_id
          ? `${base}/wp-json/wc/v3/products/${product.woo_product_id}/variations/${product.woo_variation_id}`
          : `${base}/wp-json/wc/v3/products/${product.woo_product_id}`;
        const targetStock = product.woo_stock ?? 0;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 30000);
          const wooRes = await fetch(endpoint, {
            method: 'PUT',
            signal: controller.signal,
            headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ stock_quantity: targetStock, manage_stock: true }),
          });
          clearTimeout(timeout);
          if (!wooRes.ok) {
            const body = await wooRes.text();
            errors.push(`${product.sku}: ${wooRes.status} ${body}`);
          } else {
            pushed++;
          }
        } catch (err) {
          // Timeout/network error — the update may have landed anyway; check before reporting failure.
          if (await verifyPushed(endpoint, targetStock)) {
            pushed++;
          } else {
            errors.push(`${product.sku}: ${err.message}`);
          }
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }).map(runBatch));

    res.json({
      pushed,
      failed:    errors.length,
      errors:    errors.slice(0, 5), // return first 5 errors if any
      pushed_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Google Sheets ─────────────────────────────────────────────────────────────

function getSheetsClient(credentialsJson) {
  const credentials = JSON.parse(credentialsJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

const SHEET_HEADERS = [
  'Product Name', 'SKU', 'Category',
  'Woo Stock', 'Cutting Room', 'Combined',
  'Status', 'Threshold', 'Cutting Room Min', 'Hidden', 'Last Updated',
];

async function pushAllToSheets(settings, products) {
  if (!settings.sheets_enabled || !settings.sheets_id || !settings.sheets_credentials_json) return;

  const sheets   = getSheetsClient(settings.sheets_credentials_json);
  const tabName  = settings.sheets_tab || 'Stock';
  const range    = `${tabName}!A1`;
  const now      = new Date().toISOString();

  const rows = products.map(computeProduct).map(p => [
    p.name, p.sku, p.category,
    p.woo_stock, p.cutting_room_stock, p.combined_stock,
    p.status, p.low_stock_threshold, p.cutting_room_minimum, p.hidden ? 'Yes' : 'No', now,
  ]);

  await sheets.spreadsheets.values.update({
    spreadsheetId: settings.sheets_id,
    range,
    valueInputOption: 'RAW',
    requestBody: { values: [SHEET_HEADERS, ...rows] },
  });
}

// Fire-and-forget push — never blocks an API response
function silentSheetsPush(products) {
  const settings = readData('settings');
  pushAllToSheets(settings, products).catch(err =>
    console.error('[Sheets] Auto-push failed:', err.message),
  );
}

// Manual push
app.post('/api/sheets/push', async (_req, res) => {
  const settings = readData('settings');
  if (!settings.sheets_enabled)              return res.status(400).json({ error: 'Google Sheets is not enabled.' });
  if (!settings.sheets_id)                   return res.status(400).json({ error: 'Sheet ID is not configured.' });
  if (!settings.sheets_credentials_json)     return res.status(400).json({ error: 'Service account credentials are not configured.' });

  try {
    const products = readData('products');
    await pushAllToSheets(settings, products);
    res.json({ ok: true, rows: products.length, pushed_at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: `Sheets push failed: ${err.message}` });
  }
});

// Pull all editable fields from sheet
app.post('/api/sheets/pull', async (_req, res) => {
  const settings = readData('settings');
  if (!settings.sheets_enabled)              return res.status(400).json({ error: 'Google Sheets is not enabled.' });
  if (!settings.sheets_id)                   return res.status(400).json({ error: 'Sheet ID is not configured.' });
  if (!settings.sheets_credentials_json)     return res.status(400).json({ error: 'Service account credentials are not configured.' });

  try {
    const sheets  = getSheetsClient(settings.sheets_credentials_json);
    const tabName = settings.sheets_tab || 'Stock';

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: settings.sheets_id,
      range: `${tabName}!A:Z`,   // wide range — handles any number of columns
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) return res.status(400).json({ error: 'Sheet appears empty or has no data rows.' });

    // Case-insensitive, whitespace-tolerant header lookup
    const headers    = rows[0].map(h => (h || '').trim().toLowerCase());
    const col = (name) => headers.indexOf(name.toLowerCase().trim());

    const skuCol        = col('SKU');
    const cuttingCol    = col('Cutting Room');
    const cuttingMinCol = col('Cutting Room Min');
    const wooCol        = col('Woo Stock');
    const thresholdCol  = col('Threshold');
    const hiddenCol     = col('Hidden');

    if (skuCol === -1) {
      return res.status(400).json({ error: `Sheet must have a "SKU" column header in row 1. Found: ${rows[0].join(', ')}` });
    }

    console.log('[Sheets Pull] Columns found:', { skuCol, cuttingCol, wooCol, thresholdCol, hiddenCol, cuttingMinCol });

    // Build a map keyed by SKU containing all editable fields found in the sheet
    const sheetData = new Map();
    for (const row of rows.slice(1)) {
      const sku = (row[skuCol] || '').trim();
      if (!sku) continue;

      const entry = {};
      if (cuttingCol    !== -1 && row[cuttingCol]    !== undefined) { const v = parseInt(row[cuttingCol],    10); if (!isNaN(v)) entry.cutting_room_stock   = v; }
      if (cuttingMinCol !== -1 && row[cuttingMinCol] !== undefined) { const v = parseInt(row[cuttingMinCol], 10); if (!isNaN(v)) entry.cutting_room_minimum = v; }
      if (wooCol        !== -1 && row[wooCol]        !== undefined) { const v = parseInt(row[wooCol],        10); if (!isNaN(v)) entry.woo_stock             = v; }
      if (thresholdCol  !== -1 && row[thresholdCol]  !== undefined) { const v = parseInt(row[thresholdCol],  10); if (!isNaN(v)) entry.low_stock_threshold   = v; }
      if (hiddenCol     !== -1 && row[hiddenCol]     !== undefined) {
        const raw = (row[hiddenCol] || '').trim().toLowerCase();
        if (raw === 'yes' || raw === 'true' || raw === '1') entry.hidden = true;
        else if (raw === 'no' || raw === 'false' || raw === '0' || raw === '') entry.hidden = false;
      }

      if (Object.keys(entry).length > 0) sheetData.set(sku, entry);
    }

    const now            = new Date().toISOString();
    const newAdjustments = [];
    let   updated        = 0;

    const products = await mutateData('products', (products) => {
      for (let i = 0; i < products.length; i++) {
        const p = products[i];
        const data = sheetData.get(p.sku);
        if (!data) continue;

        let changed = false;
        const patch = { updated_at: now };

        // Cutting room — log adjustment
        if (data.cutting_room_stock !== undefined && data.cutting_room_stock !== (p.cutting_room_stock ?? 0)) {
          const prev = p.cutting_room_stock ?? 0;
          newAdjustments.push({
            id: uid(), product_id: p.id, sku: p.sku, product_name: p.name,
            adjustment_type: 'sheet_import',
            quantity_change: data.cutting_room_stock - prev,
            previous_stock: prev, new_stock: data.cutting_room_stock,
            reason: 'Imported from Google Sheet', user_name: 'Sheet Import', created_at: now,
          });
          patch.cutting_room_stock = data.cutting_room_stock;
          changed = true;
        }

        // Woo stock — log adjustment
        if (data.woo_stock !== undefined && data.woo_stock !== (p.woo_stock ?? 0)) {
          const prev = p.woo_stock ?? 0;
          newAdjustments.push({
            id: uid(), product_id: p.id, sku: p.sku, product_name: p.name,
            adjustment_type: 'sheet_import',
            quantity_change: data.woo_stock - prev,
            previous_stock: prev, new_stock: data.woo_stock,
            reason: 'Woo stock imported from Google Sheet', user_name: 'Sheet Import', created_at: now,
          });
          patch.woo_stock = data.woo_stock;
          changed = true;
        }

        // Other fields — update silently
        if (data.cutting_room_minimum !== undefined && data.cutting_room_minimum !== (p.cutting_room_minimum ?? 0)) { patch.cutting_room_minimum = data.cutting_room_minimum; changed = true; }
        if (data.low_stock_threshold  !== undefined && data.low_stock_threshold  !== (p.low_stock_threshold  ?? 0)) { patch.low_stock_threshold  = data.low_stock_threshold;  changed = true; }
        if (data.hidden               !== undefined && data.hidden               !== p.hidden)                       { patch.hidden               = data.hidden;               changed = true; }

        if (changed) {
          products[i] = { ...p, ...patch };
          updated++;
        }
      }
      return products;
    });

    if (newAdjustments.length) {
      await mutateData('adjustments', (adjustments) => { adjustments.push(...newAdjustments); return adjustments; });
    }

    res.json({
      ok:         true,
      updated,
      total_rows: sheetData.size,
      pulled_at:  now,
      products:   products.map(computeProduct),
    });
  } catch (err) {
    res.status(500).json({ error: `Sheets pull failed: ${err.message}` });
  }
});

// Test connection
app.post('/api/sheets/test', async (_req, res) => {
  const settings = readData('settings');

  // Pre-flight checks with clear messages
  if (!settings.sheets_credentials_json?.trim()) {
    return res.status(400).json({ error: 'No credentials pasted. Add the JSON key file contents in Settings.' });
  }
  let creds;
  try {
    creds = JSON.parse(settings.sheets_credentials_json);
  } catch {
    return res.status(400).json({ error: 'Credentials JSON is invalid — make sure you pasted the entire file including the { } braces.' });
  }
  if (!creds.client_email || !creds.private_key) {
    return res.status(400).json({ error: 'Credentials JSON is missing client_email or private_key fields.' });
  }
  if (!settings.sheets_id?.trim()) {
    return res.status(400).json({ error: 'Sheet ID is empty. Enter the ID from your Google Sheet URL.' });
  }

  try {
    const sheets  = getSheetsClient(settings.sheets_credentials_json);
    const info    = await sheets.spreadsheets.get({ spreadsheetId: settings.sheets_id.trim() });
    res.json({ ok: true, title: info.data.properties?.title });
  } catch (err) {
    const code = err?.code || err?.status;
    const msg  = err?.message || '';
    let friendly = msg;
    if (code === 404 || msg.includes('not found') || msg.includes('NOT_FOUND')) {
      friendly = `Sheet not found (404). Check: 1) Sheet ID is correct, 2) The sheet is shared with ${creds.client_email}`;
    } else if (code === 403 || msg.includes('permission') || msg.includes('PERMISSION_DENIED')) {
      friendly = `Permission denied. Make sure the sheet is shared with ${creds.client_email} as Editor, and Google Sheets API is enabled in your Cloud project.`;
    } else if (msg.includes('API') || msg.includes('disabled') || msg.includes('accessNotConfigured')) {
      friendly = `Google Sheets API is not enabled. Go to console.cloud.google.com → APIs & Services → Enable APIs → search "Google Sheets API" → Enable.`;
    } else if (msg.includes('invalid_grant') || msg.includes('DECODER')) {
      friendly = `Credentials are invalid or expired. Download a fresh JSON key from Google Cloud Console.`;
    }
    res.status(500).json({ error: friendly });
  }
});

// ── CSV Export ────────────────────────────────────────────────────────────────
function toCSV(headers, rows) {
  const escape = v => (typeof v === 'string' && v.includes(',') ? `"${v.replace(/"/g, '""')}"` : v);
  return [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
}

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

app.get('/api/export/adjustments', (_req, res) => {
  const adj = readData('adjustments').sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const csv = toCSV(
    ['Product', 'SKU', 'Type', 'Change', 'Previous', 'New', 'Reason', 'User', 'Date'],
    adj.map(a => [a.product_name, a.sku, a.adjustment_type, a.quantity_change, a.previous_stock, a.new_stock, a.reason, a.user_name, a.created_at]),
  );
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=pqw-adjustments.csv');
  res.send(csv);
});

// ── Version info ─────────────────────────────────────────────────────────────

function getVersion() {
  // Packaged Electron exe — use app version set by electron-main.mjs
  if (process.env.APP_VERSION) {
    return { hash: '', date: '', subject: `v${process.env.APP_VERSION}` };
  }
  // Git clone / PM2 mode — read from git
  try {
    const hash    = execSync('git rev-parse --short HEAD',  { cwd: __dirname }).toString().trim();
    const date    = execSync('git log -1 --format=%cd --date=short', { cwd: __dirname }).toString().trim();
    const subject = execSync('git log -1 --format=%s',     { cwd: __dirname }).toString().trim();
    return { hash, date, subject };
  } catch {
    return { hash: 'unknown', date: 'unknown', subject: 'Git not available' };
  }
}

app.get('/api/version', (_req, res) => {
  res.json(getVersion());
});

// ── In-app updater (SSE stream) ───────────────────────────────────────────────
app.get('/api/update', (_req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (type, text) =>
    res.write(`data: ${JSON.stringify({ type, text })}\n\n`);

  // ── Packaged Electron exe — use electron-updater ──────────────────
  if (global.pqwUpdater) {
    const { emitter, check } = global.pqwUpdater;

    const onLine = (line) => send('out', line);
    const onDone = (code) => {
      emitter.off('line', onLine);
      if (code === 0) send('done', 'Update complete.');
      else            send('error', 'Update failed — see above.');
      res.end();
    };

    emitter.on('line', onLine);
    emitter.once('done', onDone);
    check();
    return;
  }

  // ── Git clone / PM2 mode — pull, build, restart ───────────────────
  function runCmd(label, cmd, args) {
    return new Promise((resolve, reject) => {
      send('step', label);
      const proc = spawn(cmd, args, { cwd: __dirname, shell: true, windowsHide: true });
      proc.stdout.on('data', d =>
        d.toString().split('\n').forEach(l => { if (l.trim()) send('out', l.trimEnd()); })
      );
      proc.stderr.on('data', d =>
        d.toString().split('\n').forEach(l => { if (l.trim()) send('out', l.trimEnd()); })
      );
      proc.on('close', code =>
        code === 0 ? resolve() : reject(new Error(`"${label}" failed (exit code ${code})`))
      );
    });
  }

  (async () => {
    try {
      await runCmd('Pulling latest changes from GitHub…', 'git', ['pull']);
      await runCmd('Installing packages…',               'npm', ['install']);
      await runCmd('Building the app…',                  'npm', ['run', 'build']);
      send('done', 'Update complete — restarting…');
      setTimeout(() => process.exit(0), 800);
    } catch (err) {
      send('error', err.message);
      res.end();
    }
  })();
});

// ── Local network URL (for QR code) ──────────────────────────────────────────
app.get('/api/local-url', (_req, res) => {
  let localIp = 'localhost';
  const interfaces = os.networkInterfaces();
  outer: for (const iface of Object.values(interfaces)) {
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) {
        localIp = alias.address;
        break outer;
      }
    }
  }
  res.json({ url: `http://${localIp}:${PORT}` });
});

// ── Backup / Restore ──────────────────────────────────────────────────────────
// Build a full snapshot. `mask` hides secrets (for the LAN-exposed HTTP download);
// scheduled on-disk backups keep secrets so they are fully restorable offline.
function buildBackup({ mask } = {}) {
  const settings = readData('settings');
  return {
    products:    readData('products'),
    adjustments: readData('adjustments'),
    settings:    mask ? sanitizeSettings(settings) : settings,
  };
}

app.get('/api/backup', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="pqw-backup.json"');
  res.send(JSON.stringify(buildBackup({ mask: true }), null, 2));
});

app.post('/api/restore', async (req, res) => {
  const { products, adjustments, settings } = req.body;
  if (!Array.isArray(products) || !Array.isArray(adjustments) || typeof settings !== 'object' || settings === null) {
    return res.status(400).json({ error: 'Invalid backup format. Must contain products[], adjustments[], and settings object.' });
  }
  if (products.length > 10000 || adjustments.length > 50000) {
    return res.status(400).json({ error: 'Backup file exceeds maximum allowed rows.' });
  }

  // Coerce each product back to the expected shape and drop any injected computed fields.
  const restoredProducts = products.map(p => ({
    id:                   typeof p.id === 'string' ? p.id : uid(),
    woo_product_id:       p.woo_product_id ?? null,
    woo_variation_id:     p.woo_variation_id ?? null,
    name:                 String(p.name ?? ''),
    sku:                  String(p.sku ?? ''),
    category:             String(p.category ?? 'Uncategorized'),
    woo_stock:            Number.isFinite(Number(p.woo_stock)) ? Number(p.woo_stock) : 0,
    cutting_room_stock:   Number.isFinite(Number(p.cutting_room_stock)) ? Number(p.cutting_room_stock) : 0,
    low_stock_threshold:  Number.isFinite(Number(p.low_stock_threshold)) ? Number(p.low_stock_threshold) : 5,
    cutting_room_minimum: Number.isFinite(Number(p.cutting_room_minimum)) ? Number(p.cutting_room_minimum) : 0,
    image_url:            p.image_url ?? null,
    notes:                String(p.notes ?? ''),
    hidden:               !!p.hidden,
    last_synced_at:       p.last_synced_at ?? null,
    updated_at:           p.updated_at ?? new Date().toISOString(),
  }));

  const restoredAdjustments = adjustments.map(a => ({
    id:              typeof a.id === 'string' ? a.id : uid(),
    product_id:      String(a.product_id ?? ''),
    sku:             String(a.sku ?? ''),
    product_name:    String(a.product_name ?? ''),
    adjustment_type: ['add','remove','set','transfer_to_woo','woo_edit','sheet_import'].includes(a.adjustment_type) ? a.adjustment_type : 'sheet_import',
    quantity_change: Number.isFinite(Number(a.quantity_change)) ? Number(a.quantity_change) : 0,
    previous_stock:  Number.isFinite(Number(a.previous_stock)) ? Number(a.previous_stock) : 0,
    new_stock:       Number.isFinite(Number(a.new_stock)) ? Number(a.new_stock) : 0,
    reason:          String(a.reason ?? ''),
    user_name:       String(a.user_name ?? ''),
    created_at:      a.created_at ?? new Date().toISOString(),
  }));

  // Preserve current secrets when the backup carries masked placeholders (e.g. a
  // backup downloaded from /api/backup), so restore never wipes live credentials.
  const restoredSettings = mergeSettings(normalizeSettings(readData('settings')), settings);

  await writeData('products', restoredProducts);
  await writeData('adjustments', restoredAdjustments);
  await writeData('settings', restoredSettings);
  res.json({ ok: true, products: restoredProducts.length, adjustments: restoredAdjustments.length });
});

// ── Scheduled backups ───────────────────────────────────────────────────────────
// Daily on-disk snapshots to DATA_DIR/backups/, keeping the most recent ones.
// This is the only safety net for the JSON data store, so it runs in all modes.
const BACKUP_DIR       = path.join(DATA_DIR, 'backups');
const BACKUP_RETENTION = 14;
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

function writeScheduledBackup() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    atomicWrite(path.join(BACKUP_DIR, `backup-${stamp}.json`), buildBackup({ mask: false }));

    // Prune oldest, keeping the newest BACKUP_RETENTION files (names sort chronologically).
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .sort();
    while (files.length > BACKUP_RETENTION) {
      const old = files.shift();
      try { fs.unlinkSync(path.join(BACKUP_DIR, old)); } catch { /* ignore */ }
    }
    console.log(`[Backup] Snapshot written (${files.length} kept).`);
  } catch (err) {
    console.error('[Backup] Scheduled backup failed:', err.message);
  }
}

setTimeout(writeScheduledBackup, 15000).unref?.();
setInterval(writeScheduledBackup, BACKUP_INTERVAL_MS).unref?.();

// ── SPA Fallback ──────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  const index = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(index)) {
    res.sendFile(index);
  } else {
    res.status(404).send('Run `npm run build` first, or use `npm run dev` for development.');
  }
});

app.listen(PORT, () => {
  console.log(`\n  PQW Stock Dashboard → http://localhost:${PORT}\n`);
});
