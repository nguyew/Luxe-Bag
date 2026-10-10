import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * favoriteService – lưu danh sách túi yêu thích trên thiết bị bằng AsyncStorage.
 *
 * - Lưu nguyên object handbag, nên màn Favorites hiển thị được ngay,
 *   không cần gọi lại API.
 * - Không lưu trùng: so sánh theo id (luôn đổi về chuỗi).
 * - Ghi tuần tự (queue) để bấm nhanh nhiều lần không bị ghi đè dữ liệu.
 * - Mỗi lần thay đổi sẽ báo cho các màn đang lắng nghe (subscribeFavorites),
 *   nên xóa ở màn này thì màn kia cập nhật ngay.
 */

const STORAGE_KEY = '@luxebag/favorites';

const listeners = new Set();
let queue = Promise.resolve();

// Chạy các thao tác ghi lần lượt, lỗi của việc trước không chặn việc sau
function enqueue(task) {
  const result = queue.then(task);
  queue = result.catch(() => {});
  return result;
}

function notify(list) {
  listeners.forEach((listener) => {
    try {
      listener(list);
    } catch {
      // một listener lỗi không được làm hỏng các listener khác
    }
  });
}

async function readList() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // dữ liệu hỏng -> coi như danh sách rỗng
    return [];
  }
}

async function writeList(list) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  notify(list);
  return list;
}

/** Lấy toàn bộ danh sách yêu thích (mới thêm nằm trước). */
export function getFavorites() {
  return readList();
}

/** Túi này đã được yêu thích chưa. */
export async function isFavorite(id) {
  const list = await readList();
  return list.some((item) => String(item.id) === String(id));
}

/** Thêm một túi. Nếu id đã có thì giữ nguyên danh sách. Trả về danh sách mới. */
export function addFavorite(handbag) {
  return enqueue(async () => {
    const list = await readList();
    if (list.some((item) => String(item.id) === String(handbag.id))) {
      return list;
    }
    return writeList([handbag, ...list]);
  });
}

/** Xóa một túi theo id. Trả về danh sách mới. */
export function removeFavorite(id) {
  return enqueue(async () => {
    const list = await readList();
    const next = list.filter((item) => String(item.id) !== String(id));
    if (next.length === list.length) return list;
    return writeList(next);
  });
}

/** Xóa tất cả. Trả về danh sách rỗng. */
export function clearFavorites() {
  return enqueue(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    notify([]);
    return [];
  });
}

/**
 * Bật/tắt yêu thích cho một túi (dùng cho nút trái tim).
 * Trả về { favorites, added } – added = true nếu vừa thêm, false nếu vừa xóa.
 */
export function toggleFavorite(handbag) {
  return enqueue(async () => {
    const list = await readList();
    const exists = list.some(
      (item) => String(item.id) === String(handbag.id)
    );
    const next = exists
      ? list.filter((item) => String(item.id) !== String(handbag.id))
      : [handbag, ...list];
    await writeList(next);
    return { favorites: next, added: !exists };
  });
}

/** Lắng nghe thay đổi. Trả về hàm hủy đăng ký. */
export function subscribeFavorites(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}