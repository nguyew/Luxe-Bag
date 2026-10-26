export const BASE_URL = (process.env.EXPO_PUBLIC_API_URL || '')
  .trim()
  .replace(/\/+$/, '') // bỏ dấu "/" ở cuối
  .replace(/\/handbags$/i, ''); // lỡ dán cả "/handbags" thì tự bỏ đi

const RESOURCE = 'api/products';
const TIMEOUT_MS = 10000;

// fetch có giới hạn thời gian; lỗi mạng, quá hạn hay HTTP lỗi đều ném Error
async function request(path, { method = 'GET', body, baseUrl = BASE_URL, auth = false } = {}) {
  if (!baseUrl) {
    throw new Error(
      'Missing EXPO_PUBLIC_API_URL. Add it to your .env file and restart Expo.'
    );
  }

  const hasBody = body !== undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const headers = hasBody
      ? { Accept: 'application/json', 'Content-Type': 'application/json' }
      : { Accept: 'application/json' };
    if (auth) {
      const { getAuthToken } = await import('./authToken');
      const token = await getAuthToken();
      if (token) headers.Authorization = 'Bearer ' + token;
    }
    const response = await fetch(`${baseUrl}/${path}`, {
      method,
      headers,
      body: hasBody ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = new Error(`Request failed with status ${response.status}`);
      error.status = response.status;
      throw error;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeout = new Error('The request timed out. Please try again.');
      timeout.code = 'timeout';
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

const BACKEND_URL = (
  process.env.EXPO_PUBLIC_BACKEND_URL || ''
)
  .trim()
  .replace(/\/+$/, '');

function backendRequest(path, options = {}) {
  if (!BACKEND_URL) {
    throw new Error(
      'Missing EXPO_PUBLIC_BACKEND_URL. ' +
      'Please configure it in .env.local and restart Expo.'
    );
  }

  return request(path, {
    ...options,
    baseUrl: BACKEND_URL,
    auth: true,
  });
}

export const backendApi = {
  get: (path) => backendRequest(path),

  post: (path, body) =>
    backendRequest(path, {
      method: 'POST',
      body,
    }),

  patch: (path, body) =>
    backendRequest(path, {
      method: 'PATCH',
      body,
    }),

  delete: (path) =>
    backendRequest(path, {
      method: 'DELETE',
    }),
};

/** Lấy toàn bộ túi xách. Ném lỗi nếu gọi thất bại (Home sẽ hiện nút "Try again"). */
export async function getHandbags() {
  const response = await backendApi.get(RESOURCE);
  const data = response?.products;
  // Không trả về [] khi dữ liệu lạ: nếu vậy kho dữ liệu sẽ tưởng cửa hàng
  // trống và ghi đè bản sao tốt đang có
  if (!Array.isArray(data)) throw new Error('Unexpected response from the server.');
  return data;
}
