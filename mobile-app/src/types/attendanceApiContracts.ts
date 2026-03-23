export type Primitive = string | number | boolean | null;

export type ApiStatus = 'success' | 'error';

export type ApiErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiEnvelope<TData> = {
  status: ApiStatus;
  success: boolean;
  message: string;
  data: TData | null;
  error: ApiErrorPayload | null;
  timestamp: string;
};

export type ApiResult<TData, TError = ApiErrorPayload> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      error: TError;
    };

export type ScanRequestPayload = {
  qrCode: string;
  scannedAt?: string;
  clientEventId?: string;
  scannerId?: string;
  metadata?: Record<string, Primitive>;
};

export type BatchScanRequestPayload = {
  items: ScanRequestPayload[];
};

export type LogsQueryParams = {
  dateFrom?: string;
  dateTo?: string;
  personnelId?: string;
  limit?: number;
  cursor?: string;
  source?: 'raw' | 'archive';
};

export type HealthRouteMap = {
  get: string[];
  post: string[];
};

export type HealthSheetMap = {
  rawLog: string;
  archive: string;
  profile: string;
  leave: string;
};

export type HealthPayload = {
  service: string;
  version: string;
  routes?: HealthRouteMap;
  sheets?: HealthSheetMap;
};

export type HealthResponsePayload = ApiEnvelope<HealthPayload> &
  Pick<HealthPayload, 'service' | 'version'>;

export type AttendeeInfo = {
  personnelId: string;
  accountNumber?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  rank?: string;
  unit?: string;
  adminOp?: string;
  photoUrl?: string;
  status?: string;
};

export type ScanProfile = {
  accountNumber: string;
  firstName: string;
  lastName: string;
  rank: string;
  fullName: string;
  unit: string;
  adminOp: string;
  photoUrl: string;
  status: string;
};

export type ScanResponseData = {
  success: boolean;
  message: string;
  referenceId?: string;
  timestamp: string;
  attendee?: AttendeeInfo;
  action?: string;
  profile?: ScanProfile;
};

export type ScanResponsePayload = ApiEnvelope<ScanResponseData> & ScanResponseData;

export type BatchScanResultItem = {
  index: number;
  qrCode: string;
  ok: boolean;
  data?: ScanResponseData;
  error?: ApiErrorPayload;
};

export type BatchScanResponseData = {
  items: BatchScanResultItem[];
  total: number;
  successCount: number;
  failedCount: number;
};

export type BatchScanResponsePayload = ApiEnvelope<BatchScanResponseData> & BatchScanResponseData;

export type SyncChangesPayload = {
  logs: AttendanceLogEntry[];
};

export type SyncResponseData = {
  cursor: string;
  serverTime: string;
  hasMore: boolean;
  changes: SyncChangesPayload;
};

export type SyncResponsePayload = ApiEnvelope<SyncResponseData> & SyncResponseData;

export type AttendanceLogEntry = {
  id: string;
  timestamp: string;
  personnelId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  rank?: string;
  unit?: string;
  status: string;
  source?: 'raw' | 'archive' | string;
};

export type CollectionPayload<TItem> = {
  items: TItem[];
  total?: number;
  nextCursor?: string;
};

export type LogsResponsePayload = ApiEnvelope<CollectionPayload<AttendanceLogEntry>> &
  CollectionPayload<AttendanceLogEntry>;

export type PersonnelEntry = {
  accountNumber: string;
  rank: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  designation?: string;
  unit?: string;
  photoUrl?: string;
};

export type PersonnelResponsePayload = ApiEnvelope<CollectionPayload<PersonnelEntry>> &
  CollectionPayload<PersonnelEntry>;

export type LeaveEntry = {
  id: string;
  personnelName: string;
  accountNumber: string;
  rank?: string;
  leaveType?: string;
  startDate: string;
  endDate: string;
  reason?: string;
  status?: string;
};

export type LeavesResponsePayload = ApiEnvelope<CollectionPayload<LeaveEntry>> &
  CollectionPayload<LeaveEntry>;