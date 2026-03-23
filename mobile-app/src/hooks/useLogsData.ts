import { useCallback, useEffect, useState } from 'react';
import { attendanceApi, getCachedLogs, setCachedLogs } from '../services';
import type { AttendanceLogEntry, ApiErrorPayload, LogsQueryParams } from '../types';

type LogsCacheMode = 'all' | 'raw' | 'archive';

export interface UseLogsDataOptions {
  source?: 'raw' | 'archive';
}

export interface UseLogsDataReturn {
  data: AttendanceLogEntry[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: ApiErrorPayload | null;
  lastUpdated: string | null;
  refresh: () => void;
}

/**
 * Reusable hook for loading attendance logs with AsyncStorage cache and refresh support (mobile).
 *
 * Bootstraps from AsyncStorage, then silent-refreshes in background.
 */
export const useLogsData = (options: UseLogsDataOptions = {}): UseLogsDataReturn => {
  const { source = undefined } = options;
  const [data, setData] = useState<AttendanceLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<ApiErrorPayload | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Determine cache mode based on source filter
  const cacheMode: LogsCacheMode = source === 'raw' ? 'raw' : source === 'archive' ? 'archive' : 'all';

  // Build query params
  const query: LogsQueryParams = source ? { source } : {};

  const loadLogs = useCallback(
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
        const result = await attendanceApi.getLogs(query);

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
        await setCachedLogs(cacheMode, items);

        if (!silent) {
          setError(null);
        }
      } catch (err) {
        const apiError: ApiErrorPayload = err instanceof Error ? {
          code: 'UNKNOWN_ERROR',
          message: err.message,
        } : {
          code: 'UNKNOWN_ERROR',
          message: 'An error occurred while loading logs',
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
    [cacheMode, query]
  );

  // Bootstrap: load cached data on mount, then silent refresh
  useEffect(() => {
    let isActive = true;

    const bootstrap = async () => {
      const cachedData = await getCachedLogs(cacheMode);

      if (!isActive) {
        return;
      }

      if (Array.isArray(cachedData)) {
        setData(cachedData);
        setLastUpdated(new Date().toISOString());
        setIsLoading(false);
        // Trigger silent refresh in background
        void loadLogs({ silent: true });
        return;
      }

      // No cached data; load from network
      void loadLogs({ silent: false });
    };

    void bootstrap();

    return () => {
      isActive = false;
    };
  }, [cacheMode, loadLogs]);

  const refresh = useCallback(() => {
    void loadLogs({ forceRefresh: true, silent: false });
  }, [loadLogs]);

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    refresh,
  };
};
