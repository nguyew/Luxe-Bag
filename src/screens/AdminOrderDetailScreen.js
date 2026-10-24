import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import OrderStatusBadge from '../components/OrderStatusBadge';
import OrderTimeline from '../components/OrderTimeline';
import RemoteImage from '../components/RemoteImage';
import useHandbags from '../hooks/useHandbags';
import { fetchAdminUsers, updateOrderStatus } from '../services/adminService';
import { describeOrderError } from '../services/orderService';
import { formatPrice } from '../utils/format';
import {
  STATUS_ACTION_LABEL,
  formatOrderDate,
  nextStatuses,
  paymentLabel,
} from '../utils/orders';

/** Chi tiết một đơn cho admin: xem thông tin và chuyển trạng thái. */
export default function AdminOrderDetailScreen({ route }) {
  const { reload } = useHandbags();
  const [order, setOrder] = useState(route.params.order);
  const [busy, setBusy] = useState(null); // trạng thái đang chuyển tới

  const items = Array.isArray(order.items) ? order.items : [];
  const actions = nextStatuses(order.status);

  // Lấy bản mới nhất khi đơn đã bị thay đổi ở nơi khác (khách hủy, admin khác xử lý)
  const refreshOrder = useCallback(async () => {
    try {
      const users = await fetchAdminUsers({ force: true });
      const owner = users.find((user) => user.id === order.userId);
      const found = owner?.orders.find((item) => item.id === order.id);
      if (found) setOrder((current) => ({ ...current, ...found }));
    } catch {
      // mất mạng: giữ bản đang hiển thị
    }
  }, [order.userId, order.id]);

  const change = useCallback(
    async (nextStatus) => {
      setBusy(nextStatus);
      try {
        const updated = await updateOrderStatus(order.userId, order.id, nextStatus);
        setOrder((current) => ({ ...current, ...updated }));
        if (nextStatus === 'cancelled') reload(); // tồn kho đã được hoàn lại
      } catch (error) {
        Alert.alert('Order', describeOrderError(error));
        if (error?.code === 'invalid_transition') refreshOrder();
      } finally {
        setBusy(null);
      }
    },
    [order.userId, order.id, reload, refreshOrder]
  );

  const confirmChange = (nextStatus) => {
    const cancelling = nextStatus === 'cancelled';
    Alert.alert(
      `${STATUS_ACTION_LABEL[nextStatus]}?`,
      cancelling
        ? 'The customer will see the order as cancelled and the items go back into stock.'
        : `The customer will see this order as ${nextStatus}.`,
      [
        { text: 'Back', style: 'cancel' },
        {
          text: STATUS_ACTION_LABEL[nextStatus],
          style: cancelling ? 'destructive' : 'default',
          onPress: () => change(nextStatus),
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <View style={styles.headRow}>
          <View>
            <Text style={styles.orderId}>{order.id}</Text>
            <Text style={styles.date}>{formatOrderDate(order.createdAt)}</Text>
          </View>
          <OrderStatusBadge status={order.status} />
        </View>
        <OrderTimeline order={order} />
      </View>

      {actions.length > 0 && (
        <View style={styles.actions}>
          {actions.map((next) => {
            const cancel = next === 'cancelled';
            return (
              <Pressable
                key={next}
                onPress={() => confirmChange(next)}
                disabled={busy !== null}
                style={[
                  styles.action,
                  cancel ? styles.actionCancel : styles.actionPrimary,
                  busy !== null && styles.actionBusy,
                ]}
                accessibilityRole="button"
              >
                {busy === next ? (
                  <ActivityIndicator color={cancel ? '#B3261E' : '#FFFFFF'} />
                ) : (
                  <Text style={[styles.actionText, cancel && styles.actionTextCancel]}>
                    {STATUS_ACTION_LABEL[next]}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      <Text style={styles.section}>Customer</Text>
      <View style={styles.card}>
        <Text style={styles.strong}>{order.customerName}</Text>
        <Text style={styles.line}>{order.customerEmail}</Text>
      </View>

      <Text style={styles.section}>Items</Text>
      <View style={styles.card}>
        {items.map((item, index) => (
          <View
            key={item.handbagId}
            style={[styles.itemRow, index < items.length - 1 && styles.itemDivider]}
          >
            <View style={styles.thumb}>
              <RemoteImage uri={item.uri} style={styles.thumbImage} />
            </View>
            <View style={styles.itemBody}>
              {!!item.brand && <Text style={styles.brand}>{item.brand}</Text>}
              <Text style={styles.itemName} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.itemQty}>
                {item.qty} × {formatPrice(item.unitPrice)}
              </Text>
            </View>
            <Text style={styles.itemTotal}>{formatPrice(item.unitPrice * item.qty)}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.section}>Delivery</Text>
      <View style={styles.card}>
        <Text style={styles.strong}>{order.address?.fullName}</Text>
        <Text style={styles.line}>{order.address?.phone}</Text>
        <Text style={styles.line}>
          {order.address?.line1}, {order.address?.city}
        </Text>
      </View>

      <Text style={styles.section}>Payment</Text>
      <View style={styles.card}>
        <View style={styles.payRow}>
          <Text style={styles.line}>{paymentLabel(order.paymentMethod)}</Text>
          <Text style={styles.payStatus}>
            {order.paymentStatus === 'paid'
              ? 'Paid'
              : order.paymentStatus === 'refunded'
              ? 'Refunded'
              : 'Unpaid'}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.payRow}>
          <Text style={styles.muted}>Subtotal</Text>
          <Text style={styles.value}>{formatPrice(order.subtotal)}</Text>
        </View>
        <View style={styles.payRow}>
          <Text style={styles.muted}>Shipping</Text>
          <Text style={styles.value}>
            {order.shipping === 0 ? 'Free' : formatPrice(order.shipping)}
          </Text>
        </View>
        <View style={styles.payRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatPrice(order.total)}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F1F1' },
  content: { padding: 16, paddingBottom: 48 },
  section: {
    marginTop: 18,
    marginBottom: 10,
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#77716A',
  },
  card: { padding: 16, borderRadius: 24, backgroundColor: '#FFFFFF' },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderId: { fontSize: 16, fontWeight: '800', letterSpacing: 0.3, color: '#0D0D0D' },
  date: { marginTop: 2, fontSize: 12, color: '#77716A' },

  actions: { gap: 10, marginTop: 14 },
  action: {
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimary: { backgroundColor: '#050505' },
  actionCancel: { backgroundColor: '#FBE3E1' },
  actionBusy: { opacity: 0.7 },
  actionText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  actionTextCancel: { color: '#B3261E' },

  strong: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  line: { marginTop: 2, fontSize: 13, lineHeight: 18, color: '#55514C' },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  itemDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E4DFDA' },
  thumb: {
    width: 52,
    height: 66,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E7E3DF',
  },
  thumbImage: { width: '100%', height: '100%' },
  itemBody: { flex: 1 },
  brand: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#77716A',
  },
  itemName: { marginTop: 1, fontSize: 13, lineHeight: 18, fontWeight: '600', color: '#1A1A1A' },
  itemQty: { marginTop: 3, fontSize: 12, color: '#77716A' },
  itemTotal: { fontSize: 14, fontWeight: '800', color: '#0D0D0D' },

  payRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  payStatus: { fontSize: 12, fontWeight: '700', color: '#1F7A3E' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 10, backgroundColor: '#D8D2CC' },
  muted: { fontSize: 13, color: '#77716A' },
  value: { fontSize: 13, fontWeight: '600', color: '#1A1A1A' },
  totalLabel: { fontSize: 15, fontWeight: '700', color: '#0D0D0D' },
  totalValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5, color: '#0D0D0D' },
});
