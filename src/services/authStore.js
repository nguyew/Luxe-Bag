/**
 * authStore – trạng thái đăng nhập DÙNG CHUNG cho mọi màn hình.
 *
 *  - Phiên (session) lưu trong AsyncStorage: chỉ chứa thông tin công khai của
 *    user (không có mật khẩu/băm). Mở lại app là vào thẳng, không cần mạng.
 *  - Khi mở app, phiên được kiểm tra lại ngầm với API: tài khoản bị vô hiệu
 *    hóa hoặc bị xóa -> tự đăng xuất; đổi role -> giao diện đổi theo.
 *    Mất mạng thì giữ nguyên phiên đã lưu.
 *  - Đổi tài khoản thì đổi luôn kho "yêu thích" và hồ sơ ảnh đại diện
 *    và giỏ hàng (mỗi tài khoản một bản riêng) TRƯỚC khi báo cho các màn hình.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getUserById,
  loginUser,
  registerUser,
  setUserAddresses,
  updateUser,
} from './userService';
import { setCartOwner } from './cartService';
import { setFavoritesOwner } from './favoriteService';
import { setProfileOwner } from './profileService';
import { setAuthToken } from './authToken';

const SESSION_KEY = '@luxebag/session';

// status: 'loading' (đang đọc phiên đã lưu) | 'ready'
let state = { user: null, status: 'loading' };

const listeners = new Set();
let initPromise = null;

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // một listener lỗi không được làm hỏng các listener khác
    }
  });
}

export const getSnapshot = () => state;

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function saveSession(user) {
  try {
    if (user) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ user }));
    else await AsyncStorage.removeItem(SESSION_KEY);
  } catch {
    // không lưu được thì thôi, lần sau đăng nhập lại
  }
}

// Đổi kho dữ liệu theo tài khoản trước, rồi mới công bố user mới
async function applyUser(user) {
  const ownerId = user ? user.id : null;
  await Promise.all([
    setFavoritesOwner(ownerId),
    setProfileOwner(ownerId),
    setCartOwner(ownerId),
  ]);
  setState({ user, status: 'ready' });
}

// Kiểm tra lại tài khoản với API (chạy ngầm, không chặn giao diện)
async function revalidate(userId) {
  try {
    const fresh = await getUserById(userId);
    if (!state.user || state.user.id !== userId) return; // đã đổi tài khoản

    if (fresh.status === 'disabled') {
      await logout();
      return;
    }
    setState({ user: fresh });
    saveSession(fresh);
  } catch (error) {
    // Tài khoản đã bị xóa -> đăng xuất. Lỗi khác (mất mạng...) -> giữ phiên cũ
    if (error?.status === 404 && state.user?.id === userId) await logout();
  }
}

/** Nạp phiên đã lưu (chỉ chạy một lần). */
export function initAuth() {
  if (!initPromise) {
    initPromise = (async () => {
      let cached = null;
      try {
        const raw = await AsyncStorage.getItem(SESSION_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && parsed.user && parsed.user.id) cached = parsed.user;
      } catch {
        // phiên hỏng -> coi như chưa đăng nhập
      }

      await applyUser(cached);
      if (cached) revalidate(cached.id);
    })();
  }
  return initPromise;
}

async function startSession(user) {
  await saveSession(user);
  await applyUser(user);
  return user;
}

/** Đăng nhập. Ném AuthError nếu sai thông tin / tài khoản bị khóa / mất mạng. */
export async function login(email, password) {
  const session = await loginUser(email, password);
  await setAuthToken(session.token);
  return startSession(session.user);
}

/** Đăng ký rồi đăng nhập luôn. */
export async function register({ name, email, password }) {
  const session = await registerUser({ name, email, password });
  await setAuthToken(session.token);
  return startSession(session.user);
}

export async function logout() {
  await setAuthToken(null);
  await saveSession(null);
  await applyUser(null);
}

/** Sửa hồ sơ (name, phone). Trả về user mới. */
export async function updateAccount(patch) {
  if (!state.user) throw new Error('Not signed in.');
  const user = await updateUser(state.user.id, patch);
  setState({ user });
  saveSession(user);
  return user;
}

/** Lưu danh sách địa chỉ giao hàng. Trả về user mới. */
export async function saveAddresses(addresses) {
  if (!state.user) throw new Error('Not signed in.');
  const user = await setUserAddresses(state.user.id, addresses);
  setState({ user });
  saveSession(user);
  return user;
}
