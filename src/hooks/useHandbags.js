import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  ensureLoaded,
  getSnapshot,
  reload,
  revalidate,
  subscribe,
} from '../services/handbagStore';
import { isPublished } from '../utils/catalog';

/**
 * Danh sách túi xách dùng chung.
 * Trả về { items, allItems, loading, refreshing, error, reload, revalidate }:
 *  - items:      chỉ các túi ĐÃ XUẤT BẢN (dùng cho khách hàng: Home, Search...)
 *  - allItems:   tất cả, kể cả bản nháp/lưu trữ (dùng cho Detail, giỏ hàng, admin)
 *  - loading:    đang tải và chưa có dữ liệu để hiển thị
 *  - refreshing: đang tải lại ngầm (vẫn có dữ liệu cũ)
 *  - error:      thông báo lỗi (có thể vẫn kèm dữ liệu cũ -> chế độ offline)
 *  - reload():     tải lại ngay (kéo để làm mới, nút Try again)
 *  - revalidate(): tải lại nếu dữ liệu đã cũ (gọi khi màn hình được focus)
 */
export default function useHandbags() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    ensureLoaded();
  }, []);

  return useMemo(
    () => ({
      ...snapshot,
      items: snapshot.items.filter(isPublished),
      allItems: snapshot.items,
      reload,
      revalidate,
    }),
    [snapshot]
  );
}

/**
 * Bản MỚI NHẤT của một túi theo id (ví dụ feedback/tồn kho vừa đổi trên API).
 * Chưa có trong kho thì dùng `fallback` (đối tượng truyền qua route).
 */
export function useHandbag(id, fallback) {
  const { allItems } = useHandbags();

  return useMemo(
    () => allItems.find((item) => String(item.id) === String(id)) || fallback,
    [allItems, id, fallback]
  );
}
