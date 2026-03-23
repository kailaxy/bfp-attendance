import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock } from 'lucide-react'
import { attendanceApi } from '../services'
import { getRelativeTime } from '../utils/timeDisplay'

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

const normalizeStatus = (status) => {
  const upper = (status || '').toString().trim().toUpperCase()

  if (!upper) {
    return 'UNKNOWN'
  }

  if (['IN', 'TIME_IN', 'TIME-IN', 'ON-DUTY', 'ONDUTY'].includes(upper)) {
    return 'IN'
  }

  if (['OUT', 'TIME_OUT', 'TIME-OUT', 'OFF-DUTY', 'OFFDUTY'].includes(upper)) {
    return 'OUT'
  }

  return upper
}

const normalizeSourceLabel = (value) => {
  const lower = (value || '').toString().trim().toLowerCase()

  if (!lower) {
    return ''
  }

  if (lower.includes('raw') || lower.includes('operational') || lower === 'today') {
    return 'raw'
  }

  if (lower.includes('archive') || lower.includes('history') || lower.includes('historical')) {
    return 'archive'
  }

  return ''
}

const entrySignature = (entry) => {
  const id = entry?.id || ''
  const personnelId = entry?.personnelId || entry?.accountNumber || ''
  const status = normalizeStatus(entry?.status)
  const timestamp = entry?.timestamp || entry?.timeIn || entry?.timeOut || ''

  return [id, personnelId, status, timestamp].join('|')
}

const parseLogsItems = (result) => {
  if (!result?.ok) {
    return []
  }

  return Array.isArray(result.data?.items) ? result.data.items : []
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

const REFERENCE_RANKS = [
  'FCINSP',
  'FSUPT',
  'FINSP',
  'FSINSP',
  'SFO4',
  'SFO3',
  'SFO2',
  'SFO1',
  'FO3',
  'FO2',
  'FO1',
  'Engr.',
  'Mr.',
]

const toRankKey = (value) => (value || '').toString().trim().toUpperCase()

const RANK_LOOKUP = new Map(REFERENCE_RANKS.map((rank) => [toRankKey(rank), rank]))
const EXCLUDED_UNITS = new Set(['Station 1', 'Station 2'])

const inferRankFromName = (name) => {
  const normalizedName = (name || '').toString().trim().toUpperCase()
  if (!normalizedName) {
    return ''
  }

  const matchedRank = REFERENCE_RANKS.find((rank) => {
    const normalizedRank = toRankKey(rank)
    return normalizedName === normalizedRank || normalizedName.startsWith(`${normalizedRank} `)
  })

  return matchedRank || ''
}

const normalizeRank = (rank, name) => {
  const explicitRank = (rank || '').toString().trim()
  if (explicitRank) {
    return RANK_LOOKUP.get(toRankKey(explicitRank)) || explicitRank
  }

  const inferredRank = inferRankFromName(name)
  return inferredRank || 'Unspecified'
}

const normalizeEntries = (items) =>
  items
    .map((item) => {
      const timestamp = item?.timestamp || item?.timeIn || item?.timeOut || ''
      const name = toDisplayName(item)

      return {
        id: item?.id || `${item?.personnelId || 'unknown'}-${timestamp}-${item?.status || ''}`,
        personnelId: item?.personnelId || item?.accountNumber || 'Unknown ID',
        name,
        rank: normalizeRank(item?.rank || item?.grade, name),
        unit: item?.unit || item?.station || 'Unassigned Unit',
        status: normalizeStatus(item?.status),
        timestamp,
        date: toDateSafe(timestamp),
      }
    })
    .filter((entry) => entry.date)
    .sort((a, b) => b.date.getTime() - a.date.getTime())

const percentage = (value, total) => {
  if (!total) {
    return 0
  }

  return Math.round((value / total) * 100)
}

const compactDateTime = (value) => {
  const date = toDateSafe(value)
  if (!date) {
    return '—'
  }

  return date.toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const buildMetrics = (entries, selectedUnit = 'All Units', rosterTotal = null) => {
  const now = new Date()
  const allPersonnel = new Set(entries.map((entry) => entry.personnelId))
  const todayEntries = entries.filter((entry) => isSameLocalDay(entry.date, now))

  /** @type {Map<string, { latest: typeof todayEntries[number], firstIn: typeof todayEntries[number] | null }>} */
  const perPersonnelToday = new Map()

  todayEntries
    .slice()
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .forEach((entry) => {
      if (!perPersonnelToday.has(entry.personnelId)) {
        perPersonnelToday.set(entry.personnelId, {
          latest: entry,
          firstIn: entry.status === 'IN' ? entry : null,
        })
        return
      }

      const existing = perPersonnelToday.get(entry.personnelId)
      if (!existing) {
        return
      }

      if (entry.status === 'IN' && !existing.firstIn) {
        existing.firstIn = entry
      }

      if (entry.date > existing.latest.date) {
        existing.latest = entry
      }
    })

  const totalPersonnelFromLogs = allPersonnel.size
  const totalPersonnel = Number.isInteger(rosterTotal) && rosterTotal >= 0 ? rosterTotal : totalPersonnelFromLogs
  const todayPresent = Array.from(perPersonnelToday.values()).filter(
    (record) => record.latest.status === 'IN'
  ).length
  const onDuty = todayPresent
  const completedShift = Array.from(perPersonnelToday.values()).filter(
    (record) => record.latest.status === 'OUT'
  ).length

  const onTimeCutoff = new Date(now)
  onTimeCutoff.setHours(8, 15, 0, 0)

  const firstIns = Array.from(perPersonnelToday.values()).filter((record) => record.firstIn)
  const onTimeCount = firstIns.filter((record) => {
    if (!record.firstIn?.date) {
      return false
    }

    return record.firstIn.date.getTime() <= onTimeCutoff.getTime()
  }).length

  const lateArrivals = firstIns.length - onTimeCount
  const attendanceRate = percentage(todayPresent, totalPersonnel)
  const onTimeRatio = percentage(onTimeCount, firstIns.length)
  const absences = Math.max(totalPersonnel - todayPresent, 0)

  const hourlyBuckets = Array.from({ length: 8 }, (_, index) => {
    const hour = 6 + index * 2
    const labelHour = hour > 12 ? hour - 12 : hour
    const suffix = hour >= 12 ? 'PM' : 'AM'
    return {
      hour,
      label: `${labelHour}:00 ${suffix}`,
      count: 0,
    }
  })

  todayEntries
    .filter((entry) => entry.status === 'IN')
    .forEach((entry) => {
      const hour = entry.date.getHours()
      const bucketIndex = Math.max(0, Math.min(7, Math.floor((hour - 6) / 2)))
      if (hourlyBuckets[bucketIndex]) {
        hourlyBuckets[bucketIndex].count += 1
      }
    })

  const maxTrendCount = Math.max(1, ...hourlyBuckets.map((bucket) => bucket.count))
  const trend = hourlyBuckets.map((bucket) => ({
    ...bucket,
    percent: percentage(bucket.count, maxTrendCount),
  }))

  const onDutyRecords = Array.from(perPersonnelToday.values()).filter(
    (record) => record.latest.status === 'IN'
  )

  const unitOptions = [
    'All Units',
    ...Array.from(
      new Set(
        onDutyRecords
          .map((record) => record.latest.unit || 'Unassigned Unit')
          .filter((unit) => !EXCLUDED_UNITS.has(unit))
      )
    ).sort((a, b) => a.localeCompare(b)),
  ]

  const normalizedSelectedUnit =
    selectedUnit && unitOptions.includes(selectedUnit) ? selectedUnit : 'All Units'

  const filteredOnDutyRecords =
    normalizedSelectedUnit === 'All Units'
      ? onDutyRecords
      : onDutyRecords.filter(
          (record) => (record.latest.unit || 'Unassigned Unit') === normalizedSelectedUnit
        )

  const rankCounts = new Map()
  filteredOnDutyRecords.forEach((record) => {
    const rank = normalizeRank(record.latest.rank, record.latest.name)
    rankCounts.set(rank, (rankCounts.get(rank) || 0) + 1)
  })

  const headcountByRank = [
    ...REFERENCE_RANKS.filter((rank) => rankCounts.has(rank)).map((rank) => ({
      rank,
      count: rankCounts.get(rank) || 0,
    })),
    ...Array.from(rankCounts.entries())
      .filter(([rank]) => !REFERENCE_RANKS.includes(rank))
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([rank, count]) => ({ rank, count })),
  ]

  const filteredOnDutyCount = filteredOnDutyRecords.length
  const maxRankCount = Math.max(1, ...headcountByRank.map((row) => row.count))
  const rankRows = headcountByRank.map((row) => ({
    ...row,
    percent: percentage(row.count, maxRankCount),
  }))

  const recentActivities = todayEntries.slice(0, 6)

  return {
    kpis: {
      totalPersonnel,
      todayPresent,
      attendanceRate,
      onTimeRatio,
      lateArrivals,
      absences,
      onDuty,
      completedShift,
    },
    trend,
    unitOptions,
    selectedUnit: normalizedSelectedUnit,
    filteredOnDutyCount,
    rankRows,
    recentActivities,
  }
}

const KpiCard = ({ title, value, subtitle, tone = 'default' }) => {
  const toneClassMap = {
    default: 'border-brand-secondary/15',
    primary: 'border-brand-primary/30',
    success: 'border-status-success/30',
    warning: 'border-status-warning/30',
    danger: 'border-status-danger/30',
  }

  return (
    <article
      className={`rounded-panel border bg-surface-base p-4 shadow-card ${
        toneClassMap[tone] || toneClassMap.default
      }`}
    >
      <p className="text-meta font-semibold uppercase tracking-wide text-text-muted">{title}</p>
      <p className="mt-3 font-heading text-heading-1 text-text-heading">{value}</p>
      <p className="mt-1 text-meta text-text-muted">{subtitle}</p>
    </article>
  )
}

const DashboardPage = () => {
  const [entries, setEntries] = useState([])
  const [rosterTotal, setRosterTotal] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedUnit, setSelectedUnit] = useState('All Units')
  const [lastUpdated, setLastUpdated] = useState(null)

  const loadDashboard = useCallback(async () => {
    setIsLoading(true)
    setError('')

    const [primaryResult, personnelResult] = await Promise.all([
      attendanceApi.getLogs({ limit: 300 }),
      attendanceApi.getPersonnel(),
    ])

    if (personnelResult.ok) {
      const personnelItems = Array.isArray(personnelResult.data?.items) ? personnelResult.data.items : []
      setRosterTotal(personnelItems.length)
    } else {
      setRosterTotal(null)
    }

    if (!primaryResult.ok) {
      setError(primaryResult.error?.message || 'Unable to load dashboard metrics.')
      setEntries([])
      setRosterTotal(null)
      setIsLoading(false)
      return
    }

    const primaryItems = parseLogsItems(primaryResult)
    const hasSourceLabels = primaryItems.some((item) => normalizeSourceLabel(item?.source))

    if (hasSourceLabels) {
      setEntries(normalizeEntries(primaryItems))
      setIsLoading(false)
      return
    }

    const [rawResult, archiveResult] = await Promise.all([
      attendanceApi.getLogs({ limit: 300, source: 'raw' }),
      attendanceApi.getLogs({ limit: 300, source: 'archive' }),
    ])

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

    const mergedItems = splitCallsUseful ? [...rawItems, ...archiveItems] : primaryItems
    setEntries(normalizeEntries(mergedItems))
    setLastUpdated(new Date())
    setIsLoading(false)
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const dashboard = useMemo(
    () => buildMetrics(entries, selectedUnit, rosterTotal),
    [entries, selectedUnit, rosterTotal]
  )

  useEffect(() => {
    if (!dashboard.unitOptions.includes(selectedUnit)) {
      setSelectedUnit('All Units')
    }
  }, [dashboard.unitOptions, selectedUnit])

  const hasData = entries.length > 0

  return (
    <section className="space-y-4">
      <header className="rounded-panel border border-brand-secondary/20 bg-surface-base p-5 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-meta font-semibold uppercase tracking-wide text-brand-secondary">
              Home / Dashboard
            </p>
            <h2 className="mt-1 font-heading text-heading-1 text-text-heading">Attendance Command View</h2>
            <p className="mt-2 max-w-3xl text-body text-text-body">
              Daily operational metrics derived from attendance logs. Figures are adapter-driven and
              update for both mock and live modes.
            </p>
            {lastUpdated && (
              <div className="mt-3 flex items-center gap-2 text-meta text-text-muted">
                <Clock className="h-4 w-4" />
                <span>Last updated {getRelativeTime(lastUpdated)}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="inline-flex items-center justify-center rounded-control border border-brand-secondary/30 bg-brand-secondary px-4 py-2 text-meta font-semibold text-text-inverse transition duration-160 hover:bg-brand-secondary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            Refresh Metrics
          </button>
        </div>
      </header>

      {isLoading ? (
        <article className="rounded-panel border border-brand-secondary/20 bg-surface-base p-5 shadow-card">
          <p className="text-body text-text-muted">Loading dashboard metrics...</p>
        </article>
      ) : null}

      {!isLoading && error ? (
        <article className="rounded-panel border border-status-danger/30 bg-status-danger-soft p-5 shadow-card">
          <p className="font-heading text-heading-3 text-status-danger">Unable to load dashboard</p>
          <p className="mt-1 text-body text-status-danger">{error}</p>
        </article>
      ) : null}

      {!isLoading && !error && !hasData ? (
        <article className="rounded-panel border border-brand-secondary/20 bg-surface-base p-5 shadow-card">
          <p className="font-heading text-heading-3 text-text-heading">No attendance data yet</p>
          <p className="mt-1 text-body text-text-muted">
            Metrics will appear once scanner and logs APIs return attendance events.
          </p>
        </article>
      ) : null}

      {!isLoading && !error && hasData ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard
              title="Total Personnel"
              value={dashboard.kpis.totalPersonnel}
              subtitle="From active personnel roster"
              tone="default"
            />
            <KpiCard
              title="On Duty Now"
              value={dashboard.kpis.onDuty}
              subtitle="Latest status is IN"
              tone="success"
            />
            <KpiCard
              title="Attendance Rate"
              value={`${dashboard.kpis.attendanceRate}%`}
              subtitle="On-duty vs known personnel"
              tone="primary"
            />
            <KpiCard
              title="On-Time Ratio"
              value={`${dashboard.kpis.onTimeRatio}%`}
              subtitle="First IN at or before 8:15 AM"
              tone="warning"
            />
            <KpiCard
              title="Late Arrivals"
              value={dashboard.kpis.lateArrivals}
              subtitle={`${dashboard.kpis.absences} approx. absences today`}
              tone="danger"
            />
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-5">
            <article className="rounded-panel border border-brand-secondary/20 bg-surface-base p-5 shadow-card xl:col-span-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-heading text-heading-3 text-text-heading">Check-In Trend (Today)</h3>
                  <p className="mt-1 text-meta text-text-muted">
                    Two-hour check-in volume blocks for quick staffing rhythm assessment.
                  </p>
                </div>
                <span className="rounded-badge bg-status-info-soft px-3 py-1 text-meta font-semibold text-status-info">
                  {dashboard.kpis.todayPresent} active
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {dashboard.trend.map((bucket) => (
                  <div key={bucket.label} className="rounded-control bg-surface-muted p-3">
                    <p className="text-meta font-semibold text-text-muted">{bucket.label}</p>
                    <div className="mt-2 h-2 rounded-badge bg-brand-secondary-soft">
                      <div
                        className="h-2 rounded-badge bg-brand-secondary transition-all duration-160"
                        style={{ width: `${bucket.percent}%` }}
                      />
                    </div>
                    <p className="mt-2 text-meta text-text-body">{bucket.count} check-ins</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-panel border border-brand-secondary/20 bg-surface-base p-5 shadow-card xl:col-span-2">
              <h3 className="font-heading text-heading-3 text-text-heading">On-Duty Headcount by Rank</h3>
              <p className="mt-1 text-meta text-text-muted">Filtered by unit using active personnel only.</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {dashboard.unitOptions.map((unit) => {
                  const isActive = dashboard.selectedUnit === unit

                  return (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => setSelectedUnit(unit)}
                      className={`rounded-badge px-3 py-1.5 text-meta font-semibold transition duration-160 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 ${
                        isActive
                          ? 'bg-brand-secondary text-text-inverse'
                          : 'bg-surface-muted text-text-body hover:bg-brand-secondary-soft'
                      }`}
                    >
                      {unit}
                    </button>
                  )
                })}
              </div>

              <div className="mt-4">
                {dashboard.rankRows.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                      {dashboard.rankRows.map((row) => (
                        <div key={row.rank} className="rounded-control bg-surface-muted p-2">
                          <div className="flex flex-col gap-1.5">
                            <div>
                              <p className="text-[11px] leading-tight text-text-body">
                                <span>{row.rank}</span>
                                <span className="ml-0.5 font-bold text-text-heading">{row.count}</span>
                              </p>
                            </div>
                            <div className="h-1 rounded-badge bg-surface-base">
                              <div
                                className="h-1 rounded-badge bg-brand-secondary transition-all duration-160"
                                style={{ width: `${row.percent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-meta text-text-muted">
                      {dashboard.filteredOnDutyCount} total on-duty personnel in{' '}
                      {dashboard.selectedUnit === 'All Units' ? 'all units' : dashboard.selectedUnit}.
                    </p>
                  </div>
                ) : (
                  <p className="rounded-control bg-surface-muted p-3 text-body text-text-muted">
                    No on-duty personnel found for the selected unit.
                  </p>
                )}
              </div>
            </article>
          </div>

          <div className="grid gap-4 lg:grid-cols-1">
            <article className="rounded-panel border border-brand-secondary/20 bg-surface-base p-5 shadow-card">
              <h3 className="font-heading text-heading-3 text-text-heading">Recent Attendance Activity</h3>
              <p className="mt-1 text-meta text-text-muted">Latest events from today for quick review.</p>

              <ul className="mt-4 space-y-3">
                {dashboard.recentActivities.map((activity) => {
                  const isIn = activity.status === 'IN'

                  return (
                    <li
                      key={activity.id}
                      className="flex items-center justify-between rounded-control bg-surface-muted p-3"
                    >
                      <div>
                        <p className="text-body font-semibold text-text-body">{activity.name}</p>
                        <p className="text-meta text-text-muted">
                          {activity.personnelId} • {activity.unit}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex rounded-badge px-2.5 py-1 text-meta font-semibold ${
                            isIn
                              ? 'bg-status-success-soft text-status-success'
                              : 'bg-status-warning-soft text-status-warning'
                          }`}
                        >
                          {isIn ? 'On Duty' : 'Off Duty'}
                        </span>
                        <p className="mt-1 text-meta text-text-muted">
                          {compactDateTime(activity.timestamp)}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </article>
          </div>
        </>
      ) : null}
    </section>
  )
}

export default DashboardPage
