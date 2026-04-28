import { api } from '../api/client';
import { useStore } from '../store';

export function useSync() {
  const { setSyncStatus, setProducts } = useStore();

  async function runSync() {
    setSyncStatus({ state: 'syncing', message: 'Syncing with WooCommerce…' });
    try {
      const result = await api.sync.run();
      setProducts(result.products);
      setSyncStatus({
        state:         'success',
        last_synced_at: result.synced_at,
        synced_count:  result.synced_count,
        message:       `Synced ${result.synced_count} products`,
      });
    } catch (err) {
      setSyncStatus({
        state:   'error',
        message: err instanceof Error ? err.message : 'Sync failed',
      });
    }
  }

  return { runSync };
}
