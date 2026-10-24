import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import FilterChips from '../components/FilterChips';
import SearchBox from '../components/SearchBox';
import StarRating from '../components/StarRating';
import useHandbags from '../hooks/useHandbags';
import { deleteReview, setReviewHidden } from '../services/adminService';
import { formatFeedbackDate, normalizeFeedbacks } from '../utils/feedback';

/** Kiểm duyệt đánh giá: xem mọi đánh giá, ẩn / hiện hoặc xóa. */
export default function AdminReviewsScreen() {
  const { allItems, loading, error, reload, revalidate } = useHandbags();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [pulling, setPulling] = useState(false);

  useFocusEffect(
    useCallback(() => {
      revalidate();
    }, [revalidate])
  );

  const reviews = useMemo(() => {
    const list = [];
    allItems.forEach((handbag) => {
      normalizeFeedbacks(handbag.feedbacks, { includeHidden: true }).forEach((item) => {
        list.push({
          ...item,
          key: `${handbag.id}:${item.id}`,
          handbagId: handbag.id,
          productName: handbag.handbagName,
        });
      });
    });
    return list.sort((a, b) => (b.date || 0) - (a.date || 0));
  }, [allItems]);

  const counts = useMemo(
    () => ({
      all: reviews.length,
      visible: reviews.filter((item) => !item.hidden).length,
      hidden: reviews.filter((item) => item.hidden).length,
      low: reviews.filter((item) => item.rating <= 2).length,
    }),
    [reviews]
  );

  const options = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'low', label: '1–2 stars', count: counts.low },
    { key: 'visible', label: 'Visible', count: counts.visible },
    { key: 'hidden', label: 'Hidden', count: counts.hidden },
  ];

  const data = useMemo(() => {
    const text = query.trim().toLowerCase();
    return reviews
      .filter((item) => {
        if (filter === 'visible') return !item.hidden;
        if (filter === 'hidden') return item.hidden;
        if (filter === 'low') return item.rating <= 2;
        return true;
      })
      .filter(
        (item) =>
          !text ||
          item.author.toLowerCase().includes(text) ||
          item.comment.toLowerCase().includes(text) ||
          String(item.productName || '').toLowerCase().includes(text)
      );
  }, [reviews, filter, query]);

  const run = useCallback(async (item, action) => {
    setBusyId(item.key);
    try {
      await action();
    } catch {
      Alert.alert('Reviews', 'Could not update this review. Please try again.');
    } finally {
      setBusyId(null);
    }
  }, []);

  const toggleHidden = useCallback(
    (item) => run(item, () => setReviewHidden(item.handbagId, item.id, !item.hidden)),
    [run]
  );

  const confirmDelete = useCallback(
    (item) => {
      Alert.alert('Delete this review?', `${item.author} · ${item.rating}★\nThis cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => run(item, () => deleteReview(item.handbagId, item.id)),
        },
      ]);
    },
    [run]
  );

  const onRefresh = useCallback(async () => {
    setPulling(true);
    await reload();
    setPulling(false);
  }, [reload]);

  const empty = loading ? (
    <View style={styles.center}>
      <ActivityIndicator color="#292725" />
    </View>
  ) : error && allItems.length === 0 ? (
    <View style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={44} color="#77716A" />
      <Text style={styles.emptyTitle}>Couldn’t load reviews</Text>
      <Pressable onPress={reload} style={styles.retry} accessibilityRole="button">
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  ) : (
    <View style={styles.center}>
      <Ionicons name="chatbubble-ellipses-outline" size={44} color="#77716A" />
      <Text style={styles.emptyTitle}>No reviews found</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <SearchBox value={query} onChangeText={setQuery} placeholder="Search author, comment or product" />
      <FilterChips options={options} value={filter} onChange={setFilter} />

      <FlatList
        data={data}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        windowSize={7}
        ListEmptyComponent={empty}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={[styles.card, item.hidden && styles.cardHidden]}>
            <Text style={styles.product} numberOfLines={1}>
              {item.productName}
            </Text>
            <View style={styles.metaRow}>
              <StarRating value={item.rating} size={14} />
              <Text style={styles.author} numberOfLines={1}>
                {item.author}
              </Text>
              {!!item.date && <Text style={styles.date}>{formatFeedbackDate(item.date)}</Text>}
            </View>
            {!!item.comment && <Text style={styles.comment}>{item.comment}</Text>}

            <View style={styles.footer}>
              {item.hidden && (
                <View style={styles.hiddenBadge}>
                  <Text style={styles.hiddenText}>Hidden</Text>
                </View>
              )}
              <View style={styles.actions}>
                {busyId === item.key ? (
                  <ActivityIndicator color="#292725" />
                ) : (
                  <>
                    <Pressable onPress={() => toggleHidden(item)} hitSlop={8} accessibilityRole="button">
                      <Text style={styles.action}>{item.hidden ? 'Show' : 'Hide'}</Text>
                    </Pressable>
                    <Pressable onPress={() => confirmDelete(item)} hitSlop={8} accessibilityRole="button">
                      <Text style={[styles.action, styles.danger]}>Delete</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F1F1', paddingTop: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 32, flexGrow: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 56 },
  emptyTitle: { marginTop: 12, fontSize: 17, fontWeight: '800', color: '#0D0D0D' },
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
  card: { padding: 16, marginBottom: 10, borderRadius: 22, backgroundColor: '#FFFFFF' },
  cardHidden: { opacity: 0.6 },
  product: { fontSize: 13, fontWeight: '700', color: '#55514C' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  author: { flexShrink: 1, fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  date: { fontSize: 12, color: '#77716A' },
  comment: { marginTop: 8, fontSize: 14, lineHeight: 20, color: '#1A1A1A' },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 12, minHeight: 24 },
  hiddenBadge: {
    paddingHorizontal: 9,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FBE3E1',
    justifyContent: 'center',
  },
  hiddenText: { fontSize: 11, fontWeight: '700', color: '#B3261E' },
  actions: { flexDirection: 'row', gap: 20, marginLeft: 'auto', alignItems: 'center' },
  action: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  danger: { color: '#B3261E' },
});
