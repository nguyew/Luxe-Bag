/**
 * api.js – gọi MockAPI (mockapi.io) để lấy dữ liệu túi xách.
 *
 * Địa chỉ gốc đọc từ file .env ở thư mục gốc của project:
 *   EXPO_PUBLIC_API_URL=https://abc123.mockapi.io/api/v1
 * (không cần "/handbags" ở cuối; nếu lỡ dán thì code tự bỏ đi).
 * Sửa .env xong phải khởi động lại: npx expo start -c
 */
export const BASE_URL = (process.env.EXPO_PUBLIC_API_URL || '')
  .trim()
  .replace(/\/+$/, '') // bỏ dấu "/" ở cuối
  .replace(/\/handbags$/i, ''); // lỡ dán cả "/handbags" thì tự bỏ đi

const RESOURCE = 'handbags';
const TIMEOUT_MS = 10000;

// fetch có giới hạn thời gian; lỗi mạng, quá hạn hay HTTP lỗi đều ném Error
async function request(path) {
  if (!BASE_URL) {
    throw new Error(
      'Missing EXPO_PUBLIC_API_URL. Add it to your .env file and restart Expo.'
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('The request timed out. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Lấy toàn bộ túi xách. Ném lỗi nếu gọi thất bại (Home sẽ hiện nút "Try again"). */
export async function getHandbags() {
  const data = await request(RESOURCE);
  return Array.isArray(data) ? data : [];
}

/** Lấy một túi theo id (dùng cho Detail nếu cần tải lại). */
export function getHandbagById(id) {
  return request(`${RESOURCE}/${encodeURIComponent(id)}`);
}