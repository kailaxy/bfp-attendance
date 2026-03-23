import { useMemo, useState } from 'react'
import AppShell from './layouts/AppShell'
import AttendanceLogsPage from './pages/AttendanceLogsPage'
import AttendanceScannerPage from './pages/AttendanceScannerPage'
import DashboardPage from './pages/DashboardPage'
import ListOfPersonnelPage from './pages/ListOfPersonnelPage'
import LeaveMonitoringPage from './pages/LeaveMonitoringPage'

const VIEW_KEYS = {
  personnel: 'personnel',
  dashboard: 'dashboard',
  scanner: 'scanner',
  logs: 'logs',
  leave: 'leave',
}

const App = () => {
  const [activeView, setActiveView] = useState(VIEW_KEYS.dashboard)

  const activePanel = useMemo(() => {
    switch (activeView) {
      case VIEW_KEYS.personnel:
        return <ListOfPersonnelPage />
      case VIEW_KEYS.scanner:
        return <AttendanceScannerPage />
      case VIEW_KEYS.logs:
        return <AttendanceLogsPage />
      case VIEW_KEYS.leave:
        return <LeaveMonitoringPage />
      case VIEW_KEYS.dashboard:
      default:
        return <DashboardPage />
    }
  }, [activeView])

  return (
    <AppShell activeView={activeView} onViewChange={setActiveView}>
      {activePanel}
    </AppShell>
  )
}

export default App
