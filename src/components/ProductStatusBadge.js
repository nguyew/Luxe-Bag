import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export const PRODUCT_STATUS = {
  published: { label: 'Published', color: '#1F7A3E', bg: '#DFF3E5' },
  draft: { label: 'Draft', color: '#8A5A00', bg: '#FFF1D6' },
  archived: { label: 'Archived', color: '#55514C', bg: '#E7E3DF' },
};

/** Nhãn trạng thái xuất bản của sản phẩm (thiếu status = Published). */
export default function ProductStatusBadge({ status }) {
  const meta = PRODUCT_STATUS[status] || PRODUCT_STATUS.published;
  return (
    <View style={[styles.badge, { backgroundColor: meta.bg }]}>
      <Text style={[styles.text, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
  },
  text: { fontSize: 11, fontWeight: '700' },
});
