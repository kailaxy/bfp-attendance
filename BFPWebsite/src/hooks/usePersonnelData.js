import { useCallback, useEffect, useState } from 'react'
import { attendanceApi, readCachedData } from '../services'

/**
 * Reusable hook for loading personnel data with cache and refresh support.
 * 
 * @returns {Object} { data, isLoading, isRefreshing, error, lastUpdated, refresh }
 */
export const usePersonnelData = () => {
  const [data, setData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const loadPersonnel = useCallback(async (options = {}) => {
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
      const result = await attendanceApi.getPersonnel({ forceRefresh })

      if (!result.ok) {
        if (!silent) {
          setError(result.error?.message || 'Failed to load personnel')
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
        setError(err?.message || 'An error occurred while loading personnel')
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
      const cachedData = readCachedData('personnel')

      if (!isActive) {
        return
      }

      if (Array.isArray(cachedData)) {
        setData(cachedData)
        setLastUpdated(new Date().toISOString())
        setIsLoading(false)
        // Trigger silent refresh in background
        void loadPersonnel({ silent: true })
        return
      }

      // No cached data; load from network
      void loadPersonnel({ silent: false })
    }

    void bootstrap()

    return () => {
      isActive = false
    }
  }, [loadPersonnel])

  const refresh = useCallback(() => {
    void loadPersonnel({ forceRefresh: true, silent: false })
  }, [loadPersonnel])

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    refresh,
  }
}
