import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FilterSheet from '../components/FilterSheet';
import HandbagCard from '../components/HandbagCard';
import useFavorites from '../hooks/useFavorites';
import useHandbags from '../hooks/useHandbags';
import { DEFAULT_FILTERS, applyFilters, countActiveFilters } from '../utils/filters';
import { filterHandbags } from '../utils/search';

const DEBOUNCE_MS = 200;
const SPACER_ID = '__spacer__';

// Khối thông báo (lỗi / không có kết quả) kèm một nút hành động
function StateMessage({ icon, title, message, actionLabel, onAction }) {
  return (
    <View style={styles.stateBox}>
      <Ionicons name={icon} size={40} color="#77716A" />
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{message}</Text>
      <Pressable onPress={onAction} style={styles.stateButton}>
        <Text style={styles.stateButtonText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

export default function SearchScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { isFavorite, toggleFavorite } = useFavorites();

  // Dữ liệu từ kho dùng chung: mở Search là có sẵn ngay, không còn vòng xoay chờ
  const { items: handbags, loading, error, reload: loadProducts } = useHandbags();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Debounce: chỉ lọc sau khi người dùng ngừng gõ một chút
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const searching = debouncedQuery.trim().length > 0;

  // Lọc theo từ khóa, rồi áp bộ lọc nâng cao và sắp xếp (mặc định giá giảm dần, giống Home)
  const matched = useMemo(
    () => filterHandbags(handbags, debouncedQuery),
    [handbags, debouncedQuery]
  );
  const results = useMemo(() => applyFilters(matched, filters), [matched, filters]);
  const activeFilters = countActiveFilters(filters);
  const clearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  // Lưới 2 cột: nếu số lẻ thì thêm ô trống để thẻ cuối không bị kéo giãn
  const data = useMemo(
    () => (results.length % 2 === 1 ? [...results, { id: SPACER_ID }] : results),
    [results]
  );

  const openDetail = useCallback(
    (item) => navigation.navigate('Detail', { handbag: item }),
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }) => {
      if (item.id === SPACER_ID) return <View style={styles.cell} />;

      return (
        <View style={styles.cell}>
          <HandbagCard
            item={item}
            onOpen={openDetail}
            onFavorite={toggleFavorite}
            isFavorite={isFavorite(item.id)}
          />
        </View>
      );
    },
    [openDetail, toggleFavorite, isFavorite]
  );

  const keyExtractor = useCallback((item) => item.id, []);

  const clearQuery = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
  }, []);

  // Nút mở bảng lọc, có huy hiệu số bộ lọc đang bật
  const filterButton = (
    <Pressable
      onPress={() => setSheetOpen(true)}
      style={[styles.filterButton, activeFilters > 0 && styles.filterButtonOn]}
      accessibilityRole="button"
      accessibilityLabel={
        activeFilters > 0 ? `Filters, ${activeFilters} active` : 'Filters'
      }
    >
      <Ionicons
        name="options-outline"
        size={22}
        color={activeFilters > 0 ? '#FFFFFF' : '#1A1A1A'}
      />
      {activeFilters > 0 && (
        <View style={styles.filterBadge}>
          <Text style={styles.filterBadgeText}>{activeFilters}</Text>
        </View>
      )}
    </Pressable>
  );

  // Ô nhập từ khóa (nằm ngoài FlatList để không mất focus khi danh sách đổi)
  const searchBar = (
    <View style={styles.searchBox}>
      <Ionicons name="search-outline" size={20} color="#77716A" />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search handbags by name"
        placeholderTextColor="#9A948D"
        style={styles.input}
        autoFocus
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel="Search handbags"
      />
      {query.length > 0 && (
        <Pressable
          onPress={clearQuery}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Ionicons name="close-circle" size={20} color="#9A948D" />
        </Pressable>
      )}
    </View>
  );

  // Dòng tóm tắt số kết quả
  const summary =
    !loading && handbags.length > 0 ? (
      <Text style={styles.summary}>
        {searching
          ? `${results.length} ${results.length === 1 ? 'result' : 'results'} for “${debouncedQuery.trim()}”`
          : `All handbags (${results.length})`}
        {activeFilters > 0 ? ` · ${activeFilters} ${activeFilters === 1 ? 'filter' : 'filters'}` : ''}
      </Text>
    ) : null;

  let emptyContent = null;
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
      <StateMessage
        icon="search-outline"
        title="No handbags found"
        message="Try a different name, brand or filters."
        actionLabel={activeFilters > 0 ? 'Clear filters' : 'Clear search'}
        onAction={activeFilters > 0 ? clearFilters : clearQuery}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <View style={styles.searchRow}>
          {searchBar}
          {filterButton}
        </View>
        {summary}
      </View>

      <FlatList
        data={loading ? [] : data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.row}
        ListEmptyComponent={emptyContent}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
      />

      <FilterSheet
        visible={sheetOpen}
        items={matched}
        filters={filters}
        onApply={(next) => {
          setFilters(next);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F1F1',
  },
  top: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonOn: { backgroundColor: '#050505' },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#FF4D5E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },

  // Ô tìm kiếm
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#1A1A1A',
    padding: 0,
  },
  summary: {
    marginTop: 14,
    marginLeft: 4,
    fontSize: 13,
    color: '#77716A',
  },

  // Lưới kết quả
  content: {
    paddingHorizontal: 20,
    flexGrow: 1,
  },
  row: {
    gap: 12,
    marginBottom: 12,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },

  // Trạng thái
  loader: {
    marginTop: 35,
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
  stateButton: {
    marginTop: 20,
    paddingHorizontal: 22,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
