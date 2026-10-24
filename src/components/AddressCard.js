import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Thẻ địa chỉ giao hàng. Dùng ở màn quản lý địa chỉ và ở bước chọn địa chỉ khi checkout.
 *  - onPress + selected: chế độ chọn (radio)
 *  - children: các nút hành động (Edit, Delete...) hiện dưới thẻ
 */
export default function AddressCard({ address, selected, onPress, children }) {
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      style={[styles.card, selected && styles.cardSelected]}
      accessibilityRole={onPress ? 'radio' : undefined}
      accessibilityState={onPress ? { selected: !!selected } : undefined}
    >
      <View style={styles.top}>
        <View style={styles.labelPill}>
          <Text style={styles.labelText}>{address.label}</Text>
        </View>
        {address.isDefault && <Text style={styles.default}>Default</Text>}
        {onPress && (
          <Ionicons
            name={selected ? 'radio-button-on' : 'radio-button-off'}
            size={22}
            color={selected ? '#050505' : '#B9B2AA'}
            style={styles.radio}
          />
        )}
      </View>

      <Text style={styles.name}>{address.fullName}</Text>
      <Text style={styles.line}>{address.phone}</Text>
      <Text style={styles.line}>
        {address.line1}, {address.city}
      </Text>

      {children}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardSelected: { borderColor: '#050505' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  labelPill: {
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F1F1',
    justifyContent: 'center',
  },
  labelText: { fontSize: 12, fontWeight: '700', color: '#1A1A1A' },
  default: { fontSize: 12, fontWeight: '700', color: '#1F7A3E' },
  radio: { marginLeft: 'auto' },
  name: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  line: { marginTop: 2, fontSize: 13, lineHeight: 18, color: '#55514C' },
});
