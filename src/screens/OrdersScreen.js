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
import OrderStatusBadge from '../components/OrderStatusBadge';
import RemoteImage from '../components/RemoteImage';
import SignInPrompt from '../components/SignInPrompt';
import useAuth from '../hooks/useAuth';
import { describeOrderError, getMyOrders } from '../services/orderService';
import { formatPrice } from '../utils/format';
import { paymentStatusMeta } from '../utils/orders';
import { formatOrderCode, formatOrderDate } from '../utils/orders';

/** Danh sách đơn hàng của tôi (mới nhất trước). */
export default function OrdersScreen({ navigation }) {
  const { user, isLoggedIn } = useAuth();
  const userId = user?.id;

  const [orders, setOrders] = useState(null); // null = chưa tải xong lần đầu
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setOrders(await getMyOrders(userId));
      setError('');
    } catch (e) {
      setError(describeOrderError(e));
    }
  }, [userId]);

  // Tải lại mỗi lần màn hình được focus (ví dụ vừa hủy đơn ở màn chi tiết)
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

  // Hàm ổn định -> OrderRow (React.memo) không vẽ lại khi danh sách đổi nhỏ
  const openOrder = useCallback(
    (order) => navigation.navigate('OrderDetail', { orderId: order.id, order }),
    [navigation]
  );
  const renderItem = useCallback(
    ({ item }) => <OrderRow order={item} onPress={openOrder} />,
    [openOrder]
  );

  if (!isLoggedIn) {
    return (
      <View style={styles.screen}>
        <SignInPrompt
          icon="receipt-outline"
          title="My orders"
          message="Sign in to see your orders."
        />
      </View>
    );
  }

  if (orders === null && !error) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color="#292725" />
      </View>
    );
  }

  if (orders === null) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Ionicons name="cloud-offline-outline" size={44} color="#77716A" />
        <Text style={styles.emptyTitle}>Couldn’t load your orders</Text>
        <Text style={styles.emptyText}>{error}</Text>
        <Pressable onPress={load} style={styles.primary} accessibilityRole="button">
          <Text style={styles.primaryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          error ? (
            <View style={styles.banner}>
              <Ionicons name="cloud-offline-outline" size={16} color="#8A5A00" />
              <Text style={styles.bannerText}>Offline – showing the last loaded orders.</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={44} color="#77716A" />
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptyText}>Your orders will show up here.</Text>
            <Pressable
              onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
              style={styles.primary}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>Start shopping</Text>
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

const OrderRow = React.memo(function OrderRow({ order, onPress }) {
  const items = Array.isArray(order.items) ? order.items : [];
  const count = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  const extra = items.length - 3;
  // Chỉ hiện nhãn thanh toán khi đơn thẻ cần chú ý (chờ trả tiền, đang xử lý, thất bại, đã hoàn tiền)
  const payment = paymentStatusMeta(order.paymentStatus);
  const showPayment =
    order.paymentMethod === 'card' &&
    ['requires_payment', 'processing', 'failed', 'refunded'].includes(order.paymentStatus);

  return (
    <Pressable
      onPress={() => onPress(order)}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`Order ${formatOrderCode(order.id)}`}
    >
      <View style={styles.cardTop}>
        <View>
          <Text style={styles.orderId}>{formatOrderCode(order.id)}</Text>
          <Text style={styles.date}>{formatOrderDate(order.createdAt)}</Text>
        </View>
        <OrderStatusBadge status={order.status} />
      </View>

      {showPayment && (
        <View style={[styles.payChip, { backgroundColor: payment.bg }]}>
          <Text style={[styles.payChipText, { color: payment.color }]}>{payment.label}</Text>
        </View>
      )}

      <View style={styles.thumbs}>
        {items.slice(0, 3).map((item) => (
          <View key={item.handbagId} style={styles.thumb}>
            <RemoteImage uri={item.uri} style={styles.thumbImage} />
          </View>
        ))}
        {extra > 0 && <Text style={styles.extra}>+{extra}</Text>}
      </View>

      <View style={styles.cardBottom}>
        <Text style={styles.count}>
          {count} {count === 1 ? 'item' : 'items'}
        </Text>
        <Text style={styles.total}>{formatPrice(order.total)}</Text>
      </View>
    </Pressable>
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
  payChip: { alignSelf: 'flex-start', paddingHorizontal: 10, height: 24, borderRadius: 12, justifyContent: 'center', marginTop: 10 },
  payChipText: { fontSize: 12, fontWeight: '700' },
  card: { padding: 16, marginBottom: 12, borderRadius: 24, backgroundColor: '#FFFFFF' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderId: { fontSize: 14, fontWeight: '800', letterSpacing: 0.3, color: '#0D0D0D' },
  date: { marginTop: 2, fontSize: 12, color: '#77716A' },
  thumbs: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  thumb: {
    width: 46,
    height: 58,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E7E3DF',
  },
  thumbImage: { width: '100%', height: '100%' },
  extra: { fontSize: 13, fontWeight: '700', color: '#77716A' },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  count: { fontSize: 13, color: '#77716A' },
  total: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, color: '#0D0D0D' },
});