/**
 * userService – tài khoản người dùng lưu trong resource `users` của MockAPI.
 *
 * Mỗi record: { id, name, email, passwordHash, salt, role, status, phone,
 *               createdAt, addresses[], orders[] }
 *  - role:   'customer' | 'admin'   (admin chỉ tạo bằng scripts/seed-admin.js)
 *  - status: 'active' | 'disabled'  (tài khoản bị vô hiệu hóa không đăng nhập được)
 *
 * LƯU Ý BẢO MẬT: MockAPI không có xác thực thật. Mật khẩu được băm SHA-256
 * kèm salt riêng nên không lưu chữ thô, nhưng ai biết URL vẫn đọc/ghi được
 * API. Việc kiểm tra mật khẩu và role ở đây chỉ để mô phỏng cho bài tập.
 */
import * as Crypto from 'expo-crypto';
import { api } from './api';
import {
  validateEmail,
  validateName,
  validatePassword,
  validatePhone,
  validateRequired,
} from '../utils/validation';

const ENDPOINT = 'users';

export class AuthError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'AuthError';
    this.code = code;
  }
}

/** Thông báo thân thiện để hiển thị cho người dùng. */
export function describeAuthError(error) {
  switch (error?.code) {
    case 'invalid_credentials':
      return 'Incorrect email or password.';
    case 'disabled':
      return 'This account has been disabled. Please contact support.';
    case 'email_taken':
      return 'An account with this email already exists.';
    case 'invalid_input':
      return error.message;
    case 'network':
    default:
      return 'Could not reach the server. Check your connection and try again.';
  }
}

export const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase();

// Chỉ trả về các trường an toàn: KHÔNG có passwordHash/salt và không kèm orders
export function toPublicUser(record) {
  return {
    id: String(record.id),
    name: String(record.name || ''),
    email: normalizeEmail(record.email),
    // 'system' = bản ghi nội bộ (mã giảm giá), không phải tài khoản đăng nhập
    role: record.role === 'admin' ? 'admin' : record.role === 'system' ? 'system' : 'customer',
    status: record.status === 'disabled' ? 'disabled' : 'active',
    phone: String(record.phone || ''),
    createdAt: record.createdAt || null,
    addresses: Array.isArray(record.addresses) ? record.addresses : [],
  };
}

// Thuật toán băm: sha256("<salt>:<mật khẩu>") dạng hex.
// scripts/seed-admin.js phải dùng đúng công thức này.
export async function hashPassword(password, salt) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${password}`
  );
}

// MockAPI lọc theo kiểu "chứa chuỗi" và trả 404 khi không có kết quả,
// nên phải so sánh chính xác lại ở client và coi 404 là "không có".
async function findRecordByEmail(email) {
  try {
    const list = await api.get(`${ENDPOINT}?email=${encodeURIComponent(email)}`);
    if (!Array.isArray(list)) return null;
    return list.find((item) => normalizeEmail(item.email) === email) || null;
  } catch (error) {
    if (error?.status === 404) return null;
    throw error;
  }
}

// Mọi lỗi không phải AuthError (mất mạng, quá hạn, 5xx...) đều quy về 'network'
function asAuthError(error) {
  return error instanceof AuthError ? error : new AuthError('network');
}

/** Đăng ký tài khoản khách hàng mới. Trả về user công khai. */
export async function registerUser({ name, email, password }) {
  const invalid =
    validateName(name) || validateEmail(email) || validatePassword(password);
  if (invalid) throw new AuthError('invalid_input', invalid);

  try {
    const normalized = normalizeEmail(email);
    if (await findRecordByEmail(normalized)) throw new AuthError('email_taken');

    const salt = Crypto.randomUUID();
    const created = await api.post(ENDPOINT, {
      name: String(name).trim(),
      email: normalized,
      passwordHash: await hashPassword(password, salt),
      salt,
      role: 'customer', // luôn là khách hàng; admin tạo bằng script
      status: 'active',
      phone: '',
      createdAt: new Date().toISOString(),
      addresses: [],
      orders: [],
    });

    return toPublicUser(created);
  } catch (error) {
    throw asAuthError(error);
  }
}

/** Đăng nhập. Trả về user công khai, hoặc ném AuthError. */
export async function loginUser(email, password) {
  const invalid = validateEmail(email) || (password ? '' : 'Enter your password.');
  if (invalid) throw new AuthError('invalid_input', invalid);

  try {
    const record = await findRecordByEmail(normalizeEmail(email));

    // Cùng một thông báo cho "sai email" và "sai mật khẩu" để không lộ email nào có tài khoản
    if (!record || !record.salt || !record.passwordHash) {
      throw new AuthError('invalid_credentials');
    }
    if ((await hashPassword(password, record.salt)) !== record.passwordHash) {
      throw new AuthError('invalid_credentials');
    }
    if (record.status === 'disabled') throw new AuthError('disabled');

    return toPublicUser(record);
  } catch (error) {
    throw asAuthError(error);
  }
}

/** Lấy lại user theo id (dùng để làm mới phiên). Lỗi HTTP có `error.status`. */
export async function getUserById(id) {
  return toPublicUser(await api.get(`${ENDPOINT}/${encodeURIComponent(id)}`));
}

// Các trường người dùng được phép tự sửa
const EDITABLE_FIELDS = ['name', 'phone'];

/** Cập nhật hồ sơ. Đọc bản mới nhất rồi ghi lại để không làm mất orders/addresses. */
export async function updateUser(id, patch) {
  const safePatch = {};
  EDITABLE_FIELDS.forEach((field) => {
    if (patch[field] !== undefined) safePatch[field] = String(patch[field]).trim();
  });
  if (safePatch.name !== undefined) {
    const invalid = validateName(safePatch.name);
    if (invalid) throw new AuthError('invalid_input', invalid);
  }

  const path = `${ENDPOINT}/${encodeURIComponent(id)}`;
  const record = await api.get(path);
  return toPublicUser(await api.put(path, { ...record, ...safePatch }));
}

/** (Admin) Danh sách tất cả tài khoản. */
export async function listUsers() {
  try {
    const list = await api.get(ENDPOINT);
    return Array.isArray(list) ? list.map(toPublicUser) : [];
  } catch (error) {
    if (error?.status === 404) return [];
    throw error;
  }
}

export const MAX_ADDRESSES = 10;

/** Chuẩn hóa danh sách địa chỉ: bỏ mục sai, luôn có đúng một địa chỉ mặc định. */
export function sanitizeAddresses(list) {
  if (!Array.isArray(list)) return [];

  const cleaned = list
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      id: String(item.id || ''),
      label: String(item.label || '').trim().slice(0, 20) || 'Home',
      fullName: String(item.fullName || '').trim(),
      phone: String(item.phone || '').trim(),
      line1: String(item.line1 || '').trim(),
      city: String(item.city || '').trim(),
      isDefault: item.isDefault === true,
    }))
    .filter(
      (item) =>
        item.id &&
        !validateRequired(item.fullName, 'x') &&
        !validatePhone(item.phone) &&
        !validateRequired(item.line1, 'x') &&
        !validateRequired(item.city, 'x')
    )
    .slice(0, MAX_ADDRESSES);

  if (cleaned.length > 0) {
    const firstDefault = cleaned.findIndex((item) => item.isDefault);
    const keep = firstDefault >= 0 ? firstDefault : 0;
    cleaned.forEach((item, index) => {
      item.isDefault = index === keep;
    });
  }
  return cleaned;
}

/** Ghi lại toàn bộ địa chỉ của user (đọc bản mới nhất trước để không mất orders). */
export async function setUserAddresses(id, addresses) {
  const path = `${ENDPOINT}/${encodeURIComponent(id)}`;
  const record = await api.get(path);
  const saved = await api.put(path, { ...record, addresses: sanitizeAddresses(addresses) });
  return toPublicUser(saved);
}
