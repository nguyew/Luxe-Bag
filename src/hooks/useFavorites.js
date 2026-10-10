import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import {
  getFavorites,
  subscribeFavorites,
  toggleFavorite as toggleFavoriteInStorage,
} from '../services/favoriteService';

/**
 * Hook dùng chung cho Home, Detail, Favorites, Search.
 * Tự tải danh sách từ AsyncStorage và tự cập nhật khi bất kỳ màn nào
 * thêm/xóa yêu thích.
 */
export default function useFavorites() {
  const [favorites, setFavorites] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const unsubscribe = subscribeFavorites((list) => {
      if (mounted) setFavorites(list);
    });

    getFavorites().then((list) => {
      if (mounted) {
        setFavorites(list);
        setReady(true);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const favoriteIds = useMemo(
    () => new Set(favorites.map((item) => String(item.id))),
    [favorites]
  );

  const isFavorite = useCallback(
    (id) => favoriteIds.has(String(id)),
    [favoriteIds]
  );

  const toggleFavorite = useCallback(async (handbag) => {
    try {
      return await toggleFavoriteInStorage(handbag);
    } catch {
      Alert.alert(
        'Favorites',
        'Could not update your favorites. Please try again.'
      );
      return null;
    }
  }, []);

  return { favorites, favoriteIds, isFavorite, toggleFavorite, ready };
}