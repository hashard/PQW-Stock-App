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
    run: () => req<SyncResult>('/sync', { method: 'POST' }),
  },
  export: {
    products:    () => { window.location.href = '/api/export/products'; },
    adjustments: () => { window.location.href = '/api/export/adjustments'; },
  },
};
