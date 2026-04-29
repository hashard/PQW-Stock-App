import { api } from '../api/client';
import { useStore } from '../store';

export function useSync() {
  const { setSyncStatus, setProducts } = useStore();

  async function runPull() {
    setSyncStatus({ state: 'syncing', message: 'Pulling from WooCommerce…' });
    try {
      const result = await api.sync.pull();
      setProducts(result.products);
      setSyncStatus({
        state:          'success',
        last_synced_at: result.synced_at,
        synced_count:   result.synced_count,
        message:        `Pulled ${result.synced_count} products from WooCommerce`,
      });
    } catch (err) {
      setSyncStatus({
        state:   'error',
        message: err instanceof Error ? err.message : 'Pull failed',
      });
    }
  }

  async function runPush() {
    setSyncStatus({ state: 'syncing', message: 'Pushing to WooCommerce…' });
    try {
      const result = await api.sync.push();
      setSyncStatus({
        state:          'success',
        last_synced_at: result.pushed_at,
        synced_count:   result.pushed,
        message:        `Pushed ${result.pushed} products to WooCommerce${result.failed ? ` (${result.failed} failed)` : ''}`,
      });
    } catch (err) {
      setSyncStatus({
        state:   'error',
        message: err instanceof Error ? err.message : 'Push failed',
      });
    }
  }

  return { runPull, runPush };
}
