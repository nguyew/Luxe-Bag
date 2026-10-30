/**
 * userService – tài khoản người dùng từ API của LuxeBag.
 *
 * Authentication uses the backend's /api/auth endpoints. Other account
 * operations continue to use the configured resource API.
 */
import { backendApi } from './api';
import {
  validateEmail,
  validateName,
  validatePassword,
  validatePhone,
  validateRequired,
} from '../utils/validation';

const AUTH_ENDPOINT = 'api/auth';

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
    case 'email_not_verified':
      return 'Please verify your email before signing in.';
    case 'invalid_verification_code':
      return 'That code isn’t correct. Check your email and try again.';
    case 'verification_expired':
      return 'This code has expired. Tap “Resend code” to get a new one.';
    case 'verification_locked':
      return 'Too many incorrect attempts. Tap “Resend code” to get a new one.';
    case 'email_already_verified':
      return 'This email is already verified. Please sign in.';
    case 'rate_limited':
      return error.message || 'Too many attempts. Please wait a moment and try again.';
    case 'email_unavailable':
      return 'We couldn’t send the verification email right now. Please try again in a moment.';
    case 'invalid_input':
      return error.message;
    case 'network':
    default:
      return 'Could not reach the server. Check your connection and try again.';
  }
}

export const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase();

// Chỉ trả về các trường an toàn và không kèm dữ liệu riêng tư khác.
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
    avatarUrl: String(record.avatarUrl || ''),
    // Backend: tài khoản mới phải xác minh email trước khi đăng nhập
    emailVerified: record.emailVerified !== false,
  };
}

// Mọi lỗi không phải AuthError (mất mạng, quá hạn, 5xx...) đều quy về 'network'
function asAuthError(error) {
  if (error instanceof AuthError) return error;
  // Backend gắn mã lỗi cụ thể (ví dụ email_not_verified) trong body: ưu tiên mã đó
  const serverCode = error?.data?.code;
  if (serverCode === 'email_not_verified') {
    return new AuthError('email_not_verified', error?.data?.error);
  }
  if (error?.status === 429) {
    return new AuthError('rate_limited', error?.data?.error || error?.message);
  }
  if (error?.status === 400) {
    const details = error?.data?.details;
    const message = Array.isArray(details) ? details.join(' ') : (error?.data?.error || error?.message);
    return new AuthError('invalid_input', message);
  }
  if (error?.status === 401) return new AuthError('invalid_credentials');
  if (error?.status === 403) return new AuthError('disabled');
  if (error?.status === 409) return new AuthError('email_taken');
  return new AuthError('network', error?.message);
}

/**
 * Đăng ký tài khoản khách hàng mới.
 * Backend gửi mã 6 số qua email và KHÔNG đăng nhập ngay: trả về { email } để
 * chuyển sang màn xác minh. Nếu email đã đăng ký nhưng chưa xác minh thì trả thêm
 * `alreadyPending: true` (người dùng cần xin mã mới).
 */
export async function registerUser({ name, email, password }) {
  const invalid =
    validateName(name) || validateEmail(email) || validatePassword(password);
  if (invalid) throw new AuthError('invalid_input', invalid);

  try {
    const response = await backendApi.post(`${AUTH_ENDPOINT}/register`, {
      name: String(name).trim(),
      email: normalizeEmail(email),
      password,
    });
    if (!response?.verificationRequired) throw new Error('Unexpected response from the server.');
    return { email: normalizeEmail(response.email || email), alreadyPending: false };
  } catch (error) {
    if (error?.status === 409) {
      if (error?.data?.code === 'email_not_verified') {
        return { email: normalizeEmail(email), alreadyPending: true };
      }
      throw new AuthError('email_taken');
    }
    // Backend không gửi được email thì xóa tài khoản vừa tạo và trả lỗi 5xx
    if (error?.status >= 500) throw new AuthError('email_unavailable');
    throw asAuthError(error);
  }
}

/** Xác minh email bằng mã 6 số. Thành công trả về { user, token } để đăng nhập luôn. */
export async function verifyEmailCode(email, code) {
  const digits = String(code ?? '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(digits)) {
    throw new AuthError('invalid_input', 'Enter the 6-digit code from your email.');
  }
  try {
    const response = await backendApi.post(`${AUTH_ENDPOINT}/verify-email`, {
      email: normalizeEmail(email),
      code: digits,
    });
    if (!response?.user || !response?.token) throw new Error('Unexpected response from the server.');
    return { user: toPublicUser(response.user), token: response.token };
  } catch (error) {
    const serverCode = error?.data?.code;
    if (
      ['invalid_verification_code', 'verification_expired', 'verification_locked', 'email_already_verified']
        .includes(serverCode)
    ) {
      throw new AuthError(serverCode, error?.data?.error);
    }
    throw asAuthError(error);
  }
}

/** Gửi lại mã xác minh. Backend giới hạn 1 lần/phút nên có thể trả lỗi rate_limited. */
export async function resendVerificationCode(email) {
  try {
    await backendApi.post(`${AUTH_ENDPOINT}/resend-verification`, {
      email: normalizeEmail(email),
    });
  } catch (error) {
    if (error?.status >= 500) throw new AuthError('email_unavailable');
    throw asAuthError(error);
  }
}

/** Đăng nhập. Trả về user công khai, hoặc ném AuthError. */
export async function loginUser(email, password) {
  const invalid = validateEmail(email) || (password ? '' : 'Enter your password.');
  if (invalid) throw new AuthError('invalid_input', invalid);

  try {
    const response = await backendApi.post(`${AUTH_ENDPOINT}/login`, {
      email: normalizeEmail(email),
      password,
    });
    if (!response?.user) throw new Error('Unexpected response from the server.');
    return { user: toPublicUser(response.user), token: response.token };
  } catch (error) {
    if (error?.status === 401) throw new AuthError('invalid_credentials');
    // 403 có hai nghĩa: chưa xác minh email (có code) hoặc tài khoản bị vô hiệu hóa
    if (error?.status === 403) {
      throw error?.data?.code === 'email_not_verified'
        ? new AuthError('email_not_verified', error?.data?.error)
        : new AuthError('disabled');
    }
    throw asAuthError(error);
  }
}

/** Lấy lại user hiện tại từ backend (dùng để làm mới phiên). */
export async function getUserById() {
  const response = await backendApi.get(`${AUTH_ENDPOINT}/me`);
  if (!response?.user) throw new Error('Unexpected response from the server.');
  return toPublicUser(response.user);
}

// Các trường người dùng được phép tự sửa; backend chỉ nhận các trường này.
const EDITABLE_FIELDS = ['name', 'phone'];

/** Cập nhật hồ sơ bằng endpoint đã xác thực; không còn đọc/ghi MockAPI. */
export async function updateUser(_id, patch = {}) {
  const safePatch = {};
  EDITABLE_FIELDS.forEach((field) => {
    if (patch[field] !== undefined) safePatch[field] = String(patch[field]).trim();
  });

  if (safePatch.name !== undefined) {
    const invalid = validateName(safePatch.name);
    if (invalid) throw new AuthError('invalid_input', invalid);
  }
  if (safePatch.phone !== undefined && safePatch.phone !== '' && validatePhone(safePatch.phone)) {
    throw new AuthError('invalid_input', validatePhone(safePatch.phone));
  }
  if (Object.keys(safePatch).length === 0) {
    throw new AuthError('invalid_input', 'No valid profile fields were provided.');
  }

  try {
    const response = await backendApi.patch(`${AUTH_ENDPOINT}/me`, safePatch);
    if (!response?.user) throw new Error('Unexpected response from the server.');
    return toPublicUser(response.user);
  } catch (error) {
    throw asAuthError(error);
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

/** Lưu địa chỉ giao hàng vào hồ sơ trên Backend. */
export async function setUserAddresses(_id, addresses) {
  try {
    const response = await backendApi.patch(`${AUTH_ENDPOINT}/me`, {
      addresses: sanitizeAddresses(addresses),
    });
    if (!response?.user) throw new Error('Unexpected response from the server.');
    return toPublicUser(response.user);
  } catch (error) {
    throw asAuthError(error);
  }
}