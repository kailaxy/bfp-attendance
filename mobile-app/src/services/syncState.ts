import AsyncStorage from '@react-native-async-storage/async-storage';
import { attendanceApi } from './attendanceApi';

const SYNC_STATE_STORAGE_KEY = 'bfp.mobile.sync.state.v1';
const DEFAULT_SYNC_LIMIT = 50;
const MIN_SYNC_INTERVAL_MS = 30000;

export type SyncState = {
  cursor: string;
  lastSyncAt: string;
  lastServerTime: string;
  pendingQueueCount: number;
  lastError: string;
};

export type RunDeltaSyncOptions = {
  force?: boolean;
  limit?: number;
};

const defaultSyncState: SyncState = {
  cursor: '0',
  lastSyncAt: '',
  lastServerTime: '',
  pendingQueueCount: 0,
  lastError: '',
};

const readSyncState = async (): Promise<SyncState> => {
  try {
    const raw = await AsyncStorage.getItem(SYNC_STATE_STORAGE_KEY);
    if (!raw) {
      return defaultSyncState;
    }

    const parsed = JSON.parse(raw);
    return {
      cursor: String(parsed?.cursor || '0'),
      lastSyncAt: String(parsed?.lastSyncAt || ''),
      lastServerTime: String(parsed?.lastServerTime || ''),
      pendingQueueCount: Number(parsed?.pendingQueueCount || 0),
      lastError: String(parsed?.lastError || ''),
    };
  } catch {
    return defaultSyncState;
  }
};

const writeSyncState = async (next: SyncState): Promise<void> => {
  await AsyncStorage.setItem(SYNC_STATE_STORAGE_KEY, JSON.stringify(next));
};

export const getSyncState = async (): Promise<SyncState> => {
  return readSyncState();
};

export const updatePendingQueueCount = async (count: number): Promise<void> => {
  const current = await readSyncState();
  await writeSyncState({
    ...current,
    pendingQueueCount: Math.max(0, Math.floor(count || 0)),
  });
};

export const runDeltaSync = async (): Promise<SyncState> => {
  return runDeltaSyncWithOptions({});
};

const shouldSkipSync = (state: SyncState, force: boolean): boolean => {
  if (force) {
    return false;
  }

  const last = new Date(state.lastSyncAt || '').getTime();
  if (Number.isNaN(last) || last <= 0) {
    return false;
  }

  return Date.now() - last < MIN_SYNC_INTERVAL_MS;
};

export const runDeltaSyncWithOptions = async (
  options: RunDeltaSyncOptions = {}
): Promise<SyncState> => {
  const current = await readSyncState();
  const force = Boolean(options.force);
  const limit = Math.max(10, Math.min(100, Math.floor(options.limit || DEFAULT_SYNC_LIMIT)));

  if (shouldSkipSync(current, force)) {
    return current;
  }

  const response = await attendanceApi.getSync(current.cursor, limit);

  if (!response.ok) {
    const next = {
      ...current,
      lastError: response.error.message || response.error.code,
    };
    await writeSyncState(next);
    return next;
  }

  const next = {
    ...current,
    cursor: String(response.data.cursor || current.cursor || '0'),
    lastSyncAt: new Date().toISOString(),
    lastServerTime: String(response.data.serverTime || ''),
    lastError: '',
  };

  await writeSyncState(next);
  return next;
};
