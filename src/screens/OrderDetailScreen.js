import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { cancelOrder, describeOrderError, getOrder } from '../services/orderService';
import { confirmAction, showMessage } from '../utils/confirm';
import { formatPrice, formatBrand } from '../utils/format';
import {
  RETURN_STATUS,
  canCancel,
  canRequestReturn,
  formatOrderCode,
  formatOrderDate,
  isPaymentPending,
  paymentLabel,
  paymentStatusMeta,
  returnDeadline,
} from '../utils/orders';

/** Chi tiết một đơn: trạng thái, sản phẩm, địa chỉ, thanh toán, nút hủy đơn. */
export default function OrderDetailScreen({ navigation, route }) {
  const { orderId, placed, paymentSubmitted } = route.params || {};
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
      // GET /api/orders/{id}: trạng thái thật (kể cả paymentStatus do webhook Stripe cập nhật)
      setOrder(await getOrder(orderId));
      setMissing(false);
    } catch (e) {
      if (e?.code === 'not_found') setMissing(true);
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

  // Đơn thẻ đang chờ Backend xác nhận thanh toán: tải lại định kỳ (tối đa ~1 phút)
  const waitingForPayment = isPaymentPending(order);
  useEffect(() => {
    if (!waitingForPayment) return undefined;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      refresh();
      if (tries >= 20) clearInterval(timer);
    }, 3000);
    return () => clearInterval(timer);
  }, [waitingForPayment, refresh]);

  const doCancel = useCallback(async () => {
    if (!userId || !order) return;
    setCancelling(true);
    try {
      const updated = await cancelOrder(userId, order.id);
      setOrder(updated);
      reload(); // tồn kho đã được hoàn lại
    } catch (e) {
      showMessage('Cancel order', describeOrderError(e));
      if (e?.code === 'not_cancellable') refresh(); // lấy trạng thái mới nhất
    } finally {
      setCancelling(false);
    }
  }, [userId, order, reload, refresh]);

  const confirmCancel = () => {
    confirmAction({
      title: 'Cancel this order?',
      message: 'This cannot be undone.',
      cancelText: 'Keep order',
      confirmText: 'Cancel order',
      destructive: true,
      onConfirm: doCancel,
    });
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
      {placed && order.paymentMethod === 'card' ? (
        <PaymentBanner order={order} submitted={!!paymentSubmitted} />
      ) : (
        placed && order.status === 'pending' && (
          <View style={styles.success}>
            <Ionicons name="checkmark-circle" size={22} color="#1F7A3E" />
            <Text style={styles.successText}>Thank you! Your order has been placed.</Text>
          </View>
        )
      )}

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
          <PaymentChip order={order} />
        </View>
        {order.paymentStatus === 'failed' && !!order.paymentFailureMessage && (
          <Text style={styles.payFailure}>{order.paymentFailureMessage}</Text>
        )}
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

      {order.status === 'pending' && order.paymentStatus === 'processing' && (
        <Text style={styles.payNote}>
          Your payment is being processed, so the order can’t be cancelled until it’s confirmed.
        </Text>
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

/** Nhãn trạng thái thanh toán (Awaiting payment / Processing / Paid / Failed / Refunded...). */
function PaymentChip({ order }) {
  const refundPending = order.paymentStatus === 'paid' && order.refundStatus === 'pending';
  const meta = refundPending
    ? { label: 'Refund pending', color: '#8A5A00', bg: '#FFF1D6' }
    : paymentStatusMeta(order.paymentStatus);
  return (
    <View style={[styles.chip, { backgroundColor: meta.bg }]}>
      <Text style={[styles.chipText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

/**
 * Thông báo sau khi thanh toán thẻ. "Paid" chỉ hiện khi Backend (webhook Stripe) đã xác nhận;
 * ngay sau khi PaymentSheet xong thì chỉ báo đang xác nhận.
 */
function PaymentBanner({ order, submitted }) {
  if (order.paymentStatus === 'paid') {
    return (
      <View style={styles.success}>
        <Ionicons name="checkmark-circle" size={22} color="#1F7A3E" />
        <Text style={styles.successText}>Payment confirmed. Thank you for your order!</Text>
      </View>
    );
  }
  if (order.paymentStatus === 'failed') {
    return (
      <View style={[styles.success, styles.bannerFail]}>
        <Ionicons name="close-circle" size={22} color="#B3261E" />
        <Text style={[styles.successText, styles.bannerFailText]}>
          {order.paymentFailureMessage || 'The payment was not completed.'} This order was
          cancelled — go back to your bag to try again.
        </Text>
      </View>
    );
  }
  if (isPaymentPending(order)) {
    return (
      <View style={[styles.success, styles.bannerWait]}>
        <ActivityIndicator size="small" color="#1F5FA8" />
        <Text style={[styles.successText, styles.bannerWaitText]}>
          {submitted
            ? 'Payment submitted. We’re confirming it with the bank — this usually takes a few seconds.'
            : 'Waiting for your payment to be confirmed.'}
        </Text>
      </View>
    );
  }
  return null;
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
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  headText: { flexShrink: 1 },
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
  chip: { paddingHorizontal: 10, height: 24, borderRadius: 12, justifyContent: 'center' },
  chipText: { fontSize: 12, fontWeight: '700' },
  payFailure: { marginTop: 8, fontSize: 12, lineHeight: 17, color: '#B3261E' },
  payNote: { marginTop: 12, fontSize: 12, lineHeight: 17, textAlign: 'center', color: '#77716A' },
  bannerFail: { backgroundColor: '#FBE3E1' },
  bannerFailText: { color: '#B3261E' },
  bannerWait: { backgroundColor: '#E1EDFB' },
  bannerWaitText: { color: '#1F5FA8' },
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