import { useCallback, useEffect, useState } from 'react'
import { attendanceApi, readCachedData } from '../services'

/**
 * Reusable hook for loading leave data with cache and refresh support.
 * 
 * @returns {Object} { data, isLoading, isRefreshing, error, lastUpdated, refresh }
 */
export const useLeavesData = () => {
  const [data, setData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const loadLeaves = useCallback(async (options = {}) => {
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
      const result = await attendanceApi.getLeaves({ forceRefresh })

      if (!result.ok) {
        if (!silent) {
          setError(result.error?.message || 'Failed to load leave data')
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
        setError(err?.message || 'An error occurred while loading leave data')
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
      const cachedData = readCachedData('leaves')

      if (!isActive) {
        return
      }

      if (Array.isArray(cachedData)) {
        setData(cachedData)
        setLastUpdated(new Date().toISOString())
        setIsLoading(false)
        // Trigger silent refresh in background
        void loadLeaves({ silent: true })
        return
      }

      // No cached data; load from network
      void loadLeaves({ silent: false })
    }

    void bootstrap()

    return () => {
      isActive = false
    }
  }, [loadLeaves])

  const refresh = useCallback(() => {
    void loadLeaves({ forceRefresh: true, silent: false })
  }, [loadLeaves])

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    refresh,
  }
}
