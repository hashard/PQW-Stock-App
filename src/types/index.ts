export type StockStatus    = 'in_stock' | 'low_stock' | 'out_of_stock';
export type AdjustmentType = 'add' | 'remove' | 'set' | 'transfer_to_woo' | 'woo_edit' | 'sheet_import';
export type SortDir        = 'asc' | 'desc';

export interface Product {
  id:                  string;
  woo_product_id:      number | null;
  name:                string;
  sku:                 string;
  category:            string;
  woo_stock:           number;
  cutting_room_stock:  number;
  combined_stock:      number;   // computed by server
  low_stock_threshold: number;
  status:              StockStatus; // computed by server
  last_synced_at:      string | null;
  updated_at:          string;
  flagged:             boolean;
  notes:               string;
}

export interface StockAdjustment {
  id:              string;
  product_id:      string;
  sku:             string;
  product_name:    string;
  adjustment_type: AdjustmentType;
  quantity_change: number;
  previous_stock:  number;
  new_stock:       number;
  reason:          string;
  user_name:       string;
  created_at:      string;
}

export interface AppSettings {
  woo_url:                  string;
  consumer_key:             string;
  consumer_secret:          string;
  default_threshold:        number;
  auto_sync_interval:       number; // minutes; 0 = disabled
  sheets_enabled:           boolean;
  sheets_id:                string;
  sheets_tab:               string;
  sheets_credentials_json:  string;
}

export interface SyncStatus {
  state:         'idle' | 'syncing' | 'success' | 'error';
  last_synced_at: string | null;
  message:       string;
  synced_count:  number;
}

export interface SortConfig {
  key:       keyof Product;
  direction: SortDir;
}

export interface FilterConfig {
  search:   string;
  status:   string;
  category: string;
}
