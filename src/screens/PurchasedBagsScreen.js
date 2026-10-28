import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import RemoteImage from '../components/RemoteImage';
import SignInPrompt from '../components/SignInPrompt';
import useAuth from '../hooks/useAuth';
import { describeOrderError, getPurchasedBags } from '../services/orderService';
import { formatBrand, formatPrice } from '../utils/format';
import { formatOrderDate } from '../utils/orders';

/**
 * Các túi khách đã mua thành công (đơn đã giao), gộp theo sản phẩm.
 * Dữ liệu lấy từ Backend: GET /api/orders/purchased.
 */
export default function PurchasedBagsScreen({ navigation }) {
  const { user, isLoggedIn } = useAuth();
  const userId = user?.id;

  const [data, setData] = useState(null); // null = chưa tải xong lần đầu
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setData(await getPurchasedBags());
      setError('');
    } catch (e) {
      setError(describeOrderError(e));
    }
  }, [userId]);

  // Tải lại mỗi lần quay về màn hình (ví dụ vừa viết đánh giá xong)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openBag = useCallback(
    (bag) =>
      navigation.navigate('Detail', {
        handbag: {
          id: bag.productId,
          handbagName: bag.name,
          brand: bag.brand,
          uri: bag.uri,
          cost: bag.currentPrice ?? bag.unitPrice,
        },
      }),
    [navigation]
  );
  const reviewBag = useCallback(
    (bag) => navigation.navigate('ReviewForm', { handbagId: bag.productId }),
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }) => <BagRow bag={item} onOpen={openBag} onReview={reviewBag} />,
    [openBag, reviewBag]
  );

  if (!isLoggedIn) {
    return (
      <View style={styles.screen}>
        <SignInPrompt
          icon="bag-check-outline"
          title="Purchased bags"
          message="Sign in to see the bags you have bought."
        />
      </View>
    );
  }

  if (data === null && !error) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color="#292725" />
      </View>
    );
  }

  if (data === null) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Ionicons name="cloud-offline-outline" size={44} color="#77716A" />
        <Text style={styles.emptyTitle}>Couldn’t load your purchases</Text>
        <Text style={styles.emptyText}>{error}</Text>
        <Pressable onPress={load} style={styles.primary} accessibilityRole="button">
          <Text style={styles.primaryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const { bags, summary } = data;

  return (
    <View style={styles.screen}>
      <FlatList
        data={bags}
        keyExtractor={(item) => item.productId}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
            {!!error && (
              <View style={styles.banner}>
                <Ionicons name="cloud-offline-outline" size={16} color="#8A5A00" />
                <Text style={styles.bannerText}>Offline – showing the last loaded purchases.</Text>
              </View>
            )}
            {bags.length > 0 && <SummaryCard summary={summary} />}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="bag-check-outline" size={44} color="#77716A" />
            <Text style={styles.emptyTitle}>No purchased bags yet</Text>
            <Text style={styles.emptyText}>
              Bags from delivered orders will appear here.
            </Text>
            <Pressable
              onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
              style={styles.primary}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>Start shopping</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('Orders')}
              style={styles.link}
              accessibilityRole="button"
            >
              <Text style={styles.linkText}>View my orders</Text>
            </Pressable>
          </View>
        }
        renderItem={renderItem}
        initialNumToRender={8}
        windowSize={7}
      />
    </View>
  );
}

function SummaryCard({ summary }) {
  return (
    <View style={styles.summary}>
      <SummaryStat label={summary.bags === 1 ? 'Bag' : 'Bags'} value={String(summary.bags)} />
      <View style={styles.summaryDivider} />
      <SummaryStat label={summary.items === 1 ? 'Item' : 'Items'} value={String(summary.items)} />
      <View style={styles.summaryDivider} />
      <SummaryStat label="Total spent" value={formatPrice(summary.totalSpent)} wide />
    </View>
  );
}

function SummaryStat({ label, value, wide }) {
  return (
    <View style={[styles.stat, wide && styles.statWide]}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const BagRow = React.memo(function BagRow({ bag, onOpen, onReview }) {
  const rating = bag.myReview ? Number(bag.myReview.rating) || 0 : 0;

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => onOpen(bag)}
        style={styles.cardMain}
        accessibilityRole="button"
        accessibilityLabel={`${bag.name}, view details`}
      >
        <View style={styles.thumb}>
          <RemoteImage uri={bag.uri} style={styles.thumbImage} iconSize={26} />
        </View>

        <View style={styles.body}>
          {!!bag.brand && (
            <Text style={styles.brand} numberOfLines={1}>
              {formatBrand(bag.brand)}
            </Text>
          )}
          <Text style={styles.name} numberOfLines={2}>
            {bag.name}
          </Text>
          <Text style={styles.meta}>
            Bought {bag.quantity}× · {formatOrderDate(bag.lastPurchasedAt)}
          </Text>
          <Text style={styles.price}>{formatPrice(bag.unitPrice)}</Text>
          {bag.ordersCount > 1 && (
            <Text style={styles.meta}>Across {bag.ordersCount} orders</Text>
          )}
        </View>

        <Ionicons name="chevron-forward" size={18} color="#9A948D" />
      </Pressable>

      <View style={styles.actions}>
        <Pressable
          onPress={() => onReview(bag)}
          style={[styles.action, bag.myReview ? styles.actionSoft : styles.actionDark]}
          accessibilityRole="button"
          accessibilityLabel={bag.myReview ? `Edit your review of ${bag.name}` : `Write a review of ${bag.name}`}
        >
          <Ionicons
            name={bag.myReview ? 'star' : 'star-outline'}
            size={15}
            color={bag.myReview ? '#8A5A00' : '#FFFFFF'}
          />
          <Text style={[styles.actionText, bag.myReview ? styles.actionTextSoft : styles.actionTextDark]}>
            {bag.myReview ? `${rating}/5 · Edit review` : 'Write a review'}
          </Text>
        </Pressable>

        {bag.available ? (
          <Pressable
            onPress={() => onOpen(bag)}
            style={[styles.action, styles.actionOutline]}
            accessibilityRole="button"
            accessibilityLabel={`Buy ${bag.name} again`}
          >
            <Ionicons name="repeat-outline" size={16} color="#1A1A1A" />
            <Text style={[styles.actionText, styles.actionTextOutline]}>Buy again</Text>
          </Pressable>
        ) : (
          <View style={[styles.action, styles.actionOff]}>
            <Ionicons name="ban-outline" size={15} color="#77716A" />
            <Text style={[styles.actionText, styles.actionTextOff]}>Unavailable</Text>
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F1F1' },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  list: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: '#FFF1D6',
  },
  bannerText: { fontSize: 12, color: '#8A5A00' },

  // Tổng quan
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
    marginBottom: 14,
    borderRadius: 26,
    backgroundColor: '#1E1E1E',
  },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  statWide: { flex: 1.8 },
  statValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, color: '#FFFFFF' },
  statLabel: { marginTop: 3, fontSize: 12, color: 'rgba(255,255,255,0.65)' },
  summaryDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.18)' },

  // Trạng thái rỗng / lỗi
  empty: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 24 },
  emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: '800', color: '#0D0D0D' },
  emptyText: { marginTop: 4, fontSize: 13, textAlign: 'center', color: '#77716A' },
  primary: {
    height: 46,
    marginTop: 20,
    paddingHorizontal: 26,
    borderRadius: 23,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  link: { marginTop: 14, padding: 6 },
  linkText: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', textDecorationLine: 'underline' },

  // Thẻ túi đã mua
  card: { padding: 14, marginBottom: 12, borderRadius: 26, backgroundColor: '#FFFFFF' },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  thumb: {
    width: 78,
    height: 98,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#E7E3DF',
  },
  thumbImage: { width: '100%', height: '100%' },
  body: { flex: 1, minWidth: 0 },
  brand: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#77716A',
  },
  name: { marginTop: 2, fontSize: 15, lineHeight: 20, fontWeight: '700', color: '#0D0D0D' },
  meta: { marginTop: 3, fontSize: 12, color: '#77716A' },
  price: { marginTop: 6, fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: '#0D0D0D' },

  // Nút hành động
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  action: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  actionDark: { backgroundColor: '#050505' },
  actionSoft: { backgroundColor: '#FFF1D6' },
  actionOutline: { borderWidth: 1.5, borderColor: '#1A1A1A' },
  actionOff: { backgroundColor: '#EFEBE7' },
  actionText: { fontSize: 13, fontWeight: '700' },
  actionTextDark: { color: '#FFFFFF' },
  actionTextSoft: { color: '#8A5A00' },
  actionTextOutline: { color: '#1A1A1A' },
  actionTextOff: { color: '#77716A' },
});