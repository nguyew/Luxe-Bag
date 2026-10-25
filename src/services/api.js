/**
 * api.js – gọi MockAPI (mockapi.io).
 *
 * Địa chỉ gốc đọc từ file .env ở thư mục gốc của project:
 *   EXPO_PUBLIC_API_URL=https://abc123.mockapi.io
 * (nếu lỡ dán thêm "/handbags" ở cuối thì code tự bỏ đi).
 * Sửa .env xong phải khởi động lại: npx expo start -c
 *
 * Dùng chung cho mọi resource (handbags, users...):
 *   api.get('users'), api.post('users', body), api.put('users/5', body), api.delete('users/5')
 * Lỗi HTTP được ném ra kèm `error.status` (ví dụ 404) để nơi gọi xử lý riêng.
 * Lưu ý: MockAPI trả 404 khi lọc (?email=...) mà không có kết quả nào.
 */
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

export const backendApi = {
  get: (path) => request(path, { baseUrl: process.env.EXPO_PUBLIC_BACKEND_URL || BASE_URL, auth: true }),
  post: (path, body) => request(path, { method: 'POST', body, baseUrl: process.env.EXPO_PUBLIC_BACKEND_URL || BASE_URL, auth: true }),
  patch: (path, body) => request(path, { method: 'PATCH', body, baseUrl: process.env.EXPO_PUBLIC_BACKEND_URL || BASE_URL, auth: true }),
  delete: (path) => request(path, { method: 'DELETE', baseUrl: process.env.EXPO_PUBLIC_BACKEND_URL || BASE_URL, auth: true }),
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

/** Lấy một túi theo id (dùng cho Detail nếu cần tải lại). */
export function getHandbagById(id) {
  return api.get(`${RESOURCE}/${encodeURIComponent(id)}`);
}
