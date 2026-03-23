import { useCallback, useEffect, useState } from 'react'
import { attendanceApi, readCachedData, createLogsCacheKey } from '../services'

/**
 * Reusable hook for dashboard data (logs + personnel) with cache support.
 * 
 * Orchestrates multiple API calls and caches individually.
 * 
 * @returns {Object} { 
 *   logs, personnel, isLoading, isRefreshing, error, 
 *   lastUpdatedLogs, lastUpdatedPersonnel, refresh 
 * }
 */
export const useDashboardData = () => {
  const [logs, setLogs] = useState([])
  const [personnel, setPersonnel] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdatedLogs, setLastUpdatedLogs] = useState(null)
  const [lastUpdatedPersonnel, setLastUpdatedPersonnel] = useState(null)

  const logsCacheKey = createLogsCacheKey({ limit: 300 })

  const loadDashboard = useCallback(async (options = {}) => {
    const { forceRefresh = false, silent = false } = options

    if (!silent) {
      setError(null)
    }

    if (forceRefresh) {
      setIsRefreshing(true)
    } else if (!silent) {
      setIsLoading(true)
    }

    try {
      // Fetch logs and personnel in parallel
      const [logsResult, personnelResult] = await Promise.all([
        attendanceApi.getLogs({ limit: 300 }, { forceRefresh }),
        attendanceApi.getPersonnel({ forceRefresh }),
      ])

      // Process logs
      if (logsResult.ok) {
        const logItems = Array.isArray(logsResult.data?.items) ? logsResult.data.items : []
        setLogs(logItems)
        setLastUpdatedLogs(new Date().toISOString())
      } else if (!silent) {
        setError(logsResult.error?.message || 'Failed to load logs')
      }

      // Process personnel
      if (personnelResult.ok) {
        const personItems = Array.isArray(personnelResult.data?.items) ? personnelResult.data.items : []
        setPersonnel(personItems)
        setLastUpdatedPersonnel(new Date().toISOString())
      } else if (!silent) {
        setError(personnelResult.error?.message || 'Failed to load personnel')
      }
    } catch (err) {
      if (!silent) {
        setError(err?.message || 'An error occurred while loading dashboard data')
      }
    } finally {
      if (forceRefresh) {
        setIsRefreshing(false)
      } else if (!silent) {
        setIsLoading(false)
      }
    }
  }, [])

  // Bootstrap: load cached data on mount, then silent refresh
  useEffect(() => {
    let isActive = true

    const bootstrap = async () => {
      const cachedLogs = readCachedData(logsCacheKey)
      const cachedPersonnel = readCachedData('personnel')

      if (!isActive) {
        return
      }

      // Load cached data if available
      if (Array.isArray(cachedLogs)) {
        setLogs(cachedLogs)
        setLastUpdatedLogs(new Date().toISOString())
      }

      if (Array.isArray(cachedPersonnel)) {
        setPersonnel(cachedPersonnel)
        setLastUpdatedPersonnel(new Date().toISOString())
      }

      // If we had cached data, just refresh silently; otherwise load from network
      if (Array.isArray(cachedLogs) && Array.isArray(cachedPersonnel)) {
        setIsLoading(false)
        void loadDashboard({ silent: true })
        return
      }

      void loadDashboard({ silent: false })
    }

    void bootstrap()

    return () => {
      isActive = false
    }
  }, [logsCacheKey, loadDashboard])

  const refresh = useCallback(() => {
    void loadDashboard({ forceRefresh: true, silent: false })
  }, [loadDashboard])

  return {
    logs,
    personnel,
    isLoading,
    isRefreshing,
    error,
    lastUpdatedLogs,
    lastUpdatedPersonnel,
    refresh,
  }
}
