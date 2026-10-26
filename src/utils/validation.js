/**
 * Kiểm tra dữ liệu nhập ở form đăng nhập / đăng ký.
 * Mỗi hàm trả về chuỗi lỗi, hoặc '' nếu hợp lệ.
 */
export const NAME_MAX_LENGTH = 40;
export const PASSWORD_MIN_LENGTH = 8;

export function validateName(value) {
  const name = String(value ?? '').trim();
  if (!name) return 'Enter your name.';
  if (name.length > NAME_MAX_LENGTH) {
    return `Use at most ${NAME_MAX_LENGTH} characters.`;
  }
  return '';
}

export function validateEmail(value) {
  const email = String(value ?? '').trim();
  if (!email) return 'Enter your email.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Enter a valid email address.';
  }
  return '';
}

export function validatePassword(value) {
  const password = String(value ?? '');
  if (!password) return 'Enter a password.';
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  return '';
}

export function validatePhone(value) {
  const digits = String(value ?? '').replace(/[\s().+-]/g, '');
  if (!digits) return 'Enter a phone number.';
  if (!/^\d{8,15}$/.test(digits)) return 'Enter a valid phone number.';
  return '';
}

export function validateRequired(value, message) {
  return String(value ?? '').trim() ? '' : message;
}
