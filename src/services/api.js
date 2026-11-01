/**
 * API clients for LuxeBag.
 *
 * LuxeBag Backend (Express API):
 *   EXPO_PUBLIC_BACKEND_URL=http://YOUR_COMPUTER_LAN_IP:5000
 *
 * Keep these base URLs separate. Backend requests must never fall back to
 * MockAPI when EXPO_PUBLIC_BACKEND_URL is missing.
 * After changing .env, restart Expo with: npx expo start -c
 */

const trimBaseUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

export const BACKEND_URL = trimBaseUrl(process.env.EXPO_PUBLIC_BACKEND_URL);

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

/**
 * Load EVERY page of a paginated list endpoint.
 *
 * Backend list endpoints answer `{ [key]: [...], pagination: { totalPages } }` and cap
 * the page size, so a single request silently drops everything past the first page.
 * Items are de-duplicated by id because a record created while we are paging can shift
 * the pages by one. Fails loudly (never returns a partial list) if a page is invalid
 * or the list is unreasonably long.
 */
export async function fetchAllPages(path, key, { limit = 100, maxPages = 50, signal } = {}) {
  const separator = String(path).includes('?') ? '&' : '?';
  const items = [];
  const seen = new Set();
  let totalPages = 1;

  for (let page = 1; page <= totalPages; page += 1) {
    if (page > maxPages) {
      throw new Error(`Too many pages while loading ${path}.`);
    }
    const response = await backendApi.get(
      `${path}${separator}page=${page}&limit=${limit}`,
      { signal },
    );
    const list = response?.[key];
    // Do not turn an unexpected response into an empty list: callers may
    // otherwise overwrite a valid cached copy with empty data.
    if (!Array.isArray(list)) {
      throw new Error('Unexpected response from the server.');
    }
    for (const item of list) {
      const id = item?.id ?? item?._id;
      if (id !== undefined && id !== null) {
        if (seen.has(String(id))) continue;
        seen.add(String(id));
      }
      items.push(item);
    }
    totalPages = Number(response.pagination?.totalPages) || 1;
  }
  return items;
}

const PRODUCT_RESOURCE = 'api/products';

/** Get all published handbags from the Backend API (every page). */
export async function getHandbags() {
  return fetchAllPages(PRODUCT_RESOURCE, 'products', { limit: 100 });
}
