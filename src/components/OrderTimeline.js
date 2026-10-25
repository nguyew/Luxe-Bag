import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ORDER_FLOW, formatOrderDate } from '../utils/orders';

/**
 * Tiến trình đơn hàng: Pending -> Confirmed -> Shipping -> Delivered
 * (đơn đã hủy hiện khung đỏ). Dùng cho cả khách hàng và admin.
 */
export default function OrderTimeline({ order }) {
  const history = Array.isArray(order.history) ? order.history : [];

  if (order.status === 'cancelled') {
    return (
      <View style={styles.cancelledBox}>
        <Ionicons name="close-circle-outline" size={18} color="#B3261E" />
        <Text style={styles.cancelledText}>
          Cancelled{order.cancelledAt ? ` on ${formatOrderDate(order.cancelledAt)}` : ''}
        </Text>
      </View>
    );
  }

  if (order.status === 'returned') {
    return (
      <View style={styles.returnedBox}>
        <Ionicons name="return-up-back-outline" size={18} color="#55514C" />
        <Text style={styles.returnedText}>
          Returned and refunded{order.returnedAt ? ` on ${formatOrderDate(order.returnedAt)}` : ''}
        </Text>
      </View>
    );
  }

  const current = ORDER_FLOW.indexOf(order.status);
  return (
    <View style={styles.timeline}>
      {ORDER_FLOW.map((step, index) => {
        const done = index <= current;
        const at = history.find((entry) => entry.status === step)?.at;
        return (
          <View key={step} style={styles.step}>
            <View style={styles.dotCol}>
              <View style={[styles.dot, done && styles.dotDone]}>
                {done && <Ionicons name="checkmark" size={11} color="#FFFFFF" />}
              </View>
              {index < ORDER_FLOW.length - 1 && (
                <View style={[styles.stem, index < current && styles.stemDone]} />
              )}
            </View>
            <View style={styles.stepText}>
              <Text style={[styles.stepLabel, !done && styles.stepPending]}>
                {step.charAt(0).toUpperCase() + step.slice(1)}
              </Text>
              {!!at && <Text style={styles.stepDate}>{formatOrderDate(at)}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  returnedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: '#E7E3DF',
  },
  returnedText: { fontSize: 13, fontWeight: '600', color: '#55514C' },
  timeline: { marginTop: 18 },
  step: { flexDirection: 'row', gap: 12 },
  dotCol: { alignItems: 'center', width: 20 },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E7E3DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: '#1F7A3E' },
  stem: { width: 2, flex: 1, minHeight: 20, backgroundColor: '#E7E3DF' },
  stemDone: { backgroundColor: '#1F7A3E' },
  stepText: { flex: 1, paddingBottom: 14 },
  stepLabel: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  stepPending: { color: '#B9B2AA', fontWeight: '600' },
  stepDate: { marginTop: 1, fontSize: 12, color: '#77716A' },
  cancelledBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: '#FBE3E1',
  },
  cancelledText: { fontSize: 13, fontWeight: '600', color: '#B3261E' },
});
