import { useCallback, useEffect, useState } from 'react';
import { attendanceApi, getCachedPersonnel, setCachedPersonnel } from '../services';
import type { PersonnelEntry, ApiErrorPayload } from '../types';

export interface UsePersonnelDataReturn {
  data: PersonnelEntry[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: ApiErrorPayload | null;
  lastUpdated: string | null;
  refresh: () => void;
}

/**
 * Reusable hook for loading personnel data with AsyncStorage cache and refresh support (mobile).
 *
 * Bootstraps from AsyncStorage, then silent-refreshes in background.
 */
export const usePersonnelData = (): UsePersonnelDataReturn => {
  const [data, setData] = useState<PersonnelEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<ApiErrorPayload | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadPersonnel = useCallback(
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
        const result = await attendanceApi.getPersonnel();

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
        await setCachedPersonnel(items);

        if (!silent) {
          setError(null);
        }
      } catch (err) {
        const apiError: ApiErrorPayload = err instanceof Error ? {
          code: 'UNKNOWN_ERROR',
          message: err.message,
        } : {
          code: 'UNKNOWN_ERROR',
          message: 'An error occurred while loading personnel',
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
      const cachedData = await getCachedPersonnel();

      if (!isActive) {
        return;
      }

      if (Array.isArray(cachedData)) {
        setData(cachedData);
        setLastUpdated(new Date().toISOString());
        setIsLoading(false);
        // Trigger silent refresh in background
        void loadPersonnel({ silent: true });
        return;
      }

      // No cached data; load from network
      void loadPersonnel({ silent: false });
    };

    void bootstrap();

    return () => {
      isActive = false;
    };
  }, [loadPersonnel]);

  const refresh = useCallback(() => {
    void loadPersonnel({ forceRefresh: true, silent: false });
  }, [loadPersonnel]);

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    refresh,
  };
};
