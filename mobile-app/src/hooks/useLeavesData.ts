import { useCallback, useEffect, useState } from 'react';
import { attendanceApi, getCachedLeaves, setCachedLeaves } from '../services';
import type { LeaveEntry, ApiErrorPayload } from '../types';

export interface UseLeavesDataReturn {
  data: LeaveEntry[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: ApiErrorPayload | null;
  lastUpdated: string | null;
  refresh: () => void;
}

/**
 * Reusable hook for loading leave data with AsyncStorage cache and refresh support (mobile).
 *
 * Bootstraps from AsyncStorage, then silent-refreshes in background.
 */
export const useLeavesData = (): UseLeavesDataReturn => {
  const [data, setData] = useState<LeaveEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<ApiErrorPayload | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadLeaves = useCallback(
    async (options: { forceRefresh?: boolean; silent?: boolean } = {}) => {
      const { forceRefresh = false, silent = false } = options;

      if (!silent) {
        setError(null);
      }

      if (forceRefresh) {
        setIsRefreshing(true);
      } else if (!silent) {
        setIsLoading(true);
      }

      try {
        const result = await attendanceApi.getLeaves();

        if (!result.ok) {
          if (!silent) {
            setError(result.error);
            setData([]);
          }
          if (forceRefresh) {
            setIsRefreshing(false);
          } else if (!silent) {
            setIsLoading(false);
          }
          return;
        }

        const items = Array.isArray(result.data?.items) ? result.data.items : [];
        setData(items);
        setLastUpdated(new Date().toISOString());

        // Update cache
        await setCachedLeaves(items);

        if (!silent) {
          setError(null);
        }
      } catch (err) {
        const apiError: ApiErrorPayload = err instanceof Error ? {
          code: 'UNKNOWN_ERROR',
          message: err.message,
        } : {
          code: 'UNKNOWN_ERROR',
          message: 'An error occurred while loading leaves',
        };

        if (!silent) {
          setError(apiError);
        }
      } finally {
        if (forceRefresh) {
          setIsRefreshing(false);
        } else if (!silent) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  // Bootstrap: load cached data on mount, then silent refresh
  useEffect(() => {
    let isActive = true;

    const bootstrap = async () => {
      const cachedData = await getCachedLeaves();

      if (!isActive) {
        return;
      }

      if (Array.isArray(cachedData)) {
        setData(cachedData);
        setLastUpdated(new Date().toISOString());
        setIsLoading(false);
        // Trigger silent refresh in background
        void loadLeaves({ silent: true });
        return;
      }

      // No cached data; load from network
      void loadLeaves({ silent: false });
    };

    void bootstrap();

    return () => {
      isActive = false;
    };
  }, [loadLeaves]);

  const refresh = useCallback(() => {
    void loadLeaves({ forceRefresh: true, silent: false });
  }, [loadLeaves]);

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    refresh,
  };
};
