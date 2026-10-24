/**
 * cartService – giỏ hàng của từng tài khoản, lưu trên thiết bị (AsyncStorage).
 *
 * Chỉ lưu { id, qty }: tên, ảnh, giá, tồn kho luôn lấy từ kho dữ liệu túi xách
 * (handbagStore) nên không bao giờ cũ. Khách chưa đăng nhập không có giỏ.
 * Kho dùng chung (useSyncExternalStore): thêm ở Detail thì tab Cart và
 * huy hiệu số lượng cập nhật ngay.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = '@luxebag/cart';

let ownerKey = null; // null = chưa đăng nhập
let loadToken = 0;
let state = { items: [], ready: false };

const listeners = new Set();

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

function persist(items) {
  if (!ownerKey) return;
  AsyncStorage.setItem(ownerKey, JSON.stringify(items)).catch(() => {});
}

function commit(items) {
  setState({ items });
  persist(items);
}

// Đọc giỏ đã lưu, bỏ mục hỏng
function sanitize(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const result = [];
  raw.forEach((entry) => {
    const id = entry && entry.id !== undefined && entry.id !== null ? String(entry.id) : '';
    const qty = Math.floor(Number(entry?.qty));
    if (!id || seen.has(id) || !(qty >= 1)) return;
    seen.add(id);
    result.push({ id, qty });
  });
  return result;
}

/** Đổi chủ giỏ hàng (gọi khi đăng nhập / đăng xuất). ownerId = null -> không có giỏ. */
export async function setCartOwner(ownerId) {
  const token = ++loadToken;
  ownerKey = ownerId ? `${KEY_PREFIX}:${String(ownerId)}` : null;

  if (!ownerKey) {
    setState({ items: [], ready: true });
    return;
  }

  setState({ items: [], ready: false });
  let items = [];
  try {
    const raw = await AsyncStorage.getItem(ownerKey);
    items = sanitize(raw ? JSON.parse(raw) : []);
  } catch {
    // giỏ hỏng -> coi như rỗng
  }
  if (token === loadToken) setState({ items, ready: true });
}

/** Cộng thêm `qty` cho món (tạo mới nếu chưa có). `max` = số lượng tối đa cho phép. */
export function cartAdd(id, qty = 1, max = Infinity) {
  if (!ownerKey) return;
  const key = String(id);
  const existing = state.items.find((item) => item.id === key);

  if (existing) {
    const next = Math.min(existing.qty + qty, max);
    if (next === existing.qty) return;
    commit(state.items.map((item) => (item.id === key ? { ...item, qty: next } : item)));
  } else {
    const first = Math.min(qty, max);
    if (!(first >= 1)) return;
    commit([...state.items, { id: key, qty: first }]);
  }
}

/** Đặt số lượng cụ thể (>= 1). Muốn xóa thì dùng cartRemove. */
export function cartSetQty(id, qty) {
  const key = String(id);
  const value = Math.floor(Number(qty));
  if (!(value >= 1)) return;
  if (!state.items.some((item) => item.id === key)) return;
  commit(state.items.map((item) => (item.id === key ? { ...item, qty: value } : item)));
}

export function cartRemove(id) {
  const key = String(id);
  if (!state.items.some((item) => item.id === key)) return;
  commit(state.items.filter((item) => item.id !== key));
}

export function cartClear() {
  if (state.items.length === 0) return;
  commit([]);
}

/** Thay toàn bộ giỏ (dùng khi "sửa lỗi giỏ hàng": bỏ món hết hàng, hạ số lượng). */
export function cartReplace(items) {
  commit(sanitize(items));
}
