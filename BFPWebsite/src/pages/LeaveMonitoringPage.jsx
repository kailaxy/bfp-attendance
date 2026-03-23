import { useEffect, useMemo, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Clock, FileText } from 'lucide-react'
import { attendanceApi } from '../services'
import { getRelativeTime } from '../utils/timeDisplay'

const getMonthName = (date) => date.toLocaleString('default', { month: 'long', year: 'numeric' })
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate()
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay()

const parseDate = (dateStr) => {
  if (!dateStr) {
    return null
  }

  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatDate = (date) => date.toISOString().split('T')[0]

const toDateLabel = (value) => {
  const date = parseDate(value)
  return date ? date.toLocaleDateString() : '—'
}

const getLeaveForDate = (date, leaveData) => {
  const target = formatDate(date)
  return leaveData.filter((leave) => {
    const start = parseDate(leave.startDate)
    const end = parseDate(leave.endDate)
    const current = parseDate(target)
    if (!start || !end || !current) {
      return false
    }
    return current >= start && current <= end
  })
}

const getLeaveStatusColor = (status) => {
  const colors = {
    Approved: 'bg-status-success hover:brightness-95',
    Pending: 'bg-status-warning hover:brightness-95',
    Rejected: 'bg-status-danger hover:brightness-95',
  }
  return colors[status] || 'bg-brand-secondary hover:brightness-95'
}

function LeaveMonitoringPage() {
  const [leaveData, setLeaveData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedLeave, setSelectedLeave] = useState(null)
  const [showLeaveDetails, setShowLeaveDetails] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    let isActive = true

    const loadLeaves = async () => {
      setIsLoading(true)
      setError('')

      const result = await attendanceApi.getLeaves()
      if (!isActive) {
        return
      }

      if (!result.ok) {
        setLeaveData([])
        setError(result.error?.message || 'Unable to load leave records.')
        setIsLoading(false)
        return
      }

      setLeaveData(Array.isArray(result.data?.items) ? result.data.items : [])
      setLastUpdated(new Date())
      setIsLoading(false)
    }

    void loadLeaves()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    if (!selectedLeave) {
      return
    }

    const stillExists = leaveData.some((entry) => entry.id === selectedLeave.id)
    if (!stillExists) {
      setSelectedLeave(null)
    }
  }, [leaveData, selectedLeave])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  const calendarDays = useMemo(() => {
    const days = []
    for (let i = 0; i < firstDay; i += 1) {
      days.push(null)
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      days.push(day)
    }
    return days
  }, [daysInMonth, firstDay])

  const allLeaveInMonth = useMemo(() => {
    const leaveSet = new Set()

    leaveData.forEach((leave) => {
      const startDate = parseDate(leave.startDate)
      const endDate = parseDate(leave.endDate)
      const monthStart = new Date(year, month, 1)
      const monthEnd = new Date(year, month + 1, 0)

      if (startDate && endDate && startDate <= monthEnd && endDate >= monthStart) {
        leaveSet.add(leave.id)
      }
    })

    return Array.from(leaveSet).map((id) => leaveData.find((leave) => leave.id === id)).filter(Boolean)
  }, [leaveData, month, year])

  const handlePreviousMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  return (
    <div className="min-h-screen bg-surface-canvas px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-panel border border-brand-secondary/25 bg-brand-deep/40 p-5 shadow-elevated backdrop-blur-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-heading text-display text-text-inverse">Leave Monitoring</h1>
              <p className="mt-1 text-body text-text-inverse/80">Track personnel leave schedules and requests</p>
              {lastUpdated && (
                <div className="mt-3 flex items-center gap-2 text-meta text-text-inverse/60">
                  <Clock className="h-4 w-4" />
                  <span>Last updated {getRelativeTime(lastUpdated)}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <article className="rounded-control border border-brand-secondary/25 bg-brand-deep-hover/60 px-4 py-3">
                <p className="text-meta uppercase tracking-wide text-text-inverse/70">Requests This Month</p>
                <p className="text-heading-2 text-text-inverse">{allLeaveInMonth.length}</p>
              </article>
              <button
                onClick={() => setShowLeaveDetails((value) => !value)}
                className="inline-flex items-center gap-2 rounded-control bg-brand-primary px-4 py-3 text-meta font-semibold text-text-inverse transition duration-160 hover:bg-brand-primary-hover"
              >
                <FileText size={18} />
                {showLeaveDetails ? 'Hide' : 'Show'} Details
              </button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <section className={showLeaveDetails ? 'lg:col-span-2' : 'lg:col-span-3'}>
            <div className="rounded-panel border border-surface-border bg-surface-base p-5 shadow-card sm:p-6">
              <div className="mb-5 flex items-center justify-between border-b border-surface-border pb-4">
                <button
                  onClick={handlePreviousMonth}
                  className="rounded-control border border-surface-border bg-surface-base p-2 text-text-heading transition hover:bg-surface-muted"
                >
                  <ChevronLeft size={20} />
                </button>
                <h2 className="font-heading text-heading-1 text-text-heading">{getMonthName(currentDate)}</h2>
                <button
                  onClick={handleNextMonth}
                  className="rounded-control border border-surface-border bg-surface-base p-2 text-text-heading transition hover:bg-surface-muted"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              <div className="mb-2 grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="py-2 text-center text-meta font-semibold text-text-muted">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, idx) => {
                  if (day === null) {
                    return <div key={`empty-${idx}`} className="aspect-[1.08]" />
                  }

                  const date = new Date(year, month, day)
                  const dateStr = formatDate(date)
                  const dayLeaves = getLeaveForDate(date, leaveData)
                  const isToday = formatDate(new Date()) === dateStr
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6

                  return (
                    <div
                      key={day}
                      className={`aspect-[1.08] rounded-control border p-2 transition ${
                        isToday
                          ? 'border-brand-primary bg-brand-primary-soft/60'
                          : dayLeaves.length > 0
                            ? 'border-brand-secondary/35 bg-brand-secondary-soft/45'
                            : isWeekend
                              ? 'border-surface-border bg-surface-muted/70'
                              : 'border-surface-border bg-surface-base'
                      }`}
                    >
                      <div
                        className={`mb-1 text-meta font-semibold ${
                          isToday ? 'text-brand-primary' : isWeekend ? 'text-text-muted' : 'text-text-heading'
                        }`}
                      >
                        {day}
                      </div>

                      <div className="space-y-1">
                        {dayLeaves.slice(0, 2).map((leave) => (
                          <button
                            type="button"
                            key={leave.id}
                            onClick={() => setSelectedLeave(leave)}
                            className={`w-full truncate rounded px-1.5 py-1 text-left text-[11px] font-semibold text-text-inverse ${getLeaveStatusColor(leave.status)}`}
                            title={leave.personnelName}
                          >
                            {leave.personnelName}
                          </button>
                        ))}
                        {dayLeaves.length > 2 ? (
                          <p className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] font-semibold text-text-muted">
                            +{dayLeaves.length - 2} more
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-5 border-t border-surface-border pt-5">
                <h3 className="mb-3 text-heading-3 text-text-heading">Legend</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded bg-status-success" />
                    <span className="text-body text-text-body">Approved Leave</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded bg-status-warning" />
                    <span className="text-body text-text-body">Pending Leave</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded bg-status-danger" />
                    <span className="text-body text-text-body">Rejected Leave</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {showLeaveDetails ? (
            <aside className="lg:col-span-1">
              <div className="sticky top-8 rounded-panel border border-surface-border bg-surface-base p-5 shadow-card">
                <h3 className="mb-4 flex items-center gap-2 text-heading-2 text-text-heading">
                  <Calendar size={18} className="text-brand-primary" />
                  Leave Requests
                </h3>

                {allLeaveInMonth.length === 0 ? (
                  <div className="py-8 text-center text-text-muted">
                    <Calendar size={36} className="mx-auto mb-2 opacity-40" />
                    <p className="text-body">
                      {isLoading ? 'Loading leave requests...' : `No leave requests in ${getMonthName(currentDate)}`}
                    </p>
                    {error ? <p className="mt-2 text-meta text-status-danger">{error}</p> : null}
                  </div>
                ) : (
                  <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
                    {allLeaveInMonth.map((leave) => (
                      <button
                        key={leave.id}
                        onClick={() => setSelectedLeave(selectedLeave?.id === leave.id ? null : leave)}
                        className={`w-full rounded-control border p-3 text-left transition ${
                          selectedLeave?.id === leave.id
                            ? 'border-brand-primary bg-brand-primary-soft/60'
                            : 'border-surface-border hover:border-brand-secondary/40 hover:bg-surface-muted/60'
                        }`}
                      >
                        <p className="text-body font-semibold text-text-heading">{leave.personnelName}</p>
                        <p className="mt-1 flex items-center gap-1 text-meta text-text-muted">
                          <Clock size={13} />
                          {toDateLabel(leave.startDate)} - {toDateLabel(leave.endDate)}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`rounded px-2 py-1 text-[11px] font-semibold text-text-inverse ${getLeaveStatusColor(leave.status)}`}>
                            {leave.status}
                          </span>
                          <span className="text-meta text-text-muted">{leave.leaveType}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedLeave ? (
                  <div className="mt-5 border-t border-surface-border pt-5">
                    <h4 className="mb-3 text-heading-3 text-text-heading">Details</h4>
                    <div className="space-y-3 text-body">
                      <div>
                        <p className="text-meta font-semibold uppercase tracking-wide text-text-muted">Personnel</p>
                        <p className="font-semibold text-text-heading">{selectedLeave.personnelName}</p>
                        <p className="text-meta text-text-muted">{selectedLeave.accountNumber}</p>
                      </div>
                      <div>
                        <p className="text-meta font-semibold uppercase tracking-wide text-text-muted">Leave Type</p>
                        <p className="text-text-body">{selectedLeave.leaveType}</p>
                      </div>
                      <div>
                        <p className="text-meta font-semibold uppercase tracking-wide text-text-muted">Duration</p>
                        <p className="text-text-body">
                          {toDateLabel(selectedLeave.startDate)} to {toDateLabel(selectedLeave.endDate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-meta font-semibold uppercase tracking-wide text-text-muted">Reason</p>
                        <p className="text-text-body">{selectedLeave.reason}</p>
                      </div>
                      <div>
                        <p className="text-meta font-semibold uppercase tracking-wide text-text-muted">Status</p>
                        <span className={`inline-flex rounded px-2.5 py-1 text-[11px] font-semibold text-text-inverse ${getLeaveStatusColor(selectedLeave.status)}`}>
                          {selectedLeave.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default LeaveMonitoringPage
