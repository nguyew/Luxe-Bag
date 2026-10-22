import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import HandbagCard from '../components/HandbagCard';
import useFavorites from '../hooks/useFavorites';
import { getHandbags } from '../services/api';
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

  const [handbags, setHandbags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Tải danh sách túi (dùng lại được cho nút "Try again")
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getHandbags();
      if (!mountedRef.current) return;

      setHandbags(
        data
          .filter((item) => item && item.id !== undefined && item.id !== null)
          .map((item) => ({
            ...item,
            id: String(item.id),
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

  // Debounce: chỉ lọc sau khi người dùng ngừng gõ một chút
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const searching = debouncedQuery.trim().length > 0;

  // Lọc theo từ khóa, rồi xếp giá giảm dần (giống Home)
  const results = useMemo(
    () =>
      [...filterHandbags(handbags, debouncedQuery)].sort(
        (a, b) => Number(b.cost) - Number(a.cost)
      ),
    [handbags, debouncedQuery]
  );

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
    !loading && !error && handbags.length > 0 ? (
      <Text style={styles.summary}>
        {searching
          ? `${results.length} ${results.length === 1 ? 'result' : 'results'} for “${debouncedQuery.trim()}”`
          : `All handbags (${results.length})`}
      </Text>
    ) : null;

  let emptyContent = null;
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
      <StateMessage
        icon="search-outline"
        title="No handbags found"
        message="Try a different name or brand."
        actionLabel="Clear search"
        onAction={clearQuery}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        {searchBar}
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

  // Ô tìm kiếm
  searchBox: {
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