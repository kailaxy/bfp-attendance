import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AttendanceLogEntry, LeaveEntry, PersonnelEntry } from '../types';

export type LogsCacheMode = 'all' | 'raw' | 'archive';

type CacheEnvelope<T> = {
  updatedAt: string;
  data: T;
};

const CACHE_KEYS = {
  logsAll: 'bfp.mobile.cache.logs.all.v1',
  logsRaw: 'bfp.mobile.cache.logs.raw.v1',
  logsArchive: 'bfp.mobile.cache.logs.archive.v1',
  personnel: 'bfp.mobile.cache.personnel.v1',
  leaves: 'bfp.mobile.cache.leaves.v1',
  appOpenedAt: 'bfp.mobile.app.openedAt.v1',
} as const;

const LOGS_MODE_KEY: Record<LogsCacheMode, string> = {
  all: CACHE_KEYS.logsAll,
  raw: CACHE_KEYS.logsRaw,
  archive: CACHE_KEYS.logsArchive,
};

const readEnvelope = async <T>(key: string): Promise<CacheEnvelope<T> | null> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CacheEnvelope<T> | null;
    if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) {
      return null;
    }

    return {
      updatedAt: String((parsed as CacheEnvelope<T>).updatedAt || ''),
      data: (parsed as CacheEnvelope<T>).data,
    };
  } catch {
    return null;
  }
};

const writeEnvelope = async <T>(key: string, data: T): Promise<void> => {
  const payload: CacheEnvelope<T> = {
    updatedAt: new Date().toISOString(),
    data,
  };

  await AsyncStorage.setItem(key, JSON.stringify(payload));
};

export const getCachedLogs = async (mode: LogsCacheMode): Promise<AttendanceLogEntry[] | null> => {
  const envelope = await readEnvelope<AttendanceLogEntry[]>(LOGS_MODE_KEY[mode]);
  if (!envelope || !Array.isArray(envelope.data)) {
    return null;
  }

  return envelope.data;
};

export const setCachedLogs = async (
  mode: LogsCacheMode,
  items: AttendanceLogEntry[]
): Promise<void> => {
  await writeEnvelope(LOGS_MODE_KEY[mode], items);
};

export const getCachedPersonnel = async (): Promise<PersonnelEntry[] | null> => {
  const envelope = await readEnvelope<PersonnelEntry[]>(CACHE_KEYS.personnel);
  if (!envelope || !Array.isArray(envelope.data)) {
    return null;
  }

  return envelope.data;
};

export const setCachedPersonnel = async (items: PersonnelEntry[]): Promise<void> => {
  await writeEnvelope(CACHE_KEYS.personnel, items);
};

export const getCachedLeaves = async (): Promise<LeaveEntry[] | null> => {
  const envelope = await readEnvelope<LeaveEntry[]>(CACHE_KEYS.leaves);
  if (!envelope || !Array.isArray(envelope.data)) {
    return null;
  }

  return envelope.data;
};

export const setCachedLeaves = async (items: LeaveEntry[]): Promise<void> => {
  await writeEnvelope(CACHE_KEYS.leaves, items);
};

export const markAppOpenedAtNow = async (): Promise<string> => {
  const openedAt = new Date().toISOString();
  await AsyncStorage.setItem(CACHE_KEYS.appOpenedAt, openedAt);
  return openedAt;
};

export const getLastAppOpenedAt = async (): Promise<string> => {
  const value = await AsyncStorage.getItem(CACHE_KEYS.appOpenedAt);
  return String(value || '');
};
