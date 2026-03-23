import type {
  ApiEnvelope,
  ApiErrorPayload,
  ApiResult,
} from '../types';

export type ApiClientErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'HTTP_ERROR'
  | 'ENVELOPE_ERROR'
  | 'PARSE_ERROR'
  | 'UNKNOWN_ERROR';

export type ApiClientError = {
  code: ApiClientErrorCode;
  message: string;
  status?: number;
  details?: unknown;
};

export type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  retry?: {
    attempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  };
};

export type CreateApiClientOptions = {
  fetchImpl?: typeof fetch;
  defaultTimeoutMs?: number;
};

type JsonRecord = Record<string, unknown>;

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RETRY_ATTEMPTS = 0;
const DEFAULT_RETRY_BASE_DELAY_MS = 250;
const DEFAULT_RETRY_MAX_DELAY_MS = 1500;

const isObject = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toApiErrorPayload = (
  error: ApiClientError,
  fallbackCode: ApiClientErrorCode = 'UNKNOWN_ERROR'
): ApiErrorPayload => ({
  code: error.code || fallbackCode,
  message: error.message || 'Unexpected API client error.',
  details: error.details,
});

const asMessage = (value: unknown, fallback: string): string => {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  return fallback;
};

const asErrorCode = (
  value: unknown,
  fallback: ApiClientErrorCode
): ApiClientErrorCode => {
  if (value === 'NETWORK_ERROR') return 'NETWORK_ERROR';
  if (value === 'TIMEOUT') return 'TIMEOUT';
  if (value === 'HTTP_ERROR') return 'HTTP_ERROR';
  if (value === 'ENVELOPE_ERROR') return 'ENVELOPE_ERROR';
  if (value === 'PARSE_ERROR') return 'PARSE_ERROR';
  if (value === 'UNKNOWN_ERROR') return 'UNKNOWN_ERROR';
  return fallback;
};

const normalizeThrownError = (error: unknown): ApiClientError => {
  if (error instanceof Error && error.name === 'AbortError') {
    return {
      code: 'TIMEOUT',
      message: 'Request timed out before receiving a response.',
      details: error,
    };
  }

  if (error instanceof Error) {
    return {
      code: 'NETWORK_ERROR',
      message: asMessage(error.message, 'Unable to reach API endpoint.'),
      details: error,
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'Unexpected error while requesting API endpoint.',
    details: error,
  };
};

const normalizeHttpError = (
  status: number,
  payload: JsonRecord | null
): ApiClientError => {
  const payloadError = isObject(payload?.error) ? payload.error : null;

  return {
    code: asErrorCode(payloadError?.code ?? payload?.code, 'HTTP_ERROR'),
    message:
      asMessage(payloadError?.message, '') ||
      asMessage(payload?.message, '') ||
      `Request failed with status ${status}.`,
    status,
    details: payload,
  };
};

const normalizeEnvelopeError = (payload: JsonRecord): ApiClientError => {
  const payloadError = isObject(payload.error) ? payload.error : null;

  return {
    code: asErrorCode(payloadError?.code ?? payload.code, 'ENVELOPE_ERROR'),
    message:
      asMessage(payloadError?.message, '') ||
      asMessage(payload.message, '') ||
      'API returned an error envelope.',
    details: payload,
  };
};

const sleep = (durationMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });

const computeBackoffDelay = (
  attemptNumber: number,
  baseDelayMs: number,
  maxDelayMs: number
): number => {
  const exponential = baseDelayMs * 2 ** Math.max(0, attemptNumber - 1);
  return Math.min(maxDelayMs, exponential);
};

const shouldRetryError = (error: ApiClientError): boolean => {
  if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
    return true;
  }

  if (error.code !== 'HTTP_ERROR') {
    return false;
  }

  const status = typeof error.status === 'number' ? error.status : 0;
  return status === 429 || status === 502 || status === 503 || status === 504;
};

const withTimeout = async <T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
};

const parseJson = async (response: Response): Promise<JsonRecord | null> => {
  try {
    const text = await response.text();

    if (!text) {
      return null;
    }

    return JSON.parse(text) as JsonRecord;
  } catch {
    return null;
  }
};

const normalizeSuccessData = <TData>(payload: JsonRecord | null): TData => {
  if (!payload) {
    throw {
      code: 'PARSE_ERROR',
      message: 'Response body is empty or invalid JSON.',
      details: payload,
    } satisfies ApiClientError;
  }

  const payloadData = payload.data;
  if (payloadData !== undefined && payloadData !== null) {
    return payloadData as TData;
  }

  return payload as TData;
};

export type ApiClient = {
  request<TData>(url: string, options?: ApiRequestOptions): Promise<ApiResult<TData>>;
  get<TData>(url: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<ApiResult<TData>>;
  post<TData>(url: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<ApiResult<TData>>;
};

export const createApiClient = ({
  fetchImpl = fetch,
  defaultTimeoutMs = DEFAULT_TIMEOUT_MS,
}: CreateApiClientOptions = {}): ApiClient => {
  const request = async <TData>(
    url: string,
    options: ApiRequestOptions = {}
  ): Promise<ApiResult<TData>> => {
    const method = options.method || 'GET';
    const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
    const retryAttempts = Math.max(0, options.retry?.attempts ?? DEFAULT_RETRY_ATTEMPTS);
    const retryBaseDelayMs = Math.max(0, options.retry?.baseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS);
    const retryMaxDelayMs = Math.max(
      retryBaseDelayMs,
      options.retry?.maxDelayMs ?? DEFAULT_RETRY_MAX_DELAY_MS
    );

    let lastError: ApiClientError | null = null;

    for (let attempt = 1; attempt <= retryAttempts + 1; attempt += 1) {
      try {
        const response = await withTimeout(
          (signal) =>
            fetchImpl(url, {
              method,
              signal,
              headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {}),
              },
              body:
                options.body === undefined || method === 'GET'
                  ? undefined
                  : JSON.stringify(options.body),
            }),
          timeoutMs
        );

        const payload = await parseJson(response);

        if (!response.ok) {
          lastError = normalizeHttpError(response.status, payload);
        } else {
          if (isObject(payload)) {
            const hasEnvelope =
              typeof payload.status === 'string' ||
              typeof payload.success === 'boolean' ||
              payload.error !== undefined;

            if (hasEnvelope) {
              const envelope = payload as ApiEnvelope<unknown>;
              const envelopeError =
                envelope.status === 'error' ||
                envelope.success === false ||
                Boolean(envelope.error);

              if (envelopeError) {
                return {
                  ok: false,
                  error: toApiErrorPayload(normalizeEnvelopeError(payload), 'ENVELOPE_ERROR'),
                };
              }
            }
          }

          try {
            return {
              ok: true,
              data: normalizeSuccessData<TData>(payload),
            };
          } catch (error) {
            const normalized = normalizeThrownError(error);
            if (normalized.code === 'NETWORK_ERROR') {
              normalized.code = 'PARSE_ERROR';
            }

            return {
              ok: false,
              error: toApiErrorPayload(normalized, 'PARSE_ERROR'),
            };
          }
        }
      } catch (error) {
        lastError = normalizeThrownError(error);
      }

      if (!lastError || !shouldRetryError(lastError) || attempt > retryAttempts) {
        break;
      }

      const delayMs = computeBackoffDelay(attempt, retryBaseDelayMs, retryMaxDelayMs);
      await sleep(delayMs);
    }

    const normalizedLastError = lastError || {
      code: 'UNKNOWN_ERROR' as const,
      message: 'Request failed for an unknown reason.',
    };

    return {
      ok: false,
      error: toApiErrorPayload(
        {
          ...normalizedLastError,
          details: {
            ...(isObject(normalizedLastError.details)
              ? normalizedLastError.details
              : { originalDetails: normalizedLastError.details }),
            retryAttempts,
            totalAttempts: retryAttempts + 1,
          },
        },
        normalizedLastError.code
      ),
    };
  };

  return {
    request,
    get: (url, options = {}) => request(url, { ...options, method: 'GET' }),
    post: (url, body, options = {}) =>
      request(url, {
        ...options,
        method: 'POST',
        body,
      }),
  };
};