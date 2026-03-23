import { useCallback, useEffect, useState } from 'react';
import {
  attendanceApi,
  getCachedLogs,
  setCachedLogs,
  getCachedPersonnel,
  setCachedPersonnel,
  getCachedLeaves,
  setCachedLeaves,
} from '../services';
import type { AttendanceLogEntry, PersonnelEntry, LeaveEntry, ApiErrorPayload } from '../types';

export interface UseDashboardDataReturn {
  logs: AttendanceLogEntry[];
  personnel: PersonnelEntry[];
  leaves: LeaveEntry[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: ApiErrorPayload | null;
  lastUpdatedLogs: string | null;
  lastUpdatedPersonnel: string | null;
  lastUpdatedLeaves: string | null;
  refresh: () => void;
}

/**
 * Reusable hook for dashboard data (logs + personnel + leaves) with AsyncStorage cache (mobile).
 *
 * Orchestrates multiple API calls and caches individually.
 */
export const useDashboardData = (): UseDashboardDataReturn => {
  const [logs, setLogs] = useState<AttendanceLogEntry[]>([]);
  const [personnel, setPersonnel] = useState<PersonnelEntry[]>([]);
  const [leaves, setLeaves] = useState<LeaveEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<ApiErrorPayload | null>(null);
  const [lastUpdatedLogs, setLastUpdatedLogs] = useState<string | null>(null);
  const [lastUpdatedPersonnel, setLastUpdatedPersonnel] = useState<string | null>(null);
  const [lastUpdatedLeaves, setLastUpdatedLeaves] = useState<string | null>(null);

  const loadDashboard = useCallback(
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
        // Fetch all resources in parallel
        const [logsResult, personnelResult, leavesResult] = await Promise.all([
          attendanceApi.getLogs({ source: 'raw' }),
          attendanceApi.getPersonnel(),
          attendanceApi.getLeaves(),
        ]);

        // Process logs
        if (logsResult.ok) {
          const logItems = Array.isArray(logsResult.data?.items) ? logsResult.data.items : [];
          setLogs(logItems);
          setLastUpdatedLogs(new Date().toISOString());
          await setCachedLogs('raw', logItems);
        } else if (!silent) {
          setError(logsResult.error);
        }

        // Process personnel
        if (personnelResult.ok) {
          const personItems = Array.isArray(personnelResult.data?.items) ? personnelResult.data.items : [];
          setPersonnel(personItems);
          setLastUpdatedPersonnel(new Date().toISOString());
          await setCachedPersonnel(personItems);
        } else if (!silent) {
          setError(personnelResult.error);
        }

        // Process leaves
        if (leavesResult.ok) {
          const leaveItems = Array.isArray(leavesResult.data?.items) ? leavesResult.data.items : [];
          setLeaves(leaveItems);
          setLastUpdatedLeaves(new Date().toISOString());
          await setCachedLeaves(leaveItems);
        } else if (!silent) {
          setError(leavesResult.error);
        }
      } catch (err) {
        const apiError: ApiErrorPayload = err instanceof Error ? {
          code: 'UNKNOWN_ERROR',
          message: err.message,
        } : {
          code: 'UNKNOWN_ERROR',
          message: 'An error occurred while loading dashboard data',
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
      const [cachedLogs, cachedPersonnel, cachedLeaves] = await Promise.all([
        getCachedLogs('raw'),
        getCachedPersonnel(),
        getCachedLeaves(),
      ]);

      if (!isActive) {
        return;
      }

      // Load cached data if available
      if (Array.isArray(cachedLogs)) {
        setLogs(cachedLogs);
        setLastUpdatedLogs(new Date().toISOString());
      }

      if (Array.isArray(cachedPersonnel)) {
        setPersonnel(cachedPersonnel);
        setLastUpdatedPersonnel(new Date().toISOString());
      }

      if (Array.isArray(cachedLeaves)) {
        setLeaves(cachedLeaves);
        setLastUpdatedLeaves(new Date().toISOString());
      }

      // If we had all cached data, just refresh silently; otherwise load from network
      if (
        Array.isArray(cachedLogs) &&
        Array.isArray(cachedPersonnel) &&
        Array.isArray(cachedLeaves)
      ) {
        setIsLoading(false);
        void loadDashboard({ silent: true });
        return;
      }

      void loadDashboard({ silent: false });
    };

    void bootstrap();

    return () => {
      isActive = false;
    };
  }, [loadDashboard]);

  const refresh = useCallback(() => {
    void loadDashboard({ forceRefresh: true, silent: false });
  }, [loadDashboard]);

  return {
    logs,
    personnel,
    leaves,
    isLoading,
    isRefreshing,
    error,
    lastUpdatedLogs,
    lastUpdatedPersonnel,
    lastUpdatedLeaves,
    refresh,
  };
};
