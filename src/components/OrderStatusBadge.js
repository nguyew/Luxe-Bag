import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { statusMeta } from '../utils/orders';

/** Nhãn trạng thái đơn hàng (Pending, Confirmed, ...). */
export default function OrderStatusBadge({ status }) {
  const meta = statusMeta(status);
  return (
    <View style={[styles.badge, { backgroundColor: meta.bg }]}>
      <Ionicons name={meta.icon} size={13} color={meta.color} />
      <Text style={[styles.text, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
  },
  text: { fontSize: 12, fontWeight: '700' },
});
