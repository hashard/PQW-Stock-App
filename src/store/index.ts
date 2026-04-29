import { create } from 'zustand';
import type {
  Product, StockAdjustment, AppSettings, SyncStatus, FilterConfig, SortConfig,
} from '../types';

const DEFAULT_SETTINGS: AppSettings = {
  woo_url: '', consumer_key: '', consumer_secret: '',
  default_threshold: 5, auto_sync_interval: 0,
  sheets_enabled: false, sheets_id: '', sheets_tab: 'Stock', sheets_credentials_json: '',
};

const DEFAULT_SYNC: SyncStatus = {
  state: 'idle', last_synced_at: null, message: '', synced_count: 0,
};

interface Store {
  // ── Data ──────────────────────────────────────────────────────────────────
  products:       Product[];
  adjustments:    StockAdjustment[];
  settings:       AppSettings;
  syncStatus:     SyncStatus;
  isLoading:      boolean;
  error:          string | null;
  sheetsStatus:   { state: 'idle' | 'busy' | 'ok' | 'error'; message: string };

  // ── UI ────────────────────────────────────────────────────────────────────
  isDarkMode:          boolean;
  adjustProductId:     string | null;   // open adjust modal for this product
  drawerProductId:     string | null;   // open detail drawer for this product
  isBulkMode:          boolean;
  selectedIds:         Set<string>;

  // ── Table ─────────────────────────────────────────────────────────────────
  filters:  FilterConfig;
  sort:     SortConfig;
  page:     number;

  // ── Data actions ──────────────────────────────────────────────────────────
  setProducts:    (p: Product[]) => void;
  updateProduct:  (p: Product)   => void;
  setAdjustments: (a: StockAdjustment[]) => void;
  addAdjustment:  (a: StockAdjustment)   => void;
  setSettings:    (s: AppSettings)       => void;
  setSyncStatus:  (s: Partial<SyncStatus>) => void;
  setLoading:     (v: boolean)    => void;
  setError:       (e: string | null) => void;
  setSheetsStatus:(s: { state: 'idle' | 'busy' | 'ok' | 'error'; message: string }) => void;

  // ── UI actions ────────────────────────────────────────────────────────────
  toggleDarkMode:    () => void;
  openAdjustModal:   (id: string) => void;
  closeAdjustModal:  () => void;
  openDrawer:        (id: string) => void;
  closeDrawer:       () => void;
  toggleBulkMode:    () => void;
  toggleSelectedId:  (id: string) => void;
  clearSelected:     () => void;

  // ── Table actions ─────────────────────────────────────────────────────────
  setFilters: (f: Partial<FilterConfig>) => void;
  setSort:    (s: SortConfig)            => void;
  setPage:    (p: number)               => void;
}

const storedDark = localStorage.getItem('pqw_dark') === 'true';

export const useStore = create<Store>((set) => ({
  products:    [],
  adjustments: [],
  settings:    DEFAULT_SETTINGS,
  syncStatus:  DEFAULT_SYNC,
  isLoading:    false,
  error:        null,
  sheetsStatus: { state: 'idle', message: '' },

  isDarkMode:      storedDark,
  adjustProductId: null,
  drawerProductId: null,
  isBulkMode:      false,
  selectedIds:     new Set(),

  filters: { search: '', status: 'all', category: 'all' },
  sort:    { key: 'name', direction: 'asc' },
  page:    0,

  setProducts:    (products)    => set({ products }),
  updateProduct:  (product)     => set(s => ({ products: s.products.map(p => p.id === product.id ? product : p) })),
  setAdjustments: (adjustments) => set({ adjustments }),
  addAdjustment:  (adj)         => set(s => ({ adjustments: [adj, ...s.adjustments] })),
  setSettings:    (settings)    => set({ settings }),
  setSyncStatus:  (status)      => set(s => ({ syncStatus: { ...s.syncStatus, ...status } })),
  setLoading:      (isLoading)    => set({ isLoading }),
  setError:        (error)        => set({ error }),
  setSheetsStatus: (sheetsStatus) => set({ sheetsStatus }),

  toggleDarkMode: () => set(s => {
    const v = !s.isDarkMode;
    localStorage.setItem('pqw_dark', String(v));
    return { isDarkMode: v };
  }),
  openAdjustModal:  (id) => set({ adjustProductId: id }),
  closeAdjustModal: ()   => set({ adjustProductId: null }),
  openDrawer:       (id) => set({ drawerProductId: id }),
  closeDrawer:      ()   => set({ drawerProductId: null }),
  toggleBulkMode:   ()   => set(s => ({ isBulkMode: !s.isBulkMode, selectedIds: new Set() })),
  toggleSelectedId: (id) => set(s => {
    const next = new Set(s.selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    return { selectedIds: next };
  }),
  clearSelected: () => set({ selectedIds: new Set() }),

  setFilters: (f) => set(s => ({ filters: { ...s.filters, ...f }, page: 0 })),
  setSort:    (sort) => set({ sort }),
  setPage:    (page) => set({ page }),
}));
