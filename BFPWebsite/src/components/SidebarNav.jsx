const NAV_ITEMS = [
  {
    key: 'personnel',
    label: 'Personnel Roster',
    description: 'Manage and review personnel records',
  },
  {
    key: 'dashboard',
    label: 'Command Dashboard',
    description: 'Daily attendance command overview',
  },
  {
    key: 'scanner',
    label: 'QR Scanner',
    description: 'Live scan and attendance validation',
  },
  {
    key: 'logs',
    label: 'Operations Logs',
    description: 'Review attendance activity history',
  },
  {
    key: 'leave',
    label: 'Leave Monitoring',
    description: 'Track leave requests and schedule',
  },
]

const SidebarNav = ({ activeView, onViewChange, onNavigate }) => {
  return (
    <nav className="mt-6 space-y-2" aria-label="Primary navigation">
      {NAV_ITEMS.map((item) => {
        const isActive = item.key === activeView

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              onViewChange(item.key)
              onNavigate()
            }}
            className={`w-full rounded-panel border px-4 py-3 text-left shadow-card transition duration-160 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 ${
              isActive
                ? 'border-brand-primary/55 bg-brand-primary text-text-inverse'
                : 'border-brand-secondary/20 bg-brand-deep-hover/40 text-text-inverse hover:border-brand-secondary/45 hover:bg-brand-secondary/35'
            }`}
            aria-current={isActive ? 'page' : undefined}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-body font-semibold">{item.label}</div>
                <div className={`mt-1 text-meta ${isActive ? 'text-text-inverse/85' : 'text-text-inverse/70'}`}>
                  {item.description}
                </div>
              </div>
              <span
                className={`inline-flex rounded-badge px-2 py-1 text-meta font-semibold ${
                  isActive
                    ? 'bg-text-inverse/15 text-text-inverse'
                    : 'bg-brand-secondary-soft text-brand-secondary'
                }`}
              >
                {isActive ? 'Active' : 'View'}
              </span>
            </div>
          </button>
        )
      })}
    </nav>
  )
}

export default SidebarNav
