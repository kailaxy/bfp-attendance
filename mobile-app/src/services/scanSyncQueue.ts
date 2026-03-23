import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ApiErrorPayload, ScanRequestPayload, ScanResponsePayload } from '../types';
import { attendanceApi } from './attendanceApi';
import { runDeltaSyncWithOptions, updatePendingQueueCount } from './syncState';

const SCAN_QUEUE_STORAGE_KEY = 'bfp.mobile.scan.queue.v1';

type QueuedScanItem = {
  id: string;
  payload: ScanRequestPayload;
  createdAt: string;
  attempts: number;
  lastError?: string;
};

type SubmitScanWithQueueResult =
  | {
      kind: 'submitted';
      response: ScanResponsePayload;
    }
  | {
      kind: 'queued';
      queueCount: number;
      reason: string;
    }
  | {
      kind: 'rejected';
      error: ApiErrorPayload;
    };

export type FlushQueuedScansResult = {
  queueCount: number;
  successCount: number;
  failedCount: number;
};

const isQueueableError = (error: ApiErrorPayload): boolean => {
  const code = String(error.code || '').trim().toUpperCase();
  return (
    code === 'NETWORK_ERROR' ||
    code === 'TIMEOUT' ||
    code === 'INTERNAL_ERROR' ||
    code === 'UNKNOWN_ERROR'
  );
};

const createQueueId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const sanitizePayload = (payload: ScanRequestPayload): ScanRequestPayload => ({
  qrCode: String(payload.qrCode || '').trim(),
  scannedAt: payload.scannedAt || new Date().toISOString(),
  clientEventId: payload.clientEventId || createQueueId(),
  scannerId: payload.scannerId,
  metadata: payload.metadata,
});

const readQueue = async (): Promise<QueuedScanItem[]> => {
  try {
    const raw = await AsyncStorage.getItem(SCAN_QUEUE_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item) => item && item.payload && item.payload.qrCode);
  } catch {
    return [];
  }
};

const writeQueue = async (items: QueuedScanItem[]): Promise<void> => {
  await AsyncStorage.setItem(SCAN_QUEUE_STORAGE_KEY, JSON.stringify(items));
};

const enqueueScan = async (
  payload: ScanRequestPayload,
  reason: string
): Promise<{ queueCount: number }> => {
  const queue = await readQueue();
  queue.push({
    id: createQueueId(),
    payload: sanitizePayload(payload),
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: reason,
  });

  await writeQueue(queue);
  await updatePendingQueueCount(queue.length);
  return { queueCount: queue.length };
};

export const getQueuedScanCount = async (): Promise<number> => {
  const queue = await readQueue();
  await updatePendingQueueCount(queue.length);
  return queue.length;
};

export const submitScanWithQueue = async (
  payload: ScanRequestPayload
): Promise<SubmitScanWithQueueResult> => {
  const normalizedPayload = sanitizePayload(payload);

  const response = await attendanceApi.submitScan(normalizedPayload);
  if (response.ok) {
    return {
      kind: 'submitted',
      response: response.data,
    };
  }

  if (!isQueueableError(response.error)) {
    return {
      kind: 'rejected',
      error: response.error,
    };
  }

  const reason = response.error.message || response.error.code;
  const queued = await enqueueScan(normalizedPayload, reason);
  return {
    kind: 'queued',
    queueCount: queued.queueCount,
    reason,
  };
};

export const flushQueuedScans = async (): Promise<FlushQueuedScansResult> => {
  const queue = await readQueue();
  if (!queue.length) {
    return {
      queueCount: 0,
      successCount: 0,
      failedCount: 0,
    };
  }

  const batchResponse = await attendanceApi.submitScanBatch(queue.map((item) => item.payload));
  if (batchResponse.ok) {
    const failedIndexes = new Set(
      batchResponse.data.items.filter((item) => !item.ok).map((item) => item.index)
    );

    const nextQueue: QueuedScanItem[] = [];
    queue.forEach((item, index) => {
      if (!failedIndexes.has(index)) {
        return;
      }

      nextQueue.push({
        ...item,
        attempts: item.attempts + 1,
        lastError:
          batchResponse.data.items[index]?.error?.message ||
          batchResponse.data.items[index]?.error?.code ||
          item.lastError,
      });
    });

    await writeQueue(nextQueue);
    await updatePendingQueueCount(nextQueue.length);

    if (batchResponse.data.successCount > 0) {
      await runDeltaSyncWithOptions({ force: true, limit: 40 });
    }

    return {
      queueCount: nextQueue.length,
      successCount: batchResponse.data.successCount,
      failedCount: batchResponse.data.failedCount,
    };
  }

  if (!isQueueableError(batchResponse.error)) {
    await updatePendingQueueCount(queue.length);
    return {
      queueCount: queue.length,
      successCount: 0,
      failedCount: queue.length,
    };
  }

  await updatePendingQueueCount(queue.length);
  return {
    queueCount: queue.length,
    successCount: 0,
    failedCount: queue.length,
  };
};
