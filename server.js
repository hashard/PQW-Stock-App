import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// ── Data directory ────────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
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
  },
};

function initFile(key) {
  if (!fs.existsSync(FILES[key])) {
    fs.writeFileSync(FILES[key], JSON.stringify(DEFAULTS[key], null, 2));
  }
}
Object.keys(FILES).forEach(initFile);

// ── Helpers ───────────────────────────────────────────────────────────────────
const readData  = (key) => JSON.parse(fs.readFileSync(FILES[key], 'utf8'));
const writeData = (key, data) => fs.writeFileSync(FILES[key], JSON.stringify(data, null, 2));
const uid       = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

function computeProduct(p) {
  const combined  = (p.woo_stock ?? 0) + (p.cutting_room_stock ?? 0);
  const threshold = p.low_stock_threshold ?? 5;
  const status    = combined === 0 ? 'out_of_stock' : combined <= threshold ? 'low_stock' : 'in_stock';
  const needs_laser_cut = !p.hidden && (p.cutting_room_stock ?? 0) <= (p.cutting_room_minimum ?? 0);
  return { ...p, combined_stock: combined, status, needs_laser_cut };
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// ── Products ──────────────────────────────────────────────────────────────────
app.get('/api/products', (_req, res) => {
  res.json(readData('products').map(computeProduct));
});

app.put('/api/products/:id', (req, res) => {
  const products = readData('products');
  const idx = products.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });

  const updated = { ...products[idx], ...req.body, updated_at: new Date().toISOString() };
  // Prevent accidentally overwriting computed fields via PUT
  delete updated.combined_stock;
  delete updated.status;
  delete updated.needs_laser_cut;
  products[idx] = updated;
  writeData('products', products);
  res.json(computeProduct(updated));
});

// ── Adjustments ───────────────────────────────────────────────────────────────
app.get('/api/adjustments', (_req, res) => {
  const adj = readData('adjustments');
  res.json(adj.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
});

app.post('/api/adjustments', (req, res) => {
  const { product_id, adjustment_type, quantity, reason, user_name } = req.body;

  if (!product_id || !adjustment_type || quantity === undefined || !reason?.trim() || !user_name?.trim()) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const products = readData('products');
  const idx = products.findIndex(p => p.id === product_id);
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });

  const product  = products[idx];
  const previous = product.cutting_room_stock ?? 0;
  let newStock;

  if (adjustment_type === 'add')    newStock = previous + Number(quantity);
  else if (adjustment_type === 'remove') newStock = previous - Number(quantity);
  else if (adjustment_type === 'set')    newStock = Number(quantity);
  else return res.status(400).json({ error: 'Invalid adjustment_type' });

  if (newStock < 0) newStock = 0;

  const adjustment = {
    id:             uid(),
    product_id,
    sku:            product.sku,
    product_name:   product.name,
    adjustment_type,
    quantity_change: newStock - previous,
    previous_stock:  previous,
    new_stock:       newStock,
    reason:          reason.trim(),
    user_name:       user_name.trim(),
    created_at:      new Date().toISOString(),
  };

  products[idx] = { ...product, cutting_room_stock: newStock, updated_at: new Date().toISOString() };
  writeData('products', products);

  const adjustments = readData('adjustments');
  adjustments.push(adjustment);
  writeData('adjustments', adjustments);

  silentSheetsPush(products);
  res.json({ product: computeProduct(products[idx]), adjustment });
});

// ── Settings ──────────────────────────────────────────────────────────────────
app.get('/api/settings', (_req, res) => res.json(readData('settings')));

app.put('/api/settings', (req, res) => {
  const settings = { ...readData('settings'), ...req.body };
  writeData('settings', settings);
  res.json(settings);
});

// ── Edit WooCommerce Stock Directly ──────────────────────────────────────────
app.post('/api/woo-stock', async (req, res) => {
  const { product_id, adjustment_type, quantity, reason, user_name } = req.body;

  if (!product_id || !adjustment_type || quantity === undefined || !reason?.trim() || !user_name?.trim()) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const qty = Number(quantity);
  if (isNaN(qty) || qty < 0) {
    return res.status(400).json({ error: 'Quantity must be 0 or more.' });
  }

  const products = readData('products');
  const idx = products.findIndex(p => p.id === product_id);
  if (idx === -1) return res.status(404).json({ error: 'Product not found.' });

  const product = products[idx];

  if (!product.woo_product_id) {
    return res.status(400).json({ error: 'This product has no WooCommerce ID — sync first.' });
  }

  const settings = readData('settings');
  const { woo_url, consumer_key, consumer_secret } = settings;
  if (!woo_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({ error: 'WooCommerce credentials not configured. Go to Settings first.' });
  }

  const previousWoo = product.woo_stock ?? 0;
  let newWooStock;
  if (adjustment_type === 'add')    newWooStock = previousWoo + qty;
  else if (adjustment_type === 'remove') newWooStock = Math.max(0, previousWoo - qty);
  else if (adjustment_type === 'set')    newWooStock = qty;
  else return res.status(400).json({ error: 'Invalid adjustment_type.' });

  const base = woo_url.replace(/\/$/, '');
  const auth = Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64');

  try {
    const wooRes = await fetch(`${base}/wp-json/wc/v3/products/${product.woo_product_id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stock_quantity: newWooStock, manage_stock: true }),
    });

    if (!wooRes.ok) {
      const body = await wooRes.text();
      throw new Error(`WooCommerce API error ${wooRes.status}: ${body}`);
    }
  } catch (err) {
    return res.status(500).json({ error: `Failed to update WooCommerce: ${err.message}` });
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
    reason:          reason.trim(),
    user_name:       user_name.trim(),
    created_at:      now,
  };

  products[idx] = { ...product, woo_stock: newWooStock, updated_at: now };
  writeData('products', products);

  const adjustments = readData('adjustments');
  adjustments.push(adjustment);
  writeData('adjustments', adjustments);

  silentSheetsPush(products);
  res.json({ product: computeProduct(products[idx]), adjustment });
});

// ── Transfer: Cutting Room → WooCommerce ─────────────────────────────────────
app.post('/api/transfer', async (req, res) => {
  const { product_id, quantity, reason, user_name } = req.body;

  if (!product_id || !quantity || !reason?.trim() || !user_name?.trim()) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const qty = Number(quantity);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: 'Quantity must be a positive number.' });
  }

  const products = readData('products');
  const idx = products.findIndex(p => p.id === product_id);
  if (idx === -1) return res.status(404).json({ error: 'Product not found.' });

  const product = products[idx];

  if (!product.woo_product_id) {
    return res.status(400).json({ error: 'This product has no WooCommerce ID — sync first.' });
  }

  const cuttingStock = product.cutting_room_stock ?? 0;
  if (qty > cuttingStock) {
    return res.status(400).json({ error: `Not enough cutting room stock. Available: ${cuttingStock}` });
  }

  // Push new stock level to WooCommerce
  const settings = readData('settings');
  const { woo_url, consumer_key, consumer_secret } = settings;
  if (!woo_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({ error: 'WooCommerce credentials not configured. Go to Settings first.' });
  }

  const base = woo_url.replace(/\/$/, '');
  const auth = Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64');
  const newWooStock = (product.woo_stock ?? 0) + qty;

  try {
    const wooRes = await fetch(`${base}/wp-json/wc/v3/products/${product.woo_product_id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stock_quantity: newWooStock, manage_stock: true }),
    });

    if (!wooRes.ok) {
      const body = await wooRes.text();
      throw new Error(`WooCommerce API error ${wooRes.status}: ${body}`);
    }
  } catch (err) {
    return res.status(500).json({ error: `Failed to update WooCommerce: ${err.message}` });
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
    reason:          reason.trim(),
    user_name:       user_name.trim(),
    created_at:      now,
  };

  products[idx] = {
    ...product,
    cutting_room_stock: newCutting,
    woo_stock:          newWooStock,
    updated_at:         now,
  };

  writeData('products', products);

  const adjustments = readData('adjustments');
  adjustments.push(adjustment);
  writeData('adjustments', adjustments);

  silentSheetsPush(products);
  res.json({ product: computeProduct(products[idx]), adjustment });
});

// ── WooCommerce Sync ──────────────────────────────────────────────────────────
async function fetchAllWooProducts(settings) {
  const { woo_url, consumer_key, consumer_secret } = settings;
  if (!woo_url || !consumer_key || !consumer_secret) {
    throw new Error('WooCommerce credentials are not configured. Go to Settings first.');
  }

  const base = woo_url.replace(/\/$/, '');
  const auth = Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64');

  let all = [];
  let page = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const url = `${base}/wp-json/wc/v3/products?per_page=100&page=${page}&status=publish`;
    const res = await fetch(url, {
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

app.post('/api/sync', async (_req, res) => {
  try {
    const settings = readData('settings');
    const wooItems = await fetchAllWooProducts(settings);
    const existing = readData('products');
    const bySkuMap = new Map(existing.map(p => [p.sku, p]));
    const syncedAt = new Date().toISOString();

    for (const wp of wooItems) {
      const sku      = (wp.sku || '').trim();
      const category = wp.categories?.[0]?.name ?? 'Uncategorized';
      const wooStock = wp.manage_stock
        ? (wp.stock_quantity ?? 0)
        : (wp.stock_status === 'instock' ? 999 : 0);

      const key = sku || `__woo_${wp.id}`;

      if (bySkuMap.has(key)) {
        const prev = bySkuMap.get(key);
        bySkuMap.set(key, {
          ...prev,
          woo_product_id: wp.id,
          name:           wp.name,
          sku:            sku || prev.sku,
          category,
          woo_stock:      wooStock,
          last_synced_at: syncedAt,
          updated_at:     syncedAt,
          flagged:        !sku,
        });
      } else {
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
      }
    }

    const finalProducts = Array.from(bySkuMap.values());
    writeData('products', finalProducts);

    res.json({
      products:     finalProducts.map(computeProduct),
      synced_count: wooItems.length,
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

    for (const product of pushable) {
      try {
        const wooRes = await fetch(`${base}/wp-json/wc/v3/products/${product.woo_product_id}`, {
          method: 'PUT',
          headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ stock_quantity: product.woo_stock ?? 0, manage_stock: true }),
        });
        if (!wooRes.ok) {
          const body = await wooRes.text();
          errors.push(`${product.sku}: ${wooRes.status} ${body}`);
        } else {
          pushed++;
        }
      } catch (err) {
        errors.push(`${product.sku}: ${err.message}`);
      }
    }

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

// Pull cutting room stock from sheet
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
      range: `${tabName}!A:K`,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) return res.status(400).json({ error: 'Sheet appears empty or has no data rows.' });

    const headers    = rows[0];
    const skuCol     = headers.indexOf('SKU');
    const cuttingCol = headers.indexOf('Cutting Room');
    const cuttingMinCol = headers.indexOf('Cutting Room Min');

    if (skuCol === -1 || cuttingCol === -1) {
      return res.status(400).json({ error: 'Sheet must have "SKU" and "Cutting Room" column headers in row 1.' });
    }

    const sheetMap    = new Map();
    const sheetMinMap = new Map();
    for (const row of rows.slice(1)) {
      const sku     = (row[skuCol] || '').trim();
      const cutting = parseInt(row[cuttingCol], 10);
      if (sku && !isNaN(cutting)) sheetMap.set(sku, cutting);

      if (cuttingMinCol !== -1) {
        const min = parseInt(row[cuttingMinCol], 10);
        if (sku && !isNaN(min)) sheetMinMap.set(sku, min);
      }
    }

    const products    = readData('products');
    const adjustments = readData('adjustments');
    const now         = new Date().toISOString();
    let   updated     = 0;

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (!sheetMap.has(p.sku)) continue;

      const newCutting = sheetMap.get(p.sku);
      const previous   = p.cutting_room_stock ?? 0;
      const stockChanged = newCutting !== previous;

      const newCuttingMin = sheetMinMap.has(p.sku) ? sheetMinMap.get(p.sku) : (p.cutting_room_minimum ?? 0);
      const minChanged = sheetMinMap.has(p.sku) && newCuttingMin !== (p.cutting_room_minimum ?? 0);

      if (!stockChanged && !minChanged) continue;

      if (stockChanged) {
        adjustments.push({
          id:              uid(),
          product_id:      p.id,
          sku:             p.sku,
          product_name:    p.name,
          adjustment_type: 'sheet_import',
          quantity_change: newCutting - previous,
          previous_stock:  previous,
          new_stock:       newCutting,
          reason:          'Imported from Google Sheet',
          user_name:       'Sheet Import',
          created_at:      now,
        });
      }

      products[i] = { ...p, cutting_room_stock: newCutting, cutting_room_minimum: newCuttingMin, updated_at: now };
      updated++;
    }

    writeData('products', products);
    writeData('adjustments', adjustments);

    res.json({
      ok:         true,
      updated,
      total_rows: sheetMap.size,
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
