import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdminHeader from '../components/AdminHeader';
import BulkDiscountSheet from '../components/BulkDiscountSheet';
import FilterChips from '../components/FilterChips';
import ProductStatusBadge from '../components/ProductStatusBadge';
import RemoteImage from '../components/RemoteImage';
import SearchBox from '../components/SearchBox';
import useHandbags from '../hooks/useHandbags';
import { LOW_STOCK_THRESHOLD, inventoryStats } from '../utils/admin';
import { getStock } from '../utils/catalog';
import { formatPercentOff, formatPrice } from '../utils/format';

const statusOf = (item) =>
  item.status === 'draft' || item.status === 'archived' ? item.status : 'published';

const idValue = (item) => Number(item.id) || 0;

/** Danh sách sản phẩm cho admin: tìm kiếm, lọc theo trạng thái, thêm mới, giảm giá hàng loạt. */
export default function AdminProductsScreen({ navigation }) {
  const { allItems, loading, error, reload, revalidate } = useHandbags();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [pulling, setPulling] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      revalidate();
    }, [revalidate])
  );

  const stats = useMemo(() => inventoryStats(allItems), [allItems]);

  const options = useMemo(
    () => [
      { key: 'all', label: 'All', count: stats.total },
      { key: 'published', label: 'Published', count: stats.published },
      { key: 'draft', label: 'Draft', count: stats.draft },
      { key: 'archived', label: 'Archived', count: stats.archived },
    ],
    [stats]
  );

  const data = useMemo(() => {
    const text = query.trim().toLowerCase();
    return allItems
      .filter((item) => filter === 'all' || statusOf(item) === filter)
      .filter(
        (item) =>
          !text ||
          String(item.handbagName || '').toLowerCase().includes(text) ||
          String(item.brand || '').toLowerCase().includes(text) ||
          String(item.category || '').toLowerCase().includes(text)
      )
      .sort((a, b) => idValue(b) - idValue(a));
  }, [allItems, filter, query]);

  const openForm = useCallback(
    (item) => navigation.navigate('AdminProductForm', { handbagId: item?.id }),
    [navigation]
  );

  const onRefresh = useCallback(async () => {
    setPulling(true);
    await reload();
    setPulling(false);
  }, [reload]);

  const renderItem = useCallback(
    ({ item }) => <ProductRow item={item} onPress={openForm} />,
    [openForm]
  );

  const empty = loading ? (
    <View style={styles.center}>
      <ActivityIndicator color="#292725" />
    </View>
  ) : error && allItems.length === 0 ? (
    <View style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={44} color="#77716A" />
      <Text style={styles.emptyTitle}>Couldn’t load products</Text>
      <Pressable onPress={reload} style={styles.retry} accessibilityRole="button">
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  ) : (
    <View style={styles.center}>
      <Ionicons name="pricetags-outline" size={44} color="#77716A" />
      <Text style={styles.emptyTitle}>No products found</Text>
      <Text style={styles.emptyText}>Try another filter or add a new product.</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F1F1" />

      <AdminHeader
        title="Products"
        subtitle={`${stats.total} total · ${stats.lowStock + stats.outOfStock} need restocking`}
        right={
          <View style={styles.actions}>
            <Pressable
              onPress={() => setDiscountOpen(true)}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="Bulk discount"
            >
              <Ionicons name="pricetag-outline" size={20} color="#1A1A1A" />
            </Pressable>
            <Pressable
              onPress={() => openForm(null)}
              style={[styles.iconButton, styles.addButton]}
              accessibilityRole="button"
              accessibilityLabel="Add product"
            >
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        }
      />

      <SearchBox value={query} onChangeText={setQuery} placeholder="Search name, brand or category" />
      <FilterChips options={options} value={filter} onChange={setFilter} />

      <FlatList
        data={data}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        windowSize={7}
        ListEmptyComponent={empty}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={onRefresh} />}
      />

      <BulkDiscountSheet
        visible={discountOpen}
        items={allItems}
        onClose={() => setDiscountOpen(false)}
      />
    </SafeAreaView>
  );
}

const ProductRow = React.memo(function ProductRow({ item, onPress }) {
  const stock = getStock(item);
  const discount = formatPercentOff(item.percentOff);

  let stockText = 'Stock not tracked';
  let stockStyle = styles.stockNeutral;
  if (stock === 0) {
    stockText = 'Out of stock';
    stockStyle = styles.stockOut;
  } else if (stock !== null) {
    stockText = stock <= LOW_STOCK_THRESHOLD ? `Low: ${stock} left` : `${stock} in stock`;
    stockStyle = stock <= LOW_STOCK_THRESHOLD ? styles.stockLow : styles.stockOk;
  }

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${item.handbagName}`}
    >
      <View style={styles.thumb}>
        <RemoteImage uri={item.uri} style={styles.thumbImage} />
      </View>

      <View style={styles.body}>
        <Text style={styles.brand} numberOfLines={1}>
          {item.brand || 'No brand'}
        </Text>
        <Text style={styles.name} numberOfLines={2}>
          {item.handbagName}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(item.cost)}</Text>
          {!!discount && <Text style={styles.discount}>{discount} off</Text>}
        </View>
        <View style={styles.metaRow}>
          <ProductStatusBadge status={statusOf(item)} />
          <Text style={[styles.stock, stockStyle]}>{stockText}</Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color="#B9B2AA" />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F1F1' },
  actions: { flexDirection: 'row', gap: 10 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: { backgroundColor: '#050505' },
  list: { paddingHorizontal: 20, paddingBottom: 32, flexGrow: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 56 },
  emptyTitle: { marginTop: 12, fontSize: 17, fontWeight: '800', color: '#0D0D0D' },
  emptyText: { marginTop: 4, fontSize: 13, color: '#77716A' },
  retry: {
    height: 42,
    marginTop: 16,
    paddingHorizontal: 24,
    borderRadius: 21,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginBottom: 10,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  thumb: {
    width: 62,
    height: 78,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#E7E3DF',
  },
  thumbImage: { width: '100%', height: '100%' },
  body: { flex: 1 },
  brand: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#77716A',
  },
  name: { marginTop: 1, fontSize: 14, lineHeight: 18, fontWeight: '600', color: '#1A1A1A' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  price: { fontSize: 15, fontWeight: '800', color: '#0D0D0D' },
  discount: { fontSize: 11, fontWeight: '700', color: '#1F7A3E' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  stock: { fontSize: 11, fontWeight: '700' },
  stockOk: { color: '#55514C' },
  stockLow: { color: '#8A5A00' },
  stockOut: { color: '#B3261E' },
  stockNeutral: { color: '#9A948D' },
});
