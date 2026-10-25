import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { fetchAdminUsers, peekAdminUsers } from '../services/adminService';

/**
 * Tài khoản + đơn hàng cho các màn quản trị.
 * Có bộ nhớ đệm nên chuyển tab là có dữ liệu ngay; tự làm mới ngầm khi màn hình được focus.
 * Trả về { users, loading, refreshing, error, reload }  (users = null khi chưa có dữ liệu)
 */
export default function useAdminUsers() {
  const [users, setUsers] = useState(peekAdminUsers);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force) => {
    setRefreshing(true);
    try {
      setUsers(await fetchAdminUsers({ force }));
      setError('');
    } catch {
      setError('Could not load data. Check your connection and try again.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  const reload = useCallback(() => load(true), [load]);

  return { users, loading: users === null && !error, refreshing, error, reload };
}
