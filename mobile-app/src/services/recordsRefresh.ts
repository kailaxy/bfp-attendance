import { attendanceApi } from './attendanceApi';
import {
  setCachedLeaves,
  setCachedLogs,
  setCachedPersonnel,
  type LogsCacheMode,
} from './recordsCache';
import type { AttendanceLogEntry } from '../types';

type RefreshOptions = {
  force?: boolean;
};

const MIN_REFRESH_INTERVAL_MS = 15000;
const lastRefreshAtByKey: Record<string, number> = {};

const shouldRunRefresh = (key: string, force = false): boolean => {
  if (force) {
    lastRefreshAtByKey[key] = Date.now();
    return true;
  }

  const now = Date.now();
  const last = lastRefreshAtByKey[key] || 0;
  if (now - last < MIN_REFRESH_INTERVAL_MS) {
    return false;
  }

  lastRefreshAtByKey[key] = now;
  return true;
};

const filterLogsByMode = (items: AttendanceLogEntry[], mode: Exclude<LogsCacheMode, 'all'>) => {
  const expected = mode.toLowerCase();
  return items.filter((entry) => String(entry.source || '').trim().toLowerCase() === expected);
};

export const refreshLogsInBackground = async (
  mode: LogsCacheMode,
  options: RefreshOptions = {}
): Promise<boolean> => {
  const key = `logs:${mode}`;
  if (!shouldRunRefresh(key, Boolean(options.force))) {
    return false;
  }

  const query = mode === 'all' ? {} : { source: mode };
  const result = await attendanceApi.getLogs(query);
  if (!result.ok) {
    return false;
  }

  const items = Array.isArray(result.data.items) ? result.data.items : [];
  await setCachedLogs(mode, items);

  if (mode === 'all') {
    await Promise.all([
      setCachedLogs('raw', filterLogsByMode(items, 'raw')),
      setCachedLogs('archive', filterLogsByMode(items, 'archive')),
    ]);
  }

  return true;
};

export const refreshPersonnelInBackground = async (
  options: RefreshOptions = {}
): Promise<boolean> => {
  const key = 'personnel';
  if (!shouldRunRefresh(key, Boolean(options.force))) {
    return false;
  }

  const result = await attendanceApi.getPersonnel();
  if (!result.ok) {
    return false;
  }

  const items = Array.isArray(result.data.items) ? result.data.items : [];
  await setCachedPersonnel(items);
  return true;
};

export const refreshLeavesInBackground = async (
  options: RefreshOptions = {}
): Promise<boolean> => {
  const key = 'leaves';
  if (!shouldRunRefresh(key, Boolean(options.force))) {
    return false;
  }

  const result = await attendanceApi.getLeaves();
  if (!result.ok) {
    return false;
  }

  const items = Array.isArray(result.data.items) ? result.data.items : [];
  await setCachedLeaves(items);
  return true;
};

export const refreshDashboardDataInBackground = async (
  options: RefreshOptions = {}
): Promise<void> => {
  const force = Boolean(options.force);

  await Promise.all([
    refreshLogsInBackground('raw', { force }),
    refreshPersonnelInBackground({ force }),
    refreshLeavesInBackground({ force }),
  ]);
};

export const refreshAllMenuRecordsInBackground = async (
  options: RefreshOptions = {}
): Promise<void> => {
  const force = Boolean(options.force);

  await Promise.all([
    refreshLogsInBackground('all', { force }),
    refreshPersonnelInBackground({ force }),
    refreshLeavesInBackground({ force }),
  ]);
};
