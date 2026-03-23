import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import SidebarNav from '../components/SidebarNav'
import mandaBfpLogo from '../assets/mandabfplogo.png'

const AppShell = ({ activeView, onViewChange, children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const closeSidebar = () => setIsSidebarOpen(false)

  return (
    <div className="min-h-screen bg-surface-canvas text-text-body">
      <div className="flex min-h-screen">
        {isSidebarOpen ? (
          <button
            type="button"
            aria-label="Close sidebar overlay"
            className="fixed inset-0 z-30 bg-surface-inverse/50 lg:hidden"
            onClick={closeSidebar}
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-40 w-72 transform border-r border-brand-secondary/25 bg-brand-deep p-5 transition-transform duration-200 lg:translate-x-0 ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="mb-6 rounded-panel border border-text-inverse/20 bg-brand-deep-hover p-3">
            <div className="flex items-center gap-3">
              <img src={mandaBfpLogo} alt="BFP Logo" className="h-11 w-11 rounded-control bg-white p-1" />
              <div>
                <h1 className="font-heading text-heading-2 text-text-inverse">BFP Portal</h1>
                <p className="text-meta text-text-inverse/70">Mandaluyong City</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-panel border border-text-inverse/20 bg-brand-deep-hover p-3">
            <div>
              <h2 className="font-heading text-heading-3 text-text-inverse">Attendance Operations</h2>
              <p className="mt-1 text-meta text-text-inverse/75">Personnel Command Interface</p>
            </div>
            <button
              type="button"
              onClick={closeSidebar}
              className="rounded-control p-2 text-text-inverse/70 transition duration-160 hover:bg-brand-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 lg:hidden"
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
          </div>

          <SidebarNav
            activeView={activeView}
            onViewChange={onViewChange}
            onNavigate={closeSidebar}
          />
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:ml-72">
          <header className="mb-4 flex items-center justify-between gap-3 rounded-panel border border-brand-secondary/20 bg-surface-base p-3 shadow-card lg:hidden">
            <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen((isOpen) => !isOpen)}
              className="rounded-control border border-brand-secondary/30 bg-surface-base p-2 text-brand-secondary transition duration-160 hover:bg-brand-secondary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
              aria-label="Toggle sidebar"
            >
              <Menu size={18} />
            </button>
              <p className="text-body font-semibold text-text-body">BFP Portal</p>
            </div>
            <img src={mandaBfpLogo} alt="BFP" className="h-8 w-8 rounded-control bg-white p-1" />
          </header>

          {children}
        </main>
      </div>
    </div>
  )
}

export default AppShell
