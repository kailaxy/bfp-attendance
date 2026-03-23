import type {
  ApiErrorPayload,
  ApiResult,
  AttendanceLogEntry,
  BatchScanResponsePayload,
  HealthPayload,
  HealthResponsePayload,
  LeaveEntry,
  LeavesResponsePayload,
  LogsQueryParams,
  LogsResponsePayload,
  PersonnelEntry,
  PersonnelResponsePayload,
  ScanRequestPayload,
  ScanResponsePayload,
  SyncResponsePayload,
} from '../types';
import { createApiClient, type ApiClient } from './apiClient';
import {
  attendanceApiConfig,
  createAttendanceApiPaths,
} from './apiConfig';

export type AttendanceApiPaths = {
  health: string;
  scan: string;
  commitScan: string;
  scanBatch: string;
  sync: string;
  logs: string;
  personnel: string;
  leaves: string;
};

export type AttendanceApi = {
  getHealth: () => Promise<ApiResult<HealthPayload>>;
  submitScan: (payload: ScanRequestPayload) => Promise<ApiResult<ScanResponsePayload>>;
  submitScanBatch: (payloads: ScanRequestPayload[]) => Promise<ApiResult<BatchScanResponsePayload>>;
  getSync: (cursor?: string, limit?: number) => Promise<ApiResult<SyncResponsePayload>>;
  getLogs: (query?: LogsQueryParams) => Promise<ApiResult<LogsResponsePayload>>;
  getPersonnel: () => Promise<ApiResult<PersonnelResponsePayload>>;
  getLeaves: () => Promise<ApiResult<LeavesResponsePayload>>;
};

export type CreateAttendanceApiOptions = {
  apiClient?: ApiClient;
  paths: AttendanceApiPaths;
};

const createConfigError = (message: string): ApiErrorPayload => ({
  code: 'CONFIG_ERROR',
  message,
});

const hasPathConfig = (paths: AttendanceApiPaths): boolean =>
  Boolean(
    paths.health &&
      paths.scan &&
      paths.scanBatch &&
      paths.logs &&
      paths.personnel &&
      paths.leaves
  );

const isLiveMode = attendanceApiConfig.mode === 'live';

const RECOVERABLE_READ_RETRY = {
  attempts: 2,
  baseDelayMs: 250,
  maxDelayMs: 1200,
} as const;

const appendQueryParams = (baseUrl: string, params: LogsQueryParams = {}): string => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    query.set(key, String(value));
  });

  if (!query.size) {
    return baseUrl;
  }

  return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${query.toString()}`;
};

const shapeHealthPayload = (input: HealthResponsePayload | HealthPayload): HealthPayload => {
  const routes = 'routes' in input ? input.routes : undefined;
  const sheets = 'sheets' in input ? input.sheets : undefined;

  return {
    service: input.service,
    version: input.version,
    routes,
    sheets,
  };
};

const MOCK_PERSONNEL: PersonnelEntry[] = [
  {
    accountNumber: 'BFP-0001',
    rank: 'FO1',
    lastName: 'Santos',
    firstName: 'Juan',
    middleName: 'D',
    designation: 'Fire Officer',
    unit: 'Station 1',
  },
];

const MOCK_LEAVES: LeaveEntry[] = [
  {
    id: 'leave-0001',
    personnelName: 'FO1 Santos Juan',
    accountNumber: 'BFP-0001',
    rank: 'FO1',
    leaveType: 'Vacation',
    startDate: '2026-02-20',
    endDate: '2026-02-22',
    reason: 'Personal',
    status: 'APPROVED',
  },
];

const createMockLogs = (): AttendanceLogEntry[] => {
  const now = new Date().toISOString();

  return [
    {
      id: 'log-0001',
      timestamp: now,
      personnelId: 'BFP-0001',
      name: 'FO1 Santos Juan',
      unit: 'Station 1',
      status: 'ON-DUTY',
      source: 'raw',
    },
  ];
};

const createMockScanResponse = (payload: ScanRequestPayload): ScanResponsePayload => {
  const now = new Date().toISOString();
  const accountNumber = String(payload.qrCode || '').trim() || 'BFP-0001';

  return {
    status: 'success',
    success: true,
    message: 'Mock scan accepted.',
    data: {
      success: true,
      message: 'Mock scan accepted.',
      referenceId: `MOCK-${Date.now()}`,
      timestamp: now,
      action: 'timein',
      attendee: {
        personnelId: accountNumber,
        accountNumber,
        name: 'FO1 Santos Juan',
        firstName: 'Juan',
        lastName: 'Santos',
        rank: 'FO1',
        unit: 'Station 1',
        adminOp: 'Operations',
        photoUrl: '',
        status: 'On-Duty',
      },
      profile: {
        accountNumber,
        firstName: 'Juan',
        lastName: 'Santos',
        rank: 'FO1',
        fullName: 'FO1 Santos Juan',
        unit: 'Station 1',
        adminOp: 'Operations',
        photoUrl: '',
        status: 'On-Duty',
      },
    },
    error: null,
    timestamp: now,
    referenceId: `MOCK-${Date.now()}`,
    attendee: {
      personnelId: accountNumber,
      accountNumber,
      name: 'FO1 Santos Juan',
      firstName: 'Juan',
      lastName: 'Santos',
      rank: 'FO1',
      unit: 'Station 1',
      adminOp: 'Operations',
      photoUrl: '',
      status: 'On-Duty',
    },
    action: 'timein',
  };
};

const createMockBatchScanResponse = (payloads: ScanRequestPayload[]): BatchScanResponsePayload => {
  const timestamp = new Date().toISOString();
  const items = payloads.map((payload, index) => {
    const response = createMockScanResponse(payload);
    return {
      index,
      qrCode: String(payload.qrCode || '').trim(),
      ok: true,
      data: response.data || undefined,
    };
  });

  return {
    status: 'success',
    success: true,
    message: 'Mock batch scan accepted.',
    data: {
      items,
      total: items.length,
      successCount: items.length,
      failedCount: 0,
    },
    error: null,
    timestamp,
    items,
    total: items.length,
    successCount: items.length,
    failedCount: 0,
  };
};

export const createAttendanceApi = ({
  apiClient = createApiClient(),
  paths,
}: CreateAttendanceApiOptions): AttendanceApi => ({
  async getHealth() {
    if (!isLiveMode) {
      return {
        ok: true,
        data: {
          service: 'attendance-mobile-mock',
          version: 'mock-1.0',
          routes: {
            get: ['/health', '/logs', '/personnel', '/leaves'],
            post: ['/scan'],
          },
        },
      };
    }

    if (!hasPathConfig(paths)) {
      return {
        ok: false,
        error: createConfigError(
          'Attendance API base URL is not configured. Set EXPO_PUBLIC_APPS_SCRIPT_BASE_URL for live mode.'
        ),
      };
    }

    const response = await apiClient.get<HealthResponsePayload | HealthPayload>(paths.health, {
      retry: RECOVERABLE_READ_RETRY,
    });

    if (!response.ok) {
      return response;
    }

    return {
      ok: true,
      data: shapeHealthPayload(response.data),
    };
  },

  submitScan(payload) {
    if (!isLiveMode) {
      return Promise.resolve({
        ok: true,
        data: createMockScanResponse(payload),
      });
    }

    if (!hasPathConfig(paths)) {
      return Promise.resolve({
        ok: false,
        error: createConfigError(
          'Attendance API base URL is not configured. Set EXPO_PUBLIC_APPS_SCRIPT_BASE_URL for live mode.'
        ),
      });
    }

    return apiClient.post<ScanResponsePayload>(paths.commitScan || paths.scan, payload);
  },

  submitScanBatch(payloads) {
    if (!isLiveMode) {
      return Promise.resolve({
        ok: true,
        data: createMockBatchScanResponse(payloads),
      });
    }

    if (!hasPathConfig(paths)) {
      return Promise.resolve({
        ok: false,
        error: createConfigError(
          'Attendance API base URL is not configured. Set EXPO_PUBLIC_APPS_SCRIPT_BASE_URL for live mode.'
        ),
      });
    }

    return apiClient.post<BatchScanResponsePayload>(paths.scanBatch, {
      items: payloads,
    });
  },

  getSync(cursor, limit = 200) {
    if (!isLiveMode) {
      return Promise.resolve({
        ok: true,
        data: {
          status: 'success',
          success: true,
          message: 'Mock sync loaded.',
          data: {
            cursor: cursor || '0',
            serverTime: new Date().toISOString(),
            hasMore: false,
            changes: {
              logs: [],
            },
          },
          error: null,
          timestamp: new Date().toISOString(),
          cursor: cursor || '0',
          serverTime: new Date().toISOString(),
          hasMore: false,
          changes: {
            logs: [],
          },
        },
      });
    }

    if (!hasPathConfig(paths)) {
      return Promise.resolve({
        ok: false,
        error: createConfigError(
          'Attendance API base URL is not configured. Set EXPO_PUBLIC_APPS_SCRIPT_BASE_URL for live mode.'
        ),
      });
    }

    const url = appendQueryParams(paths.sync, {
      cursor: cursor || undefined,
      limit,
    });

    return apiClient.get<SyncResponsePayload>(url, {
      retry: RECOVERABLE_READ_RETRY,
    });
  },

  getLogs(query = {}) {
    if (!isLiveMode) {
      const items = createMockLogs();

      return Promise.resolve({
        ok: true,
        data: {
          status: 'success',
          success: true,
          message: 'Mock logs loaded.',
          data: {
            items,
            total: items.length,
            nextCursor: undefined,
          },
          error: null,
          timestamp: new Date().toISOString(),
          items,
          total: items.length,
          nextCursor: undefined,
        },
      });
    }

    if (!hasPathConfig(paths)) {
      return Promise.resolve({
        ok: false,
        error: createConfigError(
          'Attendance API base URL is not configured. Set EXPO_PUBLIC_APPS_SCRIPT_BASE_URL for live mode.'
        ),
      });
    }

    return apiClient.get<LogsResponsePayload>(appendQueryParams(paths.logs, query), {
      retry: RECOVERABLE_READ_RETRY,
    });
  },

  getPersonnel() {
    if (!isLiveMode) {
      return Promise.resolve({
        ok: true,
        data: {
          status: 'success',
          success: true,
          message: 'Mock personnel loaded.',
          data: {
            items: MOCK_PERSONNEL,
            total: MOCK_PERSONNEL.length,
            nextCursor: undefined,
          },
          error: null,
          timestamp: new Date().toISOString(),
          items: MOCK_PERSONNEL,
          total: MOCK_PERSONNEL.length,
          nextCursor: undefined,
        },
      });
    }

    if (!hasPathConfig(paths)) {
      return Promise.resolve({
        ok: false,
        error: createConfigError(
          'Attendance API base URL is not configured. Set EXPO_PUBLIC_APPS_SCRIPT_BASE_URL for live mode.'
        ),
      });
    }

    return apiClient.get<PersonnelResponsePayload>(paths.personnel, {
      retry: RECOVERABLE_READ_RETRY,
    });
  },

  getLeaves() {
    if (!isLiveMode) {
      return Promise.resolve({
        ok: true,
        data: {
          status: 'success',
          success: true,
          message: 'Mock leaves loaded.',
          data: {
            items: MOCK_LEAVES,
            total: MOCK_LEAVES.length,
            nextCursor: undefined,
          },
          error: null,
          timestamp: new Date().toISOString(),
          items: MOCK_LEAVES,
          total: MOCK_LEAVES.length,
          nextCursor: undefined,
        },
      });
    }

    if (!hasPathConfig(paths)) {
      return Promise.resolve({
        ok: false,
        error: createConfigError(
          'Attendance API base URL is not configured. Set EXPO_PUBLIC_APPS_SCRIPT_BASE_URL for live mode.'
        ),
      });
    }

    return apiClient.get<LeavesResponsePayload>(paths.leaves, {
      retry: RECOVERABLE_READ_RETRY,
    });
  },
});

export const attendanceApi = createAttendanceApi({
  apiClient: createApiClient({
    defaultTimeoutMs: attendanceApiConfig.timeoutMs,
  }),
  paths: createAttendanceApiPaths(),
});