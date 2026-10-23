import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  getSnapshot,
  initAuth,
  login,
  logout,
  register,
  subscribe,
  updateAccount,
} from '../services/authStore';

/**
 * Trạng thái đăng nhập dùng chung.
 * Trả về { user, loading, isLoggedIn, isAdmin, login, register, logout, updateAccount }
 */
export default function useAuth() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    initAuth();
  }, []);

  return useMemo(
    () => ({
      user: snapshot.user,
      loading: snapshot.status === 'loading',
      isLoggedIn: !!snapshot.user,
      isAdmin: snapshot.user?.role === 'admin',
      login,
      register,
      logout,
      updateAccount,
    }),
    [snapshot]
  );
}
