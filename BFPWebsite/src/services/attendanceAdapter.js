import { API_PATHS, attendanceApiConfig, createApiUrl } from './apiConfig.js'
import { cacheTtl, createLogsCacheKey, fetchWithCache } from './webCache.js'

/**
 * @typedef {import('../types/attendanceApiContracts.js').ScanRequestPayload} ScanRequestPayload
 * @typedef {import('../types/attendanceApiContracts.js').ScanResponsePayload} ScanResponsePayload
 * @typedef {import('../types/attendanceApiContracts.js').LogsQueryParams} LogsQueryParams
 * @typedef {import('../types/attendanceApiContracts.js').LogsResponsePayload} LogsResponsePayload
 * @typedef {import('../types/attendanceApiContracts.js').ApiErrorPayload} ApiErrorPayload
 * @typedef {import('../types/attendanceApiContracts.js').ApiResult<ScanResponsePayload>} ScanResult
 * @typedef {import('../types/attendanceApiContracts.js').ApiResult<LogsResponsePayload>} LogsResult
 */

const toErrorResult = (code, message, status, details) => ({
  ok: false,
  error: {
    code,
    message,
    status,
    details,
  },
})

const toSuccessResult = (data) => ({
  ok: true,
  data,
})

const getJson = async (response) => {
  const contentType = response.headers.get('content-type') || ''

  if (!contentType.includes('application/json')) {
    return null
  }

  try {
    return await response.json()
  } catch {
    return null
  }
}

/**
 * @param {{ fetchImpl?: typeof fetch }} [options]
 */
export const createLiveAttendanceAdapter = ({ fetchImpl = fetch } = {}) => ({
  /**
   * @param {ScanRequestPayload} payload
   * @returns {Promise<ScanResult>}
   */
  async submitScan(payload) {
    const endpoint = createApiUrl(API_PATHS.scan)

    if (!endpoint) {
      return toErrorResult(
        'CONFIG_ERROR',
        'Live adapter is enabled but VITE_APPS_SCRIPT_BASE_URL is not configured.',
        500
      )
    }

    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      })

      const json = await getJson(response)

      const envelopeError =
        json?.status === 'error' ||
        json?.success === false ||
        Boolean(json?.error)

      if (envelopeError) {
        return toErrorResult(
          json?.error?.code || json?.code || 'LIVE_SCAN_REQUEST_FAILED',
          json?.error?.message || json?.message || 'Live scan submission failed.',
          response.status,
          json
        )
      }

      if (!response.ok) {
        return toErrorResult(
          json?.code || 'LIVE_SCAN_REQUEST_FAILED',
          json?.message || 'Live scan submission failed.',
          response.status,
          json
        )
      }

      return toSuccessResult(
        /** @type {ScanResponsePayload} */ ({
          success: Boolean(json?.success ?? true),
          message: json?.message || 'Scan submitted successfully.',
          referenceId: json?.referenceId,
          timestamp: json?.timestamp || new Date().toISOString(),
          attendee: json?.attendee,
        })
      )
    } catch (error) {
      return toErrorResult('NETWORK_ERROR', 'Unable to reach attendance API.', 503, error)
    }
  },

  /**
   * @param {LogsQueryParams} [query]
   * @returns {Promise<LogsResult>}
   */
  async getLogs(query = {}, options = {}) {
    const endpoint = createApiUrl(API_PATHS.logs, query)

    if (!endpoint) {
      return toErrorResult(
        'CONFIG_ERROR',
        'Live adapter is enabled but VITE_APPS_SCRIPT_BASE_URL is not configured.',
        500
      )
    }

    return fetchWithCache({
      resourceKey: createLogsCacheKey(query),
      ttlMs: cacheTtl.logs,
      forceRefresh: Boolean(options?.forceRefresh),
      fetcher: async () => {
        try {
          const response = await fetchImpl(endpoint)
          const json = await getJson(response)

          if (!response.ok) {
            return toErrorResult(
              json?.code || 'LIVE_LOGS_REQUEST_FAILED',
              json?.message || 'Live logs retrieval failed.',
              response.status,
              json
            )
          }

          return toSuccessResult(
            /** @type {LogsResponsePayload} */ ({
              items: Array.isArray(json?.items) ? json.items : [],
              nextCursor: json?.nextCursor,
              total: typeof json?.total === 'number' ? json.total : undefined,
            })
          )
        } catch (error) {
          return toErrorResult('NETWORK_ERROR', 'Unable to reach attendance API.', 503, error)
        }
      },
    })
  },

  async getPersonnel(options = {}) {
    const endpoint = createApiUrl(API_PATHS.personnel)

    if (!endpoint) {
      return toErrorResult(
        'CONFIG_ERROR',
        'Live adapter is enabled but VITE_APPS_SCRIPT_BASE_URL is not configured.',
        500
      )
    }

    return fetchWithCache({
      resourceKey: 'personnel',
      ttlMs: cacheTtl.personnel,
      forceRefresh: Boolean(options?.forceRefresh),
      fetcher: async () => {
        try {
          const response = await fetchImpl(endpoint)
          const json = await getJson(response)

          if (!response.ok) {
            return toErrorResult(
              json?.code || 'LIVE_PERSONNEL_REQUEST_FAILED',
              json?.message || 'Live personnel retrieval failed.',
              response.status,
              json
            )
          }

          return toSuccessResult({
            items: Array.isArray(json?.items) ? json.items : [],
            total: typeof json?.total === 'number' ? json.total : undefined,
          })
        } catch (error) {
          return toErrorResult('NETWORK_ERROR', 'Unable to reach attendance API.', 503, error)
        }
      },
    })
  },

  async getLeaves(options = {}) {
    const endpoint = createApiUrl(API_PATHS.leaves)

    if (!endpoint) {
      return toErrorResult(
        'CONFIG_ERROR',
        'Live adapter is enabled but VITE_APPS_SCRIPT_BASE_URL is not configured.',
        500
      )
    }

    return fetchWithCache({
      resourceKey: 'leaves',
      ttlMs: cacheTtl.leaves,
      forceRefresh: Boolean(options?.forceRefresh),
      fetcher: async () => {
        try {
          const response = await fetchImpl(endpoint)
          const json = await getJson(response)

          if (!response.ok) {
            return toErrorResult(
              json?.code || 'LIVE_LEAVES_REQUEST_FAILED',
              json?.message || 'Live leave retrieval failed.',
              response.status,
              json
            )
          }

          return toSuccessResult({
            items: Array.isArray(json?.items) ? json.items : [],
            total: typeof json?.total === 'number' ? json.total : undefined,
          })
        } catch (error) {
          return toErrorResult('NETWORK_ERROR', 'Unable to reach attendance API.', 503, error)
        }
      },
    })
  },
})

const MOCK_LOGS = [
  {
    id: 'log-1001',
    timestamp: '2026-02-24T08:05:00.000Z',
    personnelId: 'BFP-001',
    name: 'Juan Dela Cruz',
    unit: 'CENTRAL',
    status: 'IN',
    source: 'mock',
  },
  {
    id: 'log-1002',
    timestamp: '2026-02-24T17:12:00.000Z',
    personnelId: 'BFP-001',
    name: 'Juan Dela Cruz',
    unit: 'CENTRAL',
    status: 'OUT',
    source: 'mock',
  },
  {
    id: 'log-1003',
    timestamp: '2026-02-24T08:11:00.000Z',
    personnelId: 'BFP-002',
    name: 'Maria Santos',
    unit: 'HULO',
    status: 'IN',
    source: 'mock',
  },
]

export const createMockAttendanceAdapter = () => ({
  /**
   * @param {ScanRequestPayload} payload
   * @returns {Promise<ScanResult>}
   */
  async submitScan(payload) {
    const qrValue = payload?.qrCode || 'UNKNOWN'

    // Mock: alternate status for demonstration (first scan = IN, second = OUT, third = block)
    // In real implementation, Apps Script tracks state per day
    const mockStatus = Math.random() > 0.5 ? 'IN' : 'OUT'

    return toSuccessResult({
      success: true,
      message: `Mock scan accepted for ${qrValue}.`,
      referenceId: `mock-${qrValue}`,
      timestamp: new Date().toISOString(),
      status: mockStatus,
      attendee: {
        personnelId: qrValue,
        name: qrValue === 'UNKNOWN' ? 'Unknown Personnel' : 'Mock Personnel',
        unit: 'Mock Unit',
      },
    })
  },

  /**
   * @param {LogsQueryParams} [query]
   * @returns {Promise<LogsResult>}
   */
  async getLogs(query = {}, options = {}) {
    const limit = Number.isInteger(query.limit) ? query.limit : MOCK_LOGS.length
    const personnelFilter = (query.personnelId || '').trim().toLowerCase()

    const filteredItems = MOCK_LOGS.filter((entry) => {
      if (!personnelFilter) {
        return true
      }

      return entry.personnelId.toLowerCase().includes(personnelFilter)
    }).slice(0, limit)

    return fetchWithCache({
      resourceKey: createLogsCacheKey(query),
      ttlMs: cacheTtl.logs,
      forceRefresh: Boolean(options?.forceRefresh),
      fetcher: async () =>
        toSuccessResult({
          items: filteredItems,
          total: filteredItems.length,
        }),
    })
  },

  async getPersonnel(options = {}) {
    return fetchWithCache({
      resourceKey: 'personnel',
      ttlMs: cacheTtl.personnel,
      forceRefresh: Boolean(options?.forceRefresh),
      fetcher: async () =>
        toSuccessResult({
          items: [
            {
              accountNumber: 'A99021',
              rank: 'FINSP',
              lastName: 'ABAD',
              firstName: 'METCHIL',
              middleName: 'RUGA',
              unit: 'PERSONNEL',
              designation: 'Chief, Personnel and Training Unit',
            },
            {
              accountNumber: 'A17009',
              rank: 'FO2',
              lastName: 'Andes',
              firstName: 'Fermar Jake',
              middleName: 'Berces',
              unit: 'PERSONNEL',
              designation: 'Staff, Admin Section',
            },
          ],
          total: 2,
        }),
    })
  },

  async getLeaves(options = {}) {
    return fetchWithCache({
      resourceKey: 'leaves',
      ttlMs: cacheTtl.leaves,
      forceRefresh: Boolean(options?.forceRefresh),
      fetcher: async () =>
        toSuccessResult({
          items: [
            {
              id: 'leave-001',
              personnelName: 'FO1 Tigas Jr',
              accountNumber: 'A24088',
              rank: 'FO1',
              leaveType: 'Vacation',
              startDate: '2026-02-18',
              endDate: '2026-02-24',
              reason: 'Personal leave',
              status: 'Approved',
            },
            {
              id: 'leave-002',
              personnelName: 'FO2 Andes',
              accountNumber: 'A17009',
              rank: 'FO2',
              leaveType: 'Sick Leave',
              startDate: '2026-02-23',
              endDate: '2026-02-25',
              reason: 'Medical appointment',
              status: 'Approved',
            },
          ],
          total: 2,
        }),
    })
  },
})

/**
 * @param {{ mode?: 'live' | 'mock', fetchImpl?: typeof fetch }} [options]
 */
export const createAttendanceAdapter = (options = {}) => {
  const mode = options.mode || attendanceApiConfig.mode
  const baseUrl = attendanceApiConfig.baseUrl

  // Safety guard: prevent live mode without API config
  if (mode === 'live' && !baseUrl) {
    const message =
      `[API Safety Guard] Live mode is enabled (VITE_API_ADAPTER_MODE=live) but ` +
      `VITE_APPS_SCRIPT_BASE_URL is not configured. This prevents accidental production ` +
      `deployment without proper API configuration. To enable live mode, set ` +
      `VITE_APPS_SCRIPT_BASE_URL in your .env.local file.`

    console.error(message)

    // Return mock adapter as fallback to prevent runtime errors
    return createMockAttendanceAdapter()
  }

  if (mode === 'live') {
    return createLiveAttendanceAdapter({ fetchImpl: options.fetchImpl })
  }

  return createMockAttendanceAdapter()
}

export const attendanceApi = createAttendanceAdapter()
