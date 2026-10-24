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
import { SafeAreaView } from 'react-native-safe-area-context';
import AdminHeader from '../components/AdminHeader';
import FilterChips from '../components/FilterChips';
import OrderStatusBadge from '../components/OrderStatusBadge';
import SearchBox from '../components/SearchBox';
import useAdminUsers from '../hooks/useAdminUsers';
import { flattenOrders, orderCountsByStatus } from '../utils/admin';
import { formatPrice } from '../utils/format';
import { ORDER_STATUS, formatOrderDate } from '../utils/orders';

/** Tất cả đơn hàng của mọi khách: tìm theo mã/khách, lọc theo trạng thái. */
export default function AdminOrdersScreen({ navigation }) {
  const { users, loading, error, reload } = useAdminUsers();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [pulling, setPulling] = useState(false);

  const orders = useMemo(() => (users ? flattenOrders(users) : []), [users]);
  const counts = useMemo(() => orderCountsByStatus(orders), [orders]);

  const options = useMemo(
    () => [
      { key: 'all', label: 'All', count: counts.all },
      ...Object.keys(ORDER_STATUS).map((key) => ({
        key,
        label: ORDER_STATUS[key].label,
        count: counts[key] || 0,
      })),
    ],
    [counts]
  );

  const data = useMemo(() => {
    const text = query.trim().toLowerCase();
    return orders
      .filter((order) => filter === 'all' || order.status === filter)
      .filter(
        (order) =>
          !text ||
          String(order.id).toLowerCase().includes(text) ||
          String(order.customerName || '').toLowerCase().includes(text) ||
          String(order.customerEmail || '').toLowerCase().includes(text)
      );
  }, [orders, filter, query]);

  const open = useCallback(
    (order) => navigation.navigate('AdminOrderDetail', { order }),
    [navigation]
  );

  const onRefresh = useCallback(async () => {
    setPulling(true);
    await reload();
    setPulling(false);
  }, [reload]);

  const renderItem = useCallback(({ item }) => <OrderRow order={item} onPress={open} />, [open]);

  const empty = loading ? (
    <View style={styles.center}>
      <ActivityIndicator color="#292725" />
    </View>
  ) : error && !users ? (
    <View style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={44} color="#77716A" />
      <Text style={styles.emptyTitle}>Couldn’t load orders</Text>
      <Pressable onPress={reload} style={styles.retry} accessibilityRole="button">
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  ) : (
    <View style={styles.center}>
      <Ionicons name="receipt-outline" size={44} color="#77716A" />
      <Text style={styles.emptyTitle}>No orders found</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F1F1" />

      <AdminHeader
        title="Orders"
        subtitle={`${counts.pending || 0} waiting for confirmation`}
      />
      <SearchBox value={query} onChangeText={setQuery} placeholder="Search order ID or customer" />
      <FilterChips options={options} value={filter} onChange={setFilter} />

      <FlatList
        data={data}
        keyExtractor={(item) => `${item.userId}-${item.id}`}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        windowSize={7}
        ListEmptyComponent={empty}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={onRefresh} />}
      />
    </SafeAreaView>
  );
}

const OrderRow = React.memo(function OrderRow({ order, onPress }) {
  const count = (Array.isArray(order.items) ? order.items : []).reduce(
    (sum, item) => sum + (Number(item.qty) || 0),
    0
  );

  return (
    <Pressable
      onPress={() => onPress(order)}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.id} from ${order.customerName}`}
    >
      <View style={styles.top}>
        <View style={styles.topText}>
          <Text style={styles.orderId}>{order.id}</Text>
          <Text style={styles.customer} numberOfLines={1}>
            {order.customerName} · {formatOrderDate(order.createdAt)}
          </Text>
        </View>
        <OrderStatusBadge status={order.status} />
      </View>
      <View style={styles.bottom}>
        <Text style={styles.count}>
          {count} {count === 1 ? 'item' : 'items'} ·{' '}
          {order.paymentStatus === 'paid' ? 'Paid' : order.paymentStatus === 'refunded' ? 'Refunded' : 'Pay on delivery'}
        </Text>
        <Text style={styles.total}>{formatPrice(order.total)}</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F1F1' },
  list: { paddingHorizontal: 20, paddingBottom: 32, flexGrow: 1 },
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
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  topText: { flex: 1 },
  orderId: { fontSize: 14, fontWeight: '800', letterSpacing: 0.3, color: '#0D0D0D' },
  customer: { marginTop: 2, fontSize: 12, color: '#77716A' },
  bottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  count: { fontSize: 12, color: '#77716A' },
  total: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: '#0D0D0D' },
});
