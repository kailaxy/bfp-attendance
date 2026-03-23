#!/usr/bin/env node

const ENV_KEYS = {
  mode: 'EXPO_PUBLIC_API_MODE',
  baseUrl: 'EXPO_PUBLIC_APPS_SCRIPT_BASE_URL',
  timeoutMs: 'EXPO_PUBLIC_API_TIMEOUT_MS',
};

const ROUTES = {
  health: '/health',
  scan: '/scan',
  logs: '/logs',
  personnel: '/personnel',
  leaves: '/leaves',
};

const DEFAULT_TIMEOUT_MS = 15000;

const readEnv = (key) => process.env[key];

const normalizeMode = (value) =>
  String(value || '')
    .trim()
    .toLowerCase() === 'live'
    ? 'live'
    : 'mock';

const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

const normalizeTimeout = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.floor(parsed);
};

const isAppsScriptUrl = (baseUrl) => baseUrl.toLowerCase().includes('script.google.com/macros/');

const createApiUrl = (baseUrl, path, queryParams) => {
  if (!baseUrl) {
    return '';
  }

  const useRouteQuery = isAppsScriptUrl(baseUrl);
  const url = useRouteQuery ? new URL(baseUrl) : new URL(`${baseUrl}${path}`);

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

const withTimeout = async (task, timeoutMs) => {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await task(controller.signal);
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const getJson = async (response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const isSuccessEnvelope = (payload) =>
  Boolean(
    payload &&
      typeof payload === 'object' &&
      payload.status === 'success' &&
      payload.success === true &&
      typeof payload.timestamp === 'string'
  );

const hasCollectionShape = (payload) =>
  Boolean(payload && typeof payload === 'object' && Array.isArray(payload.items));

const validateLiveRoute = async ({ key, url, timeoutMs }) => {
  try {
    const response = await withTimeout((signal) => fetch(url, { method: 'GET', signal }), timeoutMs);
    const payload = await getJson(response);

    if (!response.ok) {
      return {
        route: key,
        ok: false,
        reason: `HTTP ${response.status}`,
        status: response.status,
      };
    }

    if (!isSuccessEnvelope(payload)) {
      return {
        route: key,
        ok: false,
        reason: 'Response did not match success envelope shape.',
      };
    }

    if (key === 'health') {
      const hasCoreFields = typeof payload.service === 'string' && typeof payload.version === 'string';
      return {
        route: key,
        ok: hasCoreFields,
        reason: hasCoreFields
          ? 'Health payload contains service/version compatibility fields.'
          : 'Health payload missing service/version compatibility fields.',
      };
    }

    const dataPayload = payload.data ?? payload;
    const collectionOk = hasCollectionShape(dataPayload);
    return {
      route: key,
      ok: collectionOk,
      reason: collectionOk
        ? 'Collection payload shape is compatible (items[] present).'
        : 'Collection payload shape missing items[].',
    };
  } catch (error) {
    return {
      route: key,
      ok: false,
      reason: error instanceof Error ? error.message : 'Unknown fetch error',
    };
  }
};

const mode = normalizeMode(readEnv(ENV_KEYS.mode));
const baseUrl = normalizeBaseUrl(readEnv(ENV_KEYS.baseUrl));
const timeoutMs = normalizeTimeout(readEnv(ENV_KEYS.timeoutMs));

const urls = {
  health: createApiUrl(baseUrl, ROUTES.health),
  scan: createApiUrl(baseUrl, ROUTES.scan),
  logs: createApiUrl(baseUrl, ROUTES.logs),
  personnel: createApiUrl(baseUrl, ROUTES.personnel),
  leaves: createApiUrl(baseUrl, ROUTES.leaves),
};

const print = (line) => process.stdout.write(`${line}\n`);

print('--- Mobile Contract Smoke Check ---');
print(`mode: ${mode}`);
print(`baseUrl configured: ${baseUrl ? 'yes' : 'no'}`);
print(`timeoutMs: ${timeoutMs}`);
print('resolved routes:');
Object.entries(urls).forEach(([key, value]) => {
  print(`- ${key}: ${value || '[not configured]'}`);
});

if (mode !== 'live') {
  print('result: PASS (mock mode)');
  print('note: live endpoint fetch checks are skipped in mock mode.');
  process.exit(0);
}

if (!baseUrl) {
  print('result: FAIL');
  print('reason: live mode requires EXPO_PUBLIC_APPS_SCRIPT_BASE_URL.');
  process.exit(1);
}

const liveChecks = [
  { key: 'health', url: urls.health },
  { key: 'logs', url: urls.logs },
  { key: 'personnel', url: urls.personnel },
  { key: 'leaves', url: urls.leaves },
];

const results = [];
for (const check of liveChecks) {
  const result = await validateLiveRoute({ ...check, timeoutMs });
  results.push(result);
}

print('live check results:');
results.forEach((result) => {
  print(`- ${result.route}: ${result.ok ? 'PASS' : 'FAIL'} (${result.reason})`);
});

const failed = results.filter((result) => !result.ok);
if (failed.length > 0) {
  print('result: FAIL');
  process.exit(1);
}

print('result: PASS');
process.exit(0);