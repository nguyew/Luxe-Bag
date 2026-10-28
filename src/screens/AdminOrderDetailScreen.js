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
import TextPromptModal from '../components/TextPromptModal';
import useHandbags from '../hooks/useHandbags';
import { fetchAdminUsers, resolveReturn, updateOrderStatus } from '../services/adminService';
import { describeOrderError } from '../services/orderService';
import { formatBrand, formatPrice } from '../utils/format';
import {
  RETURN_STATUS,
  STATUS_ACTION_LABEL,
  formatOrderCode,
  formatOrderDate,
  nextStatuses,
  paymentLabel,
} from '../utils/orders';

/** Chi tiết một đơn cho admin: xem thông tin và chuyển trạng thái. */
export default function AdminOrderDetailScreen({ route }) {
  const { reload } = useHandbags();
  const [order, setOrder] = useState(route.params.order);
  const [busy, setBusy] = useState(null); // trạng thái đang chuyển tới
  const [returnBusy, setReturnBusy] = useState(null); // 'approve' | 'reject'
  const [rejectOpen, setRejectOpen] = useState(false);

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

  const resolve = useCallback(
    async (decision, options) => {
      setReturnBusy(decision);
      try {
        const updated = await resolveReturn(order.userId, order.id, decision, options);
        setOrder((current) => ({ ...current, ...updated }));
        if (decision === 'approve' && options?.restock) reload(); // kho đã được cộng lại
      } catch (error) {
        Alert.alert('Return', describeOrderError(error));
        if (error?.code === 'invalid_return') refreshOrder();
      } finally {
        setReturnBusy(null);
      }
    },
    [order.userId, order.id, reload, refreshOrder]
  );

  const confirmApprove = () => {
    Alert.alert(
      'Approve this return?',
      'The customer is refunded. Put the items back into stock only if they can be sold again.',
      [
        { text: 'Back', style: 'cancel' },
        { text: 'Approve, don’t restock', onPress: () => resolve('approve', { restock: false }) },
        { text: 'Approve & restock', onPress: () => resolve('approve', { restock: true }) },
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
          <View style={styles.headText}>
            <Text style={styles.orderId} numberOfLines={1}>{formatOrderCode(order.id)}</Text>
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
                onPress={() => change(next)}
                disabled={busy !== null}
                style={[
                  styles.action,
                  cancel ? styles.actionCancel : styles.actionPrimary,
                  busy !== null && styles.actionBusy,
                ]}
                accessibilityRole="button"
                accessibilityLabel={STATUS_ACTION_LABEL[next]}
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

      {!!order.returnRequest && (
        <>
          <Text style={styles.section}>Return request</Text>
          <View style={styles.card}>
            <View
              style={[
                styles.returnBadge,
                { backgroundColor: (RETURN_STATUS[order.returnRequest.status] || RETURN_STATUS.requested).bg },
              ]}
            >
              <Text
                style={[
                  styles.returnBadgeText,
                  { color: (RETURN_STATUS[order.returnRequest.status] || RETURN_STATUS.requested).color },
                ]}
              >
                {(RETURN_STATUS[order.returnRequest.status] || RETURN_STATUS.requested).label}
              </Text>
            </View>
            <Text style={styles.strong}>{order.returnRequest.reason}</Text>
            {!!order.returnRequest.note && <Text style={styles.line}>{order.returnRequest.note}</Text>}
            {!!order.returnRequest.requestedAt && (
              <Text style={styles.returnMeta}>
                Requested {formatOrderDate(order.returnRequest.requestedAt)}
              </Text>
            )}
            {order.returnRequest.status === 'approved' && (
              <Text style={styles.returnMeta}>
                Refunded{order.returnRequest.restocked ? ' · items returned to stock' : ' · items not restocked'}
              </Text>
            )}
            {order.returnRequest.status === 'rejected' && !!order.returnRequest.adminNote && (
              <Text style={styles.returnMeta}>Note to customer: {order.returnRequest.adminNote}</Text>
            )}

            {order.returnRequest.status === 'requested' && (
              <View style={styles.returnActions}>
                <Pressable
                  onPress={confirmApprove}
                  disabled={returnBusy !== null}
                  style={[styles.action, styles.actionPrimary, returnBusy !== null && styles.actionBusy]}
                  accessibilityRole="button"
                >
                  {returnBusy === 'approve' ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.actionText}>Approve & refund</Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => setRejectOpen(true)}
                  disabled={returnBusy !== null}
                  style={[styles.action, styles.actionCancel, returnBusy !== null && styles.actionBusy]}
                  accessibilityRole="button"
                >
                  {returnBusy === 'reject' ? (
                    <ActivityIndicator color="#B3261E" />
                  ) : (
                    <Text style={[styles.actionText, styles.actionTextCancel]}>Reject</Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </>
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
              {!!item.brand && <Text style={styles.brand}>{formatBrand(item.brand)}</Text>}
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
        {order.discount > 0 && (
          <View style={styles.payRow}>
            <Text style={styles.muted}>
              Discount{order.couponCode ? ` (${order.couponCode})` : ''}
            </Text>
            <Text style={[styles.value, styles.discountValue]}>-{formatPrice(order.discount)}</Text>
          </View>
        )}
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

      <TextPromptModal
        visible={rejectOpen}
        title="Reject return"
        message="Tell the customer why (optional)."
        placeholder="e.g. The item shows signs of use"
        confirmLabel="Reject"
        multiline
        maxLength={300}
        onSubmit={(note) => {
          setRejectOpen(false);
          resolve('reject', { note });
        }}
        onCancel={() => setRejectOpen(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  discountValue: { color: '#1F7A3E' },
  returnBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    marginBottom: 10,
  },
  returnBadgeText: { fontSize: 12, fontWeight: '700' },
  returnMeta: { marginTop: 8, fontSize: 12, lineHeight: 17, color: '#77716A' },
  returnActions: { gap: 10, marginTop: 16 },
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
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  headText: { flexShrink: 1 },
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