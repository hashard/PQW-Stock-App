import type { Product, StockAdjustment, AppSettings } from '../types';

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

export interface AdjustPayload {
  product_id:      string;
  adjustment_type: string;
  quantity:        number;
  reason:          string;
  user_name:       string;
}

export interface SyncResult {
  products:     Product[];
  synced_count: number;
  synced_at:    string;
}

export interface AdjustResult {
  product:    Product;
  adjustment: StockAdjustment;
}

export interface TransferPayload {
  product_id: string;
  quantity:   number;
  reason:     string;
  user_name:  string;
}

export const api = {
  products: {
    list:   ()                              => req<Product[]>('/products'),
    update: (id: string, data: Partial<Product>) =>
      req<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  adjustments: {
    list:   ()                         => req<StockAdjustment[]>('/adjustments'),
    create: (payload: AdjustPayload)   =>
      req<AdjustResult>('/adjustments', { method: 'POST', body: JSON.stringify(payload) }),
  },
  settings: {
    get:    ()                              => req<AppSettings>('/settings'),
    update: (data: Partial<AppSettings>)   =>
      req<AppSettings>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },
  sync: {
    pull: () => req<SyncResult>('/sync', { method: 'POST' }),
    push: () => req<{ pushed: number; failed: number; errors: string[]; pushed_at: string }>('/push-woo', { method: 'POST' }),
  },
  transfer: {
    run: (payload: TransferPayload) =>
      req<AdjustResult>('/transfer', { method: 'POST', body: JSON.stringify(payload) }),
  },
  wooStock: {
    adjust: (payload: { product_id: string; adjustment_type: 'add' | 'remove' | 'set'; quantity: number; reason: string; user_name: string }) =>
      req<AdjustResult>('/woo-stock', { method: 'POST', body: JSON.stringify(payload) }),
  },
  export: {
    products:    () => { window.location.href = '/api/export/products'; },
    adjustments: () => { window.location.href = '/api/export/adjustments'; },
  },
  sheets: {
    push: () => req<{ ok: boolean; rows: number; pushed_at: string }>('/sheets/push', { method: 'POST' }),
    pull: () => req<{ ok: boolean; updated: number; total_rows: number; pulled_at: string; products: Product[] }>('/sheets/pull', { method: 'POST' }),
    test: () => req<{ ok: boolean; title: string }>('/sheets/test', { method: 'POST' }),
  },
  localUrl: () => req<{ url: string }>('/local-url'),
  version:  () => req<{ hash: string; date: string; subject: string }>('/version'),
};
