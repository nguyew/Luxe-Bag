import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  ensureLoaded,
  getSnapshot,
  reload,
  revalidate,
  subscribe,
} from '../services/handbagStore';

/**
 * Danh sách túi xách dùng chung.
 * Trả về { items, loading, refreshing, error, reload, revalidate }:
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

  return useMemo(() => ({ ...snapshot, reload, revalidate }), [snapshot]);
}

/**
 * Bản MỚI NHẤT của một túi theo id (ví dụ feedback vừa được thêm trên API).
 * Chưa có trong kho thì dùng `fallback` (đối tượng truyền qua route).
 */
export function useHandbag(id, fallback) {
  const { items } = useHandbags();

  return useMemo(
    () => items.find((item) => String(item.id) === String(id)) || fallback,
    [items, id, fallback]
  );
}