import { useEffect, useMemo, useState } from 'react'
import { Archive, Clock, Clock3, Filter, Search, TriangleAlert } from 'lucide-react'
import { attendanceApi } from '../services'
import { getRelativeTime } from '../utils/timeDisplay'

const SOURCE_RAW = 'Raw'
const SOURCE_ARCHIVE = 'Archive'

const toDateSafe = (value) => {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

const isSameLocalDay = (dateA, dateB) => {
  if (!dateA || !dateB) {
    return false
  }

  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  )
}

const normalizeSourceLabel = (value) => {
  const lower = (value || '').toString().trim().toLowerCase()

  if (!lower) {
    return ''
  }

  if (lower.includes('raw') || lower.includes('operational') || lower === 'today') {
    return SOURCE_RAW
  }

  if (lower.includes('archive') || lower.includes('history') || lower.includes('historical')) {
    return SOURCE_ARCHIVE
  }

  return ''
}

const inferSourceLabel = (entryDate) => {
  if (!entryDate) {
    return SOURCE_ARCHIVE
  }

  return isSameLocalDay(entryDate, new Date()) ? SOURCE_RAW : SOURCE_ARCHIVE
}

const normalizeStatus = (status) => {
  const upper = (status || '').toString().trim().toUpperCase()

  if (!upper) {
    return 'Unknown'
  }

  if (['IN', 'TIME_IN', 'TIME-IN', 'ON-DUTY', 'ONDUTY'].includes(upper)) {
    return 'IN'
  }

  if (['OUT', 'TIME_OUT', 'TIME-OUT', 'OFF-DUTY', 'OFFDUTY'].includes(upper)) {
    return 'OUT'
  }

  return upper
}

const toTimeDisplay = (value) => {
  const date = toDateSafe(value)

  if (!date) {
    return '—'
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const toDateTimeDisplay = (value) => {
  const date = toDateSafe(value)

  if (!date) {
    return '—'
  }

  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const parseCoordinatePair = (value) => {
  const text = (value || '').toString().trim()
  if (!text) {
    return null
  }

  const match = text.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/)
  if (!match) {
    return null
  }

  const latitude = Number(match[1])
  const longitude = Number(match[2])

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null
  }

  return {
    latitude,
    longitude,
    normalized: `${latitude.toFixed(7)}, ${longitude.toFixed(7)}`,
  }
}

const toGoogleMapsSearchUrl = (coordinates) => {
  const query = encodeURIComponent(`${coordinates.latitude},${coordinates.longitude}`)
  return `https://www.google.com/maps/search/?api=1&query=${query}`
}

const entrySignature = (entry) => {
  const id = entry?.id || ''
  const personnelId = entry?.personnelId || ''
  const status = normalizeStatus(entry?.status)
  const timestamp = entry?.timestamp || entry?.timeOut || entry?.timeIn || ''

  return [id, personnelId, status, timestamp].join('|')
}

const toDisplayName = (entry) => {
  const firstName = (entry?.firstName || '').toString().trim()
  const lastName = (entry?.lastName || '').toString().trim()
  const rank = (entry?.rank || entry?.grade || '').toString().trim()

  if (firstName && lastName) {
    return [rank, lastName, firstName].filter(Boolean).join(' ').trim()
  }

  return (
    (entry?.name || entry?.fullName || '').toString().trim() || [firstName, lastName].filter(Boolean).join(' ').trim() || 'Unknown Personnel'
  )
}

const toStatusLabel = (status) => {
  const normalized = normalizeStatus(status)

  if (normalized === 'IN') {
    return 'On-Duty'
  }

  if (normalized === 'OUT') {
    return 'Off-Duty'
  }

  return (status || '').toString().trim() || 'Unknown'
}

const normalizeEntry = (entry, sourceHint) => {
  const status = normalizeStatus(entry?.status)
  const timeIn = (
    entry?.timeIn ||
    entry?.time_in ||
    entry?.timeInAt ||
    entry?.checkIn ||
    ''
  ).toString()
  const timeOut = (
    entry?.timeOut ||
    entry?.time_out ||
    entry?.timeOutAt ||
    entry?.checkOut ||
    ''
  ).toString()
  const timestamp = entry?.timestamp || timeOut || timeIn || ''
  const parsedTimestamp = toDateSafe(timestamp)
  const explicitSource = normalizeSourceLabel(entry?.source)
  const source = explicitSource || sourceHint || inferSourceLabel(parsedTimestamp)
  const statusLabel = toStatusLabel(entry?.status)
  const scanLocationValue =
    entry?.scanLocation?.locationLabel ||
    entry?.scanLocationLabel ||
    entry?.locationLabel ||
    entry?.scanLocation ||
    entry?.location ||
    ''

  return {
    id: entry?.id || entrySignature(entry),
    personnelId: entry?.personnelId || entry?.accountNumber || 'Unknown ID',
    name: toDisplayName(entry),
    unit: entry?.unit || entry?.units || entry?.UNITS || '',
    timeIn,
    timeOut,
    remarks: (entry?.remarks || entry?.remark || statusLabel).toString().trim(),
    scanLocation: scanLocationValue.toString().trim(),
    status,
    timestamp,
    source,
  }
}

const groupEntriesToRows = (entries) => {
  /** @type {Map<string, {
   * key: string,
   * personnelId: string,
   * name: string,
    * unit: string,
   * source: string,
   * timeIn: string,
   * timeOut: string,
  * remarks: string,
  * scanLocation: string,
   * latestTimestamp: string,
   * latestStatus: string,
   * _latestDate: Date | null
   * }>} */
  const grouped = new Map()

  entries.forEach((entry) => {
    const eventDate = toDateSafe(entry.timestamp)
    const dayKey = eventDate
      ? `${eventDate.getFullYear()}-${eventDate.getMonth() + 1}-${eventDate.getDate()}`
      : 'unknown-day'
    const groupKey = `${entry.personnelId}|${dayKey}|${entry.source}`

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        key: groupKey,
        personnelId: entry.personnelId,
        name: entry.name,
        unit: entry.unit,
        source: entry.source,
        timeIn: '',
        timeOut: '',
        remarks: '',
        scanLocation: '',
        latestTimestamp: entry.timestamp,
        latestStatus: entry.status,
        _latestDate: eventDate,
      })
    }

    const row = grouped.get(groupKey)
    if (!row) {
      return
    }

    if (!row.unit && entry.unit) {
      row.unit = entry.unit
    }

    if (entry.timeIn && !row.timeIn) {
      row.timeIn = entry.timeIn
    }

    if (entry.timeOut && !row.timeOut) {
      row.timeOut = entry.timeOut
    }

    if (entry.status === 'IN' && !row.timeIn) {
      row.timeIn = entry.timestamp
    }

    if (entry.status === 'OUT' && !row.timeOut) {
      row.timeOut = entry.timestamp
    }

    if (entry.remarks) {
      row.remarks = entry.remarks
    }

    if (entry.scanLocation) {
      row.scanLocation = entry.scanLocation
    }

    if (eventDate && (!row._latestDate || eventDate > row._latestDate)) {
      row.latestTimestamp = entry.timestamp
      row.latestStatus = entry.status
      row._latestDate = eventDate
    }
  })

  return Array.from(grouped.values())
    .map((row) => ({
      key: row.key,
      personnelId: row.personnelId,
      name: row.name,
      unit: row.unit || '—',
      source: row.source,
      timeIn: row.timeIn,
      timeOut: row.timeOut,
      remarks: row.remarks || (row.timeOut ? 'Off-Duty' : row.timeIn ? 'On-Duty' : toStatusLabel(row.latestStatus)),
      scanLocation: row.scanLocation || '—',
      latestTimestamp: row.latestTimestamp,
    }))
    .sort((a, b) => {
      const aDate = toDateSafe(a.latestTimestamp)
      const bDate = toDateSafe(b.latestTimestamp)

      if (!aDate && !bDate) {
        return 0
      }

      if (!aDate) {
        return 1
      }

      if (!bDate) {
        return -1
      }

      return bDate.getTime() - aDate.getTime()
    })
}

const parseLogsItems = (result) => {
  if (!result?.ok) {
    return []
  }

  return Array.isArray(result.data?.items) ? result.data.items : []
}

const sourceModeLabel = (mode) => {
  if (mode === 'query-split') {
    return 'Split Source Query'
  }

  if (mode === 'source-fallback') {
    return 'Source Inference Fallback'
  }

  return 'Single Feed'
}

const AttendanceLogsPage = () => {
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [sourceFilter, setSourceFilter] = useState('All')
  const [sourceMode, setSourceMode] = useState('single-feed')
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    let isActive = true

    const loadLogs = async () => {
      setIsLoading(true)
      setError('')

      const primaryResult = await attendanceApi.getLogs({ limit: 250 })
      if (!isActive) {
        return
      }

      if (!primaryResult.ok) {
        setError(primaryResult.error?.message || 'Unable to load attendance logs.')
        setRows([])
        setIsLoading(false)
        return
      }

      const primaryItems = parseLogsItems(primaryResult)
      const primaryWithExplicitSource = primaryItems.some((item) =>
        normalizeSourceLabel(item?.source)
      )

      if (primaryWithExplicitSource) {
        const normalizedEntries = primaryItems.map((item) => normalizeEntry(item))
        setRows(groupEntriesToRows(normalizedEntries))
        setSourceMode('single-feed')
        setLastUpdated(new Date())
        setIsLoading(false)
        return
      }

      const [rawResult, archiveResult] = await Promise.all([
        attendanceApi.getLogs({ limit: 250, source: 'raw' }),
        attendanceApi.getLogs({ limit: 250, source: 'archive' }),
      ])

      if (!isActive) {
        return
      }

      const rawItems = parseLogsItems(rawResult)
      const archiveItems = parseLogsItems(archiveResult)

      const rawSignatures = new Set(rawItems.map(entrySignature))
      const archiveSignatures = new Set(archiveItems.map(entrySignature))
      const overlapCount = Array.from(rawSignatures).filter((signature) =>
        archiveSignatures.has(signature)
      ).length

      const splitCallsUseful =
        rawResult.ok &&
        archiveResult.ok &&
        rawSignatures.size + archiveSignatures.size > 0 &&
        overlapCount < Math.min(rawSignatures.size, archiveSignatures.size)

      if (splitCallsUseful) {
        const combined = [
          ...rawItems.map((item) => normalizeEntry(item, SOURCE_RAW)),
          ...archiveItems.map((item) => normalizeEntry(item, SOURCE_ARCHIVE)),
        ]
        setRows(groupEntriesToRows(combined))
        setSourceMode('query-split')
        setLastUpdated(new Date())
        setIsLoading(false)
        return
      }

      const fallbackEntries = primaryItems.map((item) => normalizeEntry(item))
      setRows(groupEntriesToRows(fallbackEntries))
      setSourceMode('source-fallback')
      setLastUpdated(new Date())
      setIsLoading(false)
    }

    void loadLogs()

    return () => {
      isActive = false
    }
  }, [])

  const filteredRows = useMemo(() => {
    const search = searchValue.trim().toLowerCase()

    return rows.filter((row) => {
      const matchesSource = sourceFilter === 'All' ? true : row.source === sourceFilter

      if (!matchesSource) {
        return false
      }

      if (!search) {
        return true
      }

      return [row.personnelId, row.name, row.unit, row.remarks, row.scanLocation]
        .join(' ')
        .toLowerCase()
        .includes(search)
    })
  }, [rows, searchValue, sourceFilter])

  return (
    <section className="space-y-4">
      <header className="rounded-panel border border-brand-secondary/20 bg-surface-base p-5 shadow-card">
        <p className="text-meta font-semibold uppercase tracking-wide text-brand-secondary">
          Attendance Logs
        </p>
        <h2 className="mt-1 font-heading text-heading-1 text-text-heading">Operations Log Registry</h2>
        <p className="mt-2 text-body text-text-body">
          Operational logs are labeled as Raw and historical entries are labeled as Archive.
        </p>
        {lastUpdated && (
          <div className="mt-3 flex items-center gap-2 text-meta text-text-muted">
            <Clock className="h-4 w-4" />
            <span>Last updated {getRelativeTime(lastUpdated)}</span>
          </div>
        )}
      </header>

      <article className="rounded-panel border border-brand-secondary/20 bg-surface-base p-5 shadow-card print:border-slate-200 print:bg-white print:shadow-none">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-heading text-heading-3 text-text-heading">Personnel Attendance Records</h3>
            <p className="mt-1 text-meta text-text-muted">Filter and review per-person daily records.</p>
            <div className="mt-2 inline-flex items-center gap-1 rounded-badge bg-brand-secondary-soft px-2.5 py-1 text-meta font-semibold text-brand-secondary">
              <Clock3 size={13} />
              View mode: {sourceModeLabel(sourceMode)}
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
            <label className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="search"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search by name, ID, unit, status"
                className="w-full rounded-control border border-brand-secondary/25 bg-surface-base py-2 pl-9 pr-3 text-body text-text-body outline-none transition duration-160 focus-visible:ring-2 focus-visible:ring-focus sm:w-72"
              />
            </label>

            <label className="relative">
              <Filter
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                className="rounded-control border border-brand-secondary/25 bg-surface-base py-2 pl-9 pr-3 text-body text-text-body outline-none transition duration-160 focus-visible:ring-2 focus-visible:ring-focus"
              >
                <option value="All">All Sources</option>
                <option value={SOURCE_RAW}>{SOURCE_RAW}</option>
                <option value={SOURCE_ARCHIVE}>{SOURCE_ARCHIVE}</option>
              </select>
            </label>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-4 rounded-control border border-status-info/30 bg-status-info-soft p-4 text-body text-status-info">
            Loading attendance logs...
          </div>
        ) : null}

        {!isLoading && error ? (
          <div className="mt-4 rounded-control border border-status-danger/30 bg-status-danger-soft p-4">
            <p className="inline-flex items-center gap-1 font-semibold text-status-danger">
              <TriangleAlert size={14} />
              Unable to load attendance logs
            </p>
            <p className="mt-1 text-body text-status-danger">{error}</p>
          </div>
        ) : null}

        {!isLoading && !error && filteredRows.length === 0 ? (
          <div className="mt-4 rounded-control border border-brand-secondary/20 bg-surface-muted p-4 text-body text-text-muted">
            No attendance records found for the current filters.
          </div>
        ) : null}

        {!isLoading && !error && filteredRows.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-panel border border-brand-secondary/20 print:border-slate-300">
            <table className="min-w-full divide-y divide-brand-secondary/15 text-body print:text-[11px]">
              <thead className="bg-surface-muted print:bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left text-meta font-semibold uppercase tracking-wide text-text-muted">
                    Personnel ID
                  </th>
                  <th className="px-3 py-2 text-left text-meta font-semibold uppercase tracking-wide text-text-muted">
                    Name
                  </th>
                  <th className="px-3 py-2 text-left text-meta font-semibold uppercase tracking-wide text-text-muted">
                    Units
                  </th>
                  <th className="px-3 py-2 text-left text-meta font-semibold uppercase tracking-wide text-text-muted">
                    Time-In
                  </th>
                  <th className="px-3 py-2 text-left text-meta font-semibold uppercase tracking-wide text-text-muted">
                    Time-Out
                  </th>
                  <th className="px-3 py-2 text-left text-meta font-semibold uppercase tracking-wide text-text-muted">
                    Remarks
                  </th>
                  <th className="px-3 py-2 text-left text-meta font-semibold uppercase tracking-wide text-text-muted">
                    Scan Location
                  </th>
                  <th className="px-3 py-2 text-left text-meta font-semibold uppercase tracking-wide text-text-muted">
                    Source
                  </th>
                  <th className="px-3 py-2 text-left text-meta font-semibold uppercase tracking-wide text-text-muted">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-secondary/10 bg-surface-base">
                {filteredRows.map((row) => (
                  <tr key={row.key} className="hover:bg-surface-muted/60">
                    <td className="whitespace-nowrap px-3 py-2 text-text-body">
                      {row.personnelId}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-semibold text-text-heading">{row.name}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-text-body">{row.unit}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-text-body">
                      {toTimeDisplay(row.timeIn)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-text-body">
                      {toTimeDisplay(row.timeOut)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-text-body">{row.remarks}</td>
                    <td className="px-3 py-2 text-text-body">
                      {(() => {
                        const coordinates = parseCoordinatePair(row.scanLocation)

                        if (!coordinates) {
                          return <span>{row.scanLocation}</span>
                        }

                        const googleMapsUrl = toGoogleMapsSearchUrl(coordinates)

                        return (
                          <a
                            href={googleMapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-brand-primary underline decoration-brand-primary/40 underline-offset-2 hover:text-brand-primary-hover"
                            title="Open coordinates in Google Maps"
                          >
                            {coordinates.normalized}
                          </a>
                        )
                      })()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded-badge px-2.5 py-1 text-meta font-semibold ${
                          row.source === SOURCE_RAW
                            ? 'bg-brand-accent-soft text-brand-accent'
                            : 'bg-status-info-soft text-status-info'
                        }`}
                      >
                        {row.source === SOURCE_ARCHIVE ? <Archive size={12} className="mr-1" /> : null}
                        {row.source}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-text-body">
                      {toDateTimeDisplay(row.latestTimestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>
    </section>
  )
}

export default AttendanceLogsPage
