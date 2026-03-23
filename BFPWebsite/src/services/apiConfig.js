const APP_SCRIPT_BASE_URL_KEY = 'VITE_APPS_SCRIPT_BASE_URL'
const ADAPTER_MODE_KEY = 'VITE_API_ADAPTER_MODE'

const normalizeBaseUrl = (value) => {
  if (!value || typeof value !== 'string') {
    return ''
  }

  return value.replace(/\/+$/, '')
}

const resolveAdapterMode = (value) => {
  if (value === 'live') {
    return 'live'
  }

  return 'mock'
}

// Support both browser (import.meta.env) and Node.js (process.env) environments
const getEnvValue = (key) => {
  try {
    // Try browser environment first
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env[key]
    }
  } catch (e) {
    // Fallback to Node.js
  }

  if (typeof process !== 'undefined' && process.env) {
    return process.env[key]
  }
  return undefined
}

const baseUrl = normalizeBaseUrl(getEnvValue(APP_SCRIPT_BASE_URL_KEY))
const mode = resolveAdapterMode(getEnvValue(ADAPTER_MODE_KEY))

export const attendanceApiConfig = {
  baseUrl,
  mode,
  keys: {
    APP_SCRIPT_BASE_URL_KEY,
    ADAPTER_MODE_KEY,
  },
}

export const API_PATHS = {
  scan: '/scan',
  logs: '/logs',
  personnel: '/personnel',
  leaves: '/leaves',
}

const isGoogleAppsScriptUrl = (value) => {
  const lower = (value || '').toLowerCase()
  return lower.includes('script.google.com/macros/')
}

export const createApiUrl = (path, queryParams) => {
  if (!baseUrl) {
    return ''
  }

  const useRouteQuery = isGoogleAppsScriptUrl(baseUrl)
  const url = useRouteQuery ? new URL(baseUrl) : new URL(`${baseUrl}${path}`)

  if (useRouteQuery) {
    url.searchParams.set('route', path)
  }

  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return
      }

      url.searchParams.set(key, String(value))
    })
  }

  return url.toString()
}
