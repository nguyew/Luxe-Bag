import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  LayoutAnimation,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import FavoriteItem from '../components/FavoriteItem';
import useFavorites from '../hooks/useFavorites';
import useHandbags from '../hooks/useHandbags';
import { confirmAction } from '../utils/confirm';

export default function FavoritesScreen({ navigation }) {
  const { favorites, ready, removeFavorite, clearFavorites } = useFavorites();
  const { items: catalog, reload } = useHandbags();
  const [pulling, setPulling] = useState(false);

  // Kéo xuống để làm mới dữ liệu từ API
  const onRefresh = useCallback(async () => {
    setPulling(true);
    await reload();
    setPulling(false);
  }, [reload]);

  // Danh sách yêu thích lưu bản sao của túi lúc bấm tim, nên có thể cũ (giá,
  // feedback...). Dùng bản mới nhất từ kho dùng chung; mất mạng thì vẫn hiển
  // thị bản đã lưu trên máy.
  const fresh = useMemo(() => {
    const byId = {};
    catalog.forEach((handbag) => {
      byId[String(handbag.id)] = handbag;
    });
    return byId;
  }, [catalog]);

  // Ghép bản mới từ API (nếu có) lên bản đã lưu
  const items = useMemo(
    () =>
      favorites.map((saved) => {
        const latest = fresh[String(saved.id)];
        return latest ? { ...saved, ...latest } : saved;
      }),
    [favorites, fresh]
  );

  const openDetail = useCallback(
    (item) => navigation.navigate('Detail', { handbag: item }),
    [navigation]
  );

  const handleRemove = useCallback(
    (item) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      removeFavorite(item.id);
    },
    [removeFavorite]
  );

  const confirmClearAll = useCallback(() => {
    const count = favorites.length;
    confirmAction({
      title: 'Clear all favorites?',
      message: `This removes ${count} ${count === 1 ? 'handbag' : 'handbags'} from your favorites.`,
      confirmText: 'Clear all',
      destructive: true,
      onConfirm: () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        clearFavorites();
      },
    });
  }, [favorites.length, clearFavorites]);

  const renderItem = useCallback(
    ({ item }) => (
      <FavoriteItem item={item} onOpen={openDetail} onRemove={handleRemove} />
    ),
    [openDetail, handleRemove]
  );

  const keyExtractor = useCallback((item) => String(item.id), []);

  const listHeader = (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.title}>Favorites</Text>
        {ready && items.length > 0 && (
          <Text style={styles.subtitle}>
            {items.length} saved {items.length === 1 ? 'handbag' : 'handbags'}
          </Text>
        )}
      </View>

      {ready && items.length > 0 && (
        <Pressable
          onPress={confirmClearAll}
          style={styles.clearButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear all favorites"
        >
          <Ionicons name="trash-outline" size={15} color="#B3261E" />
          <Text style={styles.clearText}>Clear all</Text>
        </Pressable>
      )}
    </View>
  );

  let emptyContent = null;
  if (!ready) {
    emptyContent = (
      <ActivityIndicator size="large" color="#292725" style={styles.loader} />
    );
  } else {
    emptyContent = (
      <View style={styles.emptyBox}>
        <Ionicons name="heart-outline" size={44} color="#77716A" />
        <Text style={styles.emptyTitle}>No favorites yet</Text>
        <Text style={styles.emptyText}>
          Tap the heart on any handbag to save it here.
        </Text>
        <Pressable
          onPress={() => navigation.navigate('Home')}
          style={styles.browseButton}
        >
          <Text style={styles.browseText}>Browse handbags</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F1F1" />

      <FlatList
        data={ready ? items : []}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyContent}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={onRefresh}
            tintColor="#292725"
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F1F1',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 110, // chừa chỗ cho tab bar nổi
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 24,
    paddingBottom: 20,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.9,
    color: '#0D0D0D',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#77716A',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: '#FBE3E1',
  },
  clearText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B3261E',
  },

  // Trạng thái
  loader: {
    marginTop: 35,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 56,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    color: '#77716A',
  },
  browseButton: {
    marginTop: 20,
    paddingHorizontal: 22,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  browseText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
