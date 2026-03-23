/**
 * @typedef {{
 *   qrCode: string,
 *   scannedAt?: string,
 *   scannerId?: string,
 *   metadata?: Record<string, string | number | boolean | null>
 * }} ScanRequestPayload
 */

/**
 * @typedef {{
 *   personnelId: string,
 *   name: string,
 *   unit?: string
 * }} AttendeeInfo
 */

/**
 * @typedef {{
 *   success: boolean,
 *   message: string,
 *   referenceId?: string,
 *   timestamp: string,
 *   attendee?: AttendeeInfo
 * }} ScanResponsePayload
 */

/**
 * @typedef {{
 *   dateFrom?: string,
 *   dateTo?: string,
 *   personnelId?: string,
 *   limit?: number,
 *   cursor?: string
 * }} LogsQueryParams
 */

/**
 * @typedef {{
 *   id: string,
 *   timestamp: string,
 *   personnelId: string,
 *   name: string,
 *   firstName?: string,
 *   lastName?: string,
 *   unit?: string,
 *   rank?: string,
 *   timeIn?: string,
 *   timeOut?: string,
 *   remarks?: string,
 *   scanLocation?: string,
 *   status: string,
 *   source?: string
 * }} AttendanceLogEntry
 */

/**
 * @typedef {{
 *   items: AttendanceLogEntry[],
 *   nextCursor?: string,
 *   total?: number
 * }} LogsResponsePayload
 */

/**
 * @typedef {{
 *   accountNumber: string,
 *   rank: string,
 *   lastName: string,
 *   firstName: string,
 *   middleName?: string,
 *   unit?: string,
 *   designation?: string
 * }} PersonnelEntry
 */

/**
 * @typedef {{
 *   items: PersonnelEntry[],
 *   total?: number
 * }} PersonnelResponsePayload
 */

/**
 * @typedef {{
 *   id: string,
 *   personnelName: string,
 *   accountNumber: string,
 *   rank?: string,
 *   leaveType?: string,
 *   startDate: string,
 *   endDate: string,
 *   reason?: string,
 *   status?: string
 * }} LeaveEntry
 */

/**
 * @typedef {{
 *   items: LeaveEntry[],
 *   total?: number
 * }} LeavesResponsePayload
 */

/**
 * @typedef {{
 *   code: string,
 *   message: string,
 *   status?: number,
 *   details?: unknown
 * }} ApiErrorPayload
 */

/**
 * @template T
 * @typedef {{ ok: true, data: T }} ApiSuccessResult
 */

/**
 * @typedef {{ ok: false, error: ApiErrorPayload }} ApiFailureResult
 */

/**
 * @template T
 * @typedef {ApiSuccessResult<T> | ApiFailureResult} ApiResult
 */

export {}
