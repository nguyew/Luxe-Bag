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
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import OrderStatusBadge from '../components/OrderStatusBadge';
import OrderTimeline from '../components/OrderTimeline';
import RemoteImage from '../components/RemoteImage';
import useAuth from '../hooks/useAuth';
import useHandbags from '../hooks/useHandbags';
import { cancelOrder, describeOrderError, getMyOrders } from '../services/orderService';
import { formatPrice } from '../utils/format';
import {
  RETURN_STATUS,
  canCancel,
  canRequestReturn,
  formatOrderDate,
  paymentLabel,
  returnDeadline,
} from '../utils/orders';

/** Chi tiết một đơn: trạng thái, sản phẩm, địa chỉ, thanh toán, nút hủy đơn. */
export default function OrderDetailScreen({ navigation, route }) {
  const { orderId, placed } = route.params || {};
  const { user } = useAuth();
  const { reload } = useHandbags();

  // Đơn truyền qua route hiện ngay; bản mới nhất từ API sẽ thay thế khi tải xong
  const [order, setOrder] = useState(route.params?.order || null);
  const [loading, setLoading] = useState(!route.params?.order);
  const [missing, setMissing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const userId = user?.id;

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const list = await getMyOrders(userId);
      const found = list.find((item) => item.id === orderId);
      if (found) setOrder(found);
      else setMissing(true);
    } catch {
      // mất mạng: giữ bản đang hiển thị
    } finally {
      setLoading(false);
    }
  }, [userId, orderId]);

  // Tải lại mỗi lần màn hình được focus (ví dụ vừa gửi yêu cầu trả hàng, hoặc cửa hàng vừa xử lý)
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const doCancel = useCallback(async () => {
    if (!userId || !order) return;
    setCancelling(true);
    try {
      const updated = await cancelOrder(userId, order.id);
      setOrder(updated);
      reload(); // tồn kho đã được hoàn lại
    } catch (e) {
      Alert.alert('Cancel order', describeOrderError(e));
      if (e?.code === 'not_cancellable') refresh(); // lấy trạng thái mới nhất
    } finally {
      setCancelling(false);
    }
  }, [userId, order, reload, refresh]);

  const confirmCancel = () => {
    Alert.alert('Cancel this order?', 'This cannot be undone.', [
      { text: 'Keep order', style: 'cancel' },
      { text: 'Cancel order', style: 'destructive', onPress: doCancel },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color="#292725" />
      </View>
    );
  }

  if (!order || missing) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Ionicons name="receipt-outline" size={44} color="#77716A" />
        <Text style={styles.emptyTitle}>Order not found</Text>
      </View>
    );
  }

  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {placed && order.status === 'pending' && (
        <View style={styles.success}>
          <Ionicons name="checkmark-circle" size={22} color="#1F7A3E" />
          <Text style={styles.successText}>Thank you! Your order has been placed.</Text>
        </View>
      )}

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
          <Text style={styles.payStatus}>{paymentStatusText(order.paymentStatus)}</Text>
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

      {/* Trả hàng */}
      {!!order.returnRequest && (
        <>
          <Text style={styles.section}>Return</Text>
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
            <Text style={styles.returnReason}>{order.returnRequest.reason}</Text>
            {!!order.returnRequest.note && <Text style={styles.line}>{order.returnRequest.note}</Text>}
            {order.returnRequest.status === 'approved' && (
              <Text style={styles.line}>Your refund has been approved.</Text>
            )}
            {order.returnRequest.status === 'rejected' && !!order.returnRequest.adminNote && (
              <Text style={styles.rejectNote}>Store note: {order.returnRequest.adminNote}</Text>
            )}
          </View>
        </>
      )}

      {canRequestReturn(order) && (
        <>
          <Pressable
            onPress={() => navigation.navigate('ReturnRequest', { order })}
            style={styles.returnButton}
            accessibilityRole="button"
          >
            <Ionicons name="return-up-back-outline" size={18} color="#1A1A1A" />
            <Text style={styles.returnButtonText}>Request a return</Text>
          </Pressable>
          {returnDeadline(order) !== null && (
            <Text style={styles.returnHint}>
              Available until {formatOrderDate(new Date(returnDeadline(order)).toISOString())}
            </Text>
          )}
        </>
      )}

      {canCancel(order) && (
        <Pressable
          onPress={confirmCancel}
          disabled={cancelling}
          style={[styles.cancel, cancelling && styles.cancelBusy]}
          accessibilityRole="button"
        >
          {cancelling ? (
            <ActivityIndicator color="#B3261E" />
          ) : (
            <Text style={styles.cancelText}>Cancel order</Text>
          )}
        </Pressable>
      )}
    </ScrollView>
  );
}

function paymentStatusText(status) {
  if (status === 'paid') return 'Paid';
  if (status === 'refunded') return 'Refunded';
  return 'Pay on delivery';
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
  returnReason: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  rejectNote: { marginTop: 8, fontSize: 13, lineHeight: 18, color: '#B3261E' },
  returnButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    marginTop: 24,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
  },
  returnButtonText: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  returnHint: { marginTop: 8, textAlign: 'center', fontSize: 12, color: '#77716A' },
  screen: { flex: 1, backgroundColor: '#F3F1F1' },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 48 },
  emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: '800', color: '#0D0D0D' },
  success: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    marginBottom: 12,
    borderRadius: 18,
    backgroundColor: '#DFF3E5',
  },
  successText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1F7A3E' },
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

  strong: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  line: { marginTop: 2, fontSize: 13, lineHeight: 18, color: '#55514C' },
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

  cancel: {
    height: 50,
    marginTop: 24,
    borderRadius: 25,
    backgroundColor: '#FBE3E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBusy: { opacity: 0.7 },
  cancelText: { fontSize: 15, fontWeight: '700', color: '#B3261E' },
});
