import { useEffect, useMemo, useState } from 'react'
import { Search, ChevronUp, ChevronDown, Clock } from 'lucide-react'
import { attendanceApi } from '../services'
import { getRelativeTime } from '../utils/timeDisplay'

const RANK_ORDER = ['FCINSP', 'FSUPT', 'FINSP', 'FSINSP', 'SFO4', 'SFO3', 'SFO2', 'SFO1', 'FO3', 'FO2', 'FO1', 'Engr.', 'Mr.']

const getRankIndex = (rank) => {
  const index = RANK_ORDER.indexOf(rank)
  return index >= 0 ? index : RANK_ORDER.length
}

const getRankColor = (rank) => {
  const index = getRankIndex(rank)
  const colors = [
    'bg-brand-secondary-soft text-brand-secondary',
    'bg-brand-accent-soft text-brand-accent-hover',
    'bg-status-info-soft text-status-info',
    'bg-status-success-soft text-status-success',
    'bg-status-warning-soft text-status-warning',
    'bg-brand-primary-soft text-brand-primary',
  ]
  return colors[index % colors.length]
}

function ListOfPersonnelPage() {
  const [personnelData, setPersonnelData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState('lastName')
  const [sortOrder, setSortOrder] = useState('asc')
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    let isActive = true

    const loadPersonnel = async () => {
      setIsLoading(true)
      setError('')

      const result = await attendanceApi.getPersonnel()
      if (!isActive) {
        return
      }

      if (!result.ok) {
        setPersonnelData([])
        setError(result.error?.message || 'Unable to load personnel records.')
        setIsLoading(false)
        return
      }

      setPersonnelData(Array.isArray(result.data?.items) ? result.data.items : [])
      setLastUpdated(new Date())
      setIsLoading(false)
    }

    void loadPersonnel()

    return () => {
      isActive = false
    }
  }, [])

  const filteredAndSorted = useMemo(() => {
    let filtered = personnelData.filter((person) => {
      const query = searchQuery.toLowerCase()
      return (
        person.accountNumber.toLowerCase().includes(query) ||
        person.lastName.toLowerCase().includes(query) ||
        person.firstName.toLowerCase().includes(query) ||
        person.rank.toLowerCase().includes(query) ||
        person.unit.toLowerCase().includes(query)
      )
    })

    filtered.sort((a, b) => {
      let aVal, bVal

      if (sortField === 'rank') {
        aVal = getRankIndex(a.rank)
        bVal = getRankIndex(b.rank)
      } else if (sortField === 'fullName') {
        aVal = `${a.lastName} ${a.firstName}`.toLowerCase()
        bVal = `${b.lastName} ${b.firstName}`.toLowerCase()
      } else {
        aVal = a[sortField]?.toString().toLowerCase() || ''
        bVal = b[sortField]?.toString().toLowerCase() || ''
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [personnelData, searchQuery, sortField, sortOrder])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const SortHeader = ({ field, label }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 font-semibold text-text-heading hover:text-brand-deep transition-colors"
    >
      {label}
      {sortField === field && (sortOrder === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
    </button>
  )

  return (
    <div className="min-h-screen bg-surface-canvas px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-panel border border-brand-secondary/25 bg-brand-deep/40 p-5 shadow-elevated backdrop-blur-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-heading text-display text-text-inverse">List of Personnel</h1>
              <p className="mt-1 text-body text-text-inverse/80">View and search through all personnel records</p>
              {lastUpdated && (
                <div className="mt-3 flex items-center gap-2 text-meta text-text-inverse/60">
                  <Clock className="h-4 w-4" />
                  <span>Last updated {getRelativeTime(lastUpdated)}</span>
                </div>
              )}
            </div>
            <div className="rounded-control border border-brand-secondary/25 bg-brand-deep-hover/60 px-4 py-3 text-right">
              <p className="text-meta uppercase tracking-wide text-text-inverse/70">Records</p>
              <p className="text-heading-2 text-text-inverse">{filteredAndSorted.length} / {personnelData.length}</p>
            </div>
          </div>
        </section>

        <section className="rounded-panel border border-surface-border bg-surface-base p-4 shadow-card sm:p-5">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <input
              type="text"
              placeholder="Search by name, rank, unit, or account number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-control border border-surface-border bg-surface-base py-3 pl-11 pr-4 text-body text-text-body placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-panel border border-surface-border bg-surface-base shadow-card">
          <div className="flex items-center justify-between border-b border-surface-border bg-surface-muted px-5 py-3">
            <p className="text-meta text-text-muted">
              Showing <span className="font-semibold text-text-heading">{filteredAndSorted.length}</span> personnel entries
            </p>
            {isLoading ? <p className="text-meta text-text-muted">Loading...</p> : null}
            {!isLoading && error ? <p className="text-meta text-status-danger">{error}</p> : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-surface-border bg-surface-elevated">
                  <th className="px-5 py-4 text-left"><SortHeader field="accountNumber" label="Account #" /></th>
                  <th className="px-5 py-4 text-left"><SortHeader field="rank" label="Rank" /></th>
                  <th className="px-5 py-4 text-left"><SortHeader field="fullName" label="Full Name" /></th>
                  <th className="px-5 py-4 text-left"><SortHeader field="unit" label="Unit" /></th>
                  <th className="px-5 py-4 text-left"><span className="font-semibold text-text-heading">Designation</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-10 text-center text-text-muted">No personnel found matching your search criteria</td>
                  </tr>
                ) : (
                  filteredAndSorted.map((person, idx) => (
                    <tr
                      key={person.accountNumber}
                      className={`border-b border-surface-border/80 transition-colors ${
                        idx % 2 === 0 ? 'bg-surface-base' : 'bg-surface-muted/40'
                      } hover:bg-brand-secondary-soft/60`}
                    >
                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-control bg-surface-muted px-2.5 py-1 text-meta font-semibold text-text-body">
                          {person.accountNumber}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-badge px-3 py-1 text-meta font-semibold ${getRankColor(person.rank)}`}>
                          {person.rank}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-text-heading">{person.lastName}, {person.firstName}</p>
                        {person.middleName ? <p className="text-meta text-text-muted">{person.middleName}</p> : null}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-control bg-brand-primary-soft px-3 py-1 text-meta font-semibold text-brand-primary">
                          {person.unit}
                        </span>
                      </td>
                      <td className="max-w-sm px-5 py-4 text-body text-text-body">
                        <p className="line-clamp-2" title={person.designation}>{person.designation}</p>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {filteredAndSorted.length > 0 ? (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <article className="rounded-panel border border-surface-border bg-surface-base p-4 shadow-card">
              <p className="text-meta text-text-muted">Total Personnel</p>
              <p className="mt-1 text-heading-1 text-text-heading">{personnelData.length}</p>
            </article>
            <article className="rounded-panel border border-surface-border bg-surface-base p-4 shadow-card">
              <p className="text-meta text-text-muted">Displayed</p>
              <p className="mt-1 text-heading-1 text-brand-primary">{filteredAndSorted.length}</p>
            </article>
            <article className="rounded-panel border border-surface-border bg-surface-base p-4 shadow-card">
              <p className="text-meta text-text-muted">Unique Units</p>
              <p className="mt-1 text-heading-1 text-brand-secondary">{new Set(personnelData.map((p) => p.unit)).size}</p>
            </article>
          </section>
        ) : null}
      </div>
    </div>
  )
}

export default ListOfPersonnelPage
