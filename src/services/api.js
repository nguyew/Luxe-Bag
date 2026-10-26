/**
 * API clients for LuxeBag.
 *
 * MockAPI (legacy resources such as handbags/users):
 *   EXPO_PUBLIC_API_URL=https://your-project.mockapi.io/handbags
 *
 * LuxeBag Backend (Express API):
 *   EXPO_PUBLIC_BACKEND_URL=http://YOUR_COMPUTER_LAN_IP:5000
 *
 * Keep these base URLs separate. Backend requests must never fall back to
 * MockAPI when EXPO_PUBLIC_BACKEND_URL is missing.
 * After changing .env, restart Expo with: npx expo start -c
 */

const trimBaseUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

export const MOCK_API_URL = trimBaseUrl(process.env.EXPO_PUBLIC_API_URL)
  .replace(/\/handbags$/i, '');

export const BACKEND_URL = trimBaseUrl(process.env.EXPO_PUBLIC_BACKEND_URL);

// Backwards compatibility for existing imports that use BASE_URL for MockAPI.
export const BASE_URL = MOCK_API_URL;

const TIMEOUT_MS = 10000;

/**
 * Send an HTTP request to the explicitly selected API.
 * `baseUrl` is required to be configured by the relevant client; there is no
 * fallback between Backend and MockAPI.
 */
async function request(
  path,
  {
    method = 'GET',
    body,
    baseUrl,
    auth = false,
    apiName = 'API',
    signal: externalSignal,
  } = {},
) {
  const resolvedBaseUrl = trimBaseUrl(baseUrl);
  if (!resolvedBaseUrl) {
    const variableName = apiName === 'Backend'
      ? 'EXPO_PUBLIC_BACKEND_URL'
      : 'EXPO_PUBLIC_API_URL';
    throw new Error(
      `Missing ${variableName}. Add it to your .env file and restart Expo.`,
    );
  }

  const normalizedPath = String(path || '').replace(/^\/+/, '');
  if (!normalizedPath) {
    throw new Error('An API request path is required.');
  }

  const hasBody = body !== undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort);
  }

  try {
    const headers = {
      Accept: 'application/json',
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    };

    if (auth) {
      const { getAuthToken } = await import('./authToken');
      const token = await getAuthToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${resolvedBaseUrl}/${normalizedPath}`, {
      method,
      headers,
      body: hasBody ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const responseText = await response.text();
    let responseData = null;
    let validJson = true;

    if (responseText) {
      try {
        responseData = JSON.parse(responseText);
      } catch {
        // Some error responses (for example a reverse proxy error) may be
        // plain text or HTML. Keep the HTTP status available to callers.
        responseData = null;
        validJson = false;
      }
    }

    if (!response.ok) {
      const message = responseData?.message
        || responseData?.error
        || `Request failed with status ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.data = responseData;
      throw error;
    }

    if (responseText && !validJson) {
      throw new Error('The server returned an invalid JSON response.');
    }

    return responseData;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeout = new Error('The request timed out. Please try again.');
      timeout.code = 'timeout';
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
  }
}

// Legacy MockAPI client. Use only for features that have not been migrated yet.
export const api = {
  get: (path, options = {}) => request(path, {
    ...options, baseUrl: MOCK_API_URL,
    apiName: 'MockAPI',
  }),
  post: (path, body, options = {}) => request(path, {
    ...options, method: 'POST', body, baseUrl: MOCK_API_URL, apiName: 'MockAPI',
  }),
  put: (path, body, options = {}) => request(path, {
    ...options, method: 'PUT', body, baseUrl: MOCK_API_URL, apiName: 'MockAPI',
  }),
  patch: (path, body, options = {}) => request(path, {
    ...options, method: 'PATCH', body, baseUrl: MOCK_API_URL, apiName: 'MockAPI',
  }),
  delete: (path, options = {}) => request(path, {
    ...options, method: 'DELETE', baseUrl: MOCK_API_URL, apiName: 'MockAPI',
  }),
};

// Express Backend client. All requests use the Backend URL and include the
// stored JWT when available. It intentionally never falls back to MockAPI.
export const backendApi = {
  get: (path, options = {}) => request(path, {
    ...options, baseUrl: BACKEND_URL, auth: true, apiName: 'Backend',
  }),
  post: (path, body, options = {}) => request(path, {
    ...options, method: 'POST', body, baseUrl: BACKEND_URL, auth: true, apiName: 'Backend',
  }),
  put: (path, body, options = {}) => request(path, {
    ...options, method: 'PUT', body, baseUrl: BACKEND_URL, auth: true, apiName: 'Backend',
  }),
  patch: (path, body, options = {}) => request(path, {
    ...options, method: 'PATCH', body, baseUrl: BACKEND_URL, auth: true, apiName: 'Backend',
  }),
  delete: (path, options = {}) => request(path, {
    ...options, method: 'DELETE', baseUrl: BACKEND_URL, auth: true, apiName: 'Backend',
  }),
};

const PRODUCT_RESOURCE = 'api/products';

/** Get all handbags from the Backend API. */
export async function getHandbags() {
  const response = await backendApi.get(PRODUCT_RESOURCE);
  const products = response?.products;

  // Do not turn an unexpected response into an empty product list: callers may
  // otherwise overwrite a valid cached copy with empty data.
  if (!Array.isArray(products)) {
    throw new Error('Unexpected response from the server.');
  }

  return products;
}
