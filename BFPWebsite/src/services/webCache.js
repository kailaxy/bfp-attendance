const CACHE_VERSION = 'v1'
const CACHE_PREFIX = 'bfp.website.cache'
const DEFAULT_TTL_MS = {
  logs: 15 * 60 * 1000,
  personnel: 12 * 60 * 60 * 1000,
  leaves: 12 * 60 * 60 * 1000,
}

const backgroundRefreshRegistry = new Map()

const getStorage = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }
  } catch {
    return null
  }

  return null
}

const getCacheStorageKey = (resourceKey) => `${CACHE_PREFIX}.${CACHE_VERSION}.${resourceKey}`

const sortObjectKeys = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value
  }

  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = sortObjectKeys(value[key])
      return acc
    }, {})
}

const normalizeQueryForKey = (query = {}) => {
  const normalized = Object.entries(query).reduce((acc, [key, value]) => {
    if (value === undefined || value === null || value === '') {
      return acc
    }

    acc[key] = value
    return acc
  }, {})

  return sortObjectKeys(normalized)
}

export const createLogsCacheKey = (query = {}) => {
  const payload = normalizeQueryForKey(query)
  return `logs.${JSON.stringify(payload)}`
}

const readEntry = (resourceKey) => {
  const storage = getStorage()
  if (!storage) {
    return null
  }

  try {
    const raw = storage.getItem(getCacheStorageKey(resourceKey))
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) {
      return null
    }

    return {
      updatedAt: Number(parsed.updatedAt || 0),
      data: parsed.data,
    }
  } catch {
    return null
  }
}

const writeEntry = (resourceKey, data) => {
  const storage = getStorage()
  if (!storage) {
    return
  }

  try {
    storage.setItem(
      getCacheStorageKey(resourceKey),
      JSON.stringify({
        updatedAt: Date.now(),
        data,
      })
    )
  } catch {
    // Ignore quota/storage errors and keep flow non-blocking.
  }
}

const emitCacheUpdate = (resourceKey, data) => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return
  }

  window.dispatchEvent(
    new CustomEvent('bfp:cache-updated', {
      detail: { resourceKey, data },
    })
  )
}

const isExpired = (updatedAt, ttlMs) => {
  if (!updatedAt || !ttlMs) {
    return true
  }

  return Date.now() - updatedAt > ttlMs
}

const enqueueBackgroundRefresh = async (resourceKey, fetcher) => {
  if (backgroundRefreshRegistry.has(resourceKey)) {
    return
  }

  const refreshPromise = Promise.resolve()
    .then(fetcher)
    .then((result) => {
      if (result?.ok) {
        writeEntry(resourceKey, result.data)
        emitCacheUpdate(resourceKey, result.data)
      }
    })
    .finally(() => {
      backgroundRefreshRegistry.delete(resourceKey)
    })

  backgroundRefreshRegistry.set(resourceKey, refreshPromise)
}

export const readCachedData = (resourceKey) => {
  const entry = readEntry(resourceKey)
  return entry?.data ?? null
}

export const fetchWithCache = async ({
  resourceKey,
  ttlMs,
  forceRefresh = false,
  fetcher,
}) => {
  const effectiveTtl = ttlMs || DEFAULT_TTL_MS.logs

  if (forceRefresh) {
    const networkResult = await fetcher()
    if (networkResult?.ok) {
      writeEntry(resourceKey, networkResult.data)
      emitCacheUpdate(resourceKey, networkResult.data)
    }
    return networkResult
  }

  const cachedEntry = readEntry(resourceKey)

  if (cachedEntry?.data) {
    if (isExpired(cachedEntry.updatedAt, effectiveTtl)) {
      void enqueueBackgroundRefresh(resourceKey, fetcher)
    }

    return {
      ok: true,
      data: cachedEntry.data,
    }
  }

  const networkResult = await fetcher()
  if (networkResult?.ok) {
    writeEntry(resourceKey, networkResult.data)
    emitCacheUpdate(resourceKey, networkResult.data)
  }

  return networkResult
}

export const cacheTtl = DEFAULT_TTL_MS
