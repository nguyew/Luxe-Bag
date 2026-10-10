import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getHandbags } from '../services/api';
import HandbagCard from '../components/HandbagCard';
import useFavorites from '../hooks/useFavorites';

// Khối thông báo lỗi / danh sách rỗng, có nút thử lại
function StateMessage({ icon, title, message, actionLabel, onAction }) {
  return (
    <View style={styles.stateBox}>
      <Ionicons name={icon} size={40} color="#77716A" />
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{message}</Text>
      <Pressable onPress={onAction} style={styles.retryButton}>
        <Text style={styles.retryText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const [handbags, setHandbags] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isFavorite, toggleFavorite } = useFavorites();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Tải danh sách túi từ MockAPI. Dùng lại được cho nút "Try again".
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getHandbags();
      if (!mountedRef.current) return;

      if (!Array.isArray(data)) {
        throw new Error('Unexpected response from the server.');
      }

      setHandbags(
        data.map((item) => ({
          ...item,
          uri: item.uri || item.image || item.imageUrl || '',
        }))
      );
    } catch {
      if (mountedRef.current) {
        setError('Could not load handbags. Check your connection and try again.');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Danh sách brand lấy từ dữ liệu API: "All" + các brand không trùng, xếp A-Z
  const brands = useMemo(() => {
    const unique = new Set(
      handbags
        .map((item) => String(item.brand || '').trim())
        .filter(Boolean)
    );
    return ['All', ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [handbags]);

  // Lọc theo brand đang chọn, rồi sắp xếp giá giảm dần (theo đề bài)
  const filteredProducts = useMemo(() => {
    const byBrand =
      selectedBrand === 'All'
        ? handbags
        : handbags.filter(
            (item) => String(item.brand || '').trim() === selectedBrand
          );

    // Copy mảng trước khi sort để không làm đổi state gốc
    return [...byBrand].sort((a, b) => Number(b.cost) - Number(a.cost));
  }, [handbags, selectedBrand]);

  // Gom thành các hàng cho FlatList: 2 thẻ đứng -> 1 thẻ rộng -> lặp lại
  const rows = useMemo(() => {
    const result = [];
    let index = 0;

    while (index < filteredProducts.length) {
      result.push({
        key: `pair-${filteredProducts[index].id}`,
        type: 'pair',
        items: filteredProducts.slice(index, index + 2),
      });
      index += 2;

      if (index < filteredProducts.length) {
        result.push({
          key: `wide-${filteredProducts[index].id}`,
          type: 'wide',
          item: filteredProducts[index],
        });
        index += 1;
      }
    }

    return result;
  }, [filteredProducts]);

  // Hàm ổn định (không tạo lại mỗi lần render) để HandbagCard (memo) không vẽ lại thừa
  const openDetail = useCallback(
    (item) => navigation.navigate('Detail', { handbag: item }),
    [navigation]
  );

  const renderRow = useCallback(
    ({ item: row }) => {
      if (row.type === 'wide') {
        return (
          <View style={styles.rowWide}>
            <HandbagCard
              item={row.item}
              wide
              onOpen={openDetail}
              onFavorite={toggleFavorite}
              isFavorite={isFavorite(row.item.id)}
            />
          </View>
        );
      }

      const [first, second] = row.items;

      return (
        <View style={styles.productRow}>
          <View style={styles.productColumn}>
            <HandbagCard
              item={first}
              onOpen={openDetail}
              onFavorite={toggleFavorite}
              isFavorite={isFavorite(first.id)}
            />
          </View>

          <View style={styles.productColumn}>
            {second && (
              <HandbagCard
                item={second}
                onOpen={openDetail}
                onFavorite={toggleFavorite}
                isFavorite={isFavorite(second.id)}
              />
            )}
          </View>
        </View>
      );
    },
    [openDetail, toggleFavorite, isFavorite]
  );

  const keyExtractor = useCallback((row) => row.key, []);

  // Phần đầu danh sách: header, tiêu đề, chip brand (cuộn cùng danh sách)
  const listHeader = (
    <>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.navigate('Search')}
          style={styles.headerButton}
          hitSlop={8}
        >
          <Ionicons name="search-outline" size={24} color="#1A1A1A" />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Designed for elegance.</Text>
        <Text style={styles.heroBold}>Built for life.</Text>
      </View>

      {handbags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
        >
          {brands.map((brand) => {
            const active = selectedBrand === brand;

            return (
              <Pressable
                key={brand}
                onPress={() => setSelectedBrand(brand)}
                style={[styles.categoryChip, active && styles.activeChip]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    active && styles.activeChipText,
                  ]}
                >
                  {brand}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </>
  );

  // Hiện khi không có hàng nào: đang tải / lỗi / rỗng / brand không có túi
  let emptyContent;
  if (loading) {
    emptyContent = (
      <ActivityIndicator size="large" color="#292725" style={styles.loader} />
    );
  } else if (error) {
    emptyContent = (
      <StateMessage
        icon="cloud-offline-outline"
        title="Something went wrong"
        message={error}
        actionLabel="Try again"
        onAction={loadProducts}
      />
    );
  } else if (handbags.length === 0) {
    emptyContent = (
      <StateMessage
        icon="bag-outline"
        title="No handbags yet"
        message="The collection is empty right now."
        actionLabel="Refresh"
        onAction={loadProducts}
      />
    );
  } else {
    emptyContent = (
      <Text style={styles.emptyText}>No handbags for this brand.</Text>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F1F1" />

      <FlatList
        data={loading ? [] : rows}
        keyExtractor={keyExtractor}
        renderItem={renderRow}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyContent}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={7}
        removeClippedSubviews
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F1F1',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110, // chừa chỗ cho tab bar nổi
  },

  // Header
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  headerButton: {
    width: 32,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero
  hero: {
    paddingTop: 22,
    paddingBottom: 22,
  },

  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.9,
    color: '#1A1A1A',
    fontWeight: '400',
  },

  heroBold: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.9,
    color: '#0D0D0D',
    fontWeight: '800',
  },

  // Category chips
  categoryList: {
    gap: 6,
    paddingBottom: 22,
    alignItems: 'center',
  },

  categoryChip: {
    minHeight: 32,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },

  activeChip: {
    backgroundColor: '#050505',
  },

  categoryText: {
    fontSize: 13,
    color: '#55514C',
  },

  activeChipText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Product grid

  productRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  rowWide: {
    marginBottom: 12,
  },

  productColumn: {
    flex: 1,
    minWidth: 0,
  },

  stateBox: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  stateTitle: {
    marginTop: 14,
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  stateText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    color: '#77716A',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 22,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loader: {
    marginTop: 35,
  },

  emptyText: {
    textAlign: 'center',
    color: '#77716A',
    paddingVertical: 30,
  },
});