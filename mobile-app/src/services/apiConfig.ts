export type ApiMode = 'mock' | 'live';

export type AttendanceApiConfig = {
  mode: ApiMode;
  baseUrl: string;
  timeoutMs: number;
};

export const API_ENV_KEYS = {
  mode: 'EXPO_PUBLIC_API_MODE',
  baseUrl: 'EXPO_PUBLIC_APPS_SCRIPT_BASE_URL',
  timeoutMs: 'EXPO_PUBLIC_API_TIMEOUT_MS',
} as const;

export const API_PATHS = {
  health: '/health',
  scan: '/scan',
  commitScan: '/commit-scan',
  scanBatch: '/scan/batch',
  sync: '/sync',
  logs: '/logs',
  personnel: '/personnel',
  leaves: '/leaves',
} as const;

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_APPS_SCRIPT_BASE_URL =
  'https://script.google.com/macros/s/AKfycbxkvpfS_b3tDuCsgtO_t6xnNonuoe8WgyFYGt1Z6yl6L49eR-DCcO042CJJAl3clBRm6g/exec';

const getEnvValue = (key: string): string | undefined => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }

  return undefined;
};

const normalizeBaseUrl = (value: string | undefined): string => {
  if (!value) {
    return '';
  }

  return value.trim().replace(/\/+$/, '');
};

const normalizeMode = (value: string | undefined): ApiMode => {
  if ((value || '').trim().toLowerCase() === 'live') {
    return 'live';
  }

  return 'mock';
};

const normalizeTimeout = (value: string | undefined): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.floor(parsed);
};

const isGoogleAppsScriptUrl = (url: string): boolean =>
  url.toLowerCase().includes('script.google.com/macros/');

export const attendanceApiConfig: AttendanceApiConfig = {
  mode: (() => {
    const modeValue = (getEnvValue(API_ENV_KEYS.mode) || '').trim().toLowerCase();
    if (modeValue === 'mock') {
      return 'mock';
    }

    const resolvedBaseUrl = normalizeBaseUrl(
      getEnvValue(API_ENV_KEYS.baseUrl) || DEFAULT_APPS_SCRIPT_BASE_URL
    );

    return resolvedBaseUrl ? 'live' : normalizeMode(getEnvValue(API_ENV_KEYS.mode));
  })(),
  baseUrl: normalizeBaseUrl(
    getEnvValue(API_ENV_KEYS.baseUrl) || DEFAULT_APPS_SCRIPT_BASE_URL
  ),
  timeoutMs: normalizeTimeout(getEnvValue(API_ENV_KEYS.timeoutMs)),
};

export const createApiUrl = (
  path: string,
  queryParams?: Record<string, string | number | boolean | undefined | null>
): string => {
  if (!attendanceApiConfig.baseUrl) {
    return '';
  }

  const useRouteQuery = isGoogleAppsScriptUrl(attendanceApiConfig.baseUrl);
  const url = useRouteQuery
    ? new URL(attendanceApiConfig.baseUrl)
    : new URL(`${attendanceApiConfig.baseUrl}${path}`);

  if (useRouteQuery) {
    url.searchParams.set('route', path);
  }

  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }

      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
};

export const createAttendanceApiPaths = () => ({
  health: createApiUrl(API_PATHS.health),
  scan: createApiUrl(API_PATHS.scan),
  commitScan: createApiUrl(API_PATHS.commitScan),
  scanBatch: createApiUrl(API_PATHS.scanBatch),
  sync: createApiUrl(API_PATHS.sync),
  logs: createApiUrl(API_PATHS.logs),
  personnel: createApiUrl(API_PATHS.personnel),
  leaves: createApiUrl(API_PATHS.leaves),
});
