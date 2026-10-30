import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { orderPaymentMeta } from '../utils/orders';

/**
 * Nhãn trạng thái thanh toán của một đơn (Admin): Awaiting payment, Processing payment,
 * Paid, Payment failed, Refunded, Pay on delivery...
 */
export default function PaymentStatusChip({ order }) {
  const meta = orderPaymentMeta(order);
  return (
    <View style={[styles.chip, { backgroundColor: meta.bg }]}>
      <Text style={[styles.text, { color: meta.color }]} numberOfLines={1}>
        {meta.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 10,
    height: 22,
    borderRadius: 11,
  },
  text: { fontSize: 11, fontWeight: '700' },
});