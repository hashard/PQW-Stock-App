import { useEffect, useRef } from 'react';
import { api } from '../api/client';
import { useStore } from '../store';

export function useInitialData() {
  const { setProducts, setAdjustments, setSettings, setLoading, setError, settings } = useStore();
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    async function load() {
      setLoading(true);
      try {
        const [products, adjustments, fetchedSettings] = await Promise.all([
          api.products.list(),
          api.adjustments.list(),
          api.settings.get(),
        ]);
        setProducts(products);
        setAdjustments(adjustments);
        setSettings(fetchedSettings);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  // Auto-sync interval
  useEffect(() => {
    if (!settings.auto_sync_interval || settings.auto_sync_interval <= 0) return;
    const ms = settings.auto_sync_interval * 60 * 1000;
    const timer = setInterval(async () => {
      try {
        const result = await api.sync.pull();
        useStore.getState().setProducts(result.products);
        useStore.getState().setSyncStatus({
          state: 'success',
          last_synced_at: result.synced_at,
          synced_count: result.synced_count,
          message: `Auto-synced ${result.synced_count} products`,
        });
      } catch {
        // silent fail on auto-sync
      }
    }, ms);
    return () => clearInterval(timer);
  }, [settings.auto_sync_interval]);
}
