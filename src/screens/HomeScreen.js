import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import HandbagCard from '../components/HandbagCard';
import useFavorites from '../hooks/useFavorites';
import useHandbags from '../hooks/useHandbags';
import { formatBrand } from '../utils/format';

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
  // Dữ liệu dùng chung với Search/Stylist/Favorites; có sẵn bản lưu trên máy nên
  // mở app là thấy ngay, mất mạng vẫn xem được bộ sưu tập đã tải.
  const { items: handbags, loading, error, reload, revalidate } = useHandbags();

  // Bộ lọc & Sắp xếp chuyên nghiệp (All, Women, Men, Top Sales, Price, Brand)
  const [genderFilter, setGenderFilter] = useState('all'); // 'all' | 'women' | 'men'
  const [sortTab, setSortTab] = useState('default'); // 'default' | 'sales' | 'price'
  const [priceDirection, setPriceDirection] = useState('desc'); // 'desc' | 'asc'
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [brandModalVisible, setBrandModalVisible] = useState(false);

  const [pulling, setPulling] = useState(false);
  const { isFavorite, toggleFavorite } = useFavorites();

  // Quay lại tab Home (ví dụ từ Detail): nếu dữ liệu đã cũ thì làm mới ngầm
  useFocusEffect(
    useCallback(() => {
      revalidate();
    }, [revalidate])
  );

  // Kéo xuống để làm mới
  const onPullRefresh = useCallback(async () => {
    setPulling(true);
    await reload();
    setPulling(false);
  }, [reload]);

  // Danh sách brand lấy từ dữ liệu API: "All" + các brand không trùng, xếp A-Z
  const brands = useMemo(() => {
    const unique = new Set(
      handbags
        .map((item) => String(item.brand || '').trim())
        .filter(Boolean)
    );
    return ['All', ...Array.from(unique).sort((a, b) => formatBrand(a).localeCompare(formatBrand(b)))];
  }, [handbags]);

  // Đếm số lượng sản phẩm của từng thương hiệu
  const brandCounts = useMemo(() => {
    const map = { All: handbags.length };
    handbags.forEach((item) => {
      const b = String(item.brand || '').trim();
      if (b) map[b] = (map[b] || 0) + 1;
    });
    return map;
  }, [handbags]);

  // Brand đang chọn không còn trong dữ liệu mới -> quay về "All"
  useEffect(() => {
    if (!brands.includes(selectedBrand)) setSelectedBrand('All');
  }, [brands, selectedBrand]);

  // Toggle chiều sắp xếp giá
  const handlePriceToggle = () => {
    if (sortTab === 'price') {
      setPriceDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortTab('price');
      setPriceDirection('desc');
    }
  };

  // Lọc theo brand đang chọn, giới tính (All/Women/Men), rồi sắp xếp theo tab
  const filteredProducts = useMemo(() => {
    let result = [...handbags];

    // 1. Lọc theo Brand
    if (selectedBrand !== 'All') {
      result = result.filter(
        (item) => String(item.brand || '').trim() === selectedBrand
      );
    }

    // 2. Lọc theo Giới tính: All | Women | Men
    if (genderFilter === 'women') {
      result = result.filter((item) => item.gender === true);
    } else if (genderFilter === 'men') {
      result = result.filter((item) => item.gender === false);
    }

    // 3. Sắp xếp theo sortTab
    if (sortTab === 'sales') {
      result.sort((a, b) => {
        const scoreB = (b.feedbacks?.length || 0) + (b.stock !== undefined ? Math.max(0, 10 - b.stock) : 0);
        const scoreA = (a.feedbacks?.length || 0) + (a.stock !== undefined ? Math.max(0, 10 - a.stock) : 0);
        return scoreB - scoreA;
      });
    } else if (sortTab === 'price') {
      if (priceDirection === 'asc') {
        result.sort((a, b) => Number(a.cost || 0) - Number(b.cost || 0));
      } else {
        result.sort((a, b) => Number(b.cost || 0) - Number(a.cost || 0));
      }
    } else {
      // Mặc định: sắp xếp theo giá giảm dần (Assignment 1 Requirement)
      result.sort((a, b) => Number(b.cost || 0) - Number(a.cost || 0));
    }

    return result;
  }, [handbags, selectedBrand, genderFilter, sortTab, priceDirection]);

  // Gom thành các hàng cho FlatList: 2 thẻ đứng -> 1 thẻ rộng -> lặp lại
  const rows = useMemo(() => {
    const result = [];
    let index = 0;

    while (index < filteredProducts.length) {
      result.push({
        key: `pair-${index}-${filteredProducts[index].id}`,
        type: 'pair',
        items: filteredProducts.slice(index, index + 2),
      });
      index += 2;

      if (index < filteredProducts.length) {
        result.push({
          key: `wide-${index}-${filteredProducts[index].id}`,
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
          onPress={() => navigation.navigate('Stylist')}
          style={styles.headerButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open AI Stylist"
        >
          <Ionicons name="sparkles-outline" size={24} color="#1A1A1A" />
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate('Search')}
          style={styles.headerButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Search handbags"
        >
          <Ionicons name="search-outline" size={24} color="#1A1A1A" />
        </Pressable>
      </View>

      {!!error && handbags.length > 0 && (
        <Pressable
          onPress={reload}
          style={styles.offlineBanner}
          accessibilityRole="button"
          accessibilityLabel="Offline. Showing saved collection. Tap to retry."
        >
          <Ionicons name="cloud-offline-outline" size={16} color="#8A5A00" />
          <Text style={styles.offlineText}>
            Offline – showing your saved collection. Tap to retry.
          </Text>
        </Pressable>
      )}

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Designed for elegance.</Text>
        <Text style={styles.heroBold}>Built for life.</Text>
      </View>

      {/* Thanh bộ lọc & Sắp xếp chuyên nghiệp (All, Women, Men, Top Sales, Price, Brand) */}
      {handbags.length > 0 && (
        <View style={styles.filterBarContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterTabsRow}
          >
            {/* Tab: All */}
            <Pressable
              onPress={() => setGenderFilter('all')}
              style={[
                styles.sortTab,
                genderFilter === 'all' && styles.sortTabActive,
              ]}
            >
              <Text
                style={[
                  styles.sortTabText,
                  genderFilter === 'all' && styles.sortTabTextActive,
                ]}
              >
                All
              </Text>
            </Pressable>

            {/* Tab: Women */}
            <Pressable
              onPress={() => setGenderFilter('women')}
              style={[
                styles.sortTab,
                genderFilter === 'women' && styles.sortTabActive,
              ]}
            >
              <Text
                style={[
                  styles.sortTabText,
                  genderFilter === 'women' && styles.sortTabTextActive,
                ]}
              >
                Women
              </Text>
            </Pressable>

            {/* Tab: Men */}
            <Pressable
              onPress={() => setGenderFilter('men')}
              style={[
                styles.sortTab,
                genderFilter === 'men' && styles.sortTabActive,
              ]}
            >
              <Text
                style={[
                  styles.sortTabText,
                  genderFilter === 'men' && styles.sortTabTextActive,
                ]}
              >
                Men
              </Text>
            </Pressable>

            {/* Tab: Top Sales */}
            <Pressable
              onPress={() =>
                setSortTab((prev) => (prev === 'sales' ? 'default' : 'sales'))
              }
              style={[
                styles.sortTab,
                sortTab === 'sales' && styles.sortTabActive,
              ]}
            >
              <Text
                style={[
                  styles.sortTabText,
                  sortTab === 'sales' && styles.sortTabTextActive,
                ]}
              >
                Top Sales
              </Text>
            </Pressable>

            {/* Tab: Price (Toggle Thấp -> Cao, Cao -> Thấp) */}
            <Pressable
              onPress={handlePriceToggle}
              style={[
                styles.sortTab,
                styles.sortTabWithIcon,
                sortTab === 'price' && styles.sortTabActive,
              ]}
            >
              <Text
                style={[
                  styles.sortTabText,
                  sortTab === 'price' && styles.sortTabTextActive,
                ]}
              >
                Price
              </Text>
              <Ionicons
                name={
                  sortTab === 'price' && priceDirection === 'asc'
                    ? 'chevron-up'
                    : 'chevron-down'
                }
                size={14}
                color={sortTab === 'price' ? '#FFFFFF' : '#6B655E'}
                style={styles.tabIcon}
              />
            </Pressable>

            {/* Tab: Brand Dropdown Button */}
            <Pressable
              onPress={() => setBrandModalVisible(true)}
              style={[
                styles.sortTab,
                styles.sortTabWithIcon,
                selectedBrand !== 'All' && styles.sortTabBrandActive,
              ]}
            >
              <Text
                style={[
                  styles.sortTabText,
                  selectedBrand !== 'All' && styles.sortTabTextBrandActive,
                ]}
                numberOfLines={1}
              >
                {selectedBrand === 'All' ? 'Brand' : formatBrand(selectedBrand)}
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={selectedBrand !== 'All' ? '#0D0D0D' : '#6B655E'}
                style={styles.tabIcon}
              />
            </Pressable>
          </ScrollView>

          {/* Dòng hiển thị nhãn lọc đang hoạt động */}
          {(selectedBrand !== 'All' || genderFilter !== 'all') && (
            <View style={styles.activeFilterRow}>
              <Text style={styles.activeFilterLabel}>Filtered by:</Text>
              {genderFilter !== 'all' && (
                <Pressable
                  onPress={() => setGenderFilter('all')}
                  style={styles.activeFilterChip}
                >
                  <Text style={styles.activeFilterChipText}>
                    {genderFilter === 'women' ? 'Women' : 'Men'}
                  </Text>
                  <Ionicons name="close-circle" size={14} color="#0D0D0D" />
                </Pressable>
              )}
              {selectedBrand !== 'All' && (
                <Pressable
                  onPress={() => setSelectedBrand('All')}
                  style={styles.activeFilterChip}
                >
                  <Text style={styles.activeFilterChipText}>
                    {formatBrand(selectedBrand)}
                  </Text>
                  <Ionicons name="close-circle" size={14} color="#0D0D0D" />
                </Pressable>
              )}
              <Text style={styles.activeFilterCount}>
                ({filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'})
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Modal Dropdown chọn Brand */}
      <Modal
        visible={brandModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBrandModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setBrandModalVisible(false)}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Brand</Text>
                <Text style={styles.modalSub}>Filter products by brand</Text>
              </View>
              <Pressable
                onPress={() => setBrandModalVisible(false)}
                style={styles.modalCloseBtn}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color="#1A1A1A" />
              </Pressable>
            </View>

            <ScrollView
              style={styles.brandListScroll}
              showsVerticalScrollIndicator={false}
            >
              {brands.map((brand) => {
                const isSelected = selectedBrand === brand;
                const count = brandCounts[brand] || 0;
                return (
                  <Pressable
                    key={brand}
                    style={[
                      styles.brandItem,
                      isSelected && styles.brandItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedBrand(brand);
                      setBrandModalVisible(false);
                    }}
                  >
                    <View style={styles.brandItemLeft}>
                      <Ionicons
                        name={
                          isSelected
                            ? 'checkmark-circle'
                            : 'ellipse-outline'
                        }
                        size={18}
                        color={isSelected ? '#0D0D0D' : '#B5AEA8'}
                      />
                      <Text
                        style={[
                          styles.brandItemText,
                          isSelected && styles.brandItemTextSelected,
                        ]}
                      >
                        {brand === 'All' ? 'All Brands' : formatBrand(brand)}
                      </Text>
                    </View>
                    <View style={styles.brandCountBadge}>
                      <Text style={styles.brandCountText}>{count}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );

  // Hiện khi không có hàng nào: đang tải / lỗi / rỗng / brand không có túi
  let emptyContent;
  if (loading) {
    emptyContent = (
      <ActivityIndicator size="large" color="#292725" style={styles.loader} />
    );
  } else if (error && handbags.length === 0) {
    emptyContent = (
      <StateMessage
        icon="cloud-offline-outline"
        title="Something went wrong"
        message={error}
        actionLabel="Try again"
        onAction={reload}
      />
    );
  } else if (handbags.length === 0) {
    emptyContent = (
      <StateMessage
        icon="bag-outline"
        title="No handbags yet"
        message="The collection is empty right now."
        actionLabel="Refresh"
        onAction={reload}
      />
    );
  } else {
    emptyContent = (
      <Text style={styles.emptyText}>No handbags match your selection.</Text>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#E6E8EB" />

      {/* Nền gradient xám xanh nhạt ở đầu trang, mờ dần về nền chính */}
      <LinearGradient
        pointerEvents="none"
        colors={['#E6E8EB', '#F3F1F1']}
        style={styles.topGradient}
      />

      <FlatList
        data={loading ? [] : rows}
        keyExtractor={keyExtractor}
        renderItem={renderRow}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyContent}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={onPullRefresh}
            tintColor="#292725"
          />
        }
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
  },

  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 340,
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
    justifyContent: 'space-between',
  },

  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Banner khi mất mạng nhưng vẫn có dữ liệu đã lưu
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#FFF1D6',
  },
  offlineText: {
    flex: 1,
    fontSize: 12,
    color: '#8A5A00',
  },

  // Hero
  hero: {
    paddingTop: 18,
    paddingBottom: 20,
  },

  heroTitle: {
    fontSize: 30,
    lineHeight: 37,
    letterSpacing: -1,
    color: '#1A1A1A',
    fontWeight: '400',
  },

  heroBold: {
    fontSize: 30,
    lineHeight: 37,
    letterSpacing: -1,
    color: '#0D0D0D',
    fontWeight: '800',
  },

  // Professional Filter Bar & Sort Tabs
  filterBarContainer: {
    marginBottom: 16,
  },
  filterTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  sortTab: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 19,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  sortTabActive: {
    backgroundColor: '#0D0D0D',
  },
  sortTabText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B655E',
  },
  sortTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sortTabWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabIcon: {
    marginLeft: 2,
  },
  sortTabBrandActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0D0D0D',
  },
  sortTabTextBrandActive: {
    color: '#0D0D0D',
    fontWeight: '700',
  },

  // Active Filter Indicator
  activeFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 2,
  },
  activeFilterLabel: {
    fontSize: 12,
    color: '#77716A',
    fontWeight: '500',
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4DFDA',
  },
  activeFilterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0D0D0D',
  },
  activeFilterCount: {
    fontSize: 12,
    color: '#8A8580',
  },

  // Modal Dropdown for Brand Selection
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxHeight: '75%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE8',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  modalSub: {
    fontSize: 12,
    color: '#77716A',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F3F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandListScroll: {
    maxHeight: 320,
  },
  brandItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginBottom: 6,
  },
  brandItemSelected: {
    backgroundColor: '#F3F1F1',
  },
  brandItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  brandItemTextSelected: {
    color: '#0D0D0D',
    fontWeight: '700',
  },
  brandCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#F0ECE8',
  },
  brandCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#77716A',
  },

  // Product grid

  productRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
  },
  rowWide: {
    marginBottom: 14,
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