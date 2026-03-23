export const SCREEN_KEYS = {
  dashboard: 'Dashboard',
  scanner: 'Scanner',
  logs: 'Logs',
  leave: 'Leave',
  personnel: 'Personnel',
} as const;

export type ScreenKey = (typeof SCREEN_KEYS)[keyof typeof SCREEN_KEYS];

export { DashboardScreen } from './DashboardScreen';
export { ScannerScreen } from './ScannerScreen';
export { LogsScreen } from './LogsScreen';
export { LeaveScreen } from './LeaveScreen';
export { PersonnelScreen } from './PersonnelScreen';
