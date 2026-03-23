import { useCallback, useEffect, useState } from 'react'
import { attendanceApi, createLogsCacheKey, readCachedData } from '../services'

/**
 * Reusable hook for loading attendance logs with cache and refresh support.
 * 
 * @param {Object} options
 * @param {string} [options.source] - Filter by source: 'raw', 'archive', or undefined for all
 * @param {number} [options.limit] - Limit number of records (default: 250)
 * @returns {Object} { data, isLoading, isRefreshing, error, lastUpdated, refresh }
 */
export const useLogsData = (options = {}) => {
  const { source = undefined, limit = 250 } = options
  const [data, setData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  // Build cache key based on query params
  const query = source ? { source, limit } : { limit }
  const cacheKey = createLogsCacheKey(query)

  const loadLogs = useCallback(async (options = {}) => {
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
      const result = await attendanceApi.getLogs(query, { forceRefresh })

      if (!result.ok) {
        if (!silent) {
          setError(result.error?.message || 'Failed to load logs')
          setData([])
        }
        if (forceRefresh) {
          setIsRefreshing(false)
        } else if (!silent) {
          setIsLoading(false)
        }
        return
      }

      const items = Array.isArray(result.data?.items) ? result.data.items : []
      setData(items)
      setLastUpdated(new Date().toISOString())

      if (!silent) {
        setError(null)
      }
    } catch (err) {
      if (!silent) {
        setError(err?.message || 'An error occurred while loading logs')
      }
    } finally {
      if (forceRefresh) {
        setIsRefreshing(false)
      } else if (!silent) {
        setIsLoading(false)
      }
    }
  }, [query])

  // Bootstrap: load cached data on mount, then silent refresh
  useEffect(() => {
    let isActive = true

    const bootstrap = async () => {
      const cachedData = readCachedData(cacheKey)

      if (!isActive) {
        return
      }

      if (Array.isArray(cachedData)) {
        setData(cachedData)
        setLastUpdated(new Date().toISOString())
        setIsLoading(false)
        // Trigger silent refresh in background
        void loadLogs({ silent: true })
        return
      }

      // No cached data; load from network
      void loadLogs({ silent: false })
    }

    void bootstrap()

    return () => {
      isActive = false
    }
  }, [cacheKey, loadLogs])

  const refresh = useCallback(() => {
    void loadLogs({ forceRefresh: true, silent: false })
  }, [loadLogs])

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    refresh,
  }
}
